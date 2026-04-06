# 🔄 CodeBabel Pro — AI Code Migration Agent

<div align="center">

![CodeBabel Pro](https://img.shields.io/badge/CodeBabel-Pro-00d4ff?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik04IDNMNCAyMGgxNmwtNC0xNyIvPjwvc3ZnPg==)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=for-the-badge&logo=google)
![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-39d353?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)

**An enterprise-grade AI agent that translates legacy code (COBOL, Python, JS, and 11 more) to Java — with a self-healing javac validation loop, real-time agent terminal, and professional code analysis tools.**

[🚀 Live Demo](https://codebabel-pro.vercel.app/) · [📖 Documentation](#how-it-works) · [🐛 Report Bug](https://github.com/Gouri257/codebabel-pro/issues)

![CodeBabel Pro Demo](https://raw.githubusercontent.com/Gouri257/codebabel-pro/main/assets/demo.png)

</div>

---

## 🎯 Why This Project Exists

Enterprise companies — especially in **banking, insurance, and government** — run billions of lines of **COBOL** written in the 1970s-80s. Migrating this legacy code to modern Java is one of the most expensive and error-prone challenges in the industry.

IBM, Accenture, and other consulting firms charge millions of dollars for this migration work. **CodeBabel Pro** demonstrates how a GenAI agent can automate this — with a self-healing loop that validates the generated code actually compiles before showing it to the user.

---

## ✨ Features

### 🤖 AI Agent Backend
- **Self-Healing javac Validation Loop** — Generated Java is automatically compiled with `javac`. If it fails, the error log is sent back to Gemini with a fix prompt. Retries up to 3 times automatically
- **Real-Time WebSocket Streaming** — Every step of the agent's work streams to the UI instantly — no waiting, no polling
- **Structured JSON Contract** — Gemini returns a strict schema: translated code, explanation, risks, unit tests, entity map, and complexity scores
- **3 Java Style Flavors** — Standard Java 17, Spring Boot 3.x, or Android/Kotlin style

### 🖥️ Professional Frontend
- **Monaco Editor** — The same engine that powers VS Code, for both source and output panels
- **Agent Terminal** — A real-time dark console showing `[SYS]`, `[OK]`, `[ERR]` logs as the agent works
- **Side-by-Side Diff View** — Word-level diff between source and translated code
- **Entity Tooltips** — Select any variable in the Java output to see where it came from in the original source
- **Performance Scorecard** — Cyclomatic Complexity, Maintainability Index, and Memory Footprint with colour-coded grades
- **One-Click Unit Tests** — JUnit 5 test suite generated and ready to paste into your IDE
- **Maven Boilerplate Toggle** — Instantly wrap output in a full `pom.xml` + Maven project structure

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (React)                          │
│  Monaco Editor  │  Agent Terminal  │  Diff View  │ Scorecard │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket (ws://)
                         │ Real-time event stream
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend                            │
│                                                             │
│  1. Receive request via WebSocket                           │
│  2. Send source code → Gemini 2.5 Flash                     │
│  3. Parse structured JSON response                          │
│  4. Run javac on generated Java                             │
│     ├── PASS → Send result to UI ✓                         │
│     └── FAIL → Send error back to Gemini (retry x3)        │
│  5. Stream all events in real-time                          │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Google Gemini     │
              │   2.5 Flash API     │
              └─────────────────────┘
```

### WebSocket Event Flow
```
Browser                          FastAPI
  │──── Connect ────────────────►│
  │──── JSON Payload ───────────►│
  │◄─── {event: "log"} ──────────│ [SYS] Initialising...
  │◄─── {event: "log"} ──────────│ [SYS] Sending to Gemini...
  │◄─── {event: "compile_attempt"}│ [SYS] Running javac...
  │◄─── {event: "compile_error"} │ [ERR] Syntax error line 12
  │◄─── {event: "log"} ──────────│ [SYS] Retrying with fix...
  │◄─── {event: "result"} ───────│ [OK]  Compiled successfully ✓
  │                          WS Close
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- JDK 17+ (`javac -version` to check)
- Google Gemini API Key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Clone the repo
```bash
git clone https://github.com/Gouri257/codebabel-pro.git
cd codebabel-pro
```

### 2. Start the Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app
Go to 👉 **http://localhost:5173**

Paste your Gemini API key in the top right and click **Translate →**

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI framework |
| Code Editor | Monaco Editor | VS Code engine for source/output |
| Diff View | react-diff-viewer | Word-level code comparison |
| Backend | FastAPI + Uvicorn | REST API + WebSocket server |
| Real-time | WebSockets | Streaming agent events to UI |
| AI Model | Google Gemini 2.5 Flash | Code translation + fix generation |
| Compiler | javac (JDK 17) | Validates generated Java code |
| Deployment | Vercel (frontend) | Live hosting |

---

## 📡 API Reference

### WebSocket: `ws://localhost:8000/ws/translate`

**Request payload:**
```json
{
  "api_key": "your-gemini-key",
  "source_code": "IDENTIFICATION DIVISION...",
  "source_language": "COBOL",
  "flavor": "standard"
}
```

**Response events:**
| Event | Description |
|-------|-------------|
| `log` | Real-time status message with level (system/success/error) |
| `compile_attempt` | javac compilation started |
| `compile_error` | javac failed — includes full error log |
| `result` | Final translated code + all analysis data |
| `error` | Fatal error — translation aborted |

**Result payload includes:**
```json
{
  "translated_code": "public class CalcInterest { ... }",
  "class_name": "CalcInterest",
  "explanation": "• Used BigDecimal for financial precision...",
  "potential_risks": "⚠ COBOL PIC clauses may truncate...",
  "unit_tests": "import org.junit.jupiter.api.*; ...",
  "entity_map": [{"source_name": "WS-PRINCIPAL", "java_name": "principal", "description": "..."}],
  "complexity": {"cyclomatic": 3, "maintainability_index": 82, "estimated_memory_kb": 48},
  "compile_passed": true
}
```

---

## 🌍 Supported Languages

| Source → Java | Flavor Options |
|--------------|----------------|
| COBOL, Python, JavaScript, TypeScript | Standard Java 17 |
| C, C++, C#, Go, Rust | Spring Boot 3.x |
| Kotlin, Swift, Ruby, PHP | Android / Kotlin |

---

## 💡 Real-World Use Case

This project directly mirrors what IBM Consulting, Accenture, and major banks are building internally:

> *"Help in showcasing the ability of Gen AI code assistant to refactor/rewrite and document code from one language to another, particularly COBOL to JAVA"* — IBM Job Description, 2026

The self-healing validation loop is a real **agentic AI pattern** used in production enterprise systems.

---

## 📁 Project Structure

```
codebabel-pro/
├── backend/
│   ├── main.py              # FastAPI + WebSocket + Gemini + javac loop
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Translator.jsx     # Main UI component
    │   ├── hooks/
    │   │   └── useTranslation.js  # WebSocket state machine
    │   └── utils/
    │       └── complexity.js      # Scorecard + Maven generator
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 👩‍💻 Author

**Sirimalla Gouri**
- 🎓 B.Tech CSE — Bhoj Reddy Engineering College for Women (2022-2026)
- 💼 Frontend Developer Intern @ Springer Capital
- 🔗 [LinkedIn](www.linkedin.com/in/sirimalla-gouri-4915a62b2) · [GitHub](https://github.com/Gouri257)

---

## 📄 License

MIT License — feel free to use this project for learning and portfolio purposes.

---

<div align="center">
Built using React, FastAPI, and Google Gemini
</div>
