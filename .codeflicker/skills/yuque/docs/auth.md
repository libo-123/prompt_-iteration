# 认证

本技能通过如下请求头调用语雀 OpenAPI 进行认证：

```http
X-Auth-Token: <token>
```

## 令牌解析顺序

随附脚本会优先自动加载 `skills/yuque/.env`（若该文件存在）。`.env` 中的值仅用于填充**尚未设置**的环境变量，不会覆盖 Shell 中已存在的变量。

实际生效的令牌解析顺序为：

1. 命令行参数 `--token`
2. `YUQUE_TOKEN`
3. `YUQUE_AUTH_TOKEN`

若脚本以 `--execute` 运行且没有任何可用令牌，会在发出请求前失败。

## 推荐用法

优先使用环境变量，而不是在命令行传入令牌。

推荐的本地配置：

1. 将 `.env.example` 复制为 `.env`
2. 填入真实的 `YUQUE_TOKEN`
3. 正常运行脚本

示例：

```bash
cp skills/yuque/.env.example skills/yuque/.env
```

示例：

```bash
node skills/yuque/scripts/read-doc.mjs --id 123 --execute
```

也可在命令行直接传参，但安全性较差，因为 Shell 历史可能保留令牌：

```bash
node skills/yuque/scripts/read-doc.mjs --id 123 --token your_token_here --execute
```

## 本地环境模板

使用仓库内的模板文件：

- `.env.example`

推荐做法：

- 将 `.env.example` 复制为 `.env`
- 在本地填入真实令牌
- 不要将 `.env` 提交到版本库
- 仅在需要时使用 Shell 环境变量覆盖

## 说明

- **预览模式**不需要令牌，因为只打印计划中的请求。
- **执行模式**需要有效令牌。
- 本技能不会在 `SKILL.md`、`references/` 或脚本中硬编码令牌。
