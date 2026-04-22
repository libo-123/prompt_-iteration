# SDK 架构设计文档

## 🏗️ 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户应用层                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  import { initSDK, trackLLM, trackTool, ...} from SDK   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SDK 公共 API 层                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      index.ts                            │  │
│  │  - initSDK()                                             │  │
│  │  - trackLLM()                                            │  │
│  │  - trackTool()                                           │  │
│  │  - setGlobalTracker()                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                     │                      │
           ▼                     ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Configuration   │  │   Event Bus      │  │     Tracker      │
│    Manager       │  │  (Pub/Sub)       │  │    (Core)        │
│                  │  │                  │  │                  │
│ sdk-config.ts    │  │ observability-   │  │  tracker.ts      │
│                  │  │   bus.ts         │  │                  │
│ - initSDK()      │  │ - setTracker()   │  │ - trackLLMCall() │
│ - getConfig()    │  │ - trackLLM()     │  │ - trackToolCall()│
│ - validate()     │  │ - trackTool()    │  │ - trackEvent()   │
│                  │  │ - 智能降级       │  │ - finish()       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                     │                      │
           └─────────────────────┴──────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         数据层                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Langfuse 平台                         │  │
│  │  - Trace (会话级别)                                      │  │
│  │  - Span (节点级别)                                       │  │
│  │  - Event (事件级别)                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 数据流向

### 1. 初始化流程

```
用户调用 initSDK()
    ↓
sdk-config.ts: configManager.init(config)
    ↓
验证必需字段（publicKey, secretKey）
    ↓
合并默认配置（模型定价、工具配置等）
    ↓
保存到单例实例中
    ↓
✅ 初始化完成
```

### 2. 创建 Tracker 流程

```
new ObservabilityTracker(userId, query, sessionId?, tags?)
    ↓
从 configManager 获取配置
    ↓
创建 Langfuse 客户端
    ↓
创建 Langfuse Trace（会话级别）
    ↓
初始化统计数据（stats）
    ↓
✅ Tracker 创建完成
```

### 3. LLM 调用追踪流程

```
用户调用 trackLLM(identifier, callType, model, input, execute, options?)
    ↓
observability-bus: publishLLMCall()
    ↓
检查是否有活跃的 tracker
    │
    ├─ 有 tracker ──────────────────────┐
    │                                   │
    │  tracker.trackLLMCall()          │
    │      ↓                            │
    │  创建 Generation Span             │
    │      ↓                            │
    │  执行 execute() 函数              │
    │      ↓                            │
    │  提取 Token 使用量                │
    │      ↓                            │
    │  计算成本（从 configManager）     │
    │      ↓                            │
    │  更新统计数据（stats）            │
    │      ↓                            │
    │  结束 Span，记录 metadata         │
    │      ↓                            │
    │  ✅ 返回结果                      │
    │                                   │
    └─ 无 tracker ──────────────────────┘
                                        │
                                        ▼
                               直接执行 execute()
                                        │
                                        ▼
                                   ✅ 返回结果
```

### 4. 工具调用追踪流程

```
用户调用 trackTool(toolName, category, params, execute, options?)
    ↓
observability-bus: publishToolCall()
    ↓
检查是否有活跃的 tracker
    │
    ├─ 有 tracker ──────────────────────┐
    │                                   │
    │  tracker.trackToolCall()          │
    │      ↓                            │
    │  从 configManager 获取重试配置    │
    │      ↓                            │
    │  创建 Tool Span                   │
    │      ↓                            │
    │  执行 execute() 函数              │
    │      ├─ 成功 ──> 返回结果         │
    │      └─ 失败 ──> 重试（最多 N 次）│
    │      ↓                            │
    │  更新统计数据（stats）            │
    │      ↓                            │
    │  结束 Span，记录 metadata         │
    │      ↓                            │
    │  ✅ 返回结果                      │
    │                                   │
    └─ 无 tracker ──────────────────────┘
                                        │
                                        ▼
                               直接执行 execute()
                                        │
                                        ▼
                                   ✅ 返回结果
```

### 5. 完成追踪流程

```
用户调用 tracker.finish(output, success)
    ↓
计算总耗时、Token 总数、总成本
    ↓
构建完整的 Trace Metadata
    │
    ├─ total_duration_ms（总耗时）
    ├─ llm_calls（LLM 调用次数）
    ├─ tool_calls（工具调用次数）
    ├─ total_tokens（Token 总数）
    ├─ total_cost（总成本）
    ├─ started_at（开始时间）
    └─ finished_at（结束时间）
    ↓
trace.update({ output, metadata })
    ↓
langfuse.flushAsync()（上报到 Langfuse）
    ↓
✅ 追踪完成
```

---

## 🧩 核心模块详解

### 1. Configuration Manager（配置管理器）

**职责**：
- 管理全局配置
- 验证配置有效性
- 提供默认值
- 支持配置合并

**关键方法**：
```typescript
class SDKConfigManager {
  init(config: SDKConfig): void              // 初始化配置
  getLangfuseConfig(): LangfuseConfig        // 获取 Langfuse 配置
  getAgentConfig(): AgentConfig              // 获取 Agent 配置
  getModelPricing(): ModelPricing            // 获取模型定价
  getToolConfig(): ToolConfig                // 获取工具配置
  isInitialized(): boolean                   // 检查是否已初始化
}
```

**设计模式**：单例模式

**配置结构**：
```typescript
{
  langfuse: {      // 必需
    publicKey,
    secretKey,
  },
  agent: {         // 可选
    name,
    defaultTags,
  },
  pricing: {       // 可选
    models,
    mergeDefaults,
  },
  tool: {          // 可选
    defaultMaxRetries,
  },
}
```

---

### 2. Event Bus（事件总线）

**职责**：
- 管理全局 Tracker 实例
- 发布 LLM/工具调用事件
- 实现智能降级（无 tracker 时直接执行）

**关键方法**：
```typescript
class ObservabilityBus {
  setTracker(tracker, debug?): void          // 设置全局 tracker
  clearTracker(): void                       // 清除 tracker
  hasTracker(): boolean                      // 检查是否有 tracker
  publishLLMCall(...): Promise<T>            // 发布 LLM 调用事件
  publishToolCall(...): Promise<T>           // 发布工具调用事件
  publishEvent(...): Promise<void>           // 发布事件
  getStatus(): BusStatus                     // 获取状态信息
}
```

**设计模式**：
- 单例模式（全局唯一实例）
- 发布订阅模式（解耦业务代码和追踪逻辑）

**优势**：
- ✅ 零侵入：无需在函数间传递 tracker
- ✅ 智能降级：无 tracker 时自动降级
- ✅ 调试模式：支持调试日志

---

### 3. Tracker（追踪器）

**职责**：
- 集成 Langfuse 客户端
- 创建和管理 Trace/Span
- 追踪 LLM 和工具调用
- 统计性能和成本数据
- 上报数据到 Langfuse

**关键方法**：
```typescript
class ObservabilityTracker {
  constructor(userId, query, sessionId?, tags?)
  
  // 追踪方法
  async trackLLMCall(identifier, callType, model, input, execute, options?)
  async trackToolCall(toolName, category, params, execute, options?)
  async trackEvent(eventName, metadata, level?)
  
  // 生命周期
  async finish(output, success)
  
  // 辅助方法
  getStats(): TrackerStats
}
```

**统计数据**：
```typescript
interface TrackerStats {
  llmCalls: number              // LLM 调用次数
  toolCalls: number             // 工具调用次数
  eventCalls: number            // 事件上报次数
  handoffCount: number          // 人工干预次数
  llmTotalTime: number          // LLM 累计耗时
  toolTotalTime: number         // 工具累计耗时
  totalInputTokens: number      // 输入 Token 总数
  totalOutputTokens: number     // 输出 Token 总数
  llmCost: number               // LLM 累计成本
  toolCost: number              // 工具累计成本
  visualizationNodes: number    // 可视化节点数
}
```

---

## 🎨 设计模式

### 1. 单例模式（Singleton）

**使用场景**：
- `ConfigManager` - 全局唯一配置
- `ObservabilityBus` - 全局唯一事件总线

**优势**：
- 确保全局只有一个实例
- 避免重复初始化
- 统一管理状态

**实现**：
```typescript
class SDKConfigManager {
  private static instance: SDKConfigManager;
  
  private constructor() {}
  
  static getInstance(): SDKConfigManager {
    if (!SDKConfigManager.instance) {
      SDKConfigManager.instance = new SDKConfigManager();
    }
    return SDKConfigManager.instance;
  }
}
```

---

### 2. 发布订阅模式（Pub/Sub）

**使用场景**：
- `ObservabilityBus` - 解耦业务代码和追踪逻辑

**优势**：
- 降低耦合度
- 零侵入设计
- 灵活的订阅/取消订阅

**实现**：
```typescript
class ObservabilityBus {
  private tracker: ObservabilityTracker | null = null;
  
  // 订阅（设置 tracker）
  setTracker(tracker) {
    this.tracker = tracker;
  }
  
  // 取消订阅（清除 tracker）
  clearTracker() {
    this.tracker = null;
  }
  
  // 发布事件
  async publishLLMCall(...) {
    if (this.tracker) {
      return this.tracker.trackLLMCall(...);
    } else {
      return execute();  // 自动降级
    }
  }
}
```

---

---

## 📊 数据模型

### Trace 层级（会话级别）

```typescript
interface TraceData {
  metadata: {
    // 时间统计
    total_duration_ms: number;
    started_at: string;
    finished_at: string;
    
    // 调用统计
    llm_calls: number;
    tool_calls: number;
    event_calls: number;
    handoff_count: number;
    total_steps: number;
    
    // 时间分布
    llm_total_time_ms: number;
    tool_total_time_ms: number;
    llm_time_ratio: number;
    tool_time_ratio: number;
    
    // Token 统计
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    
    // 成本分析
    llm_cost: number;
    tool_cost: number;
    total_cost: number;
    
    // 执行状态
    success: boolean;
    
    // 可视化
    visualization_nodes: number;
  };
}
```

### Span 层级（节点级别）

**LLM Span**
```typescript
interface LLMSpan {
  metadata: {
    // 模型信息
    model: string;
    
    // 性能指标
    duration_ms: number;
    tokens_per_second: number;
    
    // Token 统计
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    
    // 成本分析
    input_cost: number;
    output_cost: number;
    total_cost: number;
    
    max_tokens?: number;
    
    // 调用标识
    call_sequence: number;
    call_type: LLMCallType;
    
    // 可视化
    langgraph_step: number;
    langgraph_node: string;
    observation_type: 'GENERATION';
  };
}
```

**Tool Span**
```typescript
interface ToolSpan {
  metadata: {
    // 工具信息
    tool_name: string;
    tool_category: ToolCategory;
    tool_version?: string;
    
    // 性能指标
    duration_ms: number;
    
    // 执行状态
    success: boolean;
    retry_count: number;
    cache_hit: boolean;
    
    // 成本信息
    cost: number;
    
    // 错误信息
    error_type?: string;
    error_message?: string;
    
    // 调用标识
    call_sequence: number;
    
    // 可视化
    langgraph_step: number;
    langgraph_node: string;
    observation_type: 'TOOL';
  };
}
```

---

## 🔒 错误处理

### 1. 配置验证错误

```typescript
// 场景：缺少必需配置
initSDK({ langfuse: { publicKey: '', secretKey: '' } });

// 错误：
throw new Error(
  'SDK 初始化失败：必须提供 Langfuse publicKey 和 secretKey。'
);
```

### 2. 未初始化错误

```typescript
// 场景：未调用 initSDK()
const config = configManager.getConfig();

// 错误：
throw new Error(
  'SDK 未初始化。请先调用 initSDK() 进行配置。'
);
```

### 3. LLM 调用错误

```typescript
// 自动重新抛出错误，但会记录失败信息
try {
  const result = await trackLLM(...);
} catch (error) {
  // Span 标记为 ERROR
  // 记录错误信息到 metadata
  throw error;  // 重新抛出
}
```

### 4. 工具调用错误

```typescript
// 自动重试（最多 N 次）
let retryCount = 0;
while (retryCount < maxRetries) {
  try {
    return await execute();
  } catch (error) {
    retryCount++;
    if (retryCount >= maxRetries) {
      // 记录失败信息
      throw error;
    }
    // 指数退避
    await sleep(1000 * retryCount);
  }
}
```

---

## 🚀 性能优化

### 1. 懒加载
- 配置管理器使用懒加载
- Langfuse 客户端延迟初始化

### 2. 批量上报
- `langfuse.flushAsync()` 批量上报数据
- 减少网络请求次数

### 3. 智能降级
- 无 tracker 时直接执行
- 不影响业务性能

### 4. 异步处理
- 所有追踪操作异步执行
- 不阻塞主流程

---

## 📈 扩展性设计

### 1. 新增模型定价
```typescript
initSDK({
  pricing: {
    models: {
      'new-model': { input: 0.00001, output: 0.00002 },
    },
  },
});
```

### 2. 新增工具类别
```typescript
// types.ts
type ToolCategory = 'search' | 'database' | 'api' | 'compute' | 'other' | 'new-category';
```

### 3. 新增事件类型
```typescript
// types.ts
type EventType = 'human_handoff' | 'new-event-type';
```

### 4. 新增配置项
```typescript
// sdk-config.ts
interface SDKConfig {
  // ... 现有配置
  newFeature?: {
    option1?: string;
    option2?: number;
  };
}
```

---

## 🎯 总结

### 架构特点
✅ **模块化**：清晰的职责划分  
✅ **低耦合**：事件总线解耦  
✅ **高内聚**：相关功能聚合  
✅ **可扩展**：易于添加新功能  
✅ **类型安全**：完整的 TS 类型  
✅ **用户友好**：简单易用的 API  
