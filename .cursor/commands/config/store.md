# Store（Zustand）用法范式

## `AskQuestion` 模式（必须先做）

引用本 Command 落地 store 时，**先向用户确认场景**，再继续写代码或给方案：

| 选项 | 含义 | 后续侧重 |
|------|------|----------|
| **按业务拆分** | 多业务域、长期维护 | `modules/<domain>.ts` Slice、`AppStore` 交叉合并、按域扩状态 |
| **仅项目引入 store** | 先把 Zustand 接进工程，结构从简 | 最小 `create` + 单文件或单 Slice 即可，后续再拆模块 |

用户未明确时，用一两句话列出上表两项，请用户选一项后再执行。

---

基于 **Zustand** 的全局状态：新增状态管理机制，组件内用 **selector** 订阅，避免整包订阅导致无效重渲染。

## 目录与职责

| 文件 | 职责 |
|------|------|
| `store/index.ts` | `create` 根 store，交叉类型合并各 Slice，默认导出 `useStore` |
| `store/modules/<domain>.ts` | 该域的 `State` 接口 + `createXxxSlice`，导出 `StateCreator<...>` |

## 新增业务域 Slice

1. 定义接口：状态字段 + `setXxx` / `resetXxx` 等 action。
2. 实现 `createXxxSlice: StateCreator<XxxStore> = (set) => ({ ... })`，用 `set({ ... })` 更新。
3. 在根 `AppStore` 做交叉类型 `A & B & C`，并在 `create` 里展开：`...createASlice(...args), ...createBSlice(...args)`。

**注意**：Slice 之间方法名、状态字段名不要冲突。

## 组件中使用（推荐）

- 使用 **selector** 只取用到的字段或方法：`useStore((s) => s.foo)`。
- 需要多个字段时：可多次调用 selector，或使用 `useShallow`（`zustand/react/shallow`）包一层对象/数组，避免引用变化导致重渲染。

## 简短示例

```ts
// modules/user.ts
import type { StateCreator } from 'zustand';

export interface UserStore {
  token: string;
  setToken: (t: string) => void;
}

export const createUserSlice: StateCreator<UserStore> = (set) => ({
  token: '',
  setToken: (token) => set({ token }),
});
```

```ts
// index.ts
import { create } from 'zustand';
import type { UserStore } from './modules/user';
import { createUserSlice } from './modules/user';

export type AppStore = UserStore;

const useStore = create<AppStore>()((...args) => ({
  ...createUserSlice(...args),
}));

export default useStore;
```

```tsx
// 组件内
import useStore from '@/store';

const token = useStore((s) => s.token);
const setToken = useStore((s) => s.setToken);
```

## Zustand 常用 API（按需）

| API | 说明 |
|-----|------|
| `create<T>()(initializer)` | 创建 store；泛型为完整 state 类型 |
| `set(partial)` / `set(fn)` | 在 Slice 内更新状态 |
| `get()` | 在 action 内读当前 state（需跨字段计算时） |
| `useStore(selector)` | 订阅；selector 建议保持引用稳定或拆成多次订阅 |

---

**Agent 提示**：实现新页面跨组件共享的筛选条件、Tab 状态、表单实例引用等，优先放对应业务 Slice；仅组件内临时状态用 `useState` 即可。
