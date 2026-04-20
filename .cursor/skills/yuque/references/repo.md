# 知识库操作

本文件用于语雀知识库相关操作。

## 读取知识库

存在两种路由风格。

### 按知识库 ID

- `GET /api/v2/repos/{book_id}`

### 按可读路径

- `GET /api/v2/repos/{group_login}/{book_slug}`

当用户提供语雀 URL 或团队与知识库 slug 时，优先使用可读路径。

## 列出知识库

### 团队下知识库

- `GET /api/v2/groups/{login}/repos`

### 用户下知识库

- `GET /api/v2/users/{login}/repos`

当用户询问「这个团队有哪些知识库」或尚未确定要选哪个知识库时使用上述接口。

## 创建知识库

路由：

- `POST /api/v2/groups/{login}/repos`
- `POST /api/v2/users/{login}/repos`

常见创建字段包括：

- `name`
- `slug`
- `description`
- `public`
- 若 schema 支持，还可指定知识库类型等

创建知识库视为安全写入，但发送请求前须明确目标所有者。

## 更新知识库

路由：

- `PUT /api/v2/repos/{book_id}`
- `PUT /api/v2/repos/{group_login}/{book_slug}`

用于元数据更新，例如：

- 名称
- slug
- 描述
- 可见性

若需在变更时保留用户未提及的字段，应先读取知识库。

## 删除知识库

路由：

- `DELETE /api/v2/repos/{book_id}`
- `DELETE /api/v2/repos/{group_login}/{book_slug}`

属于危险操作。默认不执行。

## 关键模型

- `V2Book`：列表层知识库对象
- `V2BookDetail`：详情对象，含 `toc_yml`、计数、时间戳与 `namespace`

重要字段：

- `id`
- `slug`
- `name`
- `user_id`
- `description`
- `public`
- `items_count`
- `namespace`
