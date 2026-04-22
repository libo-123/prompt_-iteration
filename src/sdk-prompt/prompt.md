# Agent 项目接入 @ks-opia/langfuse-sdk 指南

本文档提供了在 Agent 项目中接入 @ks-opia/langfuse-sdk 可观测性追踪系统的完整指南，包括类型定义、接入步骤和最佳实践。

## 1. 系统概述

@ks-opia/langfuse-sdk 是一个专为 LangGraph Agent 项目设计的可观测性追踪系统。它提供：

- **零侵入接入**：通过事件总线模式，无需修改现有业务逻辑
- **完整追踪**：自动追踪 LLM 调用、工具调用、性能指标和成本分析
- **灵活配置**：支持调试模式、自定义标识符和详细的元数据记录
- **固定内部地址**：使用内部 Langfuse 服务地址，无需配置 baseUrl

## 2. 核心类型定义

### 2.1 LLM 调用相关类型

```typescript
/**
 * LLM 调用类型枚举
 */
export type LLMCallType = "planning" | "reasoning" | "generation";

/**
 * LLM 调用类型详细定义：
 * 
 * planning: 规划类调用 - 用于任务分解、计划制定、策略生成等需要宏观思考的场景
 *   - 任务分解和步骤规划
 *   - 生成执行计划和策略
 *   - 多步骤问题的解决方案设计
 *   - 需要长期思考和规划的场景
 * 
 * reasoning: 推理类调用 - 用于逻辑分析、判断决策、问题分析等需要推理能力的场景
 *   - 逻辑推理和因果分析
 *   - 判断和决策制定
 *   - 问题分析和诊断
 *   - 需要深度思考和推理的场景
 * 
 * generation: 生成类调用 - 用于内容生成、对话回复、创意输出等需要创造力的场景
 *   - 自然语言生成和对话
 *   - 创意内容和文本生成
 *   - 代码生成和创作
 *   - 需要创造力和表达的场景
 */

```

### 2.2 工具调用相关类型

```typescript
/**
 * 工具调用类别枚举
 */
export type ToolCategory = "search" | "database" | "api" | "compute" | "other";

/**
 * 工具调用选项
 */
export interface ToolCallOptions {
  /** 工具调用的成本（美元），用于成本统计 */
  cost?: number;
  /** 工具的版本号，用于版本管理和问题排查 */
  toolVersion?: string;
  /** 最大重试次数，默认为 3 次 */
  maxRetries?: number;
}
```

### 2.3 执行函数类型

```typescript
/**
 * 执行函数类型
 */
export type ExecuteFunction<T> = () => Promise<T>;
```

## 3. 接入步骤

### 3.1 安装 SDK

首先检查是否已安装 `@ks-opia/langfuse-sdk` 包：

```bash
# 检查是否已安装
npm list @ks-opia/langfuse-sdk
```

如果显示包未安装或找不到，请执行安装命令：

```bash
# 使用 npm 安装
npm install @ks-opia/langfuse-sdk

# 或使用 pnpm 安装（推荐）
pnpm install @ks-opia/langfuse-sdk

# 或使用 yarn 安装
yarn add @ks-opia/langfuse-sdk
```

如果已经安装了该包，可以跳过安装步骤，直接进行下一步。

### 3.2 导入必要模块

```typescript
// 导入 SDK
import {
  initSDK,
  ObservabilityTracker,
  setGlobalTracker,
  clearGlobalTracker,
  trackLLM,
  trackTool,
  trackEvent,
} from '@ks-opia/langfuse-sdk';
```

### 3.3 初始化 SDK

在应用启动时初始化 SDK（只需调用一次）。**重要提醒：如果用户在开头已经说明了 initSDK 相关配置，请严格按照用户规定的模型名称以及价格来接入，不要使用示例中的默认值。**

```typescript

/**
 * 使用代码配置初始化
 * 注意：如果用户已指定模型名称和价格，请严格使用用户提供的配置
 */
function initializeSDKWithConfig() {
  initSDK({
    // Langfuse 配置（必需）
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
    },
    
    // Agent 配置（可选）
    agent: {
      name: 'weather-bot',  // 使用用户指定的 agent 名称
      defaultTags: ['env:development', 'version:1.0'],
    },
    
    // 自定义模型定价（重要：严格按照用户规定的模型名称和价格配置）
    pricing: {
      models: {
        // 示例配置 - 实际使用时请替换为用户指定的模型名称和价格
        'llama3-groq-tool-use': { input: 0.0000001, output: 0.0000002 },
        'gpt-4': { input: 0.00003, output: 0.00006 },
        'claude-3': { input: 0.000015, output: 0.000075 },
        // 用户自定义模型示例
        'user-custom-model': { input: 0.00001, output: 0.00002 },
      },
      mergeDefaults: true,  // 合并默认定价，建议保持为 true
    },
    
    // 工具配置（可选）
    tool: {
      defaultMaxRetries: 3,  // 工具调用默认失败重试次数
    },
  });
}
```

**请确保在 `.env` 文件中正确配置了 `LANGFUSE_PUBLIC_KEY` 和 `LANGFUSE_SECRET_KEY`。**

**环境变量配置（`.env` 文件）：**
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
```

### 3.4 初始化 Tracker

在 Agent 主函数中初始化 ObservabilityTracker：

```typescript
async function runAgent(question: string, threadId: string = "default") {
  // 初始化 tracker
  const tracker = new ObservabilityTracker(
    "your_user_id",     // 用户ID
    question,           // 用户查询
    threadId,           // 会话ID
    [                   // 标签数组
      "env:development", 
      "agent:langgraph", 
      "version:1.0", 
      "model:llama3-groq-tool-use"
    ]
  );

  // 设置全局 tracker（启用调试模式）
  setGlobalTracker(tracker, true);

  try {
    // Agent 执行逻辑
    const result = await executeAgent();
    
    // 完成追踪并上报结果
    await tracker.finish({
      answer: result.finalResponse,
      
    }, true);

    return result.finalResponse;
  } catch (error) {
    // 错误处理
    await tracker.finish({
      answer: "抱歉，处理您的请求时出现了错误。",
    }, false);
    
    throw error;
  } finally {
    // 清除全局 tracker
    clearGlobalTracker();
  }
}
```

### 3.5 追踪 LLM 调用

使用 `trackLLM` 函数包装所有 LLM 调用：

```typescript
/**
 * LLM 调用追踪示例
 */
async function intentAnalyzer(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const userInput = state.userInput;

  const intentResponse = await trackLLM(
    "intent_analyzer",    // 节点标识符 - 用于区分不同的LLM节点
    "reasoning",          // 调用类型 - planning/reasoning/generation
    "llama3-groq-tool-use", // 模型名称 - 必须与 initSDK 中配置的模型名称完全一致
    [                     // 输入内容（消息数组）
      new SystemMessage("你是一个专业的意图识别助手。"),
      new HumanMessage(intentPrompt),
    ],
    async () => {         // 执行函数
      return await chatModel.invoke([
        new SystemMessage("你是一个专业的意图识别助手。"),
        new HumanMessage(intentPrompt),
      ], {
        tags: ["intent_analysis"],
        metadata: { step: "intent_analyzer", userInput: userInput },
      });
    },
    {                     // 调用选项（可选）
      maxTokens: 1000,
      topP: 0.9,
    }
  );

  return { /* 返回状态更新 */ };
}
```

### 3.6 追踪工具调用

使用 `trackTool` 函数包装所有工具调用：

```typescript
/**
 * 工具调用追踪示例
 */
async function executeWeatherTool(query: string): Promise<string> {
  const result = await trackTool(
    "get_weather",        // 工具名称
    "api",               // 工具类别 - search/database/api/compute/other
    { query: query },    // 工具参数
    async () => {        // 执行函数
      return await weatherTool.invoke(query);
    },
    {                    // 调用选项
      cost: 0,        // 工具调用成本（美元） 根据实际情况 默认为 0
      toolVersion: "1.0", // 工具版本
      maxRetries: 3      // 最大重试次数
    }
  );

  return result;
}
```

### 3.7 追踪事件上报

使用 `trackEvent` 函数上报特殊事件，主要用于人工干预：

```typescript
/**
 * 事件上报追踪示例
 */
async function reportHumanHandoff(reason?: string): Promise<void> {
  await trackEvent(
    'human_handoff',      // 事件名称
    {                     // 事件元数据
      event_type: 'human_handoff',
      handoff_reason: reason, // 可选，默认为"人为上报"
    },
    'DEFAULT'               // 事件级别，默认为 'DEFAULT'
  );
}

// 使用示例
await reportHumanHandoff('复杂问题需要人工处理');
await reportHumanHandoff(); // 使用默认理由"人为上报"
```

## 4. 节点标识符命名规范

为了确保追踪数据的唯一性和可读性，建议使用以下命名规范：

### 4.1 LLM 节点标识符

```typescript
// 3节点 Agent 示例
"intent_analyzer"     // 意图识别节点
"weather_answer"      // 天气回答节点  
"general_answer"      // 一般回答节点

// 6节点 Agent 示例
"task_analyzer"       // 任务分析节点
"task_scheduler"      // 任务调度节点
"tool_selector"       // 工具选择节点
"task_processor"      // 任务处理节点
"result_integrator"   // 结果整合节点
```

### 4.2 最终命名格式

系统会自动生成格式为 `llm-{callType}-{identifier}` 的追踪名称：

```
llm-reasoning-intent_analyzer    // 意图识别
llm-generation-weather_answer    // 天气回答
llm-planning-task_analyzer       // 任务分析
llm-reasoning-task_scheduler     // 任务调度
llm-generation-result_integrator // 结果整合
```

## 6. 完整接入示例

### 6.1 简单 3 节点 Agent

```typescript
import { ChatOllama } from "@langchain/ollama";
import {
  initSDK,
  ObservabilityTracker,
  setGlobalTracker,
  clearGlobalTracker,
  trackLLM,
  trackTool,
  trackEvent,
} from '@ks-opia/langfuse-sdk';

// 初始化 SDK（应用启动时调用一次）
// 注意：如果用户已指定模型配置，请严格使用用户提供的模型名称和价格
initSDK({
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
  },
  agent: {
    name: 'simple-agent',  // 使用用户指定的 agent 名称
    defaultTags: ['env:production', 'version:1.0'],
  },
  // 如果用户提供了模型配置，请在此处添加 pricing 配置
  pricing: {
    models: {
      // 严格按照用户指定的模型名称和价格配置
      'llama3-groq-tool-use': { input: 0.0000001, output: 0.0000002 },
    },
    mergeDefaults: true,
  },
});

async function runSimpleAgent(question: string, threadId: string = "default") {
  const tracker = new ObservabilityTracker(
    "user123",
    question,
    threadId,
    ["env:production", "agent:simple", "version:1.0"]
  );

  setGlobalTracker(tracker, true);

  try {
    // 1. 意图识别
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const intentResponse = await trackLLM(
      "intent_analyzer",
      "reasoning",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("分析用户意图"), new HumanMessage(question)],
      async () => await chatModel.invoke([
        new SystemMessage("分析用户意图"), 
        new HumanMessage(question)
      ]),
      {
        maxTokens: 1000,
        topP: 0.9,
      }
    );

    // 2. 工具调用（如果需要）
    let toolResult = null;
    if (needsTool) {
      toolResult = await trackTool(
        "get_weather",
        "api",
        { query: question },
        async () => await weatherTool.invoke(question),
        { cost: 0.00, toolVersion: "1.0", maxRetries: 3 }
      );
    }

    // 3. 生成最终回答
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const finalResponse = await trackLLM(
      "answer_generator",
      "generation",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("生成回答"), new HumanMessage(question)],
      async () => await chatModel.invoke([
        new SystemMessage("生成回答"), 
        new HumanMessage(question)
      ]),
      {
        maxTokens: 2000,
      }
    );

    // 4. 如果需要人工干预，上报事件
    if (needsHumanIntervention) {
      await trackEvent('human_handoff', {
        event_type: 'human_handoff',
        handoff_reason: '复杂问题需要人工处理'
      }, 'DEFAULT');
    }

    await tracker.finish({
      answer: finalResponse.content,
      sources: ['weather_api'],
    }, true);

    return finalResponse.content;
  } catch (error) {
    await tracker.finish({
      answer: "处理失败",
    }, false);
    throw error;
  } finally {
    clearGlobalTracker();
  }
}
```

### 6.2 复杂 6 节点 Agent

```typescript
async function runComplexAgent(question: string, threadId: string = "default") {
  const tracker = new ObservabilityTracker(
    "user123",
    question,
    threadId,
    ["env:production", "agent:complex", "version:2.0"]
  );

  setGlobalTracker(tracker, true);

  try {
    // 1. 任务分析
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const taskPlan = await trackLLM(
      "task_analyzer",
      "planning",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("分析任务"), new HumanMessage(question)],
      async () => await chatModel.invoke([
        new SystemMessage("分析任务"), 
        new HumanMessage(question)
      ]),
      {
        maxTokens: 1500,
        topP: 0.8,
      }
    );

    // 2. 任务调度
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const scheduleResult = await trackLLM(
      "task_scheduler",
      "reasoning",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("调度任务"), new HumanMessage(taskPlan.content)],
      async () => await chatModel.invoke([
        new SystemMessage("调度任务"), 
        new HumanMessage(taskPlan.content)
      ]),
      {
        maxTokens: 1000,
      }
    );

    // 3. 工具选择
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const toolSelection = await trackLLM(
      "tool_selector",
      "reasoning",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("选择工具"), new HumanMessage(scheduleResult.content)],
      async () => await chatModel.invoke([
        new SystemMessage("选择工具"), 
        new HumanMessage(scheduleResult.content)
      ]),
      {
        maxTokens: 800,
      }
    );

    // 4. 工具执行
    const toolResults = await trackTool(
      "selected_tool",
      "api",
      { query: question },
      async () => await selectedTool.invoke(question),
      { cost: 0, toolVersion: "2.1", maxRetries: 3 }
    );

    // 5. 任务处理
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const processedResult = await trackLLM(
      "task_processor",
      "generation",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("处理结果"), new HumanMessage(toolResults)],
      async () => await chatModel.invoke([
        new SystemMessage("处理结果"), 
        new HumanMessage(toolResults)
      ]),
      {
        maxTokens: 2000,
      }
    );

    // 6. 结果整合
    // 注意：模型名称必须与 initSDK 中配置的模型名称完全一致
    const finalResponse = await trackLLM(
      "result_integrator",
      "generation",
      "llama3-groq-tool-use",  // 确保与用户配置的模型名称一致
      [new SystemMessage("整合结果"), new HumanMessage(processedResult.content)],
      async () => await chatModel.invoke([
        new SystemMessage("整合结果"), 
        new HumanMessage(processedResult.content)
      ]),
      {
        maxTokens: 2500,
      }
    );

    // 7. 如果在处理过程中需要人工干预，上报事件
    if (complexTaskRequiresHuman) {
      await trackEvent('human_handoff', {
        event_type: 'human_handoff',
        handoff_reason: '复杂任务需要专家介入'
      }, 'WARNING');
    }

    await tracker.finish({
      answer: finalResponse.content,
      sources: ['multiple_apis', 'complex_processing'],
    }, true);

    return finalResponse.content;
  } catch (error) {
    await tracker.finish({
      answer: "处理失败",
    }, false);
    throw error;
  } finally {
    clearGlobalTracker();
  }
}
```

## 7. 最佳实践

### 7.1 模型配置一致性

**重要提醒：确保模型名称的一致性**

```typescript
// ❌ 错误示例：模型名称不一致
initSDK({
  pricing: {
    models: {
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },  // 配置了 gpt-4-turbo
    }
  }
});

// 但在 trackLLM 中使用了不同的模型名称
await trackLLM("test", "reasoning", "gpt-4", [...], async () => {...});  // ❌ 使用了 gpt-4

// ✅ 正确示例：模型名称完全一致
initSDK({
  pricing: {
    models: {
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },  // 配置 gpt-4-turbo
    }
  }
});

// 在 trackLLM 中使用相同的模型名称
await trackLLM("test", "reasoning", "gpt-4-turbo", [...], async () => {...});  // ✅ 使用相同的 gpt-4-turbo
```

### 7.2 用户自定义配置处理

```typescript
/**
 * 根据用户提供的配置动态初始化 SDK
 */
function initializeWithUserModels(userModels: Array<{
  name: string;
  inputPrice: number;
  outputPrice: number;
}>) {
  const modelsConfig = {};
  
  // 严格按照用户提供的模型配置
  userModels.forEach(model => {
    modelsConfig[model.name] = {
      input: model.inputPrice,
      output: model.outputPrice
    };
  });

  initSDK({
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
    },
    pricing: {
      models: modelsConfig,
      mergeDefaults: true,
    },
  });
}

// 使用示例
const userDefinedModels = [
  { name: 'custom-llama-7b', inputPrice: 0.000001, outputPrice: 0.000002 },
  { name: 'enterprise-gpt', inputPrice: 0.00005, outputPrice: 0.0001 },
];

initializeWithUserModels(userDefinedModels);

// 在 Agent 中使用时，确保模型名称完全匹配
await trackLLM("analyzer", "reasoning", "custom-llama-7b", [...], async () => {...});
```

### 7.3 错误处理

```typescript
try {
  const result = await trackLLM(/* ... */);
  return result;
} catch (error) {
  console.error("LLM 调用失败:", error);
  // 确保即使失败也要完成追踪
  await tracker.finish({
    answer: "处理失败"
  }, false);
  throw error;
}
```


## 8. 故障排查

### 8.1 常见问题

1. **追踪数据丢失**
   - 确保在 Agent 执行前调用 `setGlobalTracker()`
   - 确保在 finally 块中调用 `clearGlobalTracker()`

2. **重复追踪**
   - 检查是否多次调用 `setGlobalTracker()`
   - 确保每个会话使用唯一的 threadId

3. **成本计算不准确**
   - 检查工具调用的 cost 参数设置
   - 确认 LLM 的 Token 计算是否正确

### 8.2 调试技巧

```typescript
// 启用详细日志
setGlobalTracker(tracker, true);

```

## 9. 总结

通过以上步骤，您可以在 Agent 项目中完整接入 observability-bus 可观测性追踪系统。系统提供了：

- **完整的调用追踪**：自动记录所有 LLM 和工具调用
- **详细的性能分析**：包括耗时、Token 使用量、成本等指标
- **灵活的配置选项**：支持调试模式、自定义标识符等
- **实时监控能力**：提供状态查询和统计功能

建议在开发阶段启用调试模式，在生产环境中关闭调试模式以提高性能。