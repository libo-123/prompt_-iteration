# 文档操作

本文件用于文档的列出、读取、创建、更新及版本查看。

## 列出文档

知识库内列出文档有两种路由风格。

- `GET /api/v2/repos/{book_id}/docs`
- `GET /api/v2/repos/{group_login}/{book_slug}/docs`

在选定要更新或要移动的文档前，可用这些接口查看可用文档。

## 读取文档

路由选项：

- `GET /api/v2/repos/docs/{id}`
- `GET /api/v2/repos/{book_id}/docs/{id}`
- `GET /api/v2/repos/{group_login}/{book_slug}/docs/{id}`

若已知知识库上下文，优先使用带知识库作用域的路由。

## 创建文档

路由选项：

- `POST /api/v2/repos/{book_id}/docs`
- `POST /api/v2/repos/{group_login}/{book_slug}/docs`

重要请求字段：

- `body` 必填
- `title` 可选，但通常应显式设置
- `slug` 可选
- `public` 可选
- `format` 可选，默认 `markdown`

支持的创建格式：

- `markdown`
- `html`
- `lake`

## 更新文档

路由选项：

- `PUT /api/v2/repos/{book_id}/docs/{id}`
- `PUT /api/v2/repos/{group_login}/{book_slug}/docs/{id}`

重要更新字段：

- `title`
- `slug`
- `public`
- `format`
- `body`

先读后写。应生成更新后的完整文档状态，而不是盲目拼接片段。

## 删除文档

路由选项：

- `DELETE /api/v2/repos/{book_id}/docs/{id}`
- `DELETE /api/v2/repos/{group_login}/{book_slug}/docs/{id}`

属于危险操作。默认不执行。

## 文档模型

### `V2Doc`

用作列表/搜索摘要形态。

重要字段：

- `id`
- `type`
- `slug`
- `title`
- `description`
- `book_id`
- `public`
- `status`
- `likes_count`
- `comments_count`
- `word_count`
- 时间戳等

### `V2DocDetail`

用作完整文档对象，用于编辑与导出决策。

重要内容字段：

- `format`
- `body`
- `body_html`
- `body_lake`
- `body_draft`
- `body_sheet`
- `body_table`

支持的文档类型包括：

- `Doc`
- `Sheet`
- `Thread`
- `Board`
- `Table`

默认编辑策略：

- 优先 `markdown`
- 仅当用户明确要求时使用 `html` 或 `lake`
- 谨慎处理 `Sheet` 与 `Table`，其结构化正文并非普通 Markdown 文本

## 版本

路由：

- `GET /api/v2/doc_versions`
- `GET /api/v2/doc_versions/{id}`

版本接口用于在风险较高的更新前查看历史状态，或了解近期编辑上下文。
