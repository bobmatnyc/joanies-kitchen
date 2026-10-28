#!/usr/bin/env bash
# #72: run tsc or biome, then hand its output and exit code to ratchet.mjs.
# Usage: .github/scripts/ci-ratchet.sh check|generate tsc|biome
#   generate writes .github/<tool>-baseline.txt (regenerate with `pnpm ci:baseline`).
set -u
mode=$1
tool=$2
dir=$(cd "$(dirname "$0")" && pwd)
out=$(mktemp)
rc=0
case "$tool" in
  tsc) pnpm exec tsc --noEmit > "$out" 2>&1 || rc=$? ;;
  biome) pnpm exec biome check src --reporter=json > "$out" 2> "$out.err" || rc=$? ;;
  *) echo "unknown tool: $tool" >&2; exit 2 ;;
esac
echo "$tool exit: $rc"
baseline="$dir/../$tool-baseline.txt"
if [ "$mode" = generate ]; then
  node "$dir/ratchet.mjs" generate "$tool" "$out" "$rc" > "$baseline.tmp" || { cat "$baseline.tmp"; rm -f "$baseline.tmp"; exit 1; }
  mv "$baseline.tmp" "$baseline"
  echo "wrote $baseline"
else
  node "$dir/ratchet.mjs" check "$tool" "$out" "$rc" "$baseline" || { s=$?; tail -c 3000 "$out.err" 2>/dev/null; exit "$s"; }
fi
