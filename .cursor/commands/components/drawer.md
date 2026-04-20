# Drawer 组件封装与用法范式

你是 **提示词总结专家**。按以下范式封装业务抽屉、在页面中挂载与开关；技术栈以 React +（`@m-ui/react`）为准。

## 封装原则

1. **职责**：业务抽屉 = 一个文件夹 + `index.tsx` + `index.module.less`；内部再根据情况拆相关子组件。
2. **受控开关**：对外暂时只暴露 `visible` + `onClose`，由父组件持有状态；不要用抽屉内部去改全局路由代替“关”。
3. **数据入口**：`data` / 主键 id 等由父组件传入；抽屉内 `useEffect` 依赖 `visible` + 主键，打开时拉数、关闭时可选择 reset（看产品是否保留草稿）。
4. **自定义头区**：需要复杂标题/操作（关闭、反馈、更多）时设 `title={null}` + `closable={false}`，自绘头部组件，避免和默认标题栏打架
6. **多层抽屉**：嵌套时提高 `zIndex`（如 999 / 1000），避免遮罩互相遮挡；子抽屉仍由各自 `visible` 控制。
7. **加载态**：内容区用 `Spin` 或表格 `loading`，不要把整页 `Drawer` 卸载来当 loading。

## 页面侧用法步骤

1. `useState`：`drawerVisible`、`drawerData`（或 id）、可选 `loading`。
2. 打开：`setData` → `setVisible(true)` → 异步拉详情时 `setLoading(true/false)`。
3. 关闭：`onClose` 里 `setVisible(false)`，并清空/重置 `data`、`loading`（若需要下次打开是干净状态）。
4. JSX：在页面 JSX 底部（或布局内）渲染 `<XxxDrawer visible={...} onClose={...} ... />`，与触发按钮解耦。

## 常用 Drawer API（按需补全）

| 属性 | 说明 |
|------|------|
| `visible` / `open` | 是否显示（以库版本为准，老版多为 `visible`） |
| `onClose` | 关闭回调（点击遮罩、ESC、关闭按钮） |
| `placement` | `right` \| `left` \| `top` \| `bottom` |
| `width` / `height` | 抽屉尺寸 |
| `title` | 标题；复杂头可 `null` + 自定义 |
| `closable` | 是否显示默认关闭按钮 |
| `footer` | 底部区域（表单提交常用） |
| `zIndex` | 多层嵌套时调整层级 |
| `className` / `bodyStyle` | 样式与内容区滚动 |

## 简短示例

```tsx
// 业务抽屉：受控 + 可选数据
interface DetailDrawerProps {
  visible: boolean;
  onClose: () => void;
  recordId?: string;
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({ visible, onClose, recordId }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !recordId) return;
    setLoading(true);
    fetchDetail(recordId).finally(() => setLoading(false));
  }, [visible, recordId]);

  return (
    <Drawer
      title="详情"
      placement="right"
      width={720}
      visible={visible}
      onClose={onClose}
      destroyOnClose
    >
      <Spin spinning={loading}>{/* 内容 */}</Spin>
    </Drawer>
  );
};

// 页面
const [open, setOpen] = useState(false);
<DetailDrawer visible={open} onClose={() => setOpen(false)} recordId={id} />;
```

> **用法**：在 Agent 中引用本命令或 `@.cursor/commands/drawer-component-pattern.md`，按上述步骤实现或评审 Drawer 相关需求。
