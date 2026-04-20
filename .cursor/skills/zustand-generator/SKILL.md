---
name: zustand-generator
description: 将页面状态提取为 Zustand 模块化 store。用户提到“把某个状态做成 store 变量”“抽离全局状态”“按模块合并 store”时使用；在同一业务模块内合并变量并提供读取与更新方法。
---

# Zustand Store 模块生成

## 目标

当用户说“把某个状态变为 store 变量”时，自动完成以下动作：

1. 在 `apps/kwaishop-seller-mall-management-pc/src/store` 下按业务模块维护 slice。
2. 同一模块的状态字段合并到同一个 slice，避免散落。
3. 为每个状态同时提供：
   - 读取方式：`useStore((s) => s.xxx)`
   - 更新方式：`setXxx(...)` / `resetXxx(...)`

4.这是测试房法规 测试    
wewe

   

## 默认目录规范

- 根 store：`src/store/index.ts`
- 模块 slice：`src/store/modules/<moduleName>.ts`

如果 `src/store/index.ts` 不存在，先创建；如果存在，增量合并，不要覆盖已有模块。

## 执行步骤

1. **识别模块**
   - 根据页面路径或业务名确定模块名（例如 `marketing-managed-v2` -> `marketingManaged`）。
2. **合并字段**
   - 若已有同模块 slice，则追加字段与 actions；
   - 若无同模块 slice，则新建 `create<Module>Slice`。
3. **定义类型**
   - 导出 `<Module>Store` 接口，包含状态和 actions。
   - 字段尽量使用精确类型（字面量联合优先于 `string`）。
4. **接入根 store**
   - 在 `src/store/index.ts` 里合并 `...create<Module>Slice(...args)`。
5. **替换页面状态**
   - 把组件中的 `useState` 替换为 `useStore` 读取；
   - 交互回调改为调用 store action。

## 输出要求

每次完成后，必须给出：

1. 新增/修改文件列表；
2. 该模块下新增的 store 变量；
3. 每个变量的读取与更新示例（最少各 1 条）。

## 代码模板

```ts
import type { StateCreator } from 'zustand';

export interface DemoStore {
  period: '7d' | '30d' | 'more';
  setPeriod: (period: DemoStore['period']) => void;
  resetPeriod: () => void;
}

const DEFAULT_PERIOD: DemoStore['period'] = '7d';

export const createDemoSlice: StateCreator<DemoStore> = (set) => ({
  period: DEFAULT_PERIOD,
  setPeriod: (period) => set({ period }),
  resetPeriod: () => set({ period: DEFAULT_PERIOD }),
});
```
