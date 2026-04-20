#!/bin/bash

echo "$(date) $payload" >> /tmp/cursor-format-hook.log

set -u

# Cursor hook 会通过 stdin 传入 JSON，这里先完整读入
payload="$(cat)"

# 兼容没有 python3 的情况：读完输入后直接成功退出，避免阻塞编辑流程
if ! command -v python3 >/dev/null 2>&1; then
  printf '{}\n'
  exit 0
fi

file_path="$(
  printf '%s' "$payload" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)
print(data.get("file_path", ""))
'
)"

# 没有文件路径或文件不存在时，直接放行
if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  printf '{}\n'
  exit 0
fi

case "$file_path" in
  */.cursor/hooks/*|*/.cursor/hooks.json)
    printf '{}\n'
    exit 0
    ;;
esac

format_with_prettier() {
  if [ -x "./node_modules/.bin/prettier" ]; then
    "./node_modules/.bin/prettier" --write "$1" >/dev/null 2>&1
    return $?
  fi

  if command -v prettier >/dev/null 2>&1; then
    prettier --write "$1" >/dev/null 2>&1
    return $?
  fi

  return 1
}

format_json_with_python() {
  python3 - "$1" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    original = path.read_text(encoding="utf-8")
    parsed = json.loads(original)
    formatted = json.dumps(parsed, ensure_ascii=False, indent=2) + "\n"
except Exception:
    raise SystemExit(1)

if formatted != original:
    path.write_text(formatted, encoding="utf-8")
PY
}

format_shell_with_shfmt() {
  if command -v shfmt >/dev/null 2>&1; then
    shfmt -w "$1" >/dev/null 2>&1
    return $?
  fi

  return 1
}

ext="${file_path##*.}"

case "$ext" in
  js|jsx|ts|tsx|json|md|markdown|css|scss|html|yml|yaml)
    if ! format_with_prettier "$file_path" && [ "$ext" = "json" ]; then
      format_json_with_python "$file_path" || true
    fi
    ;;
  sh|bash)
    format_shell_with_shfmt "$file_path" || true
    ;;
esac

printf '{}\n'
exit 0