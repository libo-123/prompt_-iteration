# Agent Skill 编写通用规范

本文档用于指导编写 **Cursor Agent Skill**（`.cursor/skills/<name>/SKILL.md` 及配套文件）。适用于**调用外部 API、存在写入与风险**的领域；纯风格/纯框架类 skill 可删减相应章节。

**目标**：触发可发现、行为可预测、能力边界清晰、风险可分级、细节可维护（不把所有接口塞进一篇正文）。

---

## 1. 存放位置与目录结构

| 类型 | 路径 | 作用域 |
|------|------|--------|
| 项目 Skill | `.cursor/skills/<skill-name>/` | 随仓库共享 |
| 个人 Skill | `~/.cursor/skills/<skill-name>/` | 本机所有项目可用 |

**注意**：不要使用 `~/.cursor/skills-cursor/`，该目录为 Cursor 内置技能保留。

建议目录布局（按需取舍）：

```text
skill-name/
├── SKILL.md              # 必填：总则、工作流、决策规则
├── references/           # 可选：分域详解、能力映射、错误与安全策略
├── docs/                 # 可选：OpenAPI 快照、认证说明、本地资料说明
├── scripts/              # 可选：可复现 CLI，与技能安全模型一致
├── .env.example          # 可选：密钥占位，勿提交真实值
└── .gitignore            # 可选：忽略 .env
```

**分工**：`SKILL.md` 保持**可扫描、偏短**；接口枚举、schema 细节、长列表放入 `references/` 或 `docs/`，由正文用链接引用。

---

## 2. Frontmatter（必填）

```yaml
---
name: skill-name          # 小写字母、数字、连字符；≤64 字符
description: ...          # ≤1024 字符，非空；见下文
# 可选：供展示或团队元数据
metadata:
  name: 展示名
  description: 一句话
  author: ...
  created: ...
---
```

### `description` 写法（影响触发 discovery）

1. **第三人称**（会进入系统提示，避免「我帮你」「你可以」）。
2. **同时写清 WHAT 与 WHEN**：能做什么 + 什么情况下应启用本 skill。
3. **包含触发词**：产品名、资源类型、典型动词（读取、同步、目录、预检等），避免过泛（如仅写「帮助处理文档」）。

示例（结构可参考，勿照抄产品名）：

```yaml
description: 通过某某 API 读取与更新资源 A、B。当用户提到「同步」「知识库」「目录」或需要受控的删除预检时使用。
```

---

## 3. 正文设计原则（尤其有外部写入时）

1. **角色明确**：写明代理以何种身份行动（例如「工作空间操作者」而非泛用 REST 客户端），缩小胡编接口的空间。
2. **可读标识优先**：规定 slug / 路径 / 业务名相对原始 ID 的优先级；避免代理随意猜 ID。
3. **先读后写**：更新、移动、重组类流程在正文中**显式**写出「先读取当前状态」一步。
4. **最小有效变更**：鼓励窄范围接口、局部更新，反对未确认目标的大范围批量操作。
5. **能力分级**：读取 / 安全写入 / 危险写入 三级默认策略；危险类默认不执行，先预检摘要（目标、影响、接口、可逆性、替代方案）。
6. **脚本与副作用**：若随附脚本，默认 **预览或 dry-run**；真正写入用显式开关（如 `--execute`），并在正文「脚本」节写明。

纯只读、无账号风险的 skill 可弱化第 5～6 条，但建议保留「目标不明则阻塞、不猜测」类表述。

---

## 4. `SKILL.md` 建议章节结构

可按领域增删，**推荐顺序**便于代理与人类扫读一致。

| 章节 | 内容要点 |
|------|----------|
| **标题与导语** | 一两句说明集成对象与总体约束（如认证方式、基址默认值）。 |
| **工作方式** | 行为优先级列表（可读标识优于裸 ID、先读后写等）；可选「除非…否则假定…」的默认配置。 |
| **能力模型** | 读取 / 安全写入 / 危险写入 三分；每类下列举覆盖的操作类型。 |
| **资源标识** | 多路由或多 ID 形态时的**显式优先级**；目录类写入前是否必须先读 TOC/树。 |
| **核心工作流** | 按用户意图分场景（读空间、创建、更新、重组…）；每场景：**适用问题示例 → 编号步骤**。 |
| **决策规则** | 短句列表：格式默认值、路由选型、何时阻塞写入、保留 slug/可见性等。 |
| **API 覆盖面** | 一段概括领域；细节指向 `references/capability-map.md` 或等价文档。 |
| **准备** | `.env`、令牌、复制示例；指向 `docs/auth.md`。 |
| **脚本** | 脚本清单 + 共同约定（`--execute`、先读后写、预检脚本不实际删除等）。 |
| **错误处理** | HTTP 状态码或领域错误码速查；指向 `references/auth-and-errors.md` 若较长。 |
| **危险请求** | 重申预检与替代方案；指向 `references/safety-policy.md`。 |

**文风**：指令式、短句；少形容词；用户意图可用**引号示例**（「把这篇文档移到…」）帮助对齐场景。

---

## 5. `references/` 与 `docs/` 拆分建议

| 类型 | 放什么 |
|------|--------|
| `references/<domain>.md` | 单资源域：路径变体、必填字段、与 SKILL 一致的默认格式。 |
| `references/capability-map.md` | 接口列表按**读 / 安全写 / 危险写**分组；可选「重要模型」名列表。 |
| `references/safety-policy.md` | 默认允许、默认防护、预检模板、替代做法。 |
| `references/auth-and-errors.md` | 认证头、常见失败原因与应对。 |
| `docs/auth.md` | 令牌解析顺序、与脚本行为一致的环境变量约定。 |
| `docs/*.yaml` | OpenAPI 本地副本；在 `docs/README.md` 说明**何时应打开它**（扩展能力、对齐 schema）。 |

单篇 reference 开头可用固定句式：**「本文件用于…」**，方便区分总则与分册。

---

## 6. 随附脚本的约定（若存在）

与 `SKILL.md`「脚本」节保持一致即可，常见约定包括：

- 长选项 `--key value`；执行类用 `--execute` 等明确开关。
- `--token` 仅作覆盖，主路径为环境变量；变量名只在 `.env.example` / `docs/auth.md` 声明一处。
- 默认不执行破坏性操作；`*-preflight.*` 只生成方案不落库。
- `printUsage`、缺失参数时明确报错；多组路由互斥时在代码与文档中一致。

---

## 7. 发布前自检清单

- [ ] `name` 与 `description` 符合长度与第三人称；**WHEN** 足够具体以便触发。
- [ ] 正文是否说明默认基址、认证方式（若需）。
- [ ] 写入路径是否都要求「先读」；危险操作是否默认预检而非直接调用。
- [ ] 长接口表是否已迁出至 `references/`，`SKILL.md` 仅保留链接。
- [ ] 脚本约定（预览 / `--execute`）是否与 `docs/auth.md`、`.env.example` 一致。
- [ ] 若 OpenAPI 有本地副本：更新接口后是否同步检查 `SKILL.md` 与 `references/`。

---

## 8. 最小 `SKILL.md` 模板（可复制）

```markdown
---
name: your-skill
description: （第三人称：能力概述 + 何时使用 + 触发词）
---

# 标题

一两句：集成谁、默认约束（认证/基址）。

## 工作方式

- …

## 能力模型

### 读取

…

### 安全写入

…

### 危险写入

默认不执行；先预检。包括：…

## 资源标识

优先级：…

## 核心工作流

### 场景一

适用于：「…」

步骤：

1. …

## 决策规则

- …

## API 覆盖面

详见 [references/capability-map.md](references/capability-map.md)。

## 准备

见 [docs/auth.md](docs/auth.md) 与 `.env.example`。

## 脚本

- …

## 错误处理

见 [references/auth-and-errors.md](references/auth-and-errors.md)。

## 危险请求

见 [references/safety-policy.md](references/safety-policy.md)。
```

---

## 9. 与 Slash Command 的关系

**Slash Command**（`.cursor/commands/*.md`）适合单次任务的步骤与输出格式；**Skill** 适合长期规则与边界。编写 Command 时，应 **@ 引用** 对应 `SKILL.md`，避免在 Command 里重复维护接口清单。本规范仅约束 Skill；若需 Command 规范可另起文档或在团队模板中说明。

---

*版本：基于 `.cursor/skills/yuque/SKILL.md` 与 Cursor create-skill 指引抽象；可按项目迭代。*
