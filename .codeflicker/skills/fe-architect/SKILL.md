---
name: fe-architect
description: 前端架构师技能，根据 PRD 文档产出技术架构和开发任务列表。使用场景：(1) 根据 PRD 生成技术架构, (2) 生成可执行的开发任务列表, (3) 分析现有代码结构并设计新功能
---

# 前端架构师 Skill

**职责**：根据 PRD 文档产出技术架构和开发任务列表。

**依赖 Skills**：
- **doc-reader**：获取 PRD 文档内容
- **rules-generator**：生成项目基础 Rules


## 工作流程

```
1. 检查依赖 Skills → doc-reader、rules-generator 是否存在，不存在则安装
   ↓
2. 检查项目 Rules → project-base-rules.mdc 是否存在，不存在则使用rules-generator skill生成
   ↓
3. 读取所有 Rules → .cursor/rules/templates/ 下所有 .mdc 文件
   ↓
4. 获取 PRD 内容 → 使用 doc-reader skill 或 read_file
   ↓
5. 分析代码结构 → 使用 codebase_search、read_file、list_dir
   ↓
6. 生成架构文档和任务列表
   ↓
7. 保存到 architect-docs/[分支名]/（如已存在则加序号）
```

## 输入

- **PRD 文档链接**：`https://docs.corp.kuaishou.com/d/home/xxx`
- **docId 格式**：`docId:xxx`
- **本地文件**：`path/to/prd.md`

## 输出

**保存位置**：`architect-docs/[分支名]/`

**文件列表**：
| 文件 | 内容 |
|-----|------|
| `architecture.md` | 技术架构文档：整体思路、模块划分、组件拆分、依赖分析、关键流程 |
| `tasks.md` | 开发任务列表：任务描述、文件路径、依赖关系 |

**分支名处理规则**：
- 将 `/` 替换为 `-`（如 `feature/ai-chat` → `feature-ai-chat`）
- 如果目录已存在，在后面加 `_序号`（如 `feature-ai-chat_1`、`feature-ai-chat_2`）

**路径生成逻辑**：
```bash
# 获取分支名并替换 / 为 -
BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
OUTPUT_DIR="architect-docs/${BRANCH}"

# 如果目录已存在，在后面加序号
if [ -d "$OUTPUT_DIR" ]; then
  i=1
  while [ -d "${OUTPUT_DIR}_${i}" ]; do
    i=$((i+1))
  done
  OUTPUT_DIR="${OUTPUT_DIR}_${i}"
fi
```

**路径示例**：
- 分支 `feature/ai-chat` → 目录 `architect-docs/feature-ai-chat/`
- 如已存在 → `architect-docs/feature-ai-chat_1/`
- 再次存在 → `architect-docs/feature-ai-chat_2/`

## 使用方法

```
根据这个 PRD 文档生成技术架构和任务列表：https://docs.corp.kuaishou.com/d/home/xxx
```

或：

```
使用 前端架构师 分析这个 PRD：docId:xxx
```

## 依赖 Skills 安装

| Skill | 检查路径 | 安装命令 |
|-------|---------|---------|
| doc-reader | `.cursor/skills/doc-reader/` | `curl -sL "http://jueying.corp.kuaishou.com/api/admin/skill/install-script?name=doc-reader&scope=project" | bash` |
| rules-generator | `.cursor/skills/rules-generator/` | `curl -sL "http://jueying.corp.kuaishou.com/api/admin/skill/install-script?name=rules-generator&scope=project" | bash` |

## Rules 依赖检测与生成

### 检测流程

1. **严格检查** `.cursor/rules/templates/base/project-base-rules.mdc` **是否存在**
   - 文件名必须严格匹配 `project-base-rules.mdc`
   - 不能是 `web-base-rules.mdc` 或其他名称
2. 如果不存在，调用 `rules-generator` skill 生成
3. 读取所有 Rules（`.cursor/rules/templates/**/*.mdc`）

### 调用 rules-generator

使用 `use_skill` 工具调用：

```json
{
  "skill_name": "rules-generator",
  "reason": "项目缺少 project-base-rules.mdc，需要先生成项目基础 Rules 才能继续分析架构"
}
```

## 核心原则

1. **优先复用**：优先使用项目现有的组件、工具、hooks
2. **技术栈灵活**：优先使用 rules 中定义的技术栈，如果现有无法实现需求可引入新包
3. **目录结构灵活**：已有工程参照现有结构，新工程可参考 rules 模板
4. **简洁明了**：架构文档是给 AI Coding 看的，避免冗余
5. **只关注前端**：后端和其他团队工作一笔带过

## 文件结构

```
.cursor/skills/fe-architect/
├── SKILL.md                     # Skill 核心文档（本文件）
└── references/
    └── enhanced-prd-analysis.md # PRD 分析参考模板
```

## 代码分析方式

使用 AI IDE 工具，不执行脚本：
- `codebase_search`：搜索代码结构
- `read_file`：读取关键文件
- `list_dir`：查看目录结构

## 与其他 Skill 的协作

- **doc-reader**（必需）：获取 PRD 文档内容，不存在会自动安装
- **rules-generator**（必需）：生成项目基础 rules，不存在会自动安装
- **code-reviewer**：生成的任务列表可用于代码审查

## 自定义

修改 `references/enhanced-prd-analysis.md` 来自定义分析要求。
