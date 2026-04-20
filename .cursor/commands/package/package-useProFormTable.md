# useProFormTable：Form 与 Table 联动范式

你是熟悉 **@es/pro-components** 的前端助手。实现「筛选表单 + 分页表格」一体数据流时，优先采用 `useProFormTable` 统一分页、排序与表单取值。

## 核心关系

| 产出 | 用途 |
|------|------|
| `proFormProps` | 传给筛选区（ProForm / Form），内含 `form` 实例 |
| `proTableProps` | 传给 ProTable（分页、dataSource、loading、`onChange` 等） |
| `runAsync` / `search` | 手动触发列表请求（常与「查询」「重置」配合） |

**数据请求函数**签名一般为：`(params: UseProFormTableSearchParams) => Promise<{ list; total }>`。`params` 含 `current`、`pageSize`，以及表格 `onChange` 带来的 `sorter` 等；**表单字段**需在函数内通过 `proFormProps.form?.getFieldsValue()` 与 `params` 合并成接口入参。

## 典型配置

- `manual: true`：首屏或依赖外部条件时再 `runAsync`，避免自动请求时机不对。
- `defaultPageSize`：与表格默认每页条数一致。
- `debounceWait`：减轻频繁触发（可选）。

## 交互约定

1. **查询**：`await runAsync({ current: 1, pageSize })`，页码回到第一页；`pageSize` 可取当前 `proTableProps.pagination?.pageSize`。
2. **重置**：`proFormProps.form?.resetFields()`，再调用 `proTableProps.onChange?.({ current: 1, pageSize })` 或等价方式刷新第一页。
3. **表格翻页/排序**：一般直接使用 `proTableProps`；若需受控排序 UI，可包一层 `onChange`，在转发 `proTableProps.onChange` 前更新本地排序状态。

## 简短示例

合并请求参数时，用 **先声明 `getRequestParams`（闭包内读 `proFormProps`）、再传入 `useProFormTable`**，保证只在请求真正执行时访问 `form`（与 hook 返回顺序一致，避免在参数函数里「同步」引用尚未赋值的变量）。

```tsx
import { useProFormTable } from '@es/pro-components';
import type { UseProFormTableSearchParams } from '@es/pro-components';

const Page = () => {
  const getRequestParams = (params: UseProFormTableSearchParams) => {
    const values = proFormProps.form?.getFieldsValue() ?? {};
    const { current, pageSize, sorter } = params;
    return {
      pageNum: current,
      pageSize,
      ...values,
      sortField: sorter?.order ? sorter?.columnKey : undefined,
      sortType:
        sorter?.order === 'ascend' ? 'asc' : sorter?.order === 'descend' ? 'desc' : undefined,
    };
  };

  const fetchList = async (params: UseProFormTableSearchParams) => {
    const res = await api.queryList(getRequestParams(params));
    return { list: res.list, total: res.total };
  };

  const { proTableProps, proFormProps, runAsync } = useProFormTable(fetchList, {
    defaultPageSize: 20,
    manual: true,
  });

  return (
    <>
      <FilterForm
        proFormProps={proFormProps}
        onSearch={() =>
          runAsync({ current: 1, pageSize: proTableProps.pagination?.pageSize ?? 20 })
        }
      />
      <ProTable {...proTableProps} />
    </>
  );
};
```