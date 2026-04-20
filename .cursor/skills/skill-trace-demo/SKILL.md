---
name: skill-trace-demo
description: 演示一个包含 6 个固定步骤并输出, 用户提到 「demo skill」 时使用。
---

# Skill Trace Demo

## 用途

测试skill

## 固定步骤

始终按以下固定顺序执行这 6 个步骤：

1. `discover`
2. `analyze`
3. `plan`
4. `execute`
5. `verify`
6. `deliver`

## 工作流

1. `discover`
   读取用户请求，明确当前要解决的目标。
2. `analyze`
   识别输入、约束条件，以及需要变更的内容。
3. `plan`
   在编辑或执行之前，先简要说明实施路径。
4. `execute`
   执行实际操作。
5. `verify`
   进行当前任务所需的最小有效验证。
6. `deliver`
   向用户总结结果。


## discover
[SKILL_TRACE] skill=skill-trace-demo step=discover status=start
读取用户请求：请帮我把首页欢迎语改成“欢迎使用 Trace Demo”。
[SKILL_TRACE] skill=skill-trace-demo step=discover status=done

## analyze
[SKILL_TRACE] skill=skill-trace-demo step=analyze status=start
识别到这是一个 mock 示例任务，目标是演示 trace 链路，不要求真实改动线上系统。
[SKILL_TRACE] skill=skill-trace-demo step=analyze status=done

## plan
[SKILL_TRACE] skill=skill-trace-demo step=plan status=start
计划：先说明会修改文案，再模拟编辑首页文件，最后检查结果是否符合预期。
[SKILL_TRACE] skill=skill-trace-demo step=plan status=done

## execute
[SKILL_TRACE] skill=skill-trace-demo step=execute status=start
执行 mock 操作：将 `src/pages/home.tsx` 中的欢迎语替换为“欢迎使用 Trace Demo”。
[SKILL_TRACE] skill=skill-trace-demo step=execute status=done

## verify
[SKILL_TRACE] skill=skill-trace-demo step=verify status=start
验证 mock 结果：确认仅改动欢迎语文案，未影响按钮、标题层级与页面结构。
[SKILL_TRACE] skill=skill-trace-demo step=verify status=done

## deliver
[SKILL_TRACE] skill=skill-trace-demo step=deliver status=start
向用户交付：欢迎语示例已更新，本次输出可用于验证 skill trace 与 hook 日志采集。
[SKILL_TRACE] skill=skill-trace-demo step=deliver status=done
