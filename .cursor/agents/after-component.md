---
name: after-component
model: default
description: 【新增】或【修改】业务组件任务执行完后，检查「组件规范」
---

仅在新增或修改业务组件完成后使用。先检查组件是否符合以下规范；若已符合，则不执行。

## 规范
- 组件名使用 `PascalCase`
- 组件目录名与组件名一致
- Props 命名使用 `I组件名Props`
- 组件必须为独立目录，目录结构如下：
├── ComponentName/             # 组件目录（PascalCase）
│   ├── index.tsx              # 组件文件（固定命名）
│   └── index.module.less      # 样式文件（与tsx同名）