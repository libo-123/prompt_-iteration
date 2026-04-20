#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const TRACE_LINE_RE = /^\[SKILL_TRACE\]\s+(.*)$/gm;
const TRACE_KV_RE = /([a-zA-Z0-9_-]+)=(".*?"|\S+)/g;
const SKILL_PATH_RE =
  /(?:^|\/)\.(?:cursor\/skills(?:-cursor)?|claude\/skills)\/([^/]+)\/SKILL\.md$/;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const LOG_FILE =
  process.env.SKILL_TRACE_LOG_FILE ||
  path.join(PROJECT_ROOT, ".cursor", "logs", "skill-trace.jsonl");

/** 统计时间，精确到ms */
function utcNow() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}:${pad(now.getMilliseconds())}`;
}

/**
 * Hook 通过 stdin 传 JSON，这里统一收集完整原始输入。
 * @returns {Promise<string>} 原始输入
 */
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

/**
 * 解析 hook payload；如果输入不是合法 JSON，也保留原始内容避免直接丢失线索。
 * @param {string} raw 原始输入
 * @returns {Object} 解析后的负载
 */
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

/**
 * 深度遍历 payload 中所有字符串字段，方便在任意层级抓取 SKILL_TRACE 文本。
 * @param {*} value 值
 * @returns {Generator<string>} 字符串生成器
 */
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

/**
 * 从不稳定的 hook payload 结构里按候选字段名兜底查找目标值。
 * @param {*} value 值
 * @param {Array} keys 候选字段名数组
 * @returns {string} 目标值
 */
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

/**
 * 不同 hook 事件对会话标识的字段命名不一致，这里统一抽取为 session_id。
 * @param {Object} payload 事件负载
 * @returns {string} 会话标识
 */
function extractSessionId(payload) {
  return normalizeScalar(
    deepFind(payload, [
      "session_id",
      "sessionId",
      "conversation_id",
      "conversationId",
      "request_id",
      "requestId",
    ])
  );
}

/**
 * 工具名有时在顶层，有时嵌在 tool 对象里，这里统一做兼容处理。
 * @param {Object} payload 事件负载
 * @returns {string} 工具名
 */
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

/**
 * 时长字段在不同事件里也可能使用不同命名，统一归并到 duration_ms。
 * @param {Object} payload 事件负载
 * @returns {string} 时长
 */
function extractDurationMs(payload) {
  return normalizeScalar(
    deepFind(payload, [
      "duration_ms",
      "durationMs",
      "elapsed_ms",
      "elapsedMs",
      "latency_ms",
      "duration",
    ])
  );
}

function extractError(payload) {
  return normalizeScalar(
    deepFind(payload, ["error", "failure_reason", "stderr", "message"])
  );
}

function extractTranscriptPath(payload) {
  return normalizeScalar(deepFind(payload, ["transcript_path", "transcriptPath"]));
}

function extractToolInput(payload) {
  return deepFind(payload, ["tool_input", "toolInput", "input"]);
}

function normalizePathForMatch(filePath) {
  return typeof filePath === "string" ? filePath.replace(/\\/g, "/") : null;
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

      const content = Array.isArray(entry.message?.content) ? entry.message.content : [];
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

/**
 * 将一行 `key=value` 形式的 trace 文本转成结构化对象。
 * @param {string} traceBody 一行 trace 文本
 * @returns {Object} 结构化对象
 */
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

/**
 * 从 afterAgentResponse 的任意文本字段中提取 `[SKILL_TRACE]` 并转成日志记录。
 * @param {string} eventName 事件名称
 * @param {Object} payload 事件负载
 * @returns {Array} 技能追踪日志记录数组
 */
function buildTraceRecords(eventName, payload) {
  const records = [];
  const sessionId = extractSessionId(payload);

  for (const text of collectStrings(payload)) {
    for (const match of text.matchAll(TRACE_LINE_RE)) {
      const rawLine = match[0].trim();
      const parsed = parseTracePairs(match[1]);

      if (Object.keys(parsed).length === 0) {
        continue;
      }

      records.push({
        ts: utcNow(),
        record_type: "skill_trace",
        hook_event: eventName,
        session_id: sessionId,
        skill: parsed.skill ?? null,
        step: parsed.step ?? null,
        status: parsed.status ?? null,
        raw_line: rawLine,
      });
    }
  }

  return records;
}

/**
 * 将工具调用事件压平成单条日志，便于后续按成功率和耗时聚合分析。
 * @param {string} eventName 事件名称
 * @param {Object} payload 事件负载
 * @returns {Object} 工具事件日志记录
 */
function buildToolRecord(eventName, payload) {
  const topLevelKeys =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload).sort()
      : [];
  const skillContext = extractSkillContext(payload);

  return {
    ts: utcNow(),
    record_type: "tool_event",
    hook_event: eventName,
    session_id: extractSessionId(payload),
    tool_name: extractToolName(payload),
    skill: skillContext.skill,
    skill_source: skillContext.source,
    success: eventName === "postToolUse",
    duration_ms: extractDurationMs(payload),
    error: eventName === "postToolUseFailure" ? extractError(payload) : null,
    // 工具事件包含的顶层 payload 字段名（至多20个），便于分析结构
    payload_keys: topLevelKeys.slice(0, 20),
  };
}

/**
 * 统一使用 jsonl 追加写入，降低实现复杂度，也方便后续流式分析。
 * @param {Array} records 日志记录数组
 */
function appendRecords(records) {
  if (!records || records.length === 0) {
    return;
  }

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.appendFileSync(LOG_FILE, lines, "utf8");
}

/**
 * 主函数
 * 根据 hook 事件类型分流：回复事件产出 skill_trace，工具事件产出 tool_event。
 */
async function main() {
  const eventName = process.argv[2] || "unknown";
  const raw = await readStdin();
  const payload = parsePayload(raw);

  if (eventName === "afterAgentResponse") {
    appendRecords(buildTraceRecords(eventName, payload));
  } else if (eventName === "postToolUse" || eventName === "postToolUseFailure") {
    appendRecords([buildToolRecord(eventName, payload)]);
  }

  process.stdout.write("{}\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
  process.exit(0);
});
