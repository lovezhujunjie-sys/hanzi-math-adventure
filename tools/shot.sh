#!/bin/bash
# 无头 Chrome 截图：把 App 真跑起来看一眼（不是靠猜）
# 用法： bash tools/shot.sh tools/shots/home.js out/home.png [宽] [高]
# 说明：Chrome 的 --window-size 在 headless=new 下不生效，所以套一层固定宽度的
#       iframe 当"手机屏"，这样截出来才是真机宽度，不会被裁切。
set -e
cd "$(dirname "$0")/.."
DRIVER="$1"; OUT="$2"; W="${3:-400}"; H="${4:-860}"
mkdir -p "$(dirname "$OUT")"
ID="$$-$(date +%s)"
APP="/tmp/hm-app-$ID.html"
WRAP="/tmp/hm-wrap-$ID.html"
python3 - "$DRIVER" "$APP" "$WRAP" "$W" "$H" <<'PY'
import sys, io, os
drv, appp, wrapp, w, h = sys.argv[1:6]
# 驱动脚本前面统一挂上 _lib.js（kid / pickMod / pickMap 这些小工具）
lib = os.path.join(os.path.dirname(drv), '_lib.js')
drv = (io.open(lib, encoding='utf-8').read() if os.path.exists(lib) else '') + \
      io.open(drv, encoding='utf-8').read()
html = io.open('index.html', encoding='utf-8').read().replace(
    '</body>', '<script>\n' + drv + '\n</script>\n</body>')
io.open(appp, 'w', encoding='utf-8').write(html)
io.open(wrapp, 'w', encoding='utf-8').write(
    '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#ddd}'
    'iframe{width:%spx;height:%spx;border:0;display:block}</style>'
    '<iframe src="file://%s"></iframe>' % (w, h, appp))
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --allow-file-access-from-files \
  --window-size="$((W+20)),$((H+20))" --force-device-scale-factor=2 \
  --virtual-time-budget="${SHOT_BUDGET:-2500}" \
  --screenshot="$OUT" "file://$WRAP" 2>/dev/null
rm -f "$APP" "$WRAP"
echo "📸 $OUT"
