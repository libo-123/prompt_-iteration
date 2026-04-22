# 语雀技能（Yuque Skill）

`yuque` 是用于对接语雀 OpenAPI 的 Codex 技能。

涵盖：

- 用户与团队的读取
- 知识库的读取与安全写入
- 文档的读取与安全写入
- 目录的读取与非破坏性重组
- 搜索、版本与统计
- 对破坏性操作采用受控的预检流程

## 安装

```bash
npx skills add https://github.com/flc1125/skills --skill yuque
```

## 结构

- `SKILL.md`：面向智能体的工作流与执行规则
- `scripts/`：语雀 API 操作的可执行辅助脚本
- `references/`：面向任务的接口说明与数据模型指引
- `docs/`：本地 OpenAPI 源码与认证文档
- `.env.example`：本地认证模板

## 快速开始

1. 将 `skills/yuque/.env.example` 复制为 `skills/yuque/.env`
2. 填入 `YUQUE_TOKEN`
3. 先在预览模式下运行脚本
4. 仅在目标与动作确认无误时再追加 `--execute`

示例：

```bash
cp skills/yuque/.env.example skills/yuque/.env
node skills/yuque/scripts/read-repo.mjs --group-login your-team --book-slug handbook
node skills/yuque/scripts/read-repo.mjs --group-login your-team --book-slug handbook --execute
```

## 认证

- 请求头：`X-Auth-Token`
- 本地认证说明：[docs/auth.md](docs/auth.md)
- OpenAPI 源码：[docs/yuque_openapi_20251121_green.yaml](docs/yuque_openapi_20251121_green.yaml)

## 安全模型

- 读取类操作默认允许
- 目标明确时支持安全写入
- 破坏性操作使用预检脚本，而非直接执行

需受控防护的操作示例：

- 删除文档
- 删除知识库
- 移除目录节点
- 移除团队成员

## 说明

- 优先使用可读的知识库路径，例如 `group_login + book_slug`
- 任何目录写入前先读取目录（TOC）
- 除非用户明确要求其他格式，否则优先使用 `markdown`
