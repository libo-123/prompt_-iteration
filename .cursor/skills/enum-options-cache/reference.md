## reference.md

本文件是 `enum-options-cache-ahooks` 的细节补充，避免把 `SKILL.md` 写得过长。

### 1) useRequest 缓存参数（官方语义，建议原样遵循）

基于 `ahooks` 官方文档（`useRequest` 缓存 & SWR）：

- **cacheKey**：请求的唯一标识。设置后会缓存成功请求的数据；组件再次初始化时，如果有缓存数据会优先返回缓存，然后在背后发送新请求（SWR）。
- **staleTime（ms）**：数据保持“新鲜”的时间窗口。窗口内认为数据新鲜，不会重新发请求。`-1` 表示永远新鲜。
- **cacheTime（ms）**：缓存数据回收时间。超过该时间会清空这条缓存。默认 5 分钟；`-1` 表示永不过期。

> 注意（官方文档提示）：数据共享（Promise 共享/同步更新）在某些情况下会受 `cacheTime`、`staleTime` 影响（见官方示例的说明与 issue）。对“枚举接口去重请求”的目标通常无碍，因为你更希望在窗口期内**不再请求**。

### 2) cacheKey 命名规范（强烈建议）

跨项目复用 skill 时，`cacheKey` 最容易发生“撞 key”，建议统一前缀：

- 推荐：`enum:<project>:<biz>:<name>`
- 示例：`enum:mall:offsiteHotRecommend:outerHotItemLabel`

如果不方便带项目名，至少保证 `<biz>:<name>` 唯一。

### 3) 参数化枚举（依赖入参）如何封装

当枚举依赖参数（如 `categoryId`、`scene`、`regionCode`）时，必须保证缓存按“参数维度”隔离：

```ts
export const useXxxOptions = (categoryId: string) => {
  const cacheKey = `enum:xxxOptions:${categoryId}`;

  const { data } = useRequest(
    async (): Promise<OptionType[]> => {
      const res = await queryXxx({ categoryId });
      return res?.data?.list ?? [];
    },
    {
      cacheKey,
      refreshDeps: [categoryId],
      staleTime: 5 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
    },
  );

  return data ?? [];
};
```

**规则**

- `cacheKey` 必须包含所有影响结果的参数
- 只要参数变化，必须触发刷新：优先用 `refreshDeps`

### 4) “增强返回值”版本（需要 loading / refresh / error）

如果调用方需要加载态、手动刷新或错误信息，Hook 可以返回对象，但要保持对外 API 稳定：

```ts
export const useXxxOptions = () => {
  const { data, error, loading, refresh } = useRequest(
    async (): Promise<OptionType[]> => {
      const res = await queryXxx();
      return res?.data?.list ?? [];
    },
    {
      cacheKey: 'enum:xxxOptions',
      staleTime: 5 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
    },
  );

  return {
    options: data ?? [],
    loading,
    error,
    refresh,
  };
};
```

### 5) 强制刷新 / 清缓存

当你需要在某个操作后强制让枚举重新拉取（比如后台修改配置后）：

```ts
import { clearCache } from 'ahooks';

clearCache('enum:xxxOptions');
```

策略建议：

- 清缓存之后，下一次挂载或下一次 `refresh()` 就会重新请求
- 若你想在当前页面立刻请求：让 Hook 暴露 `refresh()` 并在清缓存后调用

### 6) 替换策略（常见旧代码形态 → 新 Hook）

#### 形态 A：页面内 useEffect + useState

- 删除 `useEffect` 请求
- 删除 `options` state
- 改为 `const options = useXxxOptions();`

#### 形态 B：页面内 useRequest 直接请求枚举

- 删除页面内 `useRequest` 逻辑
- 统一由 Hook 管控缓存

#### 形态 C：多个组件各自请求同一个枚举

- 统一替换为新 Hook
- 确保所有调用点使用**同一个** Hook（同一个 `cacheKey`）

### 7) 没有统一 hooks 目录怎么办？

目标不是强制某个路径，而是“**能被全项目稳定 import**、且避免散落复制”：

- 如果已有公共目录（`shared/common/utils` 一类），优先放在其中的 `hooks` 子目录
- 如果没有公共目录，创建一个最小公共目录（例如 `src/hooks/`），并补一个导出入口（例如 `src/hooks/index.ts`）：
  - 只需要导出这次新增的 `useXxxOptions`
  - 不要把其它无关 hooks 一起搬迁（保持变更最小）

