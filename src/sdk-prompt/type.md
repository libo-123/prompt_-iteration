# 可观测性追踪器数据结构说明

本文档详细介绍了 ObservabilityTracker 中使用的各种数据结构和字段含义，帮助开发者理解追踪数据的组织方式。

## 1. Trace 级别元数据 (TraceData.metadata)

**说明：** Trace 是整个 Agent 会话的顶层追踪对象，包含了从用户提问到最终回答的完整过程统计。

| 统计类别                 | 指标名称            | 数据类型 | 说明                                                |
| ------------------------ | ------------------- | -------- | --------------------------------------------------- |
| **时间统计**       | total_duration_ms   | number   | 会话总耗时（毫秒），从 tracker 创建到 finish() 调用 |
| **调用统计**       | llm_calls           | number   | LLM 调用总次数，包括成功和失败的调用                |
|                          | tool_calls          | number   | 工具调用总次数，包括重试次数                        |
|                          | total_steps         | number   | 总执行步骤数 (llm_calls + tool_calls)               |
| **时间分布分析**   | llm_total_time_ms   | number   | LLM 调用累计耗时（毫秒），用于性能分析              |
|                          | tool_total_time_ms  | number   | 工具调用累计耗时（毫秒），包括重试时间              |
|                          | llm_time_ratio      | number   | LLM 耗时占比 (0-1)，用于识别性能瓶颈                |
|                          | tool_time_ratio     | number   | 工具耗时占比 (0-1)，用于识别性能瓶颈                |
| **Token 使用统计** | total_input_tokens  | number   | 输入 Token 总数，用于成本计算                       |
|                          | total_output_tokens | number   | 输出 Token 总数，用于成本计算                       |
|                          | total_tokens        | number   | Token 总数 (input + output)                         |
| **成本分析**       | llm_cost            | number   | LLM 调用总成本（美元），基于 Token 使用量计算       |
|                          | tool_cost           | number   | 工具调用总成本（美元），基于工具定价                |
|                          | total_cost          | number   | 总成本（美元）(llm_cost + tool_cost)                |
| **执行状态**       | success             | boolean  | 会话是否成功完成，用于成功率统计                    |
| **可视化统计**     | visualization_nodes | number   | 可视化节点总数，用于流程图生成                      |

## 2. LLM Span 元数据 (LLMSpan.metadata)

**说明：** LLM Span 记录单次 LLM 调用的详细信息，包括性能、成本、参数等。

| 类别                 | 字段名                | 数据类型 | 说明                                        |
| -------------------- | --------------------- | -------- | ------------------------------------------- |
| **模型信息**   | model                 | string   | 模型名称（如 "gpt-4", "claude-3-opus"）     |
| **Token 统计** | input_tokens          | number   | 输入 Token 数（提示词长度）                 |
|                      | output_tokens         | number   | 输出 Token 数（生成内容长度）               |
|                      | total_tokens          | number   | 总 Token 数 (input + output)                |
| **成本分析**   | input_cost            | number   | 输入成本（美元），基于输入 Token 计算       |
|                      | output_cost           | number   | 输出成本（美元），基于输出 Token 计算       |
|                      | total_cost            | number   | 总成本（美元）(input + output)              |
|                      | max_tokens            | number?  | 最大 Token 数限制                           |
|                      | top_p                 | number?  | 核采样参数 (0-1)，控制输出多样性            |
| **调用标识**   | call_sequence         | number   | 调用序列号，用于追踪调用顺序                |
|                      | call_type             | string   | 调用类型（planning, reasoning, generation） |
| **可视化字段** | langgraph_step        | number?  | LangGraph 步骤序号                          |
|                      | step                  | number?  | 步骤序号（同 langgraph_step）               |
|                      | langgraph_node        | string?  | LangGraph 节点名称                          |
|                      | node                  | string?  | 节点名称（同 langgraph_node）               |
|                      | observation_type      | string   | 观察类型（固定为 "GENERATION"）             |
|                      | parent_observation_id | string?  | 父观察 ID，用于构建调用层级                 |

## 3. Tool Span 元数据 (ToolSpan.metadata)

**说明：** Tool Span 记录单次工具调用的详细信息，包括执行状态、重试次数、成本等。

| 类别                 | 字段名                | 数据类型 | 说明                                              |
| -------------------- | --------------------- | -------- | ------------------------------------------------- |
| **工具信息**   | tool_name             | string   | 工具名称（如 "search_documents", "get_weather"）  |
|                      | tool_category         | string   | 工具类别（search, database, api, compute, other） |
|                      | tool_version          | string?  | 工具版本号，用于版本管理和问题排查                |
| **性能指标**   | duration_ms           | number   | 调用耗时（毫秒），包括所有重试时间                |
| **执行状态**   | success               | boolean  | 执行成功状态（true=成功, false=失败）             |
|                      | retry_count           | number   | 实际重试次数，用于可靠性分析                      |
|                      | cache_hit             | boolean  | 缓存命中状态（当前固定为 false）                  |
| **成本信息**   | cost                  | number   | 工具调用成本（美元），基于工具定价                |
| **错误信息**   | error_type            | string?  | 错误类型（失败时记录）                            |
|                      | error_message         | string?  | 错误消息（失败时记录）                            |
| **调用标识**   | call_sequence         | number   | 调用序列号，用于追踪调用顺序                      |
| **可视化字段** | langgraph_step        | number?  | LangGraph 步骤序号                                |
|                      | step                  | number?  | 步骤序号（同 langgraph_step）                     |
|                      | langgraph_node        | string?  | LangGraph 节点名称                                |
|                      | node                  | string?  | 节点名称（同 langgraph_node）                     |
|                      | observation_type      | string   | 观察类型（固定为 "TOOL"）                         |
|                      | parent_observation_id | string?  | 父观察 ID，用于构建调用层级                       |

## 4. 数据使用场景

### 4.1 性能分析

- 使用 `llm_time_ratio` 和 `tool_time_ratio` 识别性能瓶颈
- 使用 `retry_count` 分析工具可靠性

### 4.2 成本优化

- 使用 `input_tokens` 和 `output_tokens` 优化提示词长度
- 使用 `tool_cost` 评估工具调用成本效益

### 4.3 质量监控

- 使用 `success` 字段计算成功率
- 使用 `error_type` 和 `error_message` 分析失败原因
- 使用 `call_sequence` 追踪执行流程

## 5. 数据查询示例

```typescript
// 获取实时统计
const stats = tracker.getStats();
console.log(`LLM 调用次数: ${stats.llmCalls}`);
console.log(`总成本: $${stats.llmCost + stats.toolCost}`);

// 获取事件总线状态
const busStatus = getBusStatus();
if (busStatus.hasTracker && busStatus.trackerStats) {
  console.log(`Token 处理速度: ${busStatus.trackerStats.totalOutputTokens / busStatus.trackerStats.llmTotalTime * 1000} tokens/s`);
}
```
