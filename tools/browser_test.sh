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
import sys, io, os
drv, appp = sys.argv[1:3]
# 跟 shot.sh 一样先挂上 _lib.js（kid / pickMod / pickMap）——
# 不挂的话驱动里一写 kid('da') 就 ReferenceError，整段脚本静默不跑（踩过）。
lib = os.path.join(os.path.dirname(drv), '_lib.js')
drv = (io.open(lib, encoding='utf-8').read() if os.path.exists(lib) else '') + \
      io.open(drv, encoding='utf-8').read()
html = io.open('index.html', encoding='utf-8').read().replace(
    '</body>', '<script>\n' + drv + '\n</script>\n</body>')
io.open(appp, 'w', encoding='utf-8').write(html)
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
  --window-size=430,932 --virtual-time-budget="${BT_BUDGET:-8000}" \
  --dump-dom "file://$APP" 2>/dev/null |
  python3 -c "
import sys,re
h=sys.stdin.read()
m=re.search(r'<pre id=\"TESTOUT\">(.*?)</pre>', h, re.S)
print(m.group(1) if m else '🔴 没拿到测试输出（驱动脚本没跑完或没写 #TESTOUT）')
# 判据只能是**最后那行判定**（脚本自己下的结论）：
#   ① 按 '✅' 判 → 失败时输出里也有一堆 '  ✅ ' 子项，永远 exit 0（踩过）；
#   ② 按 '🔴' 判 → 题目里拿 🔴 当计数物品（🔴🔴🔴🔴），随机抽到红圈题就假报失败（也踩过）。
import sys; out = (m.group(1) if m else '').strip()
last = out.splitlines()[-1].strip() if out else ''
sys.exit(0 if (m and last.startswith('✅')) else 1)
"
rm -f "$APP"
