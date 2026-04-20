#!/usr/bin/env python3 # 指定 Python 解释器路径

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


TRACE_LINE_RE = re.compile(r"^\[SKILL_TRACE\]\s+(.*)$", re.MULTILINE)
TRACE_KV_RE = re.compile(r'([a-zA-Z0-9_-]+)=(".*?"|\S+)')
PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_FILE = PROJECT_ROOT / ".cursor" / "logs" / "skill-trace.jsonl"


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def read_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}, raw

    try:
        return json.loads(raw), raw
    except Exception:
        return {"_raw": raw}, raw


def collect_strings(value):
    if isinstance(value, str):
        yield value
        return

    if isinstance(value, dict):
        for nested in value.values():
            yield from collect_strings(nested)
        return

    if isinstance(value, list):
        for nested in value:
            yield from collect_strings(nested)


def deep_find(value, keys):
    if isinstance(value, dict):
        for key in keys:
            if key in value:
                return value[key]

        for nested in value.values():
            result = deep_find(nested, keys)
            if result is not None:
                return result

    if isinstance(value, list):
        for nested in value:
            result = deep_find(nested, keys)
            if result is not None:
                return result

    return None


def normalize_scalar(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def extract_session_id(payload):
    return normalize_scalar(
        deep_find(
            payload,
            [
                "session_id",
                "sessionId",
                "conversation_id",
                "conversationId",
                "request_id",
                "requestId",
            ],
        )
    )


def extract_tool_name(payload):
    tool_value = deep_find(payload, ["tool_name", "toolName", "tool"])

    if isinstance(tool_value, dict):
        nested_name = deep_find(tool_value, ["name", "tool_name", "toolName"])
        if nested_name is not None:
            return normalize_scalar(nested_name)

    if tool_value is not None:
        return normalize_scalar(tool_value)

    return normalize_scalar(deep_find(payload, ["name"]))


def extract_duration_ms(payload):
    duration = deep_find(
        payload,
        ["duration_ms", "durationMs", "elapsed_ms", "elapsedMs", "latency_ms", "duration"],
    )
    return normalize_scalar(duration)


def extract_error(payload):
    error = deep_find(payload, ["error", "failure_reason", "stderr", "message"])
    return normalize_scalar(error)


def parse_trace_pairs(trace_body):
    parsed = {}
    for key, raw_value in TRACE_KV_RE.findall(trace_body):
        value = raw_value[1:-1] if raw_value.startswith('"') and raw_value.endswith('"') else raw_value
        parsed[key] = value
    return parsed


def build_trace_records(event_name, payload):
    records = []
    session_id = extract_session_id(payload)

    for text in collect_strings(payload):
        for match in TRACE_LINE_RE.finditer(text):
            raw_line = match.group(0).strip()
            parsed = parse_trace_pairs(match.group(1))
            if not parsed:
                continue

            records.append(
                {
                    "ts": utc_now(),
                    "record_type": "skill_trace",
                    "hook_event": event_name,
                    "session_id": session_id,
                    "skill": parsed.get("skill"),
                    "step": parsed.get("step"),
                    "status": parsed.get("status"),
                    "raw_line": raw_line,
                }
            )

    return records


def build_tool_record(event_name, payload):
    top_level_keys = sorted(payload.keys()) if isinstance(payload, dict) else []
    return {
        "ts": utc_now(),
        "record_type": "tool_event",
        "hook_event": event_name,
        "session_id": extract_session_id(payload),
        "tool_name": extract_tool_name(payload),
        "success": event_name == "postToolUse",
        "duration_ms": extract_duration_ms(payload),
        "error": extract_error(payload) if event_name == "postToolUseFailure" else None,
        "payload_keys": top_level_keys[:20],
    }


def append_records(records):
    if not records:
        return

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=True) + "\n")


def main():
    event_name = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    payload, _raw = read_payload()

    if event_name == "afterAgentResponse":
        append_records(build_trace_records(event_name, payload))
    elif event_name in {"postToolUse", "postToolUseFailure"}:
        append_records([build_tool_record(event_name, payload)])

    sys.stdout.write("{}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
