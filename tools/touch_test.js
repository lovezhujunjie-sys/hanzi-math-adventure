/* 真触摸模拟下的写一写验收（老曾 2026-09-20 报的「手机上竖着写不出来」）。

   为什么不能只用 tools/browser_test.sh：
     那套是 Chrome + --dump-dom，**没有触摸**，驱动里派发的都是 pointerType:'mouse'，
     走的不是真机上那根手指的那条路 —— 上个版本就是这么在"全绿"里漏掉这个 bug 的。
   这里用 Playwright + CDP 的 Input.dispatchTouchEvent 派发**真触摸**，
   并且在两种视口下各跑一遍（正常手机 / 矮手机），验四件事：
     ① 进写一写 = 整页锁死（html.lock-scroll），拖动过程中页面位移 = 0；
     ② 竖向触摸真能画出笔迹；
     ③ 画布是正方形（以前被边框吃掉 3.5px，竖着略扁）；
     ④ 锁死之后按钮仍在屏幕里（一屏装得下，田字格会自动收小）。

   跑法（要 playwright-core）：
     mkdir -p /tmp/pwtest && cd /tmp/pwtest && npm i playwright-core     # 只需要一次
     cd ~/.agents/skills/汉字数学大冒险
     NODE_PATH=/tmp/pwtest/node_modules node tools/touch_test.js
*/
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');

const CHROME = path.join(os.homedir(),
  'Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  🔴 ' + name + (extra ? '  → ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  for (const vp of [
    { w: 390, h: 844, tag: '正常手机 390×844' },
    { w: 390, h: 560, tag: '矮手机 390×560（地址栏吃掉高度）' },
    { w: 390, h: 460, tag: '极矮屏 390×460（田字格必须自己收小）' },
  ]) {
    console.log('\n== ' + vp.tag + ' ==');
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(400);

    await page.evaluate(() => document.querySelector('.kid-card.er').click());
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => {
      const ms = document.querySelectorAll('#home-mods .mod');
      // 🔴 二宝首页那一块叫「描一描」，大宝那边才叫「写一写」——按名字找要两个都认
      for (const m of ms) { const t = m.querySelector('.tt'); if (t && /写一写|描一描/.test(t.textContent)) { m.click(); return true; } }
      return false;
    });
    await page.waitForTimeout(400);
    const onTrace = await page.evaluate(() => (document.querySelector('.screen.on') || {}).id === 'screen-trace');
    ok('能进到写一写屏', opened && onTrace);
    /* 没进去就别说后面的话——在隐藏屏幕上量出来的尺寸全是 0，
       那种断言会「通过」（0-0≤1.5、0 在屏幕内），是标准的假绿。 */
    if (!opened || !onTrace) {
      ok('没进屏就中止这一档，不做假绿断言', false, '停在 ' + await page.evaluate(() => (document.querySelector('.screen.on') || {}).id));
      await ctx.close();
      continue;
    }

    const geom = await page.evaluate(() => {
      const cv = document.getElementById('trace-canvas'), r = cv.getBoundingClientRect();
      const next = document.getElementById('trace-next').getBoundingClientRect();
      const wrap = document.getElementById('trace-wrap');
      /* 🔴 不能拿 documentElement.scrollHeight 判「装得下」：
         锁屏后 html{overflow:hidden;height:100%} 会把它夹到视口高度，
         再高的内容也只报「刚好等于视口」→ 假通过。量最后一个元素的下沿才算数。 */
      let lastBottom = 0;
      const kids = document.getElementById('screen-trace').children;
      for (const el of kids) { const b = el.getBoundingClientRect(); if (b.height > 0 && b.bottom > lastBottom) lastBottom = b.bottom; }
      return {
        cvW: r.width, cvH: r.height, left: r.left, top: r.top,
        locked: document.documentElement.classList.contains('lock-scroll'),
        scrollH: document.documentElement.scrollHeight, winH: window.innerHeight,
        nextTop: next.top, nextBottom: next.bottom, wrapW: wrap.clientWidth, lastBottom: lastBottom,
      };
    });
    ok('html 挂上了滚动锁 lock-scroll', geom.locked);
    ok('画布是正方形（宽 ' + geom.cvW.toFixed(1) + ' × 高 ' + geom.cvH.toFixed(1) + '）',
      Math.abs(geom.cvW - geom.cvH) <= 1.5, '差 ' + (geom.cvW - geom.cvH).toFixed(1));
    ok('一屏装得下：整屏内容下沿 ' + Math.round(geom.lastBottom) + ' ≤ 视口 ' + geom.winH, geom.lastBottom <= geom.winH + 1);
    ok('「换一个字」按钮留在屏幕里（锁了也点得到）：' + Math.round(geom.nextTop) + '~' + Math.round(geom.nextBottom),
      geom.nextTop >= 0 && geom.nextBottom <= geom.winH + 1);

    // 真触摸：竖着画一笔
    const client = await ctx.newCDPSession(page);
    const cx = geom.left + geom.cvW / 2, y0 = geom.top + geom.cvH * 0.12, y1 = geom.top + geom.cvH * 0.9;
    const ink0 = await page.evaluate(() => {
      const cv = document.getElementById('trace-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n;
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: y0, id: 1 }] });
    let maxScroll = 0;
    for (let i = 1; i <= 14; i++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: y0 + (y1 - y0) * i / 14, id: 1 }] });
      await page.waitForTimeout(16);
      maxScroll = Math.max(maxScroll, await page.evaluate(() => Math.abs(window.scrollY)));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const cv = document.getElementById('trace-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
      return { ink: n, scrolled: Math.abs(window.scrollY),
        stamped: !document.getElementById('trace-stamp').classList.contains('hide') };
    });
    ok('真手指竖着划 → 画布上出现笔迹（像素 ' + ink0 + ' → ' + after.ink + '）', after.ink > ink0 + 500);
    ok('整段拖动过程中页面位移 0（手指没把页面拖走）', maxScroll === 0 && after.scrolled === 0, 'maxScrollY=' + maxScroll);
    ok('只画一笔竖的**不算写完**（判据是盖住字形的比例，不是笔迹多长）', !after.stamped);
    /* 整格蛇形描一遍＝孩子沿着字描一遍，这才该盖章 */
    const ink1 = after.ink;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geom.left + geom.cvW * 0.08, y: geom.top + geom.cvH * 0.08, id: 1 }] });
    for (let i = 0; i < 11; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: geom.left + geom.cvW * (i % 2 ? 0.08 : 0.92), y: geom.top + geom.cvH * (0.08 + 0.84 * i / 10), id: 1 }],
      });
      await page.waitForTimeout(12);
      maxScroll = Math.max(maxScroll, await page.evaluate(() => Math.abs(window.scrollY)));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    const done = await page.evaluate(() => {
      const cv = document.getElementById('trace-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
      const cov = window.__hm.traceCoverage ? window.__hm.traceCoverage() : -1;
      return { ink: n, stamped: !document.getElementById('trace-stamp').classList.contains('hide'), cov: cov };
    });
    ok('整格描一遍 → 笔迹更多（' + ink1 + ' → ' + done.ink + '）', done.ink > ink1 + 500);
    /* 盖章那一刻覆盖计数就清零了（设计如此），所以这里报的覆盖率是 0，别误会成没盖到 */
    ok('整格描一遍 → 盖章回执' + (done.stamped ? '（盖章后覆盖计数清零，这是设计）' : ''), done.stamped);
    ok('整格描的过程中页面位移也一直是 0', maxScroll === 0, 'maxScrollY=' + maxScroll);
    ok('这一屏没有未捕获异常', errs.length === 0, errs[0]);

    await page.screenshot({ path: '/tmp/hm-trace-touch-' + vp.h + '.png' });
    await ctx.close();
  }

  /* ══════════════════════════════════════════════════════════════
     真浏览器里验一次「方块消除·先认字」和「速度档」的**看得见**部分。
     🔴 这些必须在这份测试里验，不能只靠 browser_test.sh：
        那套带 --virtual-time-budget，CSS 过渡根本不推进 ——
        「拼音淡入后看得见」在那边永远是 opacity:0（假红）；气泡也是同理。
     ══════════════════════════════════════════════════════════════ */
  console.log('\n== 方块消除·先认字（真浏览器，看得到的那种）==');
  {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(1800);                 // 等过点字注音的开机冷静期
    await page.evaluate(() => document.querySelector('.kid-card.da').click());
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      document.querySelectorAll('#home-mods .mod').forEach(m => { const t = m.querySelector('.tt'); if (t && t.textContent.includes('游戏乐园')) m.click(); });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelectorAll('#games-grid .game-card').forEach(c => { if (c.querySelector('.gc-name').textContent.includes('方块消除')) c.click(); });
    });
    await page.waitForTimeout(500);
    const prep = await page.evaluate(() => {
      const cards = document.querySelectorAll('.tt-learn');
      return { n: cards.length, disabled: document.getElementById('tt-start').disabled,
        py0: cards[0] ? getComputedStyle(cards[0].querySelector('i')).opacity : null };
    });
    ok('方块消除开局先出「先认一认」面板（' + prep.n + ' 个字）', prep.n >= 5);
    ok('没认完「开始玩」点不动', prep.disabled === true);
    ok('没点之前拼音是藏着的（opacity ' + prep.py0 + '）', prep.py0 === '0');
    await page.locator('.tt-learn').first().click();
    await page.waitForTimeout(420);                  // 0.2s 淡入走完
    const after1 = await page.evaluate(() => {
      const c = document.querySelector('.tt-learn');
      return { cls: c.className, py: getComputedStyle(c.querySelector('i')).opacity,
        pyTxt: c.querySelector('i').textContent,
        pop: document.getElementById('py-pop').classList.contains('on'),
        popTxt: document.getElementById('py-pop').textContent.trim() };
    });
    ok('点一下 → 卡片标成认过', /on/.test(after1.cls));
    ok('点一下 → 拼音真的淡入看得见（opacity ' + after1.py + '，' + after1.pyTxt + '）', after1.py === '1');
    ok('点一下 → 弹拼音气泡（气泡内容「' + after1.popTxt + '」）', after1.pop);
    ok('这一屏没有未捕获异常', errs.length === 0, errs[0]);
    await page.screenshot({ path: '/tmp/hm-tetris-prep.png' });
    await ctx.close();
  }

  await browser.close();
  console.log('\n共 ' + pass + ' 项通过 / ' + fail + ' 项失败');
  console.log('截图：/tmp/hm-trace-touch-844.png、/tmp/hm-trace-touch-560.png');
  console.log(fail === 0 ? '✅ 真触摸下的写一写：整页锁定 + 竖画能写 + 按钮够得着' 
                         : '🔴 有 ' + fail + ' 项没过：' + fails.join('｜'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('触摸测试崩了:', e); process.exit(1); });
