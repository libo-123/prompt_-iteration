---
name: create-skill-showcase
description: 示范符合 Cursor 规范的 Agent Skill 写法：YAML frontmatter、可发现的 description、渐进式引用与反模式。当用户要示范 skill、学习写 skill、或需要 create-skill 风格的最小可运行示例时触发。
---

# Create-Skill 示范

## 何时使用本技能

- 向用户展示「一个标准 skill 长什么样」
- 从空白开始写新 skill 时，按本文件结构落笔

## 必备结构（照抄即可）

1. 目录：`<skill-name>/SKILL.md`（全小写、连字符；勿放入 `~/.cursor/skills-cursor/`）
2. 文件头 YAML 只含 `name` 与 `description`（必填）
3. 正文用二级标题分节，步骤可编号；长内容放同目录的 `reference.md` / `examples.md`

## `description` 写法（第三人称 + 触发词）

- 用第三人称写能力：**做什么** + **什么情况下用**
- 在描述中写入用户可能说的词（示范、写 skill、SKILL.md、最佳实践等），便于自动匹配

**合格示例：**

```yaml
description: 将页面状态提取为 Zustand 模块化 store。当用户要抽离全局状态、把某状态做成 store 变量、或按模块合并 store 时使用。
```

**避免：**

- 「我帮你…」「你可以…」
- 只有「帮助处理某某」、没有触发场景

## 执行步骤（示范工作流）

用户若仅要「跑一遍示范」，按此最小流程回应：

1. **确认落点**：默认在本仓库 `.cursor/skills/<name>/`（可改为个人 `~/.cursor/skills/<name>/`）
2. **起名**：`[a-z0-9-]{1,64}`，能说明领域（如 `create-skill-showcase`）
3. **写 frontmatter + 两节正文**：`## Instructions` + `## Examples`（可合并为中文标题）
4. **自检**：`SKILL.md` 少于约 500 行；长表、大段示例放到 `examples.md` 并只链一层

## 渐进式引用

在 `SKILL.md` 末尾放一行即可：

- 更完整示例见 [examples.md](examples.md)

## 反模式速查

| 问题 | 做法 |
|------|------|
| 上下文浪费 | 默认模型已会通用编程；只写领域特有规则与命令 |
| 多库并列 | 定一个默认方案，另需时再写「替代：…」 |
| 路径 | 用 `scripts/foo.py`，不要反斜杠 |

## 附加资源

- 可复制模板与好/坏描述对照见 [examples.md](examples.md)
