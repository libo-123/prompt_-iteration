## examples.md

以下示例是**纯范式模板**（不依赖任何具体项目路径/目录结构），用于在任意项目里快速套用。

### 示例 1：接口直接返回 `ISelectOption[]`

```ts
import { useRequest } from 'ahooks';

import { queryXxxOptions, type ISelectOption } from '../api/queryXxxOptions';

export const useXxxOptions = () => {
  const { data } = useRequest(
    async (): Promise<ISelectOption[]> => {
      const res = await queryXxxOptions();
      return res?.data?.list ?? [];
    },
    {
      cacheKey: 'enum:biz:xxxOptions',
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

### 示例 2：接口返回 `string[]`

```ts
import { useRequest } from 'ahooks';

import { queryXxxBrandList } from '../api/queryXxxBrandList';

export const useXxxBrandOptions = () => {
  const { data } = useRequest(
    async (): Promise<string[]> => {
      const res = await queryXxxBrandList();
      return res?.data?.list ?? [];
    },
    {
      cacheKey: 'enum:biz:xxxBrandOptions',
      staleTime: 5 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
      onError: (error) => {
        console.error('获取品牌下拉枚举失败:', error);
      },
    },
  );

  return data ?? [];
};
```

### 示例 3：对比（不推荐）：useEffect 手写请求（无缓存）

当你看到这种模式，并且它实际上是“枚举/字典”时，就是 skill 的主要替换目标：

```ts
const [options, setOptions] = useState<OptionType[]>([]);

useEffect(() => {
  (async () => {
    const res = await queryXxxOptions();
    setOptions(res?.data?.list ?? []);
  })();
}, []);
```

