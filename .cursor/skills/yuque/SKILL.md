---
name: yuque
description: 通过语雀 OpenAPI 读取、搜索、创建与更新用户、团队、知识库、文档、目录结构、版本与统计。当需要在语雀知识库或文档上操作、在知识库内调整文档位置、查看 API 能力，或为破坏性操作准备受控方案时使用。
metadata:
  name: 语雀
  description: 通过语雀 OpenAPI 操作语雀工作空间、知识库、文档、目录结构及相关资源。
  author: Flc゛
  created: 2026-03-23T03:05:50Z
---

# 语雀（Yuque）

通过语雀 OpenAPI 进行操作，充分了解能力边界，并对安全门槛有明确约束。

## 工作方式

以「语雀工作空间操作者」身份行动，而不是泛用的 REST 客户端。

优先顺序：

- 在原始 ID 之前，优先使用可读的标识方式
- 写入前先读取并核对
- 在广泛更新之前，先做最小有效变更
- 对破坏性操作采用受控处理
- 在移动文档之前，先理清知识库与目录（TOC）上下文

除非本地证据表明另有配置，否则假定上游 API 基址为 `https://www.yuque.com`，认证方式为 `X-Auth-Token`。

在接入本地认证以便执行脚本时，请阅读 [docs/auth.md](docs/auth.md)。

## 能力模型

将语雀相关操作分为三类执行等级。

### 1. 读取

默认允许。

包括：

- 当前用户与心跳
- 用户所在团队
- 团队成员
- 知识库列表与详情
- 文档列表与详情
- 目录读取
- 搜索
- 文档版本
- 统计

### 2. 安全写入

在目标明确时默认允许。

包括：

- 创建知识库
- 更新知识库元数据
- 创建文档
- 更新文档
- 变更成员角色
- 创建目录节点
- 重命名目录节点
- 在目录内移动文档或节点且不删除任何内容

### 3. 危险写入

默认不执行。除非运行环境定义了明确的审批路径，否则先生成预检方案。

包括：

- 删除文档
- 删除知识库
- 移除目录节点
- 移除团队成员
- 大范围或隐式的目录重写
- 可能导致内容孤立或隐藏的批量操作

对危险类请求：

- 明确具体目标
- 说明影响与可逆性
- 列出将使用的接口与动作
- 除非用户明确要求高风险路径且当前环境支持该确认方式，否则在方案阶段停止

## 资源标识

优先使用可读路径，而非不透明 ID。

当用户未强制指定形式时，按以下顺序优先：

1. `group_login + book_slug + doc_slug`
2. `group_login + book_slug + doc_id`
3. `book_id + doc_id`
4. 仅当只有这些可用时，才使用原始数字 ID

当用户以人类可读的语雀路径描述时，使用基于 slug 的知识库路由；当已有集成持有稳定 ID 时，使用 ID 路由。

在进行任何目录写入之前，先读取当前目录，以获取节点 UUID 与父子关系。

## 核心工作流

采用能满足需求的最小工作流。

### 读取工作空间状态

适用于如下问题：

- 「读取这个知识库」
- 「看看这个文档内容」
- 「列出这个团队的知识库」
- 「把当前目录结构给我理一下」

步骤：

1. 从可读标识解析目标知识库或文档。
2. 使用最匹配的窄范围接口读取资源。
3. 返回与任务相关的字段。
4. 对文档，若存在，优先返回 `body` 及与格式相关的 body 字段。

用户、团队与搜索相关任务请阅读 [references/user-group.md](references/user-group.md)。  
知识库任务请阅读 [references/repo.md](references/repo.md)。  
文档任务请阅读 [references/doc.md](references/doc.md)。  
目录任务请阅读 [references/toc.md](references/toc.md)。

### 创建文档

适用于如下请求：

- 「在这个知识库里新建文档」
- 「把这份 Markdown 发到语雀」
- 「在某个目录下面创建一篇文档」

步骤：

1. 解析目标知识库。
2. 若摆放位置重要，先读目录并解析目标父节点。
3. 构建创建请求体，明确包含 `title`、`body`，以及可选的 `slug`、`public`、`format`。
4. 除非用户明确要求 `html` 或 `lake`，否则默认 `format=markdown`。
5. 创建成功后，若用户指定了具体位置，再将文档挂到目录中。

### 更新文档

适用于如下请求：

- 「修改这篇语雀文档」
- 「把这段内容追加到现有文档」
- 「把这个标题和 slug 改掉」

步骤：

1. 先读取当前文档。
2. 判断用户需要全文替换还是局部编辑。
3. 生成更新后的完整正文内容。
4. 保留用户未要求修改的字段，尤其是 `slug`、`public` 与格式。
5. 在对应的知识库作用域路由上执行更新。

不要把文档编辑当成盲目补丁。当最终完整文档状态明确时，API 使用更安全。

### 重组目录

适用于如下请求：

- 「把这篇文档放到某个菜单下面」
- 「把这个节点移动到另一个父节点下」
- 「新建一个目录节点」
- 「重命名目录节点」

步骤：

1. 读取当前目录。
2. 解析目标节点 UUID 以及预期的父级或同级关系。
3. 选择范围最小、非破坏性的动作：
   - `appendNode`
   - 仅在明确需要插到头部时使用 `prependNode`
   - `editNode`
4. 仅执行满足该请求所需的局部目录变更。
5. 再次读取目录或总结预期的新位置。

在正常执行中不要使用 `removeNode`。

## 决策规则

- 除非用户明确要求 `html`、`lake`、表格或表格语义，否则创作时优先使用 `markdown`。
- 在已知知识库上下文时，优先使用知识库作用域的文档接口，而非通用文档详情路由。
- 对文档、知识库、成员变更及所有目录操作，先读后写。
- 在目录中移动内容时，基于最近一次目录读取得到的节点 UUID 操作。
- 除非用户明确要求修改，否则保留可见性与 slug。
- 目标不明确时视为写入阻塞；先解析目标，不要猜测。
- 当请求涉及大量资源时，拆成离散操作并说明计划。

## API 覆盖面

本技能覆盖语雀 API 的主要领域：

- 用户
- 搜索
- 团队成员
- 知识库读与写
- 文档读与写
- 文档版本
- 目录读取与安全重组
- 统计

接口覆盖与安全分级请阅读 [references/capability-map.md](references/capability-map.md)。

## 准备

在执行需认证的脚本前，按如下方式准备本地认证：

1. 将 `skills/yuque/.env.example` 复制为 `skills/yuque/.env`
2. 将占位符 `YUQUE_TOKEN` 替换为真实令牌
3. 仅在本机保留 `skills/yuque/.env`，不要提交到版本库

存在 `skills/yuque/.env` 时，脚本会自动加载。

令牌解析顺序与认证细节请阅读 [docs/auth.md](docs/auth.md)。

## 脚本

当具体请求需要变成可复现的语雀 API 调用时，使用随附脚本。

- `scripts/heartbeat.mjs` 与 `scripts/current-user.mjs`：检查基本认证连通性与令牌身份
- `scripts/search.mjs`：搜索文档或知识库
- `scripts/list-user-groups.mjs`、`scripts/list-group-members.mjs`、`scripts/update-group-member-role.mjs`：查看团队并做非破坏性的成员变更
- `scripts/list-repos.mjs`、`scripts/read-repo.mjs`、`scripts/create-repo.mjs`、`scripts/update-repo.mjs`：操作知识库
- `scripts/list-docs.mjs`、`scripts/read-doc.mjs`、`scripts/create-doc.mjs`、`scripts/update-doc.mjs`：操作文档
- `scripts/list-doc-versions.mjs`、`scripts/read-doc-version.mjs`：查看文档历史
- `scripts/read-toc.mjs`、`scripts/update-toc.mjs`、`scripts/move-toc-node.mjs`：查看与重组目录（不含删除）
- `scripts/read-statistics.mjs`：查看团队统计
- `scripts/*-preflight.mjs`：为危险操作准备受控方案，不实际执行

脚本约定：

- 默认预览模式
- 仅当目标清晰且动作符合本技能的安全模型时，再传入 `--execute`
- 常规执行优先使用从 `.env.example` 复制的本地 `skills/yuque/.env`
- 需要一次性令牌时可用 `--token` 覆盖本地配置
- 使用写入类脚本前先读取当前文档或目录

## 错误处理

默认按以下理解处理：

- `400`：请求形态错误；检查路径参数、查询参数与枚举值
- `401`：令牌缺失、无效或权限不足
- `403`：令牌有效但无法访问目标资源
- `404`：知识库、文档、团队或节点目标错误
- `422`：请求体验证失败；检查必填字段与枚举值
- `429`：触发限流；降低请求频率并谨慎重试
- `500`：上游故障；在再次核对目标状态前，避免重复大范围写入

认证与失败处理详见 [references/auth-and-errors.md](references/auth-and-errors.md)。

## 危险请求

当用户要求删除或移除时：

1. 默认不执行破坏性调用。
2. 生成预检摘要，包含：
   - 目标标识
   - 可能受影响的知识库、文档或节点
   - 接口与方法
   - 可逆性方面的顾虑
3. 若存在更安全替代方案，则提出建议。

例如：

- 通过重命名或移动文档来「归档」，而不是删除
- 将目录节点挪开，而不是移除
- 限制访问或调整角色，而不是移除成员

完整策略见 [references/safety-policy.md](references/safety-policy.md)。
