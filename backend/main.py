"""
CodeBabel Pro — Backend
========================
FastAPI + WebSockets + Gemini + javac validation loop
"""

import asyncio
import json
import os
import re
import subprocess
import tempfile
import time
from typing import Optional

import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CodeBabel Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CONSTANTS ──────────────────────────────────────────────────────────────

SUPPORTED_LANGUAGES = [
    "Python", "Java", "JavaScript", "TypeScript",
    "C", "C++", "C#", "Go", "Rust", "COBOL",
    "Kotlin", "Swift", "Ruby", "PHP",
]

JAVA_FLAVORS = {
    "standard":    "Standard Java 17. Use clean OOP, Javadoc comments, and standard library only.",
    "springboot":  "Spring Boot 3.x style. Use @RestController, @Service, @Repository annotations, constructor injection, and application.properties config where relevant.",
    "android":     "Android (Java/Kotlin-compatible). Use Android SDK idioms, Context-aware patterns, and lifecycle-safe code.",
}

MAX_RETRIES = 3


# ── PROMPT BUILDER ──────────────────────────────────────────────────────────

def build_system_prompt(flavor: str) -> str:
    flavor_instruction = JAVA_FLAVORS.get(flavor, JAVA_FLAVORS["standard"])
    return f"""You are an expert code migration engineer specializing in translating legacy and modern code to Java.
Style guide: {flavor_instruction}

CRITICAL: You must respond ONLY with a valid JSON object. No markdown, no backticks, no preamble.

The JSON schema is:
{{
  "class_name": "<A valid Java class name, PascalCase, derived from the logic>",
  "translated_code": "<Complete, compilable Java code. Escape all quotes and newlines properly.>",
  "explanation": "<3-5 bullet points (use \\n• prefix for each) explaining key translation decisions>",
  "potential_risks": "<2-3 bullet points (use \\n⚠ prefix) about edge cases or migration risks>",
  "unit_tests": "<A complete JUnit 5 test class as a string, ready to paste into an IDE>",
  "entity_map": [
    {{"source_name": "<original var/fn name>", "java_name": "<java equivalent>", "description": "<what it does>"}}
  ],
  "complexity": {{
    "cyclomatic": <integer>,
    "maintainability_index": <integer 0-100>,
    "estimated_memory_kb": <integer>
  }}
}}"""


def build_translation_prompt(source_code: str, source_lang: str, flavor: str) -> str:
    return f"""Translate the following {source_lang} code to Java.

Source ({source_lang}):
```
{source_code}
```

Respond ONLY with the JSON object as described. No markdown fences."""


def build_fix_prompt(source_code: str, source_lang: str, previous_java: str, error_log: str, flavor: str) -> str:
    return f"""The Java code you generated failed to compile. Fix it.

Original {source_lang} source:
```
{source_code}
```

Your previous Java output that FAILED:
```java
{previous_java}
```

Compiler error log:
```
{error_log}
```

Fix all compiler errors. Preserve the original logic exactly.
Respond ONLY with the corrected JSON object. No markdown fences."""


# ── JAVAC VALIDATOR ─────────────────────────────────────────────────────────

def run_javac(java_code: str, class_name: str) -> tuple[bool, str]:
    """
    Write java_code to a temp file named <class_name>.java and compile it.
    Returns (success: bool, output: str).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        filename = os.path.join(tmpdir, f"{class_name}.java")
        with open(filename, "w") as f:
            f.write(java_code)
        try:
            result = subprocess.run(
                ["javac", filename],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                return True, "Compilation successful"
            else:
                err = result.stderr or result.stdout or "Unknown compiler error"
                # Strip full temp path from error messages for cleaner display
                err = err.replace(filename, f"{class_name}.java")
                return False, err
        except FileNotFoundError:
            return False, "javac not found. Ensure JDK is installed and in PATH."
        except subprocess.TimeoutExpired:
            return False, "javac timed out after 30 seconds."


# ── PARSE LLM RESPONSE ──────────────────────────────────────────────────────

def parse_llm_json(raw: str) -> dict:
    """Extract and parse JSON from LLM response, stripping any markdown fences."""
    # Strip ```json ... ``` fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    cleaned = cleaned.strip()
    return json.loads(cleaned)


# ── WEBSOCKET ENDPOINT ───────────────────────────────────────────────────────

@app.websocket("/ws/translate")
async def translate_ws(websocket: WebSocket):
    await websocket.accept()

    async def send(event: str, data: dict):
        """Send a structured event message over the WebSocket."""
        await websocket.send_text(json.dumps({"event": event, **data}))

    async def log(level: str, message: str):
        """Send a terminal log line."""
        await send("log", {"level": level, "message": message, "ts": time.time()})

    try:
        # ── 1. Receive request ──────────────────────────────────────────────
        raw = await websocket.receive_text()
        req = json.loads(raw)

        api_key      = req.get("api_key", "").strip()
        source_code  = req.get("source_code", "").strip()
        source_lang  = req.get("source_language", "Python")
        flavor       = req.get("flavor", "standard")

        if not api_key:
            await send("error", {"message": "Gemini API key is required."})
            return
        if not source_code:
            await send("error", {"message": "Source code cannot be empty."})
            return

        await log("system", f"Request received — {source_lang} → Java [{flavor}]")

        # ── 2. Configure Gemini ────────────────────────────────────────────
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=build_system_prompt(flavor),
        )

        await log("system", "Gemini model initialised")

        # ── 3. Initial translation ─────────────────────────────────────────
        await log("system", f"Sending {source_lang} code to Gemini for translation...")
        prompt = build_translation_prompt(source_code, source_lang, flavor)

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: model.generate_content(prompt)
        )
        raw_text = response.text
        await log("system", "Response received from Gemini — parsing JSON...")

        # ── 4. Validation loop ─────────────────────────────────────────────
        parsed    = None
        java_code = None
        class_name = "TranslatedCode"

        for attempt in range(1, MAX_RETRIES + 1):
            # Parse JSON
            try:
                if attempt == 1:
                    parsed = parse_llm_json(raw_text)
                # (on retries raw_text is already updated below)
            except json.JSONDecodeError as e:
                await log("error", f"JSON parse failed on attempt {attempt}: {e}")
                await send("error", {"message": f"LLM returned invalid JSON: {e}"})
                return

            java_code  = parsed.get("translated_code", "")
            class_name = parsed.get("class_name", "TranslatedCode")

            await log("system", f"Extracted class: {class_name} — running javac (attempt {attempt}/{MAX_RETRIES})...")
            await send("compile_attempt", {"attempt": attempt})

            # Run javac in executor (blocking I/O)
            success, compiler_output = await loop.run_in_executor(
                None, lambda: run_javac(java_code, class_name)
            )

            if success:
                await log("success", f"javac passed on attempt {attempt} ✓")
                break
            else:
                await log("error", f"javac failed — {compiler_output.splitlines()[0]}")
                await send("compile_error", {"attempt": attempt, "error": compiler_output})

                if attempt == MAX_RETRIES:
                    await log("error", f"Max retries ({MAX_RETRIES}) reached. Sending best effort result.")
                    break

                # Ask Gemini to fix
                await log("system", f"Sending error log back to Gemini for fix (attempt {attempt + 1})...")
                fix_prompt = build_fix_prompt(source_code, source_lang, java_code, compiler_output, flavor)
                fix_response = await loop.run_in_executor(
                    None, lambda: model.generate_content(fix_prompt)
                )
                raw_text = fix_response.text
                try:
                    parsed = parse_llm_json(raw_text)
                except json.JSONDecodeError as e:
                    await log("error", f"JSON parse failed on fix attempt {attempt + 1}: {e}")
                    break

        # ── 5. Send final result ───────────────────────────────────────────
        await log("system", "Preparing result payload...")
        await send("result", {
            "translated_code": java_code,
            "class_name":      class_name,
            "explanation":     parsed.get("explanation", ""),
            "potential_risks": parsed.get("potential_risks", ""),
            "unit_tests":      parsed.get("unit_tests", ""),
            "entity_map":      parsed.get("entity_map", []),
            "complexity":      parsed.get("complexity", {}),
            "compile_passed":  success,
        })
        await log("system", "Done ✓")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await send("error", {"message": str(e)})
        except Exception:
            pass


# ── REST ENDPOINTS ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "CodeBabel Pro API running", "version": "2.0"}

@app.get("/languages")
def get_languages():
    return {"languages": SUPPORTED_LANGUAGES}

@app.get("/flavors")
def get_flavors():
    return {"flavors": list(JAVA_FLAVORS.keys())}
