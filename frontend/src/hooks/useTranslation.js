import { useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/translate";

export function useTranslation() {
  const wsRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [compileAttempts, setCompileAttempts] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | connecting | translating | done | error

  const addLog = useCallback((level, message, ts) => {
    setLogs(prev => [...prev, { level, message, ts: ts || Date.now() / 1000, id: Math.random() }]);
  }, []);

  const translate = useCallback((payload) => {
    // Reset state
    setLogs([]);
    setResult(null);
    setCompileAttempts([]);
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("translating");
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      switch (msg.event) {
        case "log":
          addLog(msg.level, msg.message, msg.ts);
          break;
        case "compile_attempt":
          setCompileAttempts(prev => [...prev, { attempt: msg.attempt, status: "running" }]);
          break;
        case "compile_error":
          setCompileAttempts(prev =>
            prev.map(a => a.attempt === msg.attempt ? { ...a, status: "failed", error: msg.error } : a)
          );
          break;
        case "result":
          setCompileAttempts(prev => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            return prev.map((a, i) =>
              i === prev.length - 1 ? { ...a, status: msg.compile_passed ? "passed" : "warning" } : a
            );
          });
          setResult(msg);
          setStatus("done");
          ws.close();
          break;
        case "error":
          addLog("error", msg.message);
          setStatus("error");
          ws.close();
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      addLog("error", "WebSocket connection failed. Is the backend running?");
      setStatus("error");
    };

    ws.onclose = () => {
      if (status === "connecting" || status === "translating") {
        setStatus(prev => prev === "done" || prev === "error" ? prev : "error");
      }
    };
  }, [addLog]);

  const cancel = useCallback(() => {
    wsRef.current?.close();
    setStatus("idle");
  }, []);

  return { translate, cancel, logs, result, compileAttempts, status };
}
