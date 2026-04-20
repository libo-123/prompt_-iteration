# Kpro DateFilter（周期筛选）开发范式

## 适用场景

数据看板、经营总览等页面需要在工具栏展示 **快捷周期（近 7/30 天等）**，并 **展示当前选中区间与对比区间**；筛选结果需与 **业务枚举周期**、**接口入参**、**数据截止日（T-1 等）** 对齐。

## 组件与类型

- **包名**：`@es/kpro-data-date-filter-new`
- **组件**：`DateFilter`
- **回调参数类型**：`TimeParam`（`onChange` 中可取 `timeRange` 等，与 `DateTypeMapProp` 对应）

## 核心范式

1. **双映射表**：业务侧周期枚举 ↔ 组件 `DateTypeMapProp`  
   - **正向**：当前状态 → `defaultType`  
   - **反向**：`TimeParam.timeRange` → 更新业务状态 / 请求参数  
2. **可选周期列表**：`radioTypeList` 用 `DateTypeMapProp` 数组，限制快捷项（如仅 7 天 / 30 天）。  
3. **展示**：`showSelectedDate`、`showComparedDate` 打开日期与对比说明；`showQuickOptions` 控制快捷周期。  
4. **offset**：用「数据最新可统计日」相对「今天」的天数差（如 `getDiffDaysToToday(latestPdate)`），让组件与离线/延迟数据对齐。  
5. **渲染条件**：无有效截止日时不挂载 `DateFilter`，避免日期错乱。  
6. **稳定 key**（可选）：在 `defaultType` 随外部状态同步变化时，用固定 `key` 避免内部状态与 props 不同步问题。

## 简短示例（抽象）

```tsx
import { DateFilter, type TimeParam, DateTypeMapProp } from '@es/kpro-data-date-filter-new';

// 业务周期 ↔ 组件类型（项目内 constants 维护）
const PERIOD_TO_FILTER: Record<YourPeriod, DateTypeMapProp> = { /* ... */ };
const FILTER_TO_PERIOD: Partial<Record<DateTypeMapProp, YourPeriod>> = { /* ... */ };
const RADIO_LIST = [DateTypeMapProp.SEVEN_DAY, DateTypeMapProp.THIRTY_DAY];

const handleDateChange = (param: TimeParam) => {
  const next = FILTER_TO_PERIOD[param.timeRange] ?? DEFAULT_PERIOD;
  setPeriod(next); // 并触发列表/图表请求
};

const offsetDays = useMemo(() => getDiffDaysToToday(latestAvailableDate), [latestAvailableDate]);

return latestAvailableDate ? (
  <DateFilter
    key="feature-overview-date-filter"
    defaultType={PERIOD_TO_FILTER[period]}
    radioTypeList={RADIO_LIST}
    showSelectedDate
    showComparedDate
    showQuickOptions
    onChange={handleDateChange}
    offset={offsetDays}
  />
) : null;
```

## 与数据请求的配合

- 周期状态变更后，用 `refreshDeps: [period]`（或等价）刷新依赖该周期的请求。  
- 接口若需要「截止日」字段，与 `latestAvailableDate` / `offset` 使用同一数据源，保证筛选与口径一致。
