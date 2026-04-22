#!/usr/bin/env python3
import argparse
import html
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean


PALETTE = {
    "primary": "#4f46e5",
    "secondary": "#06b6d4",
    "accent": "#f59e0b",
    "success": "#10b981",
    "danger": "#ef4444",
    "muted": "#94a3b8",
    "bg": "#0f172a",
    "panel": "#111827",
    "panel_alt": "#1f2937",
    "grid": "#334155",
    "text": "#e5e7eb",
    "subtext": "#94a3b8",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a visual dashboard from skill-trace JSONL logs.")
    parser.add_argument(
        "--input",
        default=".cursor/logs/skill-trace.jsonl",
        help="Path to the input JSONL file.",
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/skill-trace",
        help="Directory used for generated dashboard files.",
    )
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict]:
    # The log is mostly JSONL, but occasionally two JSON objects are appended
    # back-to-back on one physical line. `raw_decode` lets us recover both.
    text = path.read_text(encoding="utf-8", errors="replace")
    decoder = json.JSONDecoder()
    records = []
    index = 0

    while index < len(text):
        while index < len(text) and text[index].isspace():
            index += 1
        if index >= len(text):
            break
        record, next_index = decoder.raw_decode(text, index)
        records.append(record)
        index = next_index

    return records


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S:%f")


def fmt_duration_ms(value: float | int | None) -> str:
    if value is None:
        return "-"
    value = float(value)
    if value >= 1000:
        return f"{value / 1000:.2f}s"
    return f"{value:.0f}ms"


def fmt_count(value: int) -> str:
    return f"{value:,}"


def svg_horizontal_bar_chart(
    items: list[tuple[str, float]],
    *,
    width: int = 680,
    row_height: int = 34,
    bar_color: str = PALETTE["primary"],
    title: str = "",
    value_formatter=fmt_count,
) -> str:
    if not items:
        return "<p class='empty'>暂无数据</p>"

    label_width = 150
    chart_width = width - label_width - 90
    max_value = max(value for _, value in items) or 1
    height = 54 + len(items) * row_height
    lines = [
        f"<svg viewBox='0 0 {width} {height}' class='chart' role='img' aria-label='{html.escape(title)}'>",
        f"<text x='0' y='20' fill='{PALETTE['text']}' font-size='16' font-weight='600'>{html.escape(title)}</text>",
    ]

    for idx, (label, value) in enumerate(items):
        y = 40 + idx * row_height
        bar_len = max(2, int((value / max_value) * chart_width))
        lines.append(
            f"<text x='0' y='{y + 15}' fill='{PALETTE['subtext']}' font-size='12'>{html.escape(str(label))}</text>"
        )
        lines.append(
            f"<rect x='{label_width}' y='{y}' width='{chart_width}' height='18' rx='6' fill='{PALETTE['panel_alt']}' />"
        )
        lines.append(
            f"<rect x='{label_width}' y='{y}' width='{bar_len}' height='18' rx='6' fill='{bar_color}' />"
        )
        lines.append(
            f"<text x='{label_width + chart_width + 10}' y='{y + 14}' fill='{PALETTE['text']}' font-size='12'>{html.escape(value_formatter(value))}</text>"
        )

    lines.append("</svg>")
    return "".join(lines)


def svg_stacked_status_chart(
    items: list[dict],
    *,
    width: int = 680,
    row_height: int = 34,
    title: str = "",
) -> str:
    if not items:
        return "<p class='empty'>暂无数据</p>"

    label_width = 150
    chart_width = width - label_width - 90
    max_total = max(item["success"] + item["failed"] for item in items) or 1
    height = 70 + len(items) * row_height
    legend_y = 38
    lines = [
        f"<svg viewBox='0 0 {width} {height}' class='chart' role='img' aria-label='{html.escape(title)}'>",
        f"<text x='0' y='20' fill='{PALETTE['text']}' font-size='16' font-weight='600'>{html.escape(title)}</text>",
        f"<rect x='0' y='{legend_y}' width='12' height='12' rx='3' fill='{PALETTE['success']}' /><text x='18' y='{legend_y + 10}' fill='{PALETTE['subtext']}' font-size='12'>成功</text>",
        f"<rect x='72' y='{legend_y}' width='12' height='12' rx='3' fill='{PALETTE['danger']}' /><text x='90' y='{legend_y + 10}' fill='{PALETTE['subtext']}' font-size='12'>失败</text>",
    ]

    for idx, item in enumerate(items):
        y = 56 + idx * row_height
        total = item["success"] + item["failed"]
        success_w = 0 if total == 0 else int((item["success"] / max_total) * chart_width)
        fail_w = 0 if total == 0 else int((item["failed"] / max_total) * chart_width)
        lines.append(
            f"<text x='0' y='{y + 15}' fill='{PALETTE['subtext']}' font-size='12'>{html.escape(item['label'])}</text>"
        )
        lines.append(
            f"<rect x='{label_width}' y='{y}' width='{chart_width}' height='18' rx='6' fill='{PALETTE['panel_alt']}' />"
        )
        if success_w:
            lines.append(
                f"<rect x='{label_width}' y='{y}' width='{success_w}' height='18' rx='6' fill='{PALETTE['success']}' />"
            )
        if fail_w:
            lines.append(
                f"<rect x='{label_width + success_w}' y='{y}' width='{fail_w}' height='18' rx='0' fill='{PALETTE['danger']}' />"
            )
        lines.append(
            f"<text x='{label_width + chart_width + 10}' y='{y + 14}' fill='{PALETTE['text']}' font-size='12'>{item['success']}/{total}</text>"
        )

    lines.append("</svg>")
    return "".join(lines)


def svg_grouped_timeline(
    timeline_rows: list[dict],
    series_order: list[str],
    *,
    width: int = 760,
    height: int = 280,
    title: str = "",
) -> str:
    if not timeline_rows:
        return "<p class='empty'>暂无数据</p>"

    left = 54
    right = 18
    top = 30
    bottom = 48
    inner_width = width - left - right
    inner_height = height - top - bottom
    max_value = max(max(row["counts"].values()) for row in timeline_rows) or 1
    bucket_width = inner_width / max(len(timeline_rows), 1)
    group_gap = 8
    usable_width = max(bucket_width - group_gap, 8)
    bar_width = usable_width / max(len(series_order), 1)
    colors = {
        "tool_event": PALETTE["primary"],
        "lifecycle_event": PALETTE["secondary"],
        "skill_trace": PALETTE["accent"],
    }

    lines = [
        f"<svg viewBox='0 0 {width} {height}' class='chart' role='img' aria-label='{html.escape(title)}'>",
        f"<text x='0' y='18' fill='{PALETTE['text']}' font-size='16' font-weight='600'>{html.escape(title)}</text>",
    ]

    for tick in range(5):
        value = int(max_value * tick / 4)
        y = top + inner_height - (inner_height * tick / 4)
        lines.append(
            f"<line x1='{left}' y1='{y:.1f}' x2='{width - right}' y2='{y:.1f}' stroke='{PALETTE['grid']}' stroke-width='1' />"
        )
        lines.append(
            f"<text x='{left - 8}' y='{y + 4:.1f}' text-anchor='end' fill='{PALETTE['subtext']}' font-size='11'>{value}</text>"
        )

    for idx, row in enumerate(timeline_rows):
        group_x = left + idx * bucket_width + group_gap / 2
        for series_idx, key in enumerate(series_order):
            value = row["counts"].get(key, 0)
            bar_h = 0 if value == 0 else (value / max_value) * inner_height
            x = group_x + series_idx * bar_width
            y = top + inner_height - bar_h
            lines.append(
                f"<rect x='{x:.1f}' y='{y:.1f}' width='{max(bar_width - 2, 2):.1f}' height='{max(bar_h, 0):.1f}' rx='3' fill='{colors.get(key, PALETTE['muted'])}' />"
            )
        label_x = group_x + usable_width / 2
        lines.append(
            f"<text x='{label_x:.1f}' y='{height - 14}' text-anchor='middle' fill='{PALETTE['subtext']}' font-size='10'>{html.escape(row['label'])}</text>"
        )

    legend_x = 0
    legend_y = height - 34
    for idx, key in enumerate(series_order):
        x = legend_x + idx * 120
        lines.append(
            f"<rect x='{x}' y='{legend_y}' width='12' height='12' rx='3' fill='{colors.get(key, PALETTE['muted'])}' />"
        )
        lines.append(
            f"<text x='{x + 18}' y='{legend_y + 10}' fill='{PALETTE['subtext']}' font-size='12'>{html.escape(key)}</text>"
        )

    lines.append("</svg>")
    return "".join(lines)


def build_summary(records: list[dict]) -> dict:
    record_type_counts = Counter(record.get("record_type", "unknown") for record in records)
    tool_after = [
        record
        for record in records
        if record.get("record_type") == "tool_event" and record.get("tool_stage") == "after"
    ]
    tool_counts = Counter(record.get("tool_name", "unknown") for record in tool_after)
    success_failure = defaultdict(lambda: {"success": 0, "failed": 0})
    durations = defaultdict(list)
    failures = []

    for record in tool_after:
        tool_name = record.get("tool_name", "unknown")
        success = record.get("success")
        duration_ms = record.get("duration_ms")
        if success is False:
            success_failure[tool_name]["failed"] += 1
            failures.append(
                {
                    "ts": record.get("ts"),
                    "tool_name": tool_name,
                    "failure_type": record.get("failure_type") or "unknown",
                    "error": record.get("error") or "",
                }
            )
        else:
            success_failure[tool_name]["success"] += 1
        if duration_ms is not None:
            durations[tool_name].append(float(duration_ms))

    model_counts = Counter(record.get("model", "unknown") for record in records)
    sessions = sorted({record.get("session_id") for record in records if record.get("session_id")})
    timestamps = [parse_ts(record.get("ts")) for record in records]
    timestamps = [ts for ts in timestamps if ts is not None]
    start = min(timestamps) if timestamps else None
    end = max(timestamps) if timestamps else None

    timeline = defaultdict(lambda: Counter())
    for record in records:
        ts = parse_ts(record.get("ts"))
        if ts is None:
            continue
        bucket = ts.replace(minute=0, second=0, microsecond=0)
        timeline[bucket][record.get("record_type", "unknown")] += 1

    timeline_rows = [
        {
            "label": bucket.strftime("%H:%M"),
            "counts": dict(timeline[bucket]),
        }
        for bucket in sorted(timeline)
    ]

    skill_trace_events = [
        {
            "ts": record.get("ts"),
            "skill": record.get("skill"),
            "step": record.get("step"),
            "status": record.get("status"),
        }
        for record in records
        if record.get("record_type") == "skill_trace"
    ]

    return {
        "input_records": len(records),
        "record_type_counts": dict(record_type_counts),
        "tool_counts": dict(tool_counts),
        "tool_success_failure": dict(success_failure),
        "avg_duration_by_tool_ms": {
            tool_name: round(mean(values), 3) for tool_name, values in durations.items()
        },
        "failures": failures,
        "model_counts": dict(model_counts),
        "session_count": len(sessions),
        "session_ids": sessions,
        "time_range": {
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
            "hours": round((end - start).total_seconds() / 3600, 2) if start and end else 0,
        },
        "actual_tool_calls": len(tool_after),
        "timeline": timeline_rows,
        "skill_trace_events": skill_trace_events,
    }


def render_failure_rows(failures: list[dict]) -> str:
    if not failures:
        return "<tr><td colspan='4'>无失败调用</td></tr>"

    rows = []
    for item in failures:
        rows.append(
            "<tr>"
            f"<td>{html.escape(item['ts'] or '-')}</td>"
            f"<td>{html.escape(item['tool_name'])}</td>"
            f"<td>{html.escape(item['failure_type'])}</td>"
            f"<td>{html.escape(item['error'])}</td>"
            "</tr>"
        )
    return "".join(rows)


def render_skill_trace_list(events: list[dict]) -> str:
    if not events:
        return "<p class='empty'>当前片段没有 skill_trace 事件。</p>"

    items = []
    for event in events:
        items.append(
            "<li>"
            f"<span>{html.escape(event['ts'] or '-')}</span>"
            f"<strong>{html.escape(event['skill'] or 'unknown')}</strong>"
            f"<span>{html.escape(event['step'] or '-')}</span>"
            f"<em>{html.escape(event['status'] or '-')}</em>"
            "</li>"
        )
    return f"<ul class='trace-list'>{''.join(items)}</ul>"


def render_dashboard(summary: dict, input_path: Path) -> str:
    record_type_items = sorted(
        summary["record_type_counts"].items(), key=lambda item: item[1], reverse=True
    )
    tool_count_items = sorted(summary["tool_counts"].items(), key=lambda item: item[1], reverse=True)
    duration_items = sorted(
        summary["avg_duration_by_tool_ms"].items(), key=lambda item: item[1], reverse=True
    )
    status_items = [
        {
            "label": tool_name,
            "success": summary["tool_success_failure"][tool_name]["success"],
            "failed": summary["tool_success_failure"][tool_name]["failed"],
        }
        for tool_name, _ in tool_count_items
    ]
    model_items = sorted(summary["model_counts"].items(), key=lambda item: item[1], reverse=True)

    time_range = summary["time_range"]
    time_label = "-"
    if time_range["start"] and time_range["end"]:
        time_label = f"{time_range['start'].replace('T', ' ')} -> {time_range['end'].replace('T', ' ')}"

    cards = [
        ("总事件数", fmt_count(summary["input_records"])),
        ("实际工具调用", fmt_count(summary["actual_tool_calls"])),
        ("会话数", fmt_count(summary["session_count"])),
        ("失败调用", fmt_count(len(summary["failures"]))),
        ("工具种类", fmt_count(len(summary["tool_counts"]))),
        ("覆盖时长", f"{time_range['hours']}h"),
    ]
    card_html = "".join(
        "<div class='card'>"
        f"<div class='label'>{html.escape(label)}</div>"
        f"<div class='value'>{html.escape(value)}</div>"
        "</div>"
        for label, value in cards
    )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Skill Trace Dashboard</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: {PALETTE['bg']};
      --panel: {PALETTE['panel']};
      --panel-alt: {PALETTE['panel_alt']};
      --text: {PALETTE['text']};
      --subtext: {PALETTE['subtext']};
      --border: {PALETTE['grid']};
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 24px;
      background: radial-gradient(circle at top, #1e293b 0%, var(--bg) 45%);
      color: var(--text);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    h1, h2, h3, p {{ margin: 0; }}
    .page {{
      max-width: 1480px;
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }}
    .hero, .panel {{
      background: rgba(17, 24, 39, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
    }}
    .hero {{
      padding: 22px 24px;
      display: grid;
      gap: 10px;
    }}
    .hero .meta {{
      color: var(--subtext);
      font-size: 13px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }}
    .card {{
      background: rgba(31, 41, 55, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 14px;
      padding: 16px;
      min-height: 92px;
    }}
    .card .label {{
      color: var(--subtext);
      font-size: 12px;
      margin-bottom: 8px;
    }}
    .card .value {{
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }}
    .panel {{
      padding: 18px;
      overflow: hidden;
    }}
    .panel.full {{
      grid-column: 1 / -1;
    }}
    .chart {{
      width: 100%;
      height: auto;
      display: block;
    }}
    .panel-title {{
      margin-bottom: 12px;
      color: var(--subtext);
    }}
    .empty {{
      color: var(--subtext);
      padding: 16px 0;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    th, td {{
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      vertical-align: top;
    }}
    th {{
      color: var(--subtext);
      font-weight: 600;
    }}
    .trace-list {{
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }}
    .trace-list li {{
      display: grid;
      grid-template-columns: 180px 180px 1fr 80px;
      gap: 12px;
      background: rgba(31, 41, 55, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 12px;
      padding: 10px 12px;
      align-items: center;
    }}
    .trace-list span, .trace-list em {{
      color: var(--subtext);
      font-style: normal;
    }}
    @media (max-width: 980px) {{
      .grid {{
        grid-template-columns: 1fr;
      }}
      .trace-list li {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>Skill Trace 可视化面板</h1>
      <p class="meta">输入文件: {html.escape(str(input_path))}</p>
      <p class="meta">时间范围: {html.escape(time_label)}</p>
      <div class="cards">{card_html}</div>
    </section>

    <section class="grid">
      <div class="panel">{svg_horizontal_bar_chart(record_type_items, title="事件类型分布", bar_color=PALETTE["secondary"])}</div>
      <div class="panel">{svg_horizontal_bar_chart(tool_count_items, title="实际工具调用次数", bar_color=PALETTE["primary"])}</div>
      <div class="panel">{svg_stacked_status_chart(status_items, title="工具调用成功 / 失败")}</div>
      <div class="panel">{svg_horizontal_bar_chart(duration_items, title="工具平均耗时", bar_color=PALETTE["accent"], value_formatter=fmt_duration_ms)}</div>
      <div class="panel">{svg_horizontal_bar_chart(model_items, title="模型事件分布", bar_color=PALETTE["success"])}</div>
      <div class="panel">{svg_grouped_timeline(summary["timeline"], ["tool_event", "lifecycle_event", "skill_trace"], title="按小时聚合的事件时间线")}</div>
      <div class="panel full">
        <h2 class="panel-title">失败明细</h2>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>工具</th>
              <th>失败类型</th>
              <th>错误信息</th>
            </tr>
          </thead>
          <tbody>
            {render_failure_rows(summary["failures"])}
          </tbody>
        </table>
      </div>
      <div class="panel full">
        <h2 class="panel-title">Skill Trace 顺序</h2>
        {render_skill_trace_list(summary["skill_trace_events"])}
      </div>
    </section>
  </main>
</body>
</html>
"""


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    records = read_jsonl(input_path)
    summary = build_summary(records)

    summary_path = output_dir / "skill-trace-summary.json"
    html_path = output_dir / "skill-trace-dashboard.html"

    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    html_path.write_text(render_dashboard(summary, input_path), encoding="utf-8")

    print(f"Generated: {html_path}")
    print(f"Generated: {summary_path}")


if __name__ == "__main__":
    main()
