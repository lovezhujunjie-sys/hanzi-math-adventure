#!/bin/bash
# 真浏览器里的硬核验：把驱动脚本塞进 App 跑起来，把结果写成 DOM，再 dump 出来。
# 用法： bash tools/browser_test.sh tools/shots/t-hanzi-qz.js
# 🔴 为什么非得进浏览器：出题器在 IIFE 里，只有真加载了整页才能跑；
#    而且这里查的「选项有没有重复」是渲染前的那份数据，跟孩子看到的完全一致。
set -e
cd "$(dirname "$0")/.."
DRIVER="$1"
ID="$$-$(date +%s)"
APP="/tmp/hm-bt-$ID.html"
python3 - "$DRIVER" "$APP" <<'PY'
import sys, io
drv, appp = sys.argv[1:3]
drv = io.open(drv, encoding='utf-8').read()
html = io.open('index.html', encoding='utf-8').read().replace(
    '</body>', '<script>\n' + drv + '\n</script>\n</body>')
io.open(appp, 'w', encoding='utf-8').write(html)
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
  --window-size=430,932 --virtual-time-budget=8000 \
  --dump-dom "file://$APP" 2>/dev/null |
  python3 -c "
import sys,re
h=sys.stdin.read()
m=re.search(r'<pre id=\"TESTOUT\">(.*?)</pre>', h, re.S)
print(m.group(1) if m else '🔴 没拿到测试输出（驱动脚本没跑完或没写 #TESTOUT）')
"
rm -f "$APP"
