# 示范：最小 SKILL.md 正文

```markdown
---
name: my-task-skill
description: 从 CSV 读取一列并去重后输出为列表。当用户处理 CSV、去重、或提取单列数据时使用。
---

# My Task Skill

## Instructions

1. 用项目约定的运行时读取 CSV 路径（如 Node：`fs` + 解析器，或 Python：`csv` 模块）
2. 对指定列去重，保持首次出现顺序
3. 将结果以代码块或列表交给用户

## Examples

**输入**：对 `data.csv` 的 `email` 列去重

**输出**：以 markdown 列表返回去重后的邮箱

---

# 好 / 坏 description 对照

- **好**：`根据 git diff 生成说明性 commit 信息。当用户写提交说明、看 staged 改动、或要 conventional commits 风格时使用。`
- **坏**：`帮助提交。`（无场景、无关键词）

```
