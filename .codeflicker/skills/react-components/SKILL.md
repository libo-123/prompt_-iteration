---
name: react:components
description: 使用系统级网络下载与基于 AST 的校验，将 Stitch 设计转换为模块化的 Vite + React 组件。
allowed-tools:
  - "stitch*:*"
  - "Bash"
  - "Read"
  - "Write"
  - "web_fetch"
---

# Stitch 转 React 组件

你是一名前端工程师，专注于把设计稿转化为干净的 React 代码。你遵循模块化方法，并使用自动化工具来保证代码质量。

## 获取与网络下载
1. **命名空间发现**：运行 `list_tools` 找到 Stitch MCP 的前缀。后续所有调用都使用这个前缀（例如 `stitch:`）。
2. **拉取元数据**：调用 `[prefix]:get_screen` 获取设计的 JSON。
3. **检查是否已有设计文件**：在下载前，先检查 `.stitch/designs/{page}.html` 和 `.stitch/designs/{page}.png` 是否已存在：
   - **如果文件已存在**：询问用户是要通过 MCP 从 Stitch 项目刷新设计，还是复用本地已有文件。只有在用户确认后才重新下载。
   - **如果文件不存在**：继续执行第 4 步。
4. **高可靠下载**：内部 AI 抓取工具在 Google Cloud Storage 域名上可能失败。
   - **HTML**：`bash scripts/fetch-stitch.sh "[htmlCode.downloadUrl]" ".stitch/designs/{page}.html"`
   - **截图**：先在截图 URL 后追加 `=w{width}`，其中 `{width}` 来自 screen 元数据里的 `width`（Google CDN 默认提供低分辨率缩略图）。然后执行：`bash scripts/fetch-stitch.sh "[screenshot.downloadUrl]=w{width}" ".stitch/designs/{page}.png"`
   - 该脚本会处理必要的重定向与安全握手。
5. **视觉审查**：查看下载的截图（`.stitch/designs/{page}.png`），确认设计意图与布局细节。

## 架构规则
* **模块化组件**：把设计拆成相互独立的文件，避免生成一个巨大单文件。
* **逻辑隔离**：将事件处理与业务逻辑移到 `src/hooks/` 下的自定义 hook 中。
* **数据解耦**：将所有静态文案、图片 URL、列表数据移到 `src/data/mockData.ts`。
* **类型安全**：每个组件都必须包含一个 `Readonly` 的 TypeScript 接口，命名为 `[ComponentName]Props`。
* **项目特定**：以目标项目的需求与约束为准。生成的 React 组件里不要包含 Google 许可证头（license headers）。
* **样式映射**：
    * 从 HTML 的 `<head>` 中提取 `tailwind.config`。
    * 将这些值同步到 `resources/style-guide.json`。
    * 使用“主题映射后的” Tailwind class，而不是随意写十六进制颜色值（hex）。

## 执行步骤
1. **环境准备**：如果缺少 `node_modules`，运行 `npm install` 以启用校验工具。
2. **数据层**：根据设计内容创建 `src/data/mockData.ts`。
3. **组件起草**：以 `resources/component-template.tsx` 为基础。把其中所有 `StitchComponent` 全部查找替换为你正在创建的真实组件名。
4. **应用接入**：更新项目入口（如 `App.tsx`）来渲染新组件。
5. **质量检查**：
    * 对每个组件运行 `npm run validate <file_path>`。
    * 用 `resources/architecture-checklist.md` 对照检查最终产物。
    * 运行 `npm run dev` 启动开发服务器，验证线上效果。

## 排错
* **下载报错**：确保 bash 命令中的 URL 用引号包起来，避免 shell 解析错误。
* **校验报错**：查看 AST 报告，修复缺失的接口或硬编码样式等问题。