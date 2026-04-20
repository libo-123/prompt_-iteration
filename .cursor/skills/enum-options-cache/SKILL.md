---
name: enum-options-cache-ahooks
description: 通过提取一个可复用的缓存 Hook（基于 ahooks 的 useRequest，使用 cacheKey + staleTime/cacheTime）来优化枚举/下拉选项接口；随后在页面/组件中替换重复的获取逻辑，并执行验证（lint/test/build）。当用户提到“枚举接口/下拉枚举/Options/字典接口/避免重复请求/useRequest 缓存/cacheKey/staleTime/cacheTime”时使用.
---

# Enum Options Cache with ahooks

将“枚举/下拉/字典”接口的重复请求收敛为**单一 Hook**，并使用 `ahooks/useRequest` 的缓存与 SWR 能力在多个页面/组件间复用结果，降低网络请求与首屏抖动。

> 默认范式：`useXxxOptions()` 内部 `useRequest(async () => api(), { cacheKey, staleTime, cacheTime })`，对外返回 `data ?? []`。

## 范围约束（重要）

本 skill **只优化用户明确点名的枚举接口**：

- 只为该接口新增/更新 1 个 Hook（或 1 组参数化 Hook）
- 只替换“项目里调用该接口”的用法
- **不主动扩展**到其它枚举接口（除非用户明确要求）

## 适用场景

- 多个页面/组件都会调用同一个“枚举/下拉”接口，导致重复请求
- 枚举变化频率低，允许“短时间不重新拉取”
- 期望跨路由切换时仍能快速展示已拿到的枚举

## 目标输出

- 为**该枚举接口**在合适位置新增/更新一个 `useXxxOptions`（带缓存）
- 替换项目中**所有调用该接口**的旧用法（`useEffect`/`useRequest`/手写请求）为新 Hook
- 通过仓库现有脚本完成最小回归（`lint`/`test`/`build` 其一或多项）

## 工作流（必须按顺序执行）

### 0) 输入要求（用户需要提供的信息）

用户至少要给出：

- 枚举接口函数名（例如 `queryXxx` / `fetchXxx`）
- 返回映射规则：从接口响应中如何得到最终 `options`（例如 `res?.data?.list ?? []`）

可选但建议提供：

- 期望的 Hook 名称（例如 `useXxxOptions`）
- 期望的 options 类型（例如 `ISelectOption[]` / `string[]`）
- 是否依赖入参（如 `categoryId`），以及哪些参数会影响结果

### 1) 盘点现状（找“谁在请求这个枚举”）

- 找到目标枚举 API：
  - 入口通常是 `queryXxx` / `fetchXxx` / `getXxxOptions` 等函数
  - 明确返回结构：从响应里**映射出**最终组件需要的数据（通常为 `ISelectOption[]` / `string[]` 或其他）
- 全局搜索以下模式并记录命中点：
  - 直接调用目标 API 的地方
  - `useRequest(() => queryXxx())` / `useEffect(() => queryXxx())`
  - 本地 state：`const [options, setOptions] = useState([])` + 手动请求

### 2) 生成“缓存枚举 Hook”（范式模板）

在项目公共 hooks 里新增一个 Hook（优先集中在已有的公共 hooks 目录；如果没有，则创建一个最小公共目录并确保可被 import）。

**落盘位置选择（按优先级）**

- 已存在公共 hooks 目录：放到该目录（例如 `src/hooks/`、`src/shared/hooks/`、`src/common/hooks/`）
- 已存在枚举/字典模块：放到 `src/*/hooks/` 或 `src/*/enums/` 附近，并导出给调用方
- 都没有：创建 `src/hooks/`（或项目约定的公共目录），并新增一个入口文件用于导出（如 `index.ts`）

**模板（推荐：最小返回值）**

```ts
export const useXxxOptions = () => {
  const { data } = useRequest(
    async (): Promise<OptionType[]> => {
      const res = await queryXxx();
      return /* 从 res 映射出 OptionType[] */ ?? [];
    },
    {
      cacheKey: 'xxxOptions',
      staleTime: 5 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
      onError: (error) => {
        console.error('获取 Xxx 下拉枚举失败:', error);
      },
    },
  );

  return data ?? [];
};
```

**关键约束**

- **cacheKey 必须稳定且全局唯一**：推荐 `enum:<biz>:<name>` 或 `<name>Options`，避免不同枚举撞 key
- **类型要明确**：禁止 `any`
- **返回值兜底**：`return data ?? []`，避免调用方判空
- `staleTime`/`cacheTime` 单位是毫秒（ms）

> 官方语义（精简）：设置 `cacheKey` 后会缓存成功数据；组件再次初始化优先返回缓存并在后台可触发重新请求（SWR）；`staleTime` 在窗口内认为数据新鲜不会重新发请求；`cacheTime` 到期会回收该条缓存。更详细见 `reference.md`。

### 3) 全项目替换旧用法

对每个命中点执行以下替换策略：

- **替换请求逻辑**：删除本地 `useRequest/useEffect` 请求代码，改用 `useXxxOptions()`
- **清理 state**：若仅用于保存 options 的 `useState` 可以直接删除
- **保持渲染一致**：如果旧逻辑依赖 `loading`，则：
  - 优先用 `options.length` 做降级渲染；或
  - 将 Hook 升级为返回对象（见 `reference.md` 的“增强返回值”）
- **清理无用 import**：移除旧 API 引入、移除无用 hooks 引入

### 4) 验证与回归（必须执行至少一项）

- 读取 `package.json` 脚本并执行最贴近仓库的验证：
  - `yarn lint` / `yarn test` / `yarn build`（优先 Yarn）
  - 若仓库无测试：至少跑一次 `build` 或 `lint`
- 手工验证（强烈建议，尤其是枚举影响表单/筛选时）：
  - 打开两个会用到该枚举的页面/组件
  - 观察 Network：路由切换后**不应重复**拉取同一枚举（在 `staleTime` 窗口内）

## 决策点（遇到就按分支处理）

- **枚举依赖参数**（比如类目、地区、用户类型）：
  - `cacheKey` 必须把参数编码进去（避免不同参数共用同一缓存）
  - 配合 `refreshDeps` 或显式 `run`，细节见 `reference.md`
- **需要强制刷新**（后台配置变更后立即生效）：
  - 在合适时机调用 `clearCache(cacheKey)`，或暴露 `refresh()` 给调用方（见 `reference.md`）

## 附：项目内范式参考

如果项目里已存在同类 Hook（例如 `useXxxOptions` 风格），建议沿用其注释风格与默认 TTL，保持一致性。

## Additional resources

- 缓存参数、参数化枚举、增强返回值、清缓存与注意事项：见 [reference.md](reference.md)
- 从真实代码提取的例子：见 [examples.md](examples.md)

