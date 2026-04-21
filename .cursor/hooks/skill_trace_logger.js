#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const TRACE_LINE_RE = /^\[SKILL_TRACE\]\s+(.*)$/gm;
const TRACE_KV_RE = /([a-zA-Z0-9_-]+)=(".*?"|\S+)/g;
const SKILL_PATH_RE =
  /(?:^|\/)\.(?:cursor\/skills(?:-cursor)?|claude\/skills)\/([^/]+)\/SKILL\.md$/;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(PROJECT_ROOT, ".cursor", "logs");
const EVENT_LOG_FILE =
  process.env.SKILL_TRACE_LOG_FILE || path.join(LOG_DIR, "skill-trace.jsonl");
const RUNS_LOG_FILE =
  process.env.SKILL_TRACE_RUNS_LOG_FILE || path.join(LOG_DIR, "runs.jsonl");
const STATE_FILE =
  process.env.SKILL_TRACE_STATE_FILE ||
  path.join(LOG_DIR, "skill-trace-state.json");
const LOCK_DIR =
  process.env.SKILL_TRACE_LOCK_DIR || path.join(LOG_DIR, "skill-trace.lock");
const UNSCOPED_STEP = "_unscoped";
const FILE_EDIT_TOOL_NAMES = new Set([
  "Write",
  "Edit",
  "Delete",
  "MultiEdit",
  "EditNotebook",
  "TabWrite",
]);

function formatLocalTime(now) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds(),
  )}:${pad(now.getMilliseconds(), 3)}`;
}

function createTimestamp() {
  const now = new Date();

  return {
    ts: formatLocalTime(now),
    ts_ms: now.getTime(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
  });
}

function parsePayload(raw) {
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return { _raw: raw };
  }
}

function* collectStrings(value) {
  if (typeof value === "string") {
    yield value;
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      yield* collectStrings(item);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      yield* collectStrings(item);
    }
  }
}

function deepFind(value, keys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = deepFind(item, keys);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        return value[key];
      }
    }

    for (const item of Object.values(value)) {
      const result = deepFind(item, keys);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
  }

  return null;
}

function normalizeScalar(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  return String(value);
}

function normalizePathForMatch(filePath) {
  return typeof filePath === "string" ? filePath.replace(/\\/g, "/") : null;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function addUniqueMany(list, values) {
  for (const value of values) {
    addUnique(list, value);
  }
}

function incrementCounter(counter, key) {
  const normalizedKey = normalizeScalar(key) || "unknown";
  counter[normalizedKey] = (counter[normalizedKey] || 0) + 1;
}

function incrementCounterByGroup(counterMap, groupKey, key) {
  const normalizedGroupKey = normalizeScalar(groupKey) || "unknown";
  if (
    !counterMap[normalizedGroupKey] ||
    typeof counterMap[normalizedGroupKey] !== "object" ||
    Array.isArray(counterMap[normalizedGroupKey])
  ) {
    counterMap[normalizedGroupKey] = {};
  }

  incrementCounter(counterMap[normalizedGroupKey], key);
}

function incrementValueByGroup(counterMap, groupKey, amount = 1) {
  const normalizedGroupKey = normalizeScalar(groupKey) || "unknown";
  counterMap[normalizedGroupKey] = (counterMap[normalizedGroupKey] || 0) + amount;
}

function addUniqueManyByGroup(listMap, groupKey, values) {
  const normalizedGroupKey = normalizeScalar(groupKey) || "unknown";
  if (!Array.isArray(listMap[normalizedGroupKey])) {
    listMap[normalizedGroupKey] = [];
  }

  addUniqueMany(listMap[normalizedGroupKey], values);
}

function sortObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function sortNestedObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [
        key,
        Array.isArray(nestedValue)
          ? [...nestedValue].sort((left, right) => {
              const leftSeq =
                left && typeof left === "object" && typeof left.seq === "number"
                  ? left.seq
                  : 0;
              const rightSeq =
                right && typeof right === "object" && typeof right.seq === "number"
                  ? right.seq
                  : 0;
              return leftSeq - rightSeq;
            })
          : sortObjectByKey(nestedValue),
      ]),
  );
}

function defaultState() {
  return {
    version: 3,
    sessions: {},
  };
}

function safeReadJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallbackValue;
  }
}

function loadState() {
  const state = safeReadJson(STATE_FILE, defaultState());
  if (!state || typeof state !== "object") {
    return defaultState();
  }

  return {
    version: 3,
    sessions:
      state.sessions && typeof state.sessions === "object" ? state.sessions : {},
  };
}

function saveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
}

async function withLock(callback) {
  const deadline = Date.now() + 5000;

  while (true) {
    try {
      fs.mkdirSync(LOCK_DIR);
      break;
    } catch (error) {
      if (error.code !== "EEXIST" || Date.now() >= deadline) {
        throw error;
      }

      await sleep(25);
    }
  }

  try {
    return await callback();
  } finally {
    try {
      fs.rmdirSync(LOCK_DIR);
    } catch (_error) {
      // ignore unlock failures and fail open
    }
  }
}

function extractConversationId(payload) {
  return normalizeScalar(deepFind(payload, ["conversation_id", "conversationId"]));
}

function extractCursorSessionId(payload) {
  return normalizeScalar(deepFind(payload, ["session_id", "sessionId"]));
}

function extractRequestId(payload) {
  return normalizeScalar(deepFind(payload, ["request_id", "requestId"]));
}

function extractSessionContext(payload) {
  const conversationId = extractConversationId(payload);
  const cursorSessionId = extractCursorSessionId(payload);
  const requestId = extractRequestId(payload);

  return {
    session_id: conversationId ?? cursorSessionId ?? requestId ?? null,
    conversation_id: conversationId ?? null,
    cursor_session_id: cursorSessionId ?? null,
    request_id: requestId ?? null,
  };
}

function extractSessionId(payload) {
  return extractSessionContext(payload).session_id;
}

function extractToolName(payload) {
  const toolValue = deepFind(payload, ["tool_name", "toolName", "tool"]);

  if (toolValue && typeof toolValue === "object" && !Array.isArray(toolValue)) {
    const nestedName = deepFind(toolValue, ["name", "tool_name", "toolName"]);
    if (nestedName !== null && nestedName !== undefined) {
      return normalizeScalar(nestedName);
    }
  }

  if (toolValue !== null && toolValue !== undefined) {
    return normalizeScalar(toolValue);
  }

  return normalizeScalar(deepFind(payload, ["name"]));
}

function extractToolUseId(payload) {
  return normalizeScalar(deepFind(payload, ["tool_use_id", "toolUseId"]));
}

function extractDurationMs(payload) {
  return normalizeScalar(
    deepFind(payload, [
      "duration_ms",
      "durationMs",
      "elapsed_ms",
      "elapsedMs",
      "latency_ms",
      "duration",
    ]),
  );
}

function extractFailureType(payload) {
  return normalizeScalar(
    deepFind(payload, ["failure_type", "failureType", "status"]),
  );
}

function extractError(payload) {
  return normalizeScalar(
    deepFind(payload, [
      "error_message",
      "error",
      "failure_reason",
      "stderr",
      "message",
    ]),
  );
}

function extractInterruptFlag(payload) {
  return normalizeScalar(deepFind(payload, ["is_interrupt", "isInterrupt"]));
}

function extractTranscriptPath(payload) {
  return normalizeScalar(
    deepFind(payload, ["transcript_path", "transcriptPath"]),
  );
}

function extractToolInput(payload) {
  return deepFind(payload, ["tool_input", "toolInput", "input"]);
}

function extractWorkingDirectory(payload) {
  return normalizeScalar(deepFind(payload, ["cwd", "working_directory", "workingDirectory"]));
}

function extractModel(payload) {
  return normalizeScalar(
    deepFind(payload, [
      "model",
      "model_name",
      "modelName",
      "assistant_model",
      "assistantModel",
    ]),
  );
}

function extractModifiedFiles(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== "object") {
    return [];
  }

  if (!FILE_EDIT_TOOL_NAMES.has(toolName)) {
    return [];
  }

  const candidates = [
    toolInput.path,
    toolInput.old_path,
    toolInput.new_path,
    toolInput.target_notebook,
  ];

  return candidates
    .map((value) => normalizeScalar(value))
    .filter((value) => typeof value === "string" && value.length > 0);
}

function extractSkillFromPath(filePath) {
  const normalized = normalizePathForMatch(filePath);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(SKILL_PATH_RE);
  return match ? match[1] : null;
}

function extractSkillFromText(text) {
  if (typeof text !== "string" || !text) {
    return null;
  }

  const explicitMatch = text.match(/读取并应用 `([^`]+)`/);
  if (explicitMatch) {
    return explicitMatch[1];
  }

  const traceMatch = text.match(/\bskill=([a-zA-Z0-9_-]+)/);
  if (traceMatch) {
    return traceMatch[1];
  }

  return null;
}

function extractSkillFromToolUse(item) {
  if (!item || item.type !== "tool_use") {
    return null;
  }

  const input = item.input;
  if (!input || typeof input !== "object") {
    return null;
  }

  if (item.name === "ReadFile") {
    return extractSkillFromPath(input.path);
  }

  return null;
}

function extractSkillContextFromTranscript(transcriptPath) {
  if (typeof transcriptPath !== "string" || !transcriptPath) {
    return { skill: null, source: null };
  }

  try {
    const raw = fs.readFileSync(transcriptPath, "utf8");
    const lines = raw.split(/\r?\n/);
    let currentSkill = null;

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_error) {
        continue;
      }

      if (entry.role === "user") {
        currentSkill = null;
        continue;
      }

      if (entry.role !== "assistant") {
        continue;
      }

      const content = Array.isArray(entry.message?.content)
        ? entry.message.content
        : [];
      for (const item of content) {
        const toolSkill = extractSkillFromToolUse(item);
        if (toolSkill) {
          currentSkill = toolSkill;
          continue;
        }

        if (item?.type === "text") {
          const textSkill = extractSkillFromText(item.text);
          if (textSkill) {
            currentSkill = textSkill;
          }
        }
      }
    }

    return currentSkill
      ? { skill: currentSkill, source: "transcript" }
      : { skill: null, source: null };
  } catch (_error) {
    return { skill: null, source: null };
  }
}

function extractSkillContext(payload) {
  const toolInput = extractToolInput(payload);
  const directSkill = extractSkillFromPath(toolInput?.path);

  if (directSkill) {
    return { skill: directSkill, source: "tool_input" };
  }

  return extractSkillContextFromTranscript(extractTranscriptPath(payload));
}

function parseTracePairs(traceBody) {
  const parsed = {};

  for (const match of traceBody.matchAll(TRACE_KV_RE)) {
    const [, key, rawValue] = match;
    parsed[key] =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
  }

  return parsed;
}

function buildBaseRecord(eventName, payload) {
  const timestamp = createTimestamp();
  const sessionContext = extractSessionContext(payload);

  return {
    ...timestamp,
    hook_event: eventName,
    session_id: sessionContext.session_id,
    conversation_id: sessionContext.conversation_id,
    cursor_session_id: sessionContext.cursor_session_id,
    request_id: sessionContext.request_id,
    model: extractModel(payload),
  };
}

function buildTraceRecords(eventName, payload) {
  const records = [];
  const baseRecord = buildBaseRecord(eventName, payload);

  for (const text of collectStrings(payload)) {
    for (const match of text.matchAll(TRACE_LINE_RE)) {
      const rawLine = match[0].trim();
      const parsed = parseTracePairs(match[1]);

      if (Object.keys(parsed).length === 0) {
        continue;
      }

      records.push({
        ...baseRecord,
        record_type: "skill_trace",
        skill: parsed.skill ?? null,
        step: parsed.step ?? null,
        status: parsed.status ?? null,
        raw_line: rawLine,
      });
    }
  }

  return records;
}

function buildToolRecord(eventName, payload) {
  const topLevelKeys =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload).sort()
      : [];
  const skillContext = extractSkillContext(payload);
  const toolName = extractToolName(payload);
  const toolInput = extractToolInput(payload);

  return {
    ...buildBaseRecord(eventName, payload),
    record_type: "tool_event",
    tool_use_id: extractToolUseId(payload),
    tool_name: toolName,
    tool_stage: eventName === "preToolUse" ? "before" : "after",
    skill: skillContext.skill,
    skill_source: skillContext.source,
    step: null,
    step_source: null,
    success:
      eventName === "postToolUse"
        ? true
        : eventName === "postToolUseFailure"
          ? false
          : null,
    duration_ms:
      eventName === "postToolUse" || eventName === "postToolUseFailure"
        ? extractDurationMs(payload)
        : null,
    error: eventName === "postToolUseFailure" ? extractError(payload) : null,
    failure_type:
      eventName === "postToolUseFailure" ? extractFailureType(payload) : null,
    is_interrupt:
      eventName === "postToolUseFailure" ? extractInterruptFlag(payload) : null,
    cwd: extractWorkingDirectory(payload),
    modified_files: extractModifiedFiles(toolName, toolInput),
    payload_keys: topLevelKeys.slice(0, 20),
  };
}

function buildLifecycleRecord(eventName, payload) {
  return {
    ...buildBaseRecord(eventName, payload),
    record_type: "lifecycle_event",
    stop_reason: normalizeScalar(
      deepFind(payload, ["stop_reason", "stopReason", "reason", "status"]),
    ),
  };
}

function buildRecords(eventName, payload) {
  if (eventName === "afterAgentResponse") {
    return buildTraceRecords(eventName, payload);
  }

  if (
    eventName === "preToolUse" ||
    eventName === "postToolUse" ||
    eventName === "postToolUseFailure"
  ) {
    return [buildToolRecord(eventName, payload)];
  }

  if (eventName === "stop") {
    return [buildLifecycleRecord(eventName, payload)];
  }

  return [];
}

function appendRecords(filePath, records) {
  if (!records || records.length === 0) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines =
    records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.appendFileSync(filePath, lines, "utf8");
}

function getSessionState(state, record) {
  if (!record?.session_id) {
    return null;
  }

  if (!state.sessions[record.session_id]) {
    state.sessions[record.session_id] = {
      session_id: record.session_id,
      conversation_id: record.conversation_id ?? null,
      cursor_session_id: record.cursor_session_id ?? null,
      started_at: record.ts,
      started_at_ms: record.ts_ms,
      updated_at: record.ts,
      updated_at_ms: record.ts_ms,
      next_run_seq: 1,
      active_runs: {},
    };
  }

  const session = state.sessions[record.session_id];
  session.conversation_id = record.conversation_id ?? session.conversation_id;
  session.cursor_session_id =
    record.cursor_session_id ?? session.cursor_session_id;
  session.updated_at = record.ts;
  session.updated_at_ms = record.ts_ms;
  return session;
}

function normalizeRunState(run) {
  if (!run || typeof run !== "object") {
    return run;
  }

  if (!run.step_statuses || typeof run.step_statuses !== "object") {
    run.step_statuses = {};
  }
  if (!Array.isArray(run.steps_started)) {
    run.steps_started = [];
  }
  if (!Array.isArray(run.completed_steps)) {
    run.completed_steps = [];
  }
  if (!run.tool_breakdown || typeof run.tool_breakdown !== "object") {
    run.tool_breakdown = {};
  }
  if (!run.pre_tool_breakdown || typeof run.pre_tool_breakdown !== "object") {
    run.pre_tool_breakdown = {};
  }
  if (!run.failure_breakdown || typeof run.failure_breakdown !== "object") {
    run.failure_breakdown = {};
  }
  if (!Array.isArray(run.modified_files)) {
    run.modified_files = [];
  }
  if (!Array.isArray(run.models_used)) {
    run.models_used = [];
  }
  if (!run.tool_events_by_step || typeof run.tool_events_by_step !== "object") {
    run.tool_events_by_step = {};
  }
  if (
    !run.pre_tool_breakdown_by_step ||
    typeof run.pre_tool_breakdown_by_step !== "object"
  ) {
    run.pre_tool_breakdown_by_step = {};
  }
  if (
    !run.tool_breakdown_by_step ||
    typeof run.tool_breakdown_by_step !== "object"
  ) {
    run.tool_breakdown_by_step = {};
  }
  if (
    !run.success_tool_count_by_step ||
    typeof run.success_tool_count_by_step !== "object"
  ) {
    run.success_tool_count_by_step = {};
  }
  if (
    !run.failed_tool_count_by_step ||
    typeof run.failed_tool_count_by_step !== "object"
  ) {
    run.failed_tool_count_by_step = {};
  }
  if (
    !run.modified_files_by_step ||
    typeof run.modified_files_by_step !== "object"
  ) {
    run.modified_files_by_step = {};
  }
  if (!run.step_windows || typeof run.step_windows !== "object") {
    run.step_windows = {};
  }
  if (!run.step_durations || typeof run.step_durations !== "object") {
    run.step_durations = {};
  }
  if (!Array.isArray(run.step_anomalies)) {
    run.step_anomalies = [];
  }
  if (typeof run.step_anomaly_count !== "number") {
    run.step_anomaly_count = run.step_anomalies.length;
  }
  if (!("active_step" in run)) {
    run.active_step = null;
  }
  if (!("active_step_started_at" in run)) {
    run.active_step_started_at = null;
  }
  if (!("active_step_started_at_ms" in run)) {
    run.active_step_started_at_ms = null;
  }

  return run;
}

function createRun(session, record) {
  const runSequence = session.next_run_seq++;
  return normalizeRunState({
    skill_run_id: `${record.session_id}:${String(runSequence).padStart(4, "0")}:${record.skill}`,
    session_id: record.session_id,
    conversation_id: record.conversation_id ?? null,
    cursor_session_id: record.cursor_session_id ?? null,
    skill: record.skill,
    run_source: record.record_type === "skill_trace" ? "trace" : "tool_only",
    start_ts: record.ts,
    start_ts_ms: record.ts_ms,
    last_event_at: record.ts,
    last_event_at_ms: record.ts_ms,
    first_hook_event: record.hook_event,
    last_hook_event: record.hook_event,
    has_trace: record.record_type === "skill_trace",
    events_count: 0,
    step_events_count: 0,
    step_statuses: {},
    steps_started: [],
    completed_steps: [],
    active_step: null,
    active_step_started_at: null,
    active_step_started_at_ms: null,
    pre_tool_count: 0,
    tool_count: 0,
    success_tool_count: 0,
    failed_tool_count: 0,
    tool_breakdown: {},
    pre_tool_breakdown: {},
    tool_events_by_step: {},
    pre_tool_breakdown_by_step: {},
    tool_breakdown_by_step: {},
    success_tool_count_by_step: {},
    failed_tool_count_by_step: {},
    modified_files_by_step: {},
    step_windows: {},
    step_durations: {},
    step_anomaly_count: 0,
    step_anomalies: [],
    error_count: 0,
    last_error: null,
    failure_breakdown: {},
    mcp_count: 0,
    shell_count: 0,
    file_edit_count: 0,
    modified_files: [],
    model: record.model ?? null,
    models_used: record.model ? [record.model] : [],
  });
}

function recordStepAnomaly(run, type, record) {
  const anomaly = {
    type,
    step: record?.step ?? null,
    active_step: run.active_step ?? null,
    ts: record?.ts ?? null,
    hook_event: record?.hook_event ?? null,
    status: record?.status ?? null,
  };

  run.step_anomaly_count += 1;
  run.step_anomalies.push(anomaly);
}

function closeActiveStep(run, endTs, endTsMs, endReason) {
  const activeStep = run.active_step;
  if (!activeStep) {
    return;
  }

  const windows = ensureArray(run.step_windows[activeStep]);
  const currentWindow = windows[windows.length - 1] || null;

  if (currentWindow && !currentWindow.end_ts) {
    currentWindow.end_ts = endTs ?? currentWindow.start_ts ?? null;
    currentWindow.end_ts_ms =
      typeof endTsMs === "number" ? endTsMs : currentWindow.start_ts_ms ?? null;
    currentWindow.end_reason = endReason ?? "step_done";

    if (
      typeof currentWindow.start_ts_ms === "number" &&
      typeof currentWindow.end_ts_ms === "number"
    ) {
      incrementValueByGroup(
        run.step_durations,
        activeStep,
        Math.max(0, currentWindow.end_ts_ms - currentWindow.start_ts_ms),
      );
    }
  }

  run.active_step = null;
  run.active_step_started_at = null;
  run.active_step_started_at_ms = null;
}

function openStepWindow(run, step, record) {
  if (!step) {
    return;
  }

  if (!Array.isArray(run.step_windows[step])) {
    run.step_windows[step] = [];
  }

  run.step_windows[step].push({
    seq: run.step_windows[step].length + 1,
    start_ts: record.ts,
    start_ts_ms: record.ts_ms,
    end_ts: null,
    end_ts_ms: null,
    end_reason: null,
  });

  run.active_step = step;
  run.active_step_started_at = record.ts;
  run.active_step_started_at_ms = record.ts_ms;
}

function assignToolEventToStep(run, record) {
  const step = run.active_step || UNSCOPED_STEP;
  record.step = step;
  record.step_source = run.active_step ? "active_run" : "unscoped";
  incrementValueByGroup(run.tool_events_by_step, step, 1);
  return step;
}

function shouldRestartRun(run, record) {
  return (
    Boolean(run) &&
    record.record_type === "skill_trace" &&
    record.step === "discover" &&
    record.status === "start" &&
    run.step_events_count > 0
  );
}

function ensureRun(session, record, runRecords) {
  if (!record.skill) {
    return null;
  }

  const activeSkills = Object.keys(session.active_runs);
  for (const activeSkill of activeSkills) {
    if (activeSkill !== record.skill) {
      const summary = finalizeRun(
        session,
        activeSkill,
        record.ts,
        record.ts_ms,
        "skill_switched",
      );
      if (summary) {
        runRecords.push(summary);
      }
    }
  }

  let run = session.active_runs[record.skill] || null;
  if (shouldRestartRun(run, record)) {
    const summary = finalizeRun(
      session,
      record.skill,
      record.ts,
      record.ts_ms,
      "new_discover_started",
    );
    if (summary) {
      runRecords.push(summary);
    }
    run = null;
  }

  if (!run) {
    run = createRun(session, record);
    session.active_runs[record.skill] = run;
  }

  return normalizeRunState(run);
}

function ingestRecordIntoRun(run, record) {
  normalizeRunState(run);
  run.events_count += 1;
  run.last_event_at = record.ts;
  run.last_event_at_ms = record.ts_ms;
  run.last_hook_event = record.hook_event;
  run.conversation_id = record.conversation_id ?? run.conversation_id;
  run.cursor_session_id = record.cursor_session_id ?? run.cursor_session_id;
  run.model = record.model ?? run.model ?? null;
  if (!Array.isArray(run.models_used)) {
    run.models_used = [];
  }
  addUnique(run.models_used, record.model);

  if (record.record_type === "skill_trace") {
    run.has_trace = true;
    run.run_source = "trace";
    run.step_events_count += 1;
    if (record.step) {
      run.step_statuses[record.step] = record.status ?? run.step_statuses[record.step] ?? null;
      if (record.status === "start") {
        addUnique(run.steps_started, record.step);
        if (run.active_step) {
          recordStepAnomaly(
            run,
            run.active_step === record.step
              ? "step_restarted_without_done"
              : "step_switched_without_done",
            record,
          );
          closeActiveStep(run, record.ts, record.ts_ms, "next_step_started");
        }
        openStepWindow(run, record.step, record);
      }
      if (record.status === "done") {
        addUnique(run.completed_steps, record.step);
        if (run.active_step === record.step) {
          closeActiveStep(run, record.ts, record.ts_ms, "step_done");
        } else {
          recordStepAnomaly(run, "step_done_without_active_match", record);
        }
      }
    }
    return;
  }

  if (record.record_type !== "tool_event") {
    return;
  }

  const toolName = record.tool_name || "unknown";
  const step = assignToolEventToStep(run, record);

  if (record.tool_stage === "before") {
    run.pre_tool_count += 1;
    incrementCounter(run.pre_tool_breakdown, toolName);
    incrementCounterByGroup(run.pre_tool_breakdown_by_step, step, toolName);
    return;
  }

  run.tool_count += 1;
  incrementCounter(run.tool_breakdown, toolName);
  incrementCounterByGroup(run.tool_breakdown_by_step, step, toolName);

  if (record.success === true) {
    run.success_tool_count += 1;
    incrementValueByGroup(run.success_tool_count_by_step, step, 1);
  }

  if (record.success === false) {
    run.failed_tool_count += 1;
    incrementValueByGroup(run.failed_tool_count_by_step, step, 1);
    run.error_count += 1;
    run.last_error = record.error ?? run.last_error;
    incrementCounter(run.failure_breakdown, record.failure_type || "error");
  }

  if (toolName.startsWith("MCP:")) {
    run.mcp_count += 1;
  }

  if (toolName === "Shell") {
    run.shell_count += 1;
  }

  if (FILE_EDIT_TOOL_NAMES.has(toolName)) {
    run.file_edit_count += 1;
    addUniqueMany(run.modified_files, ensureArray(record.modified_files));
    addUniqueManyByGroup(
      run.modified_files_by_step,
      step,
      ensureArray(record.modified_files),
    );
  }
}

function finalizeRun(session, skill, endTs, endTsMs, completionReason) {
  const run = session.active_runs[skill];
  if (!run) {
    return null;
  }

  normalizeRunState(run);
  closeActiveStep(run, endTs, endTsMs, completionReason || "run_finalized");
  delete session.active_runs[skill];

  const summaryTimestamp = createTimestamp();
  const finalEndTs = endTs || run.last_event_at;
  const finalEndTsMs =
    typeof endTsMs === "number" ? endTsMs : run.last_event_at_ms;
  const durationMs =
    typeof run.start_ts_ms === "number" && typeof finalEndTsMs === "number"
      ? Math.max(0, finalEndTsMs - run.start_ts_ms)
      : null;

  return {
    ...summaryTimestamp,
    record_type: "skill_run",
    skill_run_id: run.skill_run_id,
    session_id: run.session_id,
    conversation_id: run.conversation_id,
    cursor_session_id: run.cursor_session_id,
    skill: run.skill,
    status: run.error_count > 0 ? "completed_with_errors" : "completed",
    run_source: run.run_source,
    start_ts: run.start_ts,
    end_ts: finalEndTs,
    duration_ms: durationMs,
    completion_reason: completionReason,
    has_trace: run.has_trace,
    events_count: run.events_count,
    step_count: Object.keys(run.step_statuses).length,
    step_events_count: run.step_events_count,
    step_statuses: sortObjectByKey(run.step_statuses),
    steps_started: run.steps_started,
    completed_steps: run.completed_steps,
    tool_events_by_step: sortObjectByKey(run.tool_events_by_step),
    pre_tool_count: run.pre_tool_count,
    tool_count: run.tool_count,
    success_tool_count: run.success_tool_count,
    failed_tool_count: run.failed_tool_count,
    tool_breakdown: sortObjectByKey(run.tool_breakdown),
    pre_tool_breakdown: sortObjectByKey(run.pre_tool_breakdown),
    pre_tool_breakdown_by_step: sortNestedObjectByKey(run.pre_tool_breakdown_by_step),
    tool_breakdown_by_step: sortNestedObjectByKey(run.tool_breakdown_by_step),
    success_tool_count_by_step: sortObjectByKey(run.success_tool_count_by_step),
    failed_tool_count_by_step: sortObjectByKey(run.failed_tool_count_by_step),
    modified_files_by_step: sortNestedObjectByKey(run.modified_files_by_step),
    step_windows: sortNestedObjectByKey(run.step_windows),
    step_durations: sortObjectByKey(run.step_durations),
    step_anomaly_count: run.step_anomaly_count,
    step_anomalies: run.step_anomalies,
    error_count: run.error_count,
    last_error: run.last_error,
    failure_breakdown: sortObjectByKey(run.failure_breakdown),
    mcp_count: run.mcp_count,
    shell_count: run.shell_count,
    file_edit_count: run.file_edit_count,
    modified_files: run.modified_files,
    model: run.model ?? null,
    models_used: [...(run.models_used || [])].sort(),
    first_hook_event: run.first_hook_event,
    last_hook_event: run.last_hook_event,
  };
}

function finalizeAllRuns(session, endTs, endTsMs, reason) {
  const summaries = [];

  for (const skill of Object.keys(session.active_runs)) {
    const summary = finalizeRun(session, skill, endTs, endTsMs, reason);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

function updateRunState(state, records) {
  const runRecords = [];

  for (const record of records) {
    const session = getSessionState(state, record);
    if (!session) {
      continue;
    }

    if (
      record.record_type === "lifecycle_event" &&
      record.hook_event === "stop"
    ) {
      runRecords.push(
        ...finalizeAllRuns(session, record.ts, record.ts_ms, "agent_stop"),
      );
      continue;
    }

    if (!record.skill) {
      continue;
    }

    const run = ensureRun(session, record, runRecords);
    if (!run) {
      continue;
    }

    ingestRecordIntoRun(run, record);

    if (
      record.record_type === "skill_trace" &&
      record.step === "deliver" &&
      record.status === "done"
    ) {
      const summary = finalizeRun(
        session,
        record.skill,
        record.ts,
        record.ts_ms,
        "deliver_done",
      );
      if (summary) {
        runRecords.push(summary);
      }
    }
  }

  return runRecords;
}

function buildHookResponse(eventName) {
  if (eventName === "preToolUse") {
    return { permission: "allow" };
  }

  return {};
}

async function main() {
  const eventName = process.argv[2] || "unknown";
  const raw = await readStdin();
  const payload = parsePayload(raw);
  const records = buildRecords(eventName, payload);

  await withLock(async () => {
    const state = loadState();
    const runRecords = updateRunState(state, records);

    appendRecords(EVENT_LOG_FILE, records);
    appendRecords(RUNS_LOG_FILE, runRecords);
    saveJson(STATE_FILE, state);
  });

  process.stdout.write(`${JSON.stringify(buildHookResponse(eventName))}\n`);
}

main().catch(() => {
  process.stdout.write("{}\n");
  process.exit(0);
});
