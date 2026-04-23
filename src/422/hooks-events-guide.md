# CodeFlicker Hooks 已实装事件说明

> 文档来源：`packages/agent/src/hooks/types.ts` — `ClaudeHookEventName`  
> 更新时间：2026-04-22

## 概述

CodeFlicker Hooks 系统提供了在 Agent 执行关键生命周期事件时自动触发外部处理器的能力。本文档详细说明当前已实装的事件类型及其使用方法。

---

## 已实装事件列表

### 1. SessionStart

**触发时机**：Agent 会话开始时（prompt 入口）

**可否阻断**：❌ 否

**matcherTarget**：`startup` / `resume`

**典型用途**：
- 注入环境上下文（如 git 状态、环境变量）
- 初始化会话配置
- 记录会话开始日志

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "SessionStart";
  source: "startup" | "resume";
  agentMode?: string;
}
```

**配置示例**：
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/inject-git-context.js",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

### 2. UserPromptSubmit

**触发时机**：用户提交 prompt、task 执行前

**可否阻断**：✅ **是**

**matcherTarget**：—

**典型用途**：
- 预处理用户输入
- 验证用户权限
- 添加上下文信息

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}
```

**配置示例**：
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/validate-prompt.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

---

### 3. PreToolUse

**触发时机**：工具执行前（所有工具）

**可否阻断**：✅ **是**

**matcherTarget**：工具名（如 `execute_command`、`write_to_file`）

**典型用途**：
- 拦截危险命令（如 `rm -rf /`）
- 改写工具入参
- 验证操作合法性

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, any>;
  tool_use_id: string;
}
```

**配置示例**：
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "execute_command",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/dangerous-command-check.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**脚本示例**（拦截危险命令）：
```javascript
#!/usr/bin/env node

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  
  const cmd = String(payload.tool_input?.command ?? '');
  
  // 检查危险命令
  if (/rm\s+-rf\s+\//.test(cmd) || /DROP\s+TABLE/i.test(cmd)) {
    process.stderr.write(`危险命令被阻断: ${cmd}`);
    process.exit(2); // 退出码 2 = 阻断
  }
  
  // 通过
  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}

main().catch(e => {
  process.stderr.write(String(e));
  process.exit(1);
});
```

---

### 4. PostToolUse

**触发时机**：工具执行成功后

**可否阻断**：❌ 否（但会追加文案）

**matcherTarget**：工具名

**典型用途**：
- 审计日志（记录文件变更）
- 替换工具返回内容
- 质量检查

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: any;
  tool_use_id: string;
}
```

**配置示例**：
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write_to_file|replace_in_file|multi_replace_in_file",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/audit-logger.js",
            "async": true
          }
        ]
      }
    ]
  }
}
```

---

### 5. PostToolUseFailure

**触发时机**：工具执行失败后

**可否阻断**：❌ 否

**matcherTarget**：工具名

**典型用途**：
- 错误上报
- 自动重试
- 异常监控

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "PostToolUseFailure";
  tool_name: string;
  error: any;
}
```

**配置示例**：
```json
{
  "hooks": {
    "PostToolUseFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/error-reporter.js",
            "async": true
          }
        ]
      }
    ]
  }
}
```

---

### 6. SubagentStart

**触发时机**：子 Agent 启动前

**可否阻断**：❌ 否

**matcherTarget**：subagent 类型名

**典型用途**：
- 子任务监控
- 记录子 Agent 启动日志

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "SubagentStart";
  agent_id: string;
  agent_type: string;
}
```

---

### 7. SubagentStop

**触发时机**：子 Agent 正常结束后

**可否阻断**：❌ 否（返回值未消费）

**matcherTarget**：subagent 类型名

**典型用途**：
- 子任务结果处理
- 记录子 Agent 完成日志

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "SubagentStop";
  agent_id: string;
  agent_type: string;
}
```

---

### 8. Stop

**触发时机**：Agent 任务成功完成时

**可否阻断**：✅ **是**

**matcherTarget**：—

**典型用途**：
- 质量门控制（lint/test 必须通过）
- 代码格式化
- 生成报告

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "Stop";
  last_assistant_message: string;
  tool_call_count: number;
  tool_error_count: number;
  debug_server_port?: number;
}
```

**配置示例**：
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx eslint . --max-warnings 0 && echo '{\"continue\":true}' || (echo '{}' && exit 2)",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

---

### 9. StopFailure

**触发时机**：Agent 任务因非正常原因停止时（API 错误、速率限制、最大迭代数等）

**可否阻断**：❌ 否

**matcherTarget**：—

**典型用途**：
- 错误通知
- 自动重试（如速率限制错误）
- 清理资源

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "StopFailure";
  stop_reason_type: string;
  stop_reason_message: string;
  tool_call_count: number;
  tool_error_count: number;
  debug_server_port?: number;
}
```

**配置示例**：
```json
{
  "hooks": {
    "StopFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/auto-retry-on-rate-limit.js",
            "async": true,
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

### 10. PreCompact

**触发时机**：上下文压缩开始前

**可否阻断**：❌ 否

**matcherTarget**：`auto` / `manual`

**典型用途**：
- 记录压缩前状态
- 备份重要上下文

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "PreCompact";
  trigger: "auto" | "manual";
}
```

---

### 11. PostCompact

**触发时机**：上下文压缩完成后

**可否阻断**：❌ 否

**matcherTarget**：`auto` / `manual`

**典型用途**：
- 分析压缩结果
- 记录压缩统计

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "PostCompact";
  trigger: "auto" | "manual";
  compact_summary?: string;
}
```

---

### 12. SessionEnd

**触发时机**：会话结束（finally 块）

**可否阻断**：❌ 否

**matcherTarget**：—

**典型用途**：
- 清理资源
- 生成会话报告
- 记录会话统计

**Payload 关键字段**：
```typescript
{
  session_id: string;
  cwd: string;
  hook_event_name: "SessionEnd";
  transcript_path?: string;
}
```

---

## 通用 Payload 字段

所有事件的 Payload 都包含以下基础字段：

```typescript
interface HookBaseInput {
  session_id: string;         // 会话 ID
  cwd: string;                // 当前工作目录（项目根目录）
  hook_event_name: string;    // 事件名
  transcript_path?: string;   // 预留，当前不填充
  permission_mode?: string;   // 预留，当前不填充
}
```

---

## HookResult 返回值说明

Hook 脚本通过 **stdout 输出 JSON** 或 **退出码** 来控制行为：

| 场景 | 返回方式 |
|------|---------|
| 通过（不做任何事）| 退出码 `0`，stdout 为空或 `{"continue":true}` |
| 阻断操作 | 退出码 `2`（stderr 作为 stopReason），或 `{"continue":false,"stopReason":"..."}` |
| 注入 LLM 上下文 | `{"continue":true,"additionalContext":"..."}` |
| 展示系统消息给用户 | `{"systemMessage":"..."}` |
| 改写工具入参（PreToolUse）| `{"hookSpecificOutput":{"updatedInput":{...}}}` |
| 替换工具返回内容（PostToolUse）| `{"hookSpecificOutput":{"replaceToolContextData":"新内容"}}` |

---

## Tool 类事件的 Matcher

`PreToolUse` / `PostToolUse` / `PostToolUseFailure` 的 `matcher` 字段是正则表达式，用于匹配工具名：

```jsonc
// 精确匹配单个工具
{ "matcher": "execute_command", ... }

// 正则匹配多个工具
{ "matcher": "write_to_file|replace_in_file|multi_replace_in_file", ... }

// 不填 matcher = 匹配所有工具
{ "hooks": [...] }
```

### 常用工具名

- `execute_command` — 执行 shell 命令
- `write_to_file` — 写入文件
- `replace_in_file` — 替换文件内容
- `multi_replace_in_file` — 多处替换
- `read_file` — 读取文件
- `list_files` — 列出目录
- `search_files` — 搜索文件内容
- `codebase_search` — 语义搜索
- `create_plan` — 创建计划

---

## 配置文件位置

Hooks 配置存储在 `settings.json` 中，按优先级从低到高：

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.codeflicker/settings.json` | 全局用户级 |
| 2 | `~/.claude/settings.json` | Claude Code 全局兼容 |
| 3 | `{cwd}/.codeflicker/settings.json` | 项目级 |
| 4 | `{cwd}/.codeflicker/settings.local.json` | 本地项目（gitignored）|
| 5 | `{cwd}/.claude/settings.json` | Claude Code 项目级兼容 |
| 6 | `{cwd}/.claude/settings.local.json` | Claude Code 本地兼容 |
| 7 | `{cwd}/.cursor/hooks.json` | Cursor 项目级兼容 |

同一事件的规则**全部注册**（不覆盖，低优先级先执行）。

---

## 查看执行日志

Hook 执行日志存储在：`~/.codeflicker/hooks.jsonl`

```bash
# 实时跟踪
tail -f ~/.codeflicker/hooks.jsonl

# 最近 20 条
tail -20 ~/.codeflicker/hooks.jsonl | jq '.'

# 按事件类型过滤
grep '"event":"PreToolUse"' ~/.codeflicker/hooks.jsonl

# 只看阻断记录
grep '"exitCode":2' ~/.codeflicker/hooks.jsonl
```

---

## 参考资料

- CodeFlicker Hooks Manager Skill
- `packages/agent/src/hooks/types.ts` — 类型定义源码
- 配置文件格式说明
- Hook 脚本示例集合
