# 全网调研：Skill 评估与执行观测工具

## 问题

想确认两件事：

1. 现在有没有比较成熟的“**评估 skill 效果**”的插件或工具。
2. 现在有没有比较成熟的“**观察 skill 执行过程**”的插件或工具。

这次调研重点围绕 `Cursor Skill / Agent Skill` 生态，以及更通用的 `AI Agent observability / eval` 工具来展开。

## 一句话结论

**有相关工具，但目前几乎没有一个“官方、通用、专门只服务 Cursor Skill 的完整评估插件”。**

更现实、也更成熟的方案是：

- 用 `Cursor Skill` 或本地 `skill trace` 记录执行数据；
- 再接 `Langfuse / Promptfoo / LangSmith / AgentEvals / Phoenix` 这一类通用评估与观测平台。

也就是说，当前行业主流不是“一个插件全包”，而是：

**Skill 执行数据采集 + Trace 可视化 + Eval 打分** 的组合式方案。

## 1. 最贴近 Cursor Skill 的现成方案

### 1.1 Cursor 官方文档：Agent Skills

链接：

- [Agent Skills | Cursor Docs](https://www.cursor.com/docs/context/skills)

这篇文档确认了几件重要事实：

- `Agent Skills` 已经是 Cursor 支持的标准能力形态；
- Skill 可以自动发现，也可以手动触发；
- Skill 本质上是 `SKILL.md + scripts/references/assets` 的可组合能力包；
- 但官方文档**没有内建一套完整的可视化评估面板**，也没有直接提供“Skill 执行回放”这类产品级能力。

这意味着：

**Cursor 官方对 Skill 的支持已经成熟，但对 Skill 评估和观测的产品化能力还不算完整。**

### 1.2 Cursor Marketplace 里的观测型 Skill

链接：

- [observability-llm-obs | Cursor Skill](https://cursor.com/cn/marketplace/skills/observability-llm-obs)
- [Cursor Marketplace](https://cursor.sh/plugins)

`observability-llm-obs` 是目前最贴近这个问题的现成 Skill 之一。它的定位很明确：

- 监控 LLM 和 agentic apps
- 关注性能、token/cost、response quality、workflow orchestration

但要注意：

它更像是“把观测能力接进来”的 Skill，**不是一个原生专门查看 Cursor Skill 执行链路的可视化插件**。

所以它适合做：

- LLM/Agent 质量与成本监控
- 可观测性能力接入

但如果要看“某个 skill 在一次会话里具体怎么一步步执行、哪里失败、哪里回退”，仍然需要结合其他 tracing/eval 工具。

## 2. 最适合做 Skill 评估的工具

### 2.1 Promptfoo：适合做 skill 回归评测

链接：

- [Agent Skill for Writing Evals | Promptfoo](https://promptfoo.dev/docs/integrations/agent-skill/)
- [Tracing | Promptfoo](https://promptfoo.dev/docs/tracing/)
- [CI/CD Integration for LLM Eval and Security | Promptfoo](https://promptfoo.dev/docs/integrations/ci-cd)
- [Using Promptfoo in n8n Workflows | Promptfoo](https://www.promptfoo.dev/docs/integrations/n8n/)

Promptfoo 的优势在于，它非常适合回答这个问题：

**“我改了 skill 之后，效果到底变好还是变差了？”**

它的思路很清晰：

- 设计一批固定输入；
- 定义断言或评分规则；
- 反复执行；
- 对比不同版本的通过率、得分、错误情况。

它还专门提供了一个 `promptfoo-evals` 的 Agent Skill，用来帮助 agent 正确编写 eval 配置。

适合场景：

- skill 改版前后对比
- 回归测试
- 接 CI 做质量门禁
- 评估输出是否满足预期

不那么适合单独完成的部分：

- 对复杂多步骤 agent 执行链路做非常深入的全链路观测

所以可以把它理解成：

**评估强，Tracing 够用，但不是最强的 agent 过程观测平台。**

### 2.2 Langfuse：目前最像“系统化评估 Skill”的完整方案

链接：

- [Evaluating AI Agent Skills | Langfuse](https://langfuse.com/blog/2026-02-26-evaluate-ai-agent-skills)
- [AI Agent Observability, Tracing & Evaluation with Langfuse](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse)
- [Example - Evaluating OpenAI Agents](https://langfuse.com/guides/cookbook/example_evaluating_openai_agents)
- [Trace and Evaluate LangGraph Agents](https://langfuse.com/docs/integrations/langchain/example-langgraph-agents)
- [Datasets](https://langfuse.com/docs/evaluation/experiments/datasets)
- [Experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)
- [Observability Overview](https://langfuse.com/docs/observability/overview)

Langfuse 之所以特别值得关注，是因为它已经明确在文章里讨论了：

**如何评估 AI Agent Skill。**

它给出的思路几乎可以直接复用：

1. 准备一批用户 prompt，做成 dataset；
2. 批量运行 agent；
3. 对 agent 行为做 trace；
4. 根据输出和执行过程做评分；
5. 对 skill 迭代，再重复实验。

Langfuse 文章里还特别提到，它可以记录：

- tool call
- CLI command
- file edit

这就非常适合 skill 场景，因为 skill 本来就是围绕工具调用、脚本执行、工作流指导展开的。

适合场景：

- Skill 版本迭代评估
- 多条任务集的 AB 对比
- 追踪 agent 是否正确使用了 skill
- 发现 agent 没触发 skill、误用 skill、走错工具链等问题

如果要在“评估 + 观测”之间二选一，Langfuse 是我认为最平衡的候选之一。

### 2.3 LangSmith：更强的通用 Agent Engineering 平台

链接：

- [LangSmith](https://langsmith.org/)
- [LangSmith Evaluation](https://www.langchain.com/langsmith/evaluation)
- [How to evaluate with OpenTelemetry](https://docs.langchain.com/langsmith/evaluate-with-opentelemetry)

LangSmith 的强项在于：

- 完整 trace
- offline / online eval
- LLM-as-judge
- 生产环境监控
- failure mode 分析

如果 skill 只是一个简单 markdown 指令包，LangSmith 可能略重；
但如果 skill 最终会演化成更复杂的 agent workflow，LangSmith 的价值会更大。

适合场景：

- 多步骤 agent
- 子代理协作
- 人工 review + 自动打分结合
- 线上观测和离线评测一体化

## 3. 最适合做执行链路观察的工具

### 3.1 AgentEvals：基于 Trace 直接打分

链接：

- [AgentEvals](http://aevals.ai/)
- [agentevals-dev/agentevals](https://github.com/agentevals-dev/agentevals)
- [Integrations](https://aevals.ai/docs/integrations/)
- [Evaluators Registry](https://github.com/agentevals-dev/evaluators)
- [agentevals-cli on PyPI](https://pypi.org/project/agentevals-cli/)

AgentEvals 的特点非常明确：

**它不是从“只看最终答案”入手，而是从“执行轨迹”入手。**

它支持：

- 从 OpenTelemetry traces 里读取 agent 执行轨迹；
- 按预设行为模式打分；
- 不需要重新执行昂贵的 LLM 调用；
- 可以接进 CI/CD 做质量门禁。

这对 skill 特别有价值，因为很多 skill 的问题并不在最终答案本身，而在中间过程，例如：

- 该用 skill 时没触发；
- 触发了 skill，但没有按 reference 指南执行；
- 工具调用顺序错了；
- 频繁 fallback 到 curl 或手写命令；
- 多走了很多无效步骤。

如果你很看重“**执行过程是否符合预期**”，AgentEvals 是很值得研究的方向。

### 3.2 AgentOps：接入轻量，适合快速做 agent tracing

链接：

- [AgentOps GitHub](https://github.com/agentops-ai/agentops)

这类工具的优势通常在于：

- 接入成本低
- 能快速看到调用链
- 有 cost、latency、session 级观察

更适合：

- 快速搭一个监控视图
- 先把 agent 行为“看见”

但在“Skill 专项评估方法论”上，它没有 Langfuse 那么直接。

### 3.3 Phoenix：开源取向更强，适合 OTel 方案

链接：

- [Setup OTEL - Phoenix](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-using-phoenix-otel)
- [Running Evals on Traces - Phoenix](https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces)
- [Using Tracing Helpers - Phoenix](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument)
- [Python SDK - Phoenix](https://arize.com/docs/phoenix/sdk-api-reference)

Phoenix 很适合下面这种需求：

- 想用 OpenTelemetry 做标准化埋点；
- 想保留一定开源、自托管能力；
- 想把 trace 和 eval 结合起来，但不完全依赖闭源 SaaS。

### 3.4 Weave：实验追踪和 agent 调试能力也不错

链接：

- [W&B Weave for AI Agent Evaluation](https://wandb.ai/site/agents)
- [Mastering AI agent observability](https://wandb.ai/site/articles/ai-agent-observability/)
- [Build an evaluation - Weave Docs](https://docs.wandb.ai/weave/tutorial-eval/)
- [Weave Documentation](https://wandb.github.io/weave/)

Weave 的定位更偏：

- agent 实验管理
- trace 可视化
- 评分与对比
- 审计与版本记录

如果团队本来就在用 W&B 体系，它会比较顺手。

## 4. 更贴近 Skill 概念的开源方向

### 4.1 ZeroEval：已经明确在做 Skills + Tracing + Judges

链接：

- [zeroeval/zeroeval-skills](https://github.com/zeroeval/zeroeval-skills)
- [Skills - ZeroEval Documentation](https://docs.zeroeval.com/integrations/skills)
- [Introduction - ZeroEval Tracing](https://docs.zeroeval.com/tracing/introduction)
- [Tracing Reference](https://docs.zeroeval.com/tracing/reference)
- [CLI - ZeroEval Documentation](https://docs.zeroeval.com/integrations/cli)

ZeroEval 很值得留意，因为它不只是泛泛地讲 eval，而是已经明确做了：

- `custom-tracing`
- `create-judge`
- `run-evals`
- `manage-data`

而且文档里已经直接提到能和 `Cursor / Claude Code / Codex` 这类 agent skill 生态结合。

如果要找“更像 skill 原生生态中的评估方案”，ZeroEval 是一个很值得跟进的开源方向。

## 5. 对 Cursor Skill 生态的判断

综合这次搜索，可以得出一个比较清晰的判断：

### 已经有的

- `Skill` 作为能力封装形态，已经比较成熟；
- `Observability` 和 `Eval` 工具在 Agent 领域已经很多；
- 一些团队已经开始把 “Skill 评估” 当成独立问题来做。

### 还不成熟的

- 一个面向 `Cursor Skill` 的、开箱即用的“评估 + Trace + 看板 + 对比实验”单一插件；
- 一个行业统一的 “Skill 质量指标体系”；
- 一个被广泛接受的 Cursor Skill 原生执行回放界面。

所以目前最合理的判断不是“没有工具”，而是：

**有很多可用零件，但还没有一个绝对统一的终局产品。**

## 6. 对当前项目最有启发的点

如果项目里已经能采集到 skill 执行日志，那么真正缺的通常不是“原始数据”，而是：

1. **展示层**：把 skill 执行过程可视化；
2. **评估层**：定义什么叫“好的 skill 执行”；
3. **对比层**：比较不同 skill 版本的表现变化。

一个比较现实的落地方向是：

### 路线 A：先做本地观察

- 记录 `skill name / session / tool call / duration / success / error / step`
- 做一个本地 dashboard
- 先把 skill 执行过程“看见”

### 路线 B：再做系统化评估

- 设计 benchmark prompts
- 跑固定任务集
- 做自动打分
- 比较不同 skill 版本

### 路线 C：最终接标准观测体系

- 用 `OpenTelemetry` 统一 trace 结构
- 接 `Langfuse / Phoenix / LangSmith / AgentEvals`
- 形成可观测、可评估、可回归的闭环

## 7. 推荐优先级

如果目标是“尽快落地”，我会这样排：

### 第一梯队

- `Langfuse`：评估和观测兼顾，最贴近 skill 场景
- `Promptfoo`：最适合做 skill 回归评测

### 第二梯队

- `LangSmith`：适合复杂 agent 工程体系
- `AgentEvals`：适合从执行轨迹角度做评分

### 第三梯队

- `Phoenix`：适合 OTel + 开源取向方案
- `Weave`：适合已有 W&B 生态团队
- `AgentOps`：适合先快速把 tracing 跑起来

### 一个很关键的发现
你这个项目里其实已经有本地 skill trace 基础了，不是从零开始。

例如你本地的 .cursor/logs/skill-trace.jsonl 里已经能看到"
{"ts":"2026-04-16 16:13:55","record_type":"tool_event","hook_event":"postToolUse","session_id":"93f27267-b081-4bc2-9535-cee7f200214f","tool_name":"Read","skill":"skill-trace-demo","skill_source":"transcript","success":true,"duration_ms":7.765,"error":null,"payload_keys":["conversation_id","cursor_version","duration","generation_id","hook_event_name","model","session_id","tool_input","tool_name","tool_output","tool_use_id","transcript_path","user_email","workspace_roots"]}

这说明你已经能拿到：
- skill 名称
- tool 调用
- 成功/失败
- duration
- 分步骤状态（discover/analyze/plan/execute/verify/deliver）
也就是说，你缺的不是**原始数据**，而是 **展示层 + 评估层**。


### 我给你的实际建议
如果你现在就想落地，我建议按这个优先级：

想先看到 skill 执行过程

先用你现有的 skill-trace.jsonl
再接一个轻量展示层，或者导到 OTel / Langfuse / Phoenix
想评估 skill 改动有没有变好

首选 Promptfoo
或者 Langfuse dataset + experiment
想同时做观测、trace、人工/自动打分

首选 Langfuse
备选 LangSmith
想从执行轨迹本身评分

看 AgentEvals

https://www.langchain.com/langsmith-platform



## 最终结论

如果问题是：

**“有没有评估 skill 的插件、观察 skill 执行的插件？”**

答案是：

- **有相关工具和方向；**
- **但没有一个已经成为 Cursor Skill 事实标准的一体化插件。**

当前最靠谱的路径是：

**Skill 日志/Trace 采集 + 通用 Agent Observability / Eval 平台组合使用。**

其中最值得优先研究的几类是：

- `Langfuse`
- `Promptfoo`
- `LangSmith`
- `AgentEvals`
- `ZeroEval`

## 参考链接总表

### Cursor / Skills

- [Agent Skills | Cursor Docs](https://www.cursor.com/docs/context/skills)
- [observability-llm-obs | Cursor Skill](https://cursor.com/cn/marketplace/skills/observability-llm-obs)
- [Cursor Marketplace](https://cursor.sh/plugins)

### Promptfoo

- [Agent Skill for Writing Evals | Promptfoo](https://promptfoo.dev/docs/integrations/agent-skill/)
- [Tracing | Promptfoo](https://promptfoo.dev/docs/tracing/)
- [CI/CD Integration for LLM Eval and Security | Promptfoo](https://promptfoo.dev/docs/integrations/ci-cd)
- [Using Promptfoo in n8n Workflows | Promptfoo](https://www.promptfoo.dev/docs/integrations/n8n/)

### Langfuse

- [Evaluating AI Agent Skills | Langfuse](https://langfuse.com/blog/2026-02-26-evaluate-ai-agent-skills)
- [AI Agent Observability, Tracing & Evaluation with Langfuse](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse)
- [Example - Evaluating OpenAI Agents](https://langfuse.com/guides/cookbook/example_evaluating_openai_agents)
- [Trace and Evaluate LangGraph Agents](https://langfuse.com/docs/integrations/langchain/example-langgraph-agents)
- [Datasets](https://langfuse.com/docs/evaluation/experiments/datasets)
- [Experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)
- [Observability Overview](https://langfuse.com/docs/observability/overview)

### LangSmith

- [LangSmith](https://langsmith.org/)
- [LangSmith Evaluation](https://www.langchain.com/langsmith/evaluation)
- [How to evaluate with OpenTelemetry](https://docs.langchain.com/langsmith/evaluate-with-opentelemetry)

### AgentEvals

- [AgentEvals](http://aevals.ai/)
- [agentevals-dev/agentevals](https://github.com/agentevals-dev/agentevals)
- [Integrations](https://aevals.ai/docs/integrations/)
- [Evaluators Registry](https://github.com/agentevals-dev/evaluators)
- [agentevals-cli on PyPI](https://pypi.org/project/agentevals-cli/)

### ZeroEval

- [zeroeval/zeroeval-skills](https://github.com/zeroeval/zeroeval-skills)
- [Skills - ZeroEval Documentation](https://docs.zeroeval.com/integrations/skills)
- [Introduction - ZeroEval Tracing](https://docs.zeroeval.com/tracing/introduction)
- [Tracing Reference](https://docs.zeroeval.com/tracing/reference)
- [CLI - ZeroEval Documentation](https://docs.zeroeval.com/integrations/cli)

### 其他候选

- [AgentOps GitHub](https://github.com/agentops-ai/agentops)
- [Setup OTEL - Phoenix](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-using-phoenix-otel)
- [Running Evals on Traces - Phoenix](https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces)
- [Using Tracing Helpers - Phoenix](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument)
- [Python SDK - Phoenix](https://arize.com/docs/phoenix/sdk-api-reference)
- [W&B Weave for AI Agent Evaluation](https://wandb.ai/site/agents)
- [Mastering AI agent observability](https://wandb.ai/site/articles/ai-agent-observability/)
- [Build an evaluation - Weave Docs](https://docs.wandb.ai/weave/tutorial-eval/)
- [Weave Documentation](https://wandb.github.io/weave/)
