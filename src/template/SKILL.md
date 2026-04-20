---
name: Skill模板
description: 一个标准的skill模版
disable-model-invocation: true
---

## 一个标准的 skill 模版

Frontmatter 字段
字段 必填 说明
name Yes 技能标识符。只能使用小写字母、数字和连字符。必须与父文件夹名称一致。
description Yes 描述技能的功能以及使用场景。Agent 会用它来判断相关性。
license No 许可证名称或对随附许可证文件的引用。
compatibility No 环境要求 (系统软件包、网络访问等) 。
metadata No 用于附加元数据的任意键值对映射。
disable-model-invocation No 当为 true 时，此技能仅在通过 /skill-name 显式调用时才会被使用。Agent 不会根据上下文自动应用它。

默认情况下，当 agent 判断某个技能相关时，会自动应用该技能。通过设置 disable-model-invocation: true，可以让技能表现得像传统的斜杠命令，只有当你在聊天中显式输入 /skill-name 时，它才会被加入到上下文中。

skills/
    └── deploy-app/
    ├── SKILL.md
    ├── scripts/ # 脚本
        ├── deploy.sh
        └── validate.py
    ├── references/
        └── REFERENCE.md
    └── assets/
    └── config-template.json

scripts/	智能体可以运行的可执行代码
references/	按需加载的补充文档
assets/	模板、图片或数据文件等静态资源

让主 SKILL.md 文件保持聚焦，把详细参考内容放到单独的文件中。这样可以提高上下文使用效率，因为智能体会按需逐步加载资源——只在需要时才加载。


## 子代理
无需配置这些子代理。Agent 会在合适的场景下自动使用它们。

何时使用子 Agent
适合使用子 Agent 的场景...	适合使用 Skill 的场景...
你需要为长时间的研究任务进行上下文隔离	任务是单一用途的 (生成 changelog、格式化等)
需要并行运行多个工作流	你想要一个快速、可重复的操作
任务在多个步骤中需要专业知识	任务可以一次性完成
你希望对工作结果进行独立验收/校验	你不需要单独的上下文窗口

自定义子代理
定义自定义子代理，用于固化专业知识、落实团队规范或自动化处理重复性流程。

自动委派
Agent 会根据以下因素主动委派任务：

任务的复杂度和范围
你在项目中为 subagent 编写的自定义描述
当前上下文和可用工具

### 最佳实践
编写专注的子代理 — 每个子代理应只负责一件事、职责清晰。避免泛泛的「helper」代理。
投入精力写好描述 — description 字段决定 Agent 何时委派给你的子代理。花时间打磨它。通过编写不同的提示并检查是否触发了正确的子代理来测试。
保持提示简洁 — 冗长、啰嗦的提示会削弱聚焦度。要具体、直接。
将子代理纳入版本控制 — 把 .cursor/agents/ 提交到代码仓库，让整个团队都能受益。
从 Agent 生成的代理开始 — 先让 Agent 帮你起草初始配置，再进行自定义。
使用 hooks 处理文件输出 — 如果你需要子代理生成结构化输出文件，可以考虑使用 hooks 来统一处理并保存这些结果。


## 区别
规则	持久性人工智能指导和编码标准（.mdc文件）
技能	针对复杂任务的专用代理功能
代理人	自定义代理配置和提示
命令	代理可执行命令文件
MCP服务器	模型上下文协议集成
钩子	由事件触发的自动化脚本

