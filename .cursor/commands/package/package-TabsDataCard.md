# Kpro TabsDataCard（指标 Tab 卡片）开发范式

## 适用场景

在数据看板、经营总览等页面，用 **Tab + 多指标卡片** 展示一组可切换的指标；每张卡包含主数值、环比/同比（`timeCompare`）、可选右侧插槽与指标说明 Tooltip。

## 组件与类型

- **包名**：`@es/kpro-data-tabsdatacard-new`
- **默认导出**：可作为 `Component` 使用（命名按项目习惯即可）
- **Props 类型**：`TabDataCardProps`（从同包导入）

## 调用模式

1. **用业务数据组装** `TabDataCardProps`（通常通过 `useMemo` 依赖接口结果）。
2. **展开传入** 所有卡片配置，再用显式 props **覆盖** 布局类选项（如 `size`）。

```tsx
import Component from '@es/kpro-data-tabsdatacard-new';
import type { TabDataCardProps } from '@es/kpro-data-tabsdatacard-new';

const cardProps: TabDataCardProps = {
  /* 见下表 */
};

<Component {...cardProps} size="large" />;
```

- **`{...metricsData}`**：等价于传入完整的 `TabDataCardProps`（背景、卡片列表、Tooltip、反馈配置等）。
- **`size`**：卡片区域尺寸预设（如 `"large"` 用于 PC 宽屏、主指标区强调展示）；与展开对象中的业务字段分离，便于同一套数据在不同布局下复用。

## 核心字段含义（TabDataCardProps）

| 字段 | 作用 |
|------|------|
| `backgroundColor` | 卡片容器背景色 |
| `titleTooltipType` | 标题旁说明触发样式（如 `'underline'` 下划线提示） |
| `data` | **核心**：多张子卡片配置数组；每项含 `title`、`cardKey`（唯一键，与 `indicatorData` 对齐）、`value`（主指标）、`timeCompare`（对比周期指标，可含箭头、持平文案、左右插槽） |
| `value.value` / `unit` / `valueType` | 主值展示；`valueType` 使用 `@es/kpro-data-utils` 的 `ValueBizType`（如金额后缀、百分比等格式化） |
| `timeCompare` | 环比等：`value`、`valueCompareBasic`（用于涨跌基准）、`valueTrend` / `valueHoldRender`、`valueLeftSlot`、`valueRightSlot`（自定义 React 节点）、`isWithArrow` |
| `indicatorData` | **指标说明 Tooltip**：以 `cardKey` 为 key，配置分层文案（总述 + 子项列表，如指标释义、计算口径） |
| `indicatorConfig` | Tooltip 内反馈：原因列表、`onClickFeedback`、`trigger`、`onVisibleChange`、`callbackParams` 等 |
| `isShowBorder` | 是否显示卡片边框 |
| `multipleChoose` | 是否允许多选 Tab/卡片（按业务） |
| `lineCardNum` | 每行展示卡片数量（栅格） |
| `colorConfig` | 数值颜色映射（如 `normal`、`hold` 持平色） |

## 数据流建议

- 接口原始类型 → **映射函数** `formatXxxToTabDataCardProps(metric)` → 得到 `TabDataCardProps`，避免在 JSX 内堆叠大对象。
- 环比方向等枚举字段，先在映射层转为组件需要的 `valueTrend` / `valueCompareBasic` 等，保持 UI 组件声明式。

## 最短示例（结构示意）

```tsx
import type { ValueBizType } from '@es/kpro-data-utils';

const props: TabDataCardProps = {
  data: [
    {
      title: '示例指标',
      cardKey: 'demo',
      value: {
        value: 100,
        unit: '件',
        valueType: 'AMOUNT_SUFFIX' as ValueBizType,
      },
      timeCompare: {
        value: { value: 5, unit: '%', valueType: 'PERCENT' as ValueBizType },
        valueLeftSlot: '较上周期',
        isWithArrow: true,
      },
    },
  ],
  indicatorData: {
    demo: [{ title: '示例指标', type: 'total' }, { type: 'sub', itemList: [] }],
  },
  lineCardNum: 4,
};

<Component {...props} size="large" />;
```
