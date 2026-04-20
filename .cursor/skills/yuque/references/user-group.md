# 用户、团队、搜索与统计

本文件用于用户身份、团队成员读取、搜索与报表类任务。

## 用户

### 当前令牌所属用户

- 接口：`GET /api/v2/user`
- 用途：确认令牌归属及大致可用的工作空间上下文
- 主要模型：`V2User`

当权限不明确时，应优先调用此接口。

### 用户所在团队

- 接口：`GET /api/v2/users/{id}/groups`
- 用途：列出某用户所属的团队
- 路径参数：用户 login 或数字 ID

## 团队成员

### 读取成员

- 接口：`GET /api/v2/groups/{login}/users`
- 用途：查看某团队的成员
- 可选筛选：角色、偏移量

### 变更成员角色

- 接口：`PUT /api/v2/groups/{login}/users/{id}`
- 安全写入分级：允许
- 请求体字段：`role`
- 支持的角色取值：
  - `0` 管理员
  - `1` 成员
  - `2` 只读成员

### 移除成员

- 接口：`DELETE /api/v2/groups/{login}/users/{id}`
- 危险分级：默认不执行

## 搜索

- 接口：`GET /api/v2/search`
- 必填查询参数：
  - `q`
  - `type` 取 `doc` 或 `repo`
- 常用可选参数：
  - `scope`
  - `page`
  - `creator`

当用户从语义上知道内容、但不知道结构路径时使用搜索。

若目标路径已知，优先使用直接的知识库或文档路由。

## 统计

接口：

- `GET /api/v2/groups/{login}/statistics`
- `GET /api/v2/groups/{login}/statistics/members`
- `GET /api/v2/groups/{login}/statistics/books`
- `GET /api/v2/groups/{login}/statistics/docs`

统计用于只读报表与趋势查看。所有统计接口均视为只读且安全。
