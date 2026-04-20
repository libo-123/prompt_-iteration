
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



# 修复建议
1、补齐 hook 事件
至少新增：
sessionStart
sessionEnd
stop
subagentStart
subagentStop
afterShellExecution
afterMCPExecution
afterFileEdit
preCompact

sessionStart/sessionEnd：会话级边界
stop：最终完成态、错误态、是否中断
subagentStart/subagentStop：子代理是否拖慢、是否有收益
afterShellExecution：拿到完整 shell 输出，比通用 postToolUse 更适合分析 shell 结果
afterMCPExecution：MCP 是现在 skill 很重要的一类能力，必须单独看
afterFileEdit：知道 skill 实际改了什么
preCompact：知道是不是上下文压缩影响了 skill

实现对应功能

2. 采用“双层日志”
不是只写一份扁平 jsonl，而是：

events.jsonl：原始事件流
runs.jsonl：每次 skill_run 的摘要
runs.jsonl 每次结束时生成一条汇总，比如：

skill_run_id
skill
conversation_id
start_ts
end_ts
duration_ms
status
step_count
tool_count
tool_breakdown
error_count
subagent_count
shell_count
mcp_count
file_edit_count
modified_files
compaction_count
final_stop_status

3. 给 skill trace 增加标准字段
你现在只有：

skill
step
status
建议以后 [SKILL_TRACE] 至少带：

skill
run_id 或可推导 run key
step
status
phase_index
summary
reason
expected_output
这样不仅能看“做了没”，还能看“为什么做”。


`sessionStart` / `sessionEnd` - 会话生命周期管理

