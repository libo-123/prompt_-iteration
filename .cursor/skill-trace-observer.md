# Skill Trace 观察器说明

## 1. 这是什么

这是一个基于 Cursor Hooks 的轻量观察器，用来记录两类信息：

1. `Skill` 自己显式输出的阶段轨迹，也就是正文里形如 `[SKILL_TRACE] skill=xxx step=xxx status=start|done` 的标记
2. Agent 在执行过程中触发的工具调用、失败、停止等 Hook 事件

它最终会把数据写进 3 个文件：

- `logs/skill-trace.jsonl`：最细粒度的原始事件流
- `logs/skill-trace-state.json`：当前会话和活跃 run 的内存态快照
- `logs/runs.jsonl`：已经完成的 run 汇总记录

一句话理解：

- `skill-trace.jsonl` 看“每一步发生了什么”
- `skill-trace-state.json` 看“现在跟踪到哪了”
- `runs.jsonl` 看“这次 Skill 最终跑成什么样”

---

## 2. 整体工作流

### 2.1 触发链路

`hooks.json` 把多个 Cursor Hook 事件都绑定到 `hooks/skill_trace_logger.js`：

- `preToolUse`
- `postToolUse`
- `postToolUseFailure`
- `afterAgentResponse`
- `stop`

脚本收到事件后会做三件事：

1. 从 Hook payload 中抽取上下文，构造成统一记录
2. 追加写入 `logs/skill-trace.jsonl`
3. 更新 `logs/skill-trace-state.json`，必要时产出 run 汇总并写入 `logs/runs.jsonl`

### 2.2 数据来源

观察器有两种来源：

#### A. 显式 Trace

当 Skill 内容里主动输出：

```text
[SKILL_TRACE] skill=skill-trace-demo step=discover status=start
```

这类内容会在 `afterAgentResponse` 阶段被解析成 `record_type=skill_trace` 记录。

#### B. 工具事件

当 Agent 调用了 `ReadFile`、`Shell`、`MCP` 等工具时，Hook 会记录：

- 工具名
- 调用前后
- 是否成功
- 耗时
- 错误信息
- 是否推断属于某个 Skill

这类会写成 `record_type=tool_event`。

### 2.3 run 是怎么结束的

一个 Skill run 会在以下场景被收口并写入 `runs.jsonl`：

- 命中 `deliver done`：认为这次显式 Skill 流程完成
- Agent 触发 `stop`
- 切换到了另一个 Skill
- 同一 Skill 又出现了新的 `discover start`

---

## 3. 三个日志文件说明

## 3.1 `logs/skill-trace.jsonl`

### 作用

原始事件日志。每一行都是一条 JSON 记录，适合排查细节、还原时序、做二次分析。

### 支持的记录类型

#### `record_type: "skill_trace"`

来自正文中的 `[SKILL_TRACE] ...` 行。

常见字段：

| 字段 | 含义 |
| --- | --- |
| `ts` | UTC 时间字符串，格式为 `YYYY-MM-DD HH:mm:ss:SSS` |
| `ts_ms` | 毫秒时间戳 |
| `hook_event` | 触发来源，这类通常是 `afterAgentResponse` |
| `session_id` | 归一化后的会话 ID，优先取 `conversation_id`，其次 `session_id`，再其次 `request_id` |
| `conversation_id` | Cursor 对话 ID |
| `cursor_session_id` | Cursor Session ID |
| `request_id` | 请求 ID，没有时为 `null` |
| `record_type` | 固定为 `skill_trace` |
| `skill` | Skill 名称，如 `skill-trace-demo` |
| `step` | 当前阶段，如 `discover` / `plan` / `deliver` |
| `status` | 当前阶段状态，通常是 `start` 或 `done` |
| `raw_line` | 被解析到的原始 trace 行 |

#### `record_type: "tool_event"`

来自工具调用 Hook。

常见字段：

| 字段 | 含义 |
| --- | --- |
| `ts` / `ts_ms` | 记录时间 |
| `hook_event` | `preToolUse` / `postToolUse` / `postToolUseFailure` |
| `session_id` / `conversation_id` / `cursor_session_id` / `request_id` | 会话上下文 |
| `record_type` | 固定为 `tool_event` |
| `tool_use_id` | 这次工具调用的唯一标识 |
| `tool_name` | 工具名，如 `Read`、`Shell`、`MCP:yuque_get_user` |
| `tool_stage` | `before` 或 `after` |
| `skill` | 推断出的 Skill 名称，推不出来就是 `null` |
| `skill_source` | Skill 来源，可能是 `tool_input`、`transcript` 或 `null` |
| `success` | 调用是否成功；调用前为 `null` |
| `duration_ms` | 工具耗时；仅调用后或失败后有值 |
| `error` | 失败时的错误信息 |
| `failure_type` | 失败类型 |
| `is_interrupt` | 是否是中断导致 |
| `cwd` | 工作目录，若 payload 里带了的话 |
| `modified_files` | 文件编辑工具识别出的变更文件列表 |
| `payload_keys` | 原始 payload 顶层 key 的采样，方便排查 |

#### `record_type: "lifecycle_event"`

来自 `stop` Hook。

常见字段：

| 字段 | 含义 |
| --- | --- |
| `record_type` | 固定为 `lifecycle_event` |
| `hook_event` | 固定为 `stop` |
| `stop_reason` | 停止原因，如 `completed` |

### 使用建议

- 查某个 Skill 的步骤流转：过滤 `record_type=skill_trace`
- 查工具到底有没有执行成功：过滤 `record_type=tool_event`
- 查一次对话为什么结束：看 `lifecycle_event`

---

## 3.2 `logs/skill-trace-state.json`

### 作用

这是聚合后的“当前状态文件”，相当于观察器的内存快照落盘。

它不记录完整历史，而是维护：

- 当前有哪些 `session`
- 每个 `session` 正在运行哪些 Skill
- 每个活跃 run 当前累计了哪些统计

### 顶层结构

| 字段 | 含义 |
| --- | --- |
| `version` | 状态结构版本，目前是 `2` |
| `sessions` | 以 `session_id` 为 key 的会话字典 |

### `sessions.<session_id>` 字段

| 字段 | 含义 |
| --- | --- |
| `session_id` | 当前会话 ID |
| `conversation_id` | 对话 ID |
| `cursor_session_id` | Cursor Session ID |
| `started_at` / `started_at_ms` | 首次看到此 session 的时间 |
| `updated_at` / `updated_at_ms` | 最近一次处理到该 session 的时间 |
| `next_run_seq` | 下一个 run 的自增序号 |
| `active_runs` | 当前仍未 finalize 的 Skill run |

### `active_runs.<skill>` 字段

| 字段 | 含义 |
| --- | --- |
| `skill_run_id` | run 唯一 ID，格式为 `<session>:<seq>:<skill>` |
| `session_id` / `conversation_id` / `cursor_session_id` | 所属会话信息 |
| `skill` | Skill 名称 |
| `run_source` | `trace` 或 `tool_only` |
| `start_ts` / `start_ts_ms` | run 起始时间 |
| `last_event_at` / `last_event_at_ms` | 最近一条事件时间 |
| `first_hook_event` / `last_hook_event` | 第一次和最后一次看到的 Hook 事件 |
| `has_trace` | 是否收到过显式 `[SKILL_TRACE]` |
| `events_count` | 总事件数 |
| `step_events_count` | step 类事件数 |
| `step_statuses` | 每个 step 的最后状态 |
| `steps_started` | 开始过的 step 列表 |
| `completed_steps` | 完成过的 step 列表 |
| `pre_tool_count` | 工具调用前事件数 |
| `tool_count` | 工具调用完成后的事件数 |
| `success_tool_count` | 成功工具数 |
| `failed_tool_count` | 失败工具数 |
| `tool_breakdown` | 成功/完成后的工具名统计 |
| `pre_tool_breakdown` | 调用前的工具名统计 |
| `error_count` | 错误次数 |
| `last_error` | 最近一次错误信息 |
| `failure_breakdown` | 失败类型分布 |
| `mcp_count` | `MCP:*` 工具调用数 |
| `shell_count` | `Shell` 工具调用数 |
| `file_edit_count` | 文件编辑工具调用数 |
| `modified_files` | 已识别的被编辑文件列表 |

### 使用建议

- 看“现在有没有未完成 run”：直接看 `active_runs`
- 看某个 Skill 当前累积了多少工具调用：看 `tool_count`、`tool_breakdown`
- 看某次过程中是否已经发生错误：看 `error_count`、`last_error`

---

## 3.3 `logs/runs.jsonl`

### 作用

这是“已完成 run 的汇总日志”。一行代表一轮 Skill 执行的最终摘要，适合做统计、看板、回顾分析。

### 常见字段

| 字段 | 含义 |
| --- | --- |
| `ts` / `ts_ms` | 生成汇总记录的时间 |
| `record_type` | 固定为 `skill_run` |
| `skill_run_id` | run 唯一 ID |
| `session_id` / `conversation_id` / `cursor_session_id` | 所属会话 |
| `skill` | Skill 名称 |
| `status` | `completed` 或 `completed_with_errors` |
| `run_source` | `trace` 或 `tool_only` |
| `start_ts` | 起始时间 |
| `end_ts` | 结束时间 |
| `duration_ms` | 总时长 |
| `completion_reason` | 结束原因，如 `deliver_done`、`agent_stop`、`skill_switched`、`new_discover_started` |
| `has_trace` | 是否有显式 step trace |
| `events_count` | 总事件数 |
| `step_count` | 一共出现了多少个 step |
| `step_events_count` | step 事件总数 |
| `step_statuses` | 每个 step 的最终状态 |
| `steps_started` | 启动过的 step 列表 |
| `completed_steps` | 完成过的 step 列表 |
| `pre_tool_count` | 工具前置事件数 |
| `tool_count` | 完成后的工具事件数 |
| `success_tool_count` | 成功工具数 |
| `failed_tool_count` | 失败工具数 |
| `tool_breakdown` | 工具分布统计 |
| `pre_tool_breakdown` | 调用前工具分布统计 |
| `error_count` | 错误总数 |
| `last_error` | 最后一条错误 |
| `failure_breakdown` | 错误类型统计 |
| `mcp_count` | MCP 调用次数 |
| `shell_count` | Shell 调用次数 |
| `file_edit_count` | 文件编辑次数 |
| `modified_files` | run 中修改过的文件 |
| `first_hook_event` / `last_hook_event` | 首尾 Hook 事件 |

### 使用建议

- 做 Skill 成功率统计：看 `status`
- 做链路耗时统计：看 `duration_ms`
- 做工具依赖分析：看 `tool_breakdown`、`mcp_count`、`shell_count`
- 做“哪些 Skill 真改了文件”分析：看 `file_edit_count`、`modified_files`

---

## 4. `hooks/skill_trace_logger.js` 的作用

## 4.1 核心职责

这个脚本是整个观察器的核心处理器，负责把 Cursor Hook 原始 payload 转成可分析日志。

它主要完成 6 件事：

1. 读取 stdin 里的 Hook payload
2. 根据事件类型构造标准化记录
3. 从正文中解析 `[SKILL_TRACE] ...` 行
4. 从工具输入或 transcript 推断当前属于哪个 Skill
5. 维护 session / run 状态机
6. 在合适时机产出 run summary

## 4.2 文件内重要常量

| 常量 | 作用 |
| --- | --- |
| `TRACE_LINE_RE` | 匹配 `[SKILL_TRACE] ...` 整行 |
| `TRACE_KV_RE` | 解析 `skill=... step=... status=...` 键值对 |
| `SKILL_PATH_RE` | 从 `.../.cursor/skills/<name>/SKILL.md` 路径提取 Skill 名 |
| `PROJECT_ROOT` | 项目根目录 |
| `LOG_DIR` | 日志目录 `.cursor/logs` |
| `EVENT_LOG_FILE` | 事件日志文件，默认 `skill-trace.jsonl` |
| `RUNS_LOG_FILE` | run 汇总文件，默认 `runs.jsonl` |
| `STATE_FILE` | 状态文件，默认 `skill-trace-state.json` |
| `LOCK_DIR` | 文件锁目录，避免并发写坏文件 |
| `FILE_EDIT_TOOL_NAMES` | 被认为是“文件编辑类”的工具集合 |

## 4.3 主要函数说明

下面按职责分组说明。

### A. 时间、输入与基础工具

| 函数 | 作用 |
| --- | --- |
| `utcNow()` | 生成 UTC 字符串时间 |
| `createTimestamp()` | 同时生成 `ts` 和 `ts_ms` |
| `sleep(ms)` | 锁竞争时短暂等待 |
| `readStdin()` | 读取 Hook 传入的 stdin 文本 |
| `parsePayload(raw)` | 优先按 JSON 解析；失败时保留 `_raw` |

### B. 通用数据处理

| 函数 | 作用 |
| --- | --- |
| `collectStrings(value)` | 深度遍历任意结构，收集其中所有字符串 |
| `deepFind(value, keys)` | 在嵌套对象/数组里按 key 名递归查值 |
| `normalizeScalar(value)` | 把复杂值压成可序列化标量 |
| `normalizePathForMatch(filePath)` | 统一路径分隔符，便于正则匹配 |
| `ensureArray(value)` | 保证返回数组 |
| `addUnique(list, value)` | 去重追加单个值 |
| `addUniqueMany(list, values)` | 去重追加多个值 |
| `incrementCounter(counter, key)` | 计数字典加一 |
| `sortObjectByKey(value)` | 按 key 排序对象，方便输出稳定 |

### C. 状态文件读写

| 函数 | 作用 |
| --- | --- |
| `defaultState()` | 返回默认状态结构 |
| `safeReadJson(filePath, fallbackValue)` | 安全读取 JSON，失败则返回兜底值 |
| `loadState()` | 读取并修正 `skill-trace-state.json` |
| `saveJson(filePath, value)` | 原子写入 JSON，先写临时文件再 rename |
| `withLock(callback)` | 用目录锁包裹读写，避免并发冲突 |

### D. 从 Hook payload 提取上下文

| 函数 | 作用 |
| --- | --- |
| `extractConversationId(payload)` | 抽取 `conversation_id` |
| `extractCursorSessionId(payload)` | 抽取 `session_id` |
| `extractRequestId(payload)` | 抽取 `request_id` |
| `extractSessionContext(payload)` | 统一生成 session 相关上下文 |
| `extractSessionId(payload)` | 返回归一化后的 `session_id` |
| `extractToolName(payload)` | 抽取工具名 |
| `extractToolUseId(payload)` | 抽取工具调用 ID |
| `extractDurationMs(payload)` | 抽取耗时 |
| `extractFailureType(payload)` | 抽取失败类型 |
| `extractError(payload)` | 抽取错误信息 |
| `extractInterruptFlag(payload)` | 抽取是否中断 |
| `extractTranscriptPath(payload)` | 抽取 transcript 路径 |
| `extractToolInput(payload)` | 抽取工具输入对象 |
| `extractWorkingDirectory(payload)` | 抽取工作目录 |
| `extractModifiedFiles(toolName, toolInput)` | 若是文件编辑工具，则推断被修改文件 |

### E. Skill 识别逻辑

| 函数 | 作用 |
| --- | --- |
| `extractSkillFromPath(filePath)` | 从 `.../skills/<skill>/SKILL.md` 路径提取 Skill |
| `extractSkillFromText(text)` | 从文本中识别 Skill，如 `读取并应用 \`yuque\`` 或 `skill=xxx` |
| `extractSkillFromToolUse(item)` | 从 transcript 里的工具调用片段识别 Skill |
| `extractSkillContextFromTranscript(transcriptPath)` | 扫 transcript，推断当前最近激活的 Skill |
| `extractSkillContext(payload)` | 先从 `tool_input.path` 推断，不行再回退到 transcript |

### F. Trace / Tool / 生命周期记录构建

| 函数 | 作用 |
| --- | --- |
| `parseTracePairs(traceBody)` | 解析 `[SKILL_TRACE]` 后面的键值对 |
| `buildBaseRecord(eventName, payload)` | 构建公共字段部分 |
| `buildTraceRecords(eventName, payload)` | 生成 `skill_trace` 记录数组 |
| `buildToolRecord(eventName, payload)` | 生成单条 `tool_event` 记录 |
| `buildLifecycleRecord(eventName, payload)` | 生成 `lifecycle_event` 记录 |
| `buildRecords(eventName, payload)` | 按事件类型路由到正确构建器 |
| `appendRecords(filePath, records)` | 追加写入 JSONL |

### G. run 状态机与汇总

| 函数 | 作用 |
| --- | --- |
| `getSessionState(state, record)` | 取或创建当前 session 状态 |
| `createRun(session, record)` | 创建新的 run 对象 |
| `shouldRestartRun(run, record)` | 判断是否应因为新的 `discover start` 重启 run |
| `ensureRun(session, record, runRecords)` | 保证某个 skill 有活跃 run；必要时 finalize 旧 run |
| `ingestRecordIntoRun(run, record)` | 把事件累计进 run 统计 |
| `finalizeRun(session, skill, endTs, endTsMs, completionReason)` | 结束单个 run 并生成汇总记录 |
| `finalizeAllRuns(session, endTs, endTsMs, reason)` | 结束当前 session 的所有 run |
| `updateRunState(state, records)` | 批量消费记录、更新状态、产出汇总 |

### H. Hook 返回与主入口

| 函数 | 作用 |
| --- | --- |
| `buildHookResponse(eventName)` | 给 Hook 返回响应；`preToolUse` 返回 `{ permission: "allow" }` |
| `main()` | 主入口：读取输入、构建记录、加锁写盘、输出 Hook 响应 |

## 4.4 这个脚本的关键设计点

### 1. 既支持“显式 trace”，也支持“隐式工具跟踪”

即使 Skill 没有输出 `[SKILL_TRACE]`，只要发生了工具调用，并且能从上下文推断出属于某个 Skill，也能形成 `tool_only` 类型的 run。

### 2. 用 transcript 回溯 Skill 上下文

如果当前工具调用本身没有直接暴露 Skill 名，脚本会读 transcript，从最近一次 assistant 内容里找：

- `ReadFile` 读取某个 `SKILL.md`
- 文本里出现 `读取并应用 \`xxx\``
- 文本里出现 `skill=xxx`

### 3. 用目录锁避免并发写损坏

多个 Hook 可能几乎同时触发，`withLock()` 用 `mkdir` 目录锁串行化写入，避免：

- JSON 文件写坏
- 状态覆盖
- 汇总丢失

### 4. 原子写状态文件

`saveJson()` 采用“先写 `.tmp` 再 rename”的方式，降低状态文件半写入风险。

---

## 5. `hooks.json` 的作用

`hooks.json` 是 Cursor Hook 的配置入口，决定“什么时候调用观察器”。

当前配置等价于：

- 每次工具调用前，执行 `node .cursor/hooks/skill_trace_logger.js preToolUse`
- 每次 Agent 输出后，执行 `node .cursor/hooks/skill_trace_logger.js afterAgentResponse`
- 每次工具成功返回后，执行 `node .cursor/hooks/skill_trace_logger.js postToolUse`
- 每次工具失败后，执行 `node .cursor/hooks/skill_trace_logger.js postToolUseFailure`
- 每次会话停止时，执行 `node .cursor/hooks/skill_trace_logger.js stop`

另外还有一条独立配置：

- `afterFileEdit` 会触发 `.cursor/hooks/format.sh`

这说明当前 `hooks.json` 同时承担两件事：

1. 把 Skill Trace 观察器挂到多个 Hook 事件上
2. 在文件编辑后执行格式化脚本

如果没有 `hooks.json` 里的这些配置，`skill_trace_logger.js` 本身不会自动运行。

---

## 6. 怎么使用这个观察器

## 6.1 最小使用方式

只要满足下面两个条件，观察器就能工作：

1. `hooks.json` 已经把相关 Hook 指向 `skill_trace_logger.js`
2. 发生了工具调用，或者 Skill 输出了 `[SKILL_TRACE]` 标记

### 场景 A：只观察工具调用

即使不写显式 trace，只要某个 Skill 被触发并发生了工具调用，观察器也会：

- 在 `skill-trace.jsonl` 里留下 `tool_event`
- 在 `skill-trace-state.json` 里形成 `tool_only` 类型 active run
- 在 run 结束时写入 `runs.jsonl`

### 场景 B：观察完整步骤流

如果希望看到更清晰的阶段轨迹，就在 Skill 文本里显式写：

```text
[SKILL_TRACE] skill=my-skill step=discover status=start
...
[SKILL_TRACE] skill=my-skill step=discover status=done
```

推荐至少对关键步骤写成成对标记：

- `discover`
- `analyze`
- `plan`
- `execute`
- `verify`
- `deliver`

## 6.2 推荐写法

建议在 `SKILL.md` 或实际执行输出中使用统一格式：

```text
[SKILL_TRACE] skill=your-skill-name step=discover status=start
[SKILL_TRACE] skill=your-skill-name step=discover status=done
```

约定建议：

- `skill`：固定写 Skill 名
- `step`：使用稳定、可枚举的阶段名
- `status`：优先用 `start` / `done`

这样后续做统计最稳定。

## 6.3 运行后怎么看

### 看细节

打开 `logs/skill-trace.jsonl`，按时间顺序看：

- 哪个 step 开始了
- 哪个工具被调用了
- 工具有没有失败
- 最后是否收到了 `stop`

### 看当前态

打开 `logs/skill-trace-state.json`，看：

- 哪个 session 还挂着 active run
- 当前 run 已累计了哪些步骤和工具

### 看结果摘要

打开 `logs/runs.jsonl`，看：

- 某次 Skill 总耗时
- 是否报错
- 用了哪些工具
- 有没有改文件

## 6.4 用 demo 验证

仓库里已有一个演示 Skill：`skills/skill-trace-demo/SKILL.md`。

它固定输出 6 个步骤：

1. `discover`
2. `analyze`
3. `plan`
4. `execute`
5. `verify`
6. `deliver`

你触发它后，应该能看到：

- `skill-trace.jsonl` 出现 12 条 `skill_trace` 记录
- `runs.jsonl` 出现 1 条 `skill_run` 汇总
- `completion_reason=deliver_done`
- `step_statuses` 里 6 个步骤都是 `done`

## 6.5 适合怎么扩展

这个观察器很适合继续扩展成：

- Skill 成功率统计
- 常用工具分布分析
- 平均耗时分析
- 失败原因 Top N
- 改文件行为统计
- “有显式 trace” 和 “仅工具跟踪” 的覆盖率分析

---

## 7. 一些注意点

### 1. 只有显式 `[SKILL_TRACE]` 才会有步骤级语义

如果只是调用了工具，没有写 trace，那么仍然能知道 run 存在，但不知道它处于 `discover` 还是 `verify`。

### 2. Skill 识别有推断成分

`tool_event.skill` 不是总能 100% 准确识别，因为它有时依赖 transcript 回溯和路径匹配。

### 3. `runs.jsonl` 只记录“已完成 run”

如果一个 run 还没 finalize，它只会出现在 `skill-trace-state.json` 的 `active_runs` 里，不会立刻进 `runs.jsonl`。

### 4. 文件编辑统计依赖工具名命中

只有工具名属于以下集合，才会累计到 `file_edit_count`：

- `Write`
- `Edit`
- `Delete`
- `MultiEdit`
- `EditNotebook`
- `TabWrite`

### 5. 当前 `preToolUse` 始终放行

`buildHookResponse()` 在 `preToolUse` 时固定返回：

```json
{ "permission": "allow" }
```

说明这个观察器目前只做“记录”，不做“拦截”。

---

## 8. 总结

这个观察器本质上是一个“基于 Cursor Hook 的 Skill 执行埋点系统”：

- `skill-trace.jsonl` 保存原始事件
- `skill-trace-state.json` 保存运行中状态
- `runs.jsonl` 保存完成后的汇总

而 `hooks/skill_trace_logger.js` 就是中间那层事件标准化、状态聚合和 run 收口逻辑；`hooks.json` 则是把它真正挂到 Cursor 生命周期上的入口。
