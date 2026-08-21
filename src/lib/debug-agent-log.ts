/**
 * Debug-mode agent logger — dual write (HTTP ingest + local NDJSON file).
 * Temporary instrumentation for regression debugging; do not log secrets.
 */
import { appendFileSync } from "fs";

const SESSION_ID = "e4c26e";
const INGEST =
  "http://127.0.0.1:7489/ingest/effe3673-5596-4950-a2c3-f992f902843b";
const ABS_LOG =
  "C:\\Users\\Karthik\\Downloads\\SentinelRoute-main\\debug-e4c26e.log";

export function agentLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}): void {
  const body = {
    sessionId: SESSION_ID,
    runId: payload.runId ?? "pre-fix",
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  };
  const line = JSON.stringify(body) + "\n";
  try {
    appendFileSync(ABS_LOG, line);
  } catch {
    try {
      appendFileSync("debug-e4c26e.log", line);
    } catch {
      /* ignore */
    }
  }
  try {
    void fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": SESSION_ID,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
