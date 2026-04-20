# 语雀 OpenAPI 文档

本目录存放 `yuque` 技能的本地文档资料。

## 文件

- `yuque_openapi_20251121_green.yaml`：语雀 OpenAPI 定义的本地副本，用于设计与扩展本技能
- `auth.md`：认证规则与本地令牌使用说明

## 来源

原始文档页面：

- https://www.yuque.com/yuque/developer/openapi

## 用法

在以下情况使用本 YAML 文件：

- 审查技能所覆盖的接口范围
- 更新 `references/` 内容
- 新增或调整 `scripts/`
- 在启用更多语雀能力前核对 schema 细节

在以下情况使用 `auth.md`：

- 为脚本执行接入本地认证
- 查看令牌解析顺序
- 在环境变量与命令行传令牌之间做选择

启用需认证的执行时，将 `../.env.example` 作为本地 `.env` 模板。

## 更新说明

当语雀更新其 OpenAPI 定义时，请替换本目录中的本地 YAML 副本，并复查：

- `SKILL.md`
- `references/`
- `scripts/`
