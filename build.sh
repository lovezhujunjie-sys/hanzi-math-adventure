#!/bin/bash
# 把 src/ 里的零件拼成单文件 index.html
# 用法：bash build.sh    （改完 src/ 里任何文件都要跑一次）
set -e
cd "$(dirname "$0")"
OUT=index.html
# 顺序有讲究：HTML 骨架 → 数据 → 逻辑
{
  cat src/01_head.html
  cat src/02_body.html
  echo '<script>'
  cat src/03_data_hanzi.js src/03b_data_g2.js src/04_data_math.js src/05_app.js
  echo '</script>'
  cat src/06_foot.html
} > "$OUT"
echo "✅ 构建完成：$OUT （$(wc -c < "$OUT" | tr -d ' ') 字节）"

# ── 离线缓存闸门 ───────────────────────────────────────────────
# 🔴 离线缓存是 stale-while-revalidate：改完 index.html 不顶 sw.js 里的 VERSION，
#    缓存就永远不清，孩子一直看到旧版，还会以为「改的东西没生效」。
#    这个闸门把「忘了顶版本号」变成构建时就能看见的一句话，而不是靠我记性。
test -f sw.js || { echo "❌ 缺 sw.js —— 离线缓存会失效"; exit 1; }
VER=$(sed -n "s/^const VERSION = '\([^']*\)'.*/\1/p" sw.js)
test -n "$VER" || { echo "❌ sw.js 里找不到 VERSION"; exit 1; }
HASH=$(shasum -a 256 "$OUT" | cut -c1-16)
STAMP=.sw-version
if [ -f "$STAMP" ] && [ "$(cut -d' ' -f1 "$STAMP")" = "$VER" ] && [ "$(cut -d' ' -f2 "$STAMP")" != "$HASH" ]; then
  echo "⚠️  改了 App 但没顶 sw.js 的 VERSION（当前 ${VER}）——不顶的话缓存永远不清。"
else
  printf '%s %s\n' "$VER" "$HASH" > "$STAMP"
fi
