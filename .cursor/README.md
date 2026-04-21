# `.cursor` 索引
## main

| 说明                     | 目录                        |
| ------------------------ | --------------------------- |
| 抽象可复用开发范式提示词 | `commands/create_prompt.md` |
| 同步 `.cursor` 索引      | `commands/update.md`        |

## Skills

| 类型 | 说明 | 目录 |
| --- | --- | --- |
| 总览 | Agent Skill，子目录内 `SKILL.md` 为入口 | `skills/` |
| 模板 | Skill 模板 | `skills/Atemplate/` |
| 业务开发 | 枚举/下拉接口缓存（`useRequest` + `cacheKey` 等） | `skills/enum-options-cache/` |
| 业务开发 | 前端架构设计与任务拆分 | `skills/fe-architect/` |
| 业务开发 | Stitch 设计转 Vite + React 组件 | `skills/react-components/` |
| 业务开发 | 演示固定 6 步 Skill Trace 流程 | `skills/skill-trace-demo/` |
| 业务开发 | React / Next.js 性能与写法 | `skills/vercel-react-best-practices/` |
| 业务开发 | 语雀 OpenAPI 读写与目录 | `skills/yuque/` |
| 业务开发 | 页面状态抽成 Zustand 模块化 store | `skills/zustand-generator/` |

## Commands

| 类型 | 说明 | 目录 |
| --- | --- | --- |
| 总览 | 斜杠命令（`/文件名` 触发对应 `.md`） | `commands/` |
| 通用 | 总结近两周 AI 热点 | `commands/ai-trends.md` |
| 组件 | Drawer 用法 | `commands/components/drawer.md` |
| 配置 | 生成 `AskQuestion` 配置 | `commands/config/askquestion.md` |
| 配置 | 仅单任务上下文执行约束 | `commands/config/only-single-task.md` |
| 配置 | 优先用 `@es/pro-components` | `commands/config/pro-components.md` |
| 配置 | Store 配置约定 | `commands/config/store.md` |
| 文档 | 在系统浏览器打开我的文档 | `commands/doc/myDoc.md` |
| 样式 | CSS 布局类提示 | `commands/css/css-layout-apply.md` |
| 包能力 | `DateFilter` 包相关 | `commands/package/package-DateFilter.md` |
| 包能力 | `TabsDataCard` 包相关 | `commands/package/package-TabsDataCard.md` |
| 包能力 | `useProFormTable` 包相关 | `commands/package/package-useProFormTable.md` |

## 运行与约束

| 类型 | 说明 | 目录 |
| --- | --- | --- |
| 规则 | 项目级规则 | `rules/` |
| Agent | 子 Agent 定义 | `agents/` |
| Agent | 改完业务组件后做规范检查 | `agents/after-component.md` |
| Hook 配置 | Cursor Hook 配置入口 | `hooks.json` |
| Hook | Git Hooks 脚本 | `hooks/` |
| Hook | 格式化脚本 | `hooks/format.sh` |
| Hook | Skill Trace 日志采集脚本（Node） | `hooks/skill_trace_logger.js` |
| 配置 | Cursor 工作区设置 | `settings.json` |
| 文档 | Skill Trace 观察器说明 | `skill-trace-observer.md` |


