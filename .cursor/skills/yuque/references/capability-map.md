# 能力映射

本文件用于将用户意图映射到语雀接口分组与安全级别。

## 读取

- `GET /api/v2/hello`
- `GET /api/v2/user`
- `GET /api/v2/users/{id}/groups`
- `GET /api/v2/search`
- `GET /api/v2/groups/{login}/users`
- `GET /api/v2/groups/{login}/repos`
- `GET /api/v2/users/{login}/repos`
- `GET /api/v2/repos/{book_id}`
- `GET /api/v2/repos/{group_login}/{book_slug}`
- `GET /api/v2/repos/{book_id}/docs`
- `GET /api/v2/repos/{group_login}/{book_slug}/docs`
- `GET /api/v2/repos/docs/{id}`
- `GET /api/v2/repos/{book_id}/docs/{id}`
- `GET /api/v2/repos/{group_login}/{book_slug}/docs/{id}`
- `GET /api/v2/doc_versions`
- `GET /api/v2/doc_versions/{id}`
- `GET /api/v2/repos/{book_id}/toc`
- `GET /api/v2/repos/{group_login}/{book_slug}/toc`
- `GET /api/v2/groups/{login}/statistics`
- `GET /api/v2/groups/{login}/statistics/members`
- `GET /api/v2/groups/{login}/statistics/books`
- `GET /api/v2/groups/{login}/statistics/docs`

## 安全写入

- `POST /api/v2/groups/{login}/repos`
- `POST /api/v2/users/{login}/repos`
- `PUT /api/v2/repos/{book_id}`
- `PUT /api/v2/repos/{group_login}/{book_slug}`
- `POST /api/v2/repos/{book_id}/docs`
- `POST /api/v2/repos/{group_login}/{book_slug}/docs`
- `PUT /api/v2/repos/{book_id}/docs/{id}`
- `PUT /api/v2/repos/{group_login}/{book_slug}/docs/{id}`
- `PUT /api/v2/groups/{login}/users/{id}`（角色变更）
- `PUT /api/v2/repos/{book_id}/toc`，动作为 `appendNode`、`prependNode` 或 `editNode`
- `PUT /api/v2/repos/{group_login}/{book_slug}/toc`，动作为 `appendNode`、`prependNode` 或 `editNode`

## 危险写入

- `DELETE /api/v2/groups/{login}/users/{id}`
- `DELETE /api/v2/repos/{book_id}/docs/{id}`
- `DELETE /api/v2/repos/{group_login}/{book_slug}/docs/{id}`
- `DELETE /api/v2/repos/{book_id}`
- `DELETE /api/v2/repos/{group_login}/{book_slug}`
- `PUT /api/v2/repos/{book_id}/toc`，动作为 `removeNode`
- `PUT /api/v2/repos/{group_login}/{book_slug}/toc`，动作为 `removeNode`

## 重要模型

- `V2User`
- `V2Group`
- `V2GroupUser`
- `V2Book`
- `V2BookDetail`
- `V2Doc`
- `V2DocDetail`
- `V2TocItem`
- `V2DocVersion`
- `V2DocVersionDetail`
- `V2SearchResult`
- `V2GroupStatistics`
- `V2MemberStatistics`
- `V2BookStatistics`
- `V2DocStatistics`

## 选择规则

- 用户提供人类可读的语雀路径时，使用带 slug 的知识库路由。
- 集成侧已持久化 `book_id` 时，使用知识库 ID 路由。
- 仅当缺少知识库上下文时，使用通用文档详情路由。
- 仅在读目录并解析节点 UUID 后，再使用目录相关接口。
