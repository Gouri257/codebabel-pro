import { useState, useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useTranslation } from "../hooks/useTranslation";
import { gradeComplexity, wrapInMaven } from "../utils/complexity";

const LANGUAGES = [
  "Python","Java","JavaScript","TypeScript","C","C++",
  "C#","Go","Rust","COBOL","Kotlin","Swift","Ruby","PHP",
];

const FLAVORS = [
  { value: "standard",   label: "Standard Java 17" },
  { value: "springboot", label: "Spring Boot 3.x"   },
  { value: "android",    label: "Android / Kotlin"  },
];

const EXAMPLES = {
  COBOL: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. CALC-INTEREST.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-PRINCIPAL    PIC 9(7)V99 VALUE 10000.00.
       01 WS-RATE         PIC 9(3)V9999 VALUE 0.0525.
       01 WS-YEARS        PIC 99 VALUE 10.
       01 WS-INTEREST     PIC 9(9)V99.
       01 WS-BALANCE      PIC 9(9)V99.
       PROCEDURE DIVISION.
           COMPUTE WS-INTEREST = WS-PRINCIPAL * WS-RATE * WS-YEARS
           COMPUTE WS-BALANCE  = WS-PRINCIPAL + WS-INTEREST
           DISPLAY "Principal : " WS-PRINCIPAL
           DISPLAY "Interest  : " WS-INTEREST
           DISPLAY "Balance   : " WS-BALANCE
           STOP RUN.`,
  Python: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def main():
    data = [64, 34, 25, 12, 22, 11, 90]
    sorted_data = bubble_sort(data)
    print("Sorted:", sorted_data)

if __name__ == "__main__":
    main()`,
  JavaScript: `class LinkedList {
  constructor() { this.head = null; this.size = 0; }
  append(data) {
    const node = { data, next: null };
    if (!this.head) { this.head = node; }
    else {
      let cur = this.head;
      while (cur.next) cur = cur.next;
      cur.next = node;
    }
    this.size++;
  }
  toArray() {
    const arr = []; let cur = this.head;
    while (cur) { arr.push(cur.data); cur = cur.next; }
    return arr;
  }
}
const list = new LinkedList();
[1, 2, 3, 4, 5].forEach(v => list.append(v));
console.log(list.toArray());`,
};

const LANG_TO_MONACO = {
  Python:"python", Java:"java", JavaScript:"javascript", TypeScript:"typescript",
  C:"c", "C++":"cpp", "C#":"csharp", Go:"go", Rust:"rust",
  COBOL:"plaintext", Kotlin:"kotlin", Swift:"swift", Ruby:"ruby", PHP:"php",
};

// ── Entity Tooltip ─────────────────────────────────────────────────────────
function EntityTooltip({ entityMap, javaCode }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!entityMap?.length) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setTooltip(null); return; }
    const word = sel.toString().trim();
    if (!word) { setTooltip(null); return; }
    const entity = entityMap.find(en =>
      en.java_name === word || en.source_name === word
    );
    if (entity) {
      setTooltip({ entity, x: e.clientX, y: e.clientY });
    } else {
      setTooltip(null);
    }
  }, [entityMap]);

  return (
    <div ref={containerRef} style={{ position: "relative", height: "100%" }}
         onMouseUp={handleMouseMove}>
      <Editor
        height="100%"
        language="java"
        value={javaCode || "// Translation will appear here..."}
        theme="vs-dark"
        options={{
          readOnly: true, fontSize: 13, minimap: { enabled: false },
          scrollBeyondLastLine: false, wordWrap: "on",
          lineNumbers: "on", glyphMargin: false, folding: true,
        }}
      />
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10,
          background: "#1e293b", border: "1px solid #334155",
          borderRadius: 8, padding: "8px 12px", zIndex: 9999,
          maxWidth: 280, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          <div style={{ color: "#00d4ff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
            {tooltip.entity.java_name}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>
            ← from <span style={{ color: "#fbbf24" }}>{tooltip.entity.source_name}</span>
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 11 }}>{tooltip.entity.description}</div>
        </div>
      )}
    </div>
  );
}

// ── Scorecard ──────────────────────────────────────────────────────────────
function Scorecard({ complexity }) {
  const grades = gradeComplexity(complexity);
  const items = [
    { label: "Cyclomatic Complexity", key: "cyclomatic",      showBar: true  },
    { label: "Maintainability Index", key: "maintainability", showBar: true  },
    { label: "Est. Memory Footprint", key: "memory",          showBar: false },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      {items.map(({ label, key, showBar }) => {
        const g = grades[key];
        return (
          <div key={key} style={{
            background: "#0d1521", border: "1px solid #1e2d42",
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, color: "#6b7fa3", textTransform: "uppercase",
                          letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: g.color, marginBottom: 6 }}>
              {key === "memory" ? g.label : g.value}
            </div>
            <div style={{ fontSize: 11, color: g.color, marginBottom: showBar ? 8 : 0 }}>
              {key !== "memory" && g.label}
            </div>
            {showBar && (
              <div style={{ height: 4, background: "#1e2d42", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${g.bar}%`,
                              background: g.color, borderRadius: 2,
                              transition: "width 0.8s ease" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Agent Terminal ─────────────────────────────────────────────────────────
function AgentTerminal({ logs, compileAttempts, status }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const levelColor = { system: "#00d4ff", success: "#39d353", error: "#ef4444",
                       warning: "#fbbf24", info: "#94a3b8" };
  const levelPrefix = { system: "[SYS]", success: "[OK] ", error: "[ERR]",
                        warning: "[WRN]", info: "[INF]" };
  return (
    <div style={{
      background: "#070d14", border: "1px solid #1e2d42",
      borderRadius: "0 0 12px 12px", borderTop: "none",
      height: 180, overflowY: "auto", padding: "10px 16px",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
    }}>
      <div style={{ color: "#1e4d6b", marginBottom: 6, fontSize: 11 }}>
        ── CodeBabel Agent Terminal ────────────────────────────────
      </div>
      {logs.map(log => (
        <div key={log.id} style={{ marginBottom: 3, display: "flex", gap: 10 }}>
          <span style={{ color: "#334155", flexShrink: 0 }}>
            {new Date(log.ts * 1000).toISOString().substr(11, 8)}
          </span>
          <span style={{ color: levelColor[log.level] || "#94a3b8", flexShrink: 0 }}>
            {levelPrefix[log.level] || "[   ]"}
          </span>
          <span style={{ color: "#cdd6f4" }}>{log.message}</span>
        </div>
      ))}
      {status === "translating" && (
        <div style={{ color: "#00d4ff", animation: "pulse 1s infinite" }}>
          ▋
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

// ── Accordion ──────────────────────────────────────────────────────────────
function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #1e2d42", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "#0f1520", border: "none", cursor: "pointer",
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", color: "#cdd6f4",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
      }}>
        <span>{icon} {title}</span>
        <span style={{ color: "#6b7fa3", fontSize: 16, transition: "transform 0.2s",
                       transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      {open && (
        <div style={{ background: "#0a0e14", padding: "14px 16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main Translator ────────────────────────────────────────────────────────
export default function Translator() {
  const [apiKey, setApiKey]           = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [sourceCode, setSourceCode]   = useState(EXAMPLES["COBOL"]);
  const [sourceLang, setSourceLang]   = useState("COBOL");
  const [flavor, setFlavor]           = useState("standard");
  const [viewMode, setViewMode]       = useState("split"); // split | diff
  const [mavenMode, setMavenMode]     = useState(false);
  const [copiedTest, setCopiedTest]   = useState(false);
  const [copiedCode, setCopiedCode]   = useState(false);

  const { translate, cancel, logs, result, compileAttempts, status } = useTranslation();

  const isRunning = status === "connecting" || status === "translating";

  const handleTranslate = () => {
    if (!apiKey.trim() || !sourceCode.trim()) return;
    translate({ api_key: apiKey, source_code: sourceCode, source_language: sourceLang, flavor });
  };

  const handleCopyTest = () => {
    if (result?.unit_tests) {
      navigator.clipboard.writeText(result.unit_tests);
      setCopiedTest(true); setTimeout(() => setCopiedTest(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (result?.translated_code) {
      navigator.clipboard.writeText(result.translated_code);
      setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const mavenFiles = result ? wrapInMaven(result.translated_code, result.class_name) : {};

  const bulletLines = (str) =>
    (str || "").split("\n").filter(Boolean).map((l, i) => (
      <div key={i} style={{ marginBottom: 6, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6,
                            paddingLeft: 16, position: "relative" }}>
        <span style={{ position: "absolute", left: 0, color: "#00d4ff" }}>▸</span>
        {l.replace(/^[•▸⚠\-]\s*/, "")}
      </div>
    ));

  // terminal badge
  const terminalTitle = () => {
    if (status === "idle")        return "Agent Terminal";
    if (status === "connecting")  return "Agent Terminal — Connecting...";
    if (status === "translating") return `Agent Terminal — ${logs.length} events`;
    if (status === "done")        return `Agent Terminal — Done (${logs.length} events)`;
    if (status === "error")       return "Agent Terminal — Error";
    return "Agent Terminal";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e14", color: "#cdd6f4",
                  fontFamily: "'JetBrains Mono', monospace", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── */}
      <header style={{
        borderBottom: "1px solid #1e2d42", background: "rgba(10,14,20,0.97)",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "12px 24px",
                      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, color: "#00d4ff", textShadow: "0 0 20px rgba(0,212,255,0.5)" }}>⟨/⟩</span>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
                            color: "#e8eaf6", letterSpacing: -0.5 }}>CodeBabel Pro</div>
              <div style={{ fontSize: 9, color: "#6b7fa3", letterSpacing: 2, textTransform: "uppercase" }}>
                GenAI · javac Validation · Agent
              </div>
            </div>
          </div>

          {/* API Key */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, color: "#6b7fa3" }}>🔑 Gemini API Key</span>
            <div style={{ position: "relative" }}>
              <input type={apiKeyVisible ? "text" : "password"} value={apiKey}
                onChange={e => setApiKey(e.target.value)} placeholder="Paste Gemini API key..."
                style={{ background: "#111927", border: "1px solid #1e2d42", borderRadius: 8,
                         padding: "7px 36px 7px 12px", color: "#cdd6f4", fontFamily: "inherit",
                         fontSize: 12, width: 260, outline: "none" }} />
              <button onClick={() => setApiKeyVisible(v => !v)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                         background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
                {apiKeyVisible ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTROLS BAR ── */}
      <div style={{ borderBottom: "1px solid #1e2d42", background: "#0d1521" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "10px 24px",
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Source lang */}
          <label style={{ fontSize: 11, color: "#6b7fa3" }}>Source</label>
          <select value={sourceLang} onChange={e => { setSourceLang(e.target.value); }}
            style={{ background: "#111927", border: "1px solid #1e2d42", borderRadius: 6,
                     padding: "6px 10px", color: "#e8eaf6", fontFamily: "inherit", fontSize: 12 }}>
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>

          <span style={{ color: "#1e2d42", fontSize: 20 }}>→</span>
          <span style={{ fontSize: 12, color: "#00d4ff", fontWeight: 700 }}>Java</span>

          {/* Flavor */}
          <label style={{ fontSize: 11, color: "#6b7fa3", marginLeft: 8 }}>Style</label>
          <select value={flavor} onChange={e => setFlavor(e.target.value)}
            style={{ background: "#111927", border: "1px solid #7b61ff", borderRadius: 6,
                     padding: "6px 10px", color: "#7b61ff", fontFamily: "inherit", fontSize: 12 }}>
            {FLAVORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {/* Examples */}
          <span style={{ fontSize: 11, color: "#6b7fa3", marginLeft: 8 }}>Examples:</span>
          {Object.keys(EXAMPLES).map(lang => (
            <button key={lang} onClick={() => { setSourceCode(EXAMPLES[lang]); setSourceLang(lang); }}
              style={{ background: "#141d2b", border: "1px solid #1e2d42", borderRadius: 20,
                       padding: "3px 12px", fontSize: 11, color: "#6b7fa3", cursor: "pointer" }}>
              {lang}
            </button>
          ))}

          {/* View toggle */}
          <div style={{ marginLeft: "auto", display: "flex", background: "#111927",
                        border: "1px solid #1e2d42", borderRadius: 8, overflow: "hidden" }}>
            {["split", "diff"].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: "6px 14px", fontSize: 11, fontFamily: "inherit", cursor: "pointer", border: "none",
                         background: viewMode === m ? "#00d4ff22" : "transparent",
                         color: viewMode === m ? "#00d4ff" : "#6b7fa3", textTransform: "capitalize" }}>
                {m === "split" ? "⊞ Split" : "⊟ Diff"}
              </button>
            ))}
          </div>

          {/* Maven toggle */}
          <button onClick={() => setMavenMode(m => !m)}
            style={{ padding: "6px 14px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                     border: `1px solid ${mavenMode ? "#fbbf24" : "#1e2d42"}`, borderRadius: 8,
                     background: mavenMode ? "#fbbf2418" : "transparent",
                     color: mavenMode ? "#fbbf24" : "#6b7fa3" }}>
            {mavenMode ? "📦 Maven ON" : "📦 Maven"}
          </button>

          {/* Translate / Cancel */}
          {isRunning ? (
            <button onClick={cancel}
              style={{ padding: "8px 22px", background: "#ef444422", border: "1px solid #ef4444",
                       color: "#ef4444", borderRadius: 8, fontFamily: "inherit",
                       fontSize: 13, cursor: "pointer" }}>
              ✕ Cancel
            </button>
          ) : (
            <button onClick={handleTranslate} disabled={!apiKey || !sourceCode}
              style={{ padding: "8px 22px",
                       background: "linear-gradient(135deg, #00d4ff, #7b61ff)",
                       border: "none", color: "#fff", borderRadius: 8,
                       fontFamily: "'Syne', sans-serif", fontWeight: 700,
                       fontSize: 13, cursor: "pointer", opacity: (!apiKey || !sourceCode) ? 0.5 : 1 }}>
              Translate →
            </button>
          )}
        </div>
      </div>

      {/* ── COMPILE BADGES ── */}
      {compileAttempts.length > 0 && (
        <div style={{ maxWidth: 1600, margin: "8px auto 0", padding: "0 24px",
                      display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#6b7fa3" }}>javac:</span>
          {compileAttempts.map((a, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700,
              background: a.status === "passed" ? "#39d35322" : a.status === "failed" ? "#ef444422" : "#fbbf2422",
              border: `1px solid ${a.status === "passed" ? "#39d353" : a.status === "failed" ? "#ef4444" : "#fbbf24"}`,
              color: a.status === "passed" ? "#39d353" : a.status === "failed" ? "#ef4444" : "#fbbf24",
            }}>
              Attempt {a.attempt}: {a.status === "running" ? "⏳" : a.status === "passed" ? "✓ Pass" : "✗ Fail"}
            </span>
          ))}
        </div>
      )}

      {/* ── MAIN EDITORS ── */}
      <div style={{ maxWidth: 1600, margin: "12px auto 0", padding: "0 24px",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
        {/* Source panel */}
        <div style={{ border: "1px solid #1e2d42", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
          <div style={{ background: "#0f1520", padding: "10px 16px", borderBottom: "1px solid #1e2d42",
                        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700 }}>{sourceLang} · SOURCE</span>
            <span style={{ fontSize: 10, color: "#6b7fa3" }}>{sourceCode.length} chars</span>
          </div>
          <div style={{ height: 420 }}>
            <Editor height="100%" language={LANG_TO_MONACO[sourceLang] || "plaintext"}
              value={sourceCode} onChange={v => setSourceCode(v || "")} theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false,
                         wordWrap: "on", lineNumbers: "on" }} />
          </div>
        </div>

        {/* Output panel */}
        <div style={{ border: "1px solid #1e2d42", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
          <div style={{ background: "#0f1520", padding: "10px 16px", borderBottom: "1px solid #1e2d42",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#39d353", fontSize: 12, fontWeight: 700 }}>
              Java · {result?.class_name || "OUTPUT"}
              {result?.compile_passed && <span style={{ marginLeft: 8, color: "#39d353" }}>✓ Compiled</span>}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {result?.translated_code && (
                <button onClick={handleCopyCode}
                  style={{ fontSize: 11, padding: "3px 10px", background: "#39d35320",
                           border: "1px solid #39d35340", color: "#39d353", borderRadius: 6, cursor: "pointer" }}>
                  {copiedCode ? "✅" : "📋 Copy"}
                </button>
              )}
              {result?.unit_tests && (
                <button onClick={handleCopyTest}
                  style={{ fontSize: 11, padding: "3px 10px", background: "#7b61ff20",
                           border: "1px solid #7b61ff40", color: "#7b61ff", borderRadius: 6, cursor: "pointer" }}>
                  {copiedTest ? "✅ Copied!" : "🧪 Copy Tests"}
                </button>
              )}
            </div>
          </div>
          <div style={{ height: 420, position: "relative" }}>
            {isRunning && !result && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                            justifyContent: "center", flexDirection: "column", gap: 16, zIndex: 10,
                            background: "#0a0e14aa" }}>
                <div style={{ width: 48, height: 48, border: "3px solid #1e2d42",
                              borderTopColor: "#00d4ff", borderRadius: "50%",
                              animation: "spin 0.8s linear infinite" }} />
                <div style={{ color: "#6b7fa3", fontSize: 12 }}>
                  {logs[logs.length - 1]?.message || "Initialising..."}
                </div>
              </div>
            )}
            <EntityTooltip entityMap={result?.entity_map} javaCode={result?.translated_code} />
          </div>
        </div>
      </div>

      {/* ── AGENT TERMINAL ── */}
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px", width: "100%" }}>
        <div style={{ border: "1px solid #1e2d42", borderTop: "none",
                      background: "#0d1521", padding: "8px 16px", borderRadius: "0",
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#6b7fa3", textTransform: "uppercase", letterSpacing: 1 }}>
            ▶ {terminalTitle()}
          </span>
          {status === "done" && (
            <span style={{ fontSize: 10, color: "#39d353" }}>
              {compileAttempts.filter(a => a.status === "passed").length > 0 ? "✓ Compiled successfully" : "⚠ Best-effort result"}
            </span>
          )}
        </div>
        <AgentTerminal logs={logs} compileAttempts={compileAttempts} status={status} />
      </div>

      {/* ── RESULTS SECTION ── */}
      {result && (
        <div style={{ maxWidth: 1600, margin: "20px auto 0", padding: "0 24px 40px", width: "100%" }}>

          {/* Diff view */}
          {viewMode === "diff" && (
            <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden",
                          border: "1px solid #1e2d42" }}>
              <div style={{ background: "#0f1520", padding: "10px 16px",
                            borderBottom: "1px solid #1e2d42", fontSize: 12, color: "#6b7fa3" }}>
                ⊟ Diff View — {sourceLang} → Java
              </div>
              <ReactDiffViewer
                oldValue={sourceCode} newValue={result.translated_code}
                splitView={true} diffMethod={DiffMethod.WORDS}
                useDarkTheme={true}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "#0a0e14",
                      addedBackground: "#0d2b1a", addedColor: "#39d353",
                      removedBackground: "#2b0d0d", removedColor: "#ef4444",
                      wordAddedBackground: "#1a4d2e", wordRemovedBackground: "#4d1a1a",
                    }
                  }
                }}
              />
            </div>
          )}

          {/* Performance scorecard */}
          {result.complexity && Object.keys(result.complexity).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#6b7fa3", marginBottom: 10,
                            textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                📊 Performance Scorecard
              </div>
              <Scorecard complexity={result.complexity} />
            </div>
          )}

          {/* Thinking accordion */}
          <Accordion title="Explanation" icon="🧠" defaultOpen={true}>
            {bulletLines(result.explanation)}
          </Accordion>

          <Accordion title="Potential Risks & Migration Notes" icon="⚠️">
            {bulletLines(result.potential_risks)}
          </Accordion>

          {/* Entity map */}
          {result.entity_map?.length > 0 && (
            <Accordion title={`Entity Map (${result.entity_map.length} variables mapped)`} icon="🗺️">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Source Name", "Java Name", "Description"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 12px",
                                             color: "#6b7fa3", borderBottom: "1px solid #1e2d42",
                                             fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.entity_map.map((e, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #0f1520" }}>
                        <td style={{ padding: "8px 12px", color: "#fbbf24", fontFamily: "monospace" }}>{e.source_name}</td>
                        <td style={{ padding: "8px 12px", color: "#00d4ff", fontFamily: "monospace" }}>{e.java_name}</td>
                        <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#6b7fa3" }}>
                💡 Tip: Select any variable name in the Java editor above to see its tooltip.
              </div>
            </Accordion>
          )}

          {/* Maven boilerplate */}
          {mavenMode && (
            <Accordion title="Maven Project Structure" icon="📦" defaultOpen={true}>
              {Object.entries(mavenFiles).map(([path, content]) => (
                <div key={path} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6, fontFamily: "monospace" }}>
                    📄 {path}
                  </div>
                  <div style={{ borderRadius: 6, overflow: "hidden", maxHeight: 200 }}>
                    <Editor height="150px" language={path.endsWith(".xml") ? "xml" : path.endsWith(".md") ? "markdown" : "java"}
                      value={content} theme="vs-dark"
                      options={{ readOnly: true, fontSize: 12, minimap: { enabled: false },
                                 scrollBeyondLastLine: false, lineNumbers: "off" }} />
                  </div>
                </div>
              ))}
            </Accordion>
          )}

          {/* Unit test panel */}
          {result.unit_tests && (
            <Accordion title="Unit Test Suite (JUnit 5)" icon="🧪" defaultOpen={false}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button onClick={handleCopyTest}
                  style={{ fontSize: 12, padding: "6px 16px", background: "#7b61ff20",
                           border: "1px solid #7b61ff", color: "#7b61ff", borderRadius: 8, cursor: "pointer" }}>
                  {copiedTest ? "✅ Copied to clipboard!" : "🧪 One-Click Copy for IDE"}
                </button>
              </div>
              <div style={{ borderRadius: 8, overflow: "hidden" }}>
                <Editor height="300px" language="java" value={result.unit_tests} theme="vs-dark"
                  options={{ readOnly: true, fontSize: 12, minimap: { enabled: false },
                             scrollBeyondLastLine: false, lineNumbers: "on" }} />
              </div>
            </Accordion>
          )}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0 } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #111927; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #1e2d42; border-radius: 3px; }
      `}</style>
    </div>
  );
}
