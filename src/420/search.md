
# 关于产出 jsonl 的质量分析
1、工具观测完整，技能观测不完整。
 历史记录里 tool_event 远多于 skill_trace。我统计到历史主样本里大约是 140 条工具事件，对比只有 12 条技能步骤事件。说明现在更像是在记录“调用了什么工具”，而不是完整记录“技能是怎么执行的”。

2、skill 字段覆盖率不高，很多行为无法归因到技能。
 大量记录的 skill=null、skill_source=null。也就是说，很多操作被记下来了，但不知道是不是某个 skill 触发的。如果你想做“技能效果评估”，这份日志目前还不够。

3、session_id 不是 skill run id，更像会话 id。
 同一个 session_id 里可以同时出现多个 skill。最明显的是 93f27267-... 这个 session 里，既有 skill-trace-demo，也有 fe-architect。这说明不能拿 session_id 直接当“一次技能执行”。

4、skill_trace 目前更像手工/演示标记，不像真实步骤耗时。
 skill-trace-demo 的 discover/analyze/plan/execute/verify/deliver 全部 start/done 都挤在同一秒里，没有持续时长字段。
 这意味着它适合证明“步骤被打点了”，但不适合做真实耗时分析、瓶颈分析。

5、失败率不高，但失败高度集中在 Read。
 我看到 6 条失败，里面 5 条是 Read，1 条是 WebFetch。
 这说明系统整体不是大面积不稳定，而是文件读取类操作更脆弱，很可能和路径不存在、文件瞬时变化、上下文失效有关。

6、性能瓶颈主要在外部网络类工具，不在本地工具。
 平均耗时大致是：
Read 约 7.7ms
Write 约 35ms
Grep 约 208ms
Shell 约 975ms
WebFetch 约 4.8s
WebSearch 约 9.0s
结论就是：慢的不是本地读写，而是联网检索/抓取。