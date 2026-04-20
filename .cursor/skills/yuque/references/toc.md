# 目录（TOC）操作

本文件用于目录读取与非破坏性的目录变更。

## 读取目录

路由选项：

- `GET /api/v2/repos/{book_id}/toc`
- `GET /api/v2/repos/{group_login}/{book_slug}/toc`

在尝试任何目录写入前，必须先读取目录。写入接口依赖节点 UUID 与当前树形结构。

## 写入目录

路由选项：

- `PUT /api/v2/repos/{book_id}/toc`
- `PUT /api/v2/repos/{group_login}/{book_slug}/toc`

Schema 中支持的动作取值：

- `appendNode`
- `prependNode`
- `editNode`
- `removeNode`

支持的动作模式：

- `sibling`
- `child`

## 安全的目录动作

当目标明确且变更范围较小时，可将以下操作视为安全：

- 在已知父节点下新建节点
- 将文档挂到已知父节点下
- 在已知兄弟节点之间调整顺序
- 重命名已有节点

优先使用：

- 常规插入用 `appendNode`
- 针对性更新或移动用 `editNode`

仅当用户明确要求节点排在同级列表最前时，再使用 `prependNode`。

## 危险的目录动作

以下视为危险：

- `removeNode`
- 一步内大范围重写多个节点
- 目标身份不明确时移动节点

删除目录节点不一定会删除底层文档，但仍可能隐藏内容、破坏导航预期，因此仍按高风险处理。

## 实务规则

- 从**最新一次**目录读取中取得 `target_uuid` 与 `node_uuid`
- 不要根据过时笔记猜测 UUID
- 将文档移到某菜单下时，先解析该菜单节点
- 多个节点名称相近时，先消歧再写入
