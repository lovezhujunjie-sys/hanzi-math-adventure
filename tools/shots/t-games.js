/* 游戏乐园的硬核验（老曾 2026-09-20 报「点了不能玩」）：
     ① 进去就能玩（不再要「学满 15 分钟赚时间」）
     ② 贪吃蛇**真把蛇引到正确答案那儿**，看它是不是真的变长、真的换题
     ③ 吃错的会扣一节、题目不变
     ④ 每日上限仍然拦得住（防沉迷没被一起拆掉）
   跑法： bash tools/browser_test.sh tools/shots/t-games.js
   🔴 判据看每条自己的输出行，不看退出码。 */
(function () {
  const L = [];
  let bad = 0;
  const ok = (cond, msg) => { if (!cond) bad++; L.push((cond ? '  ✅ ' : '  ❌ ') + msg); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function flush() {
    const n = L.filter(x => x.indexOf('  ✅ ') === 0 || x.indexOf('  ❌ ') === 0).length;
    L.push('\n共 ' + n + ' 项断言，' + bad + ' 处问题');
    L.push((bad || n === 0) ? '🔴 游戏乐园没通过' + (n === 0 ? '（一项断言都没跑到）' : '') : '✅ 游戏乐园全部通过');
    const pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = L.join('\n');
    document.body.appendChild(pre);
  }
  const G = () => window.HMGames;
  const scr = () => window.__hm.screen();

  /* 走最短方向（含穿墙），别撞上反向——step 里 180° 掉头会被忽略。
     另外绕开「吃错的答案」：撞上去会被扣一节，把「吃对会变长」这件事盖掉，
     测出来的就不是游戏对不对，而是测试自己手笨。 */
  function steerTo(p, target, N) {
    const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
    const wrap = v => (v % N + N) % N;
    let dx = target.x - p.head.x, dy = target.y - p.head.y;
    if (dx > N / 2) dx -= N; if (dx < -N / 2) dx += N;
    if (dy > N / 2) dy -= N; if (dy < -N / 2) dy += N;
    const opts = [];
    if (Math.abs(dx) >= Math.abs(dy)) { if (dx) opts.push({ x: sgn(dx), y: 0 }); if (dy) opts.push({ x: 0, y: sgn(dy) }); }
    else { if (dy) opts.push({ x: 0, y: sgn(dy) }); if (dx) opts.push({ x: sgn(dx), y: 0 }); }
    const legal = opts.filter(o => !(o.x === -p.dir.x && o.y === -p.dir.y));
    const safe = legal.filter(o => !p.foods.some(f =>
      f.x === wrap(p.head.x + o.x) && f.y === wrap(p.head.y + o.y) && f.text !== target.text));
    return safe[0] || legal[0] || { x: 0, y: 0 };
  }

  async function main() {
    /* 先把孩子选好、进首页 */
    const c = document.querySelector('.kid-card.er');
    const r = c.getBoundingClientRect();
    fireTap(c, r.left + r.width / 2, r.top + r.height / 2);
    await sleep(2000);                                  // 等开机冷静期过去（点字注音的闸）
    ok(scr() === 'screen-home', '进了首页（' + scr() + '）');
    /* 🔴 夹具：游戏乐园现在有「先学习才能进」的门（老曾 2026-09-20 要的）。
       这一份测的是**游戏本身**，不是门；所以先按家长页那个开关把他今天放行，
       门自己的三条路（时长/闯关/家长放行）由 tools/shots/t-gate.js 专门验。 */
    window.__hm.gate.forceOpen();

    /* ── ① 游戏乐园进去就能玩 ── */
    L.push('== ① 进去就能玩 ==');
    const m = pickModTitle('游戏乐园');
    ok(!!m, '首页有游戏乐园入口');
    if (!m) { flush(); return; }
    m.click();
    await sleep(200);
    ok(scr() === 'screen-games', '进了游戏中心');
    const remain = window.HMBridge.gameRemainSec();
    ok(remain > 0, '🔴 可玩秒数 > 0（不用先学满 15 分钟）—— 实际 ' + remain + ' 秒');
    const cards = document.querySelectorAll('#games-grid .game-card');
    const names = [].map.call(cards, x => x.querySelector('.gc-name').textContent);
    L.push('  ℹ️ 游戏中心摆了 ' + cards.length + ' 款：' + JSON.stringify(names));
    ok(names.indexOf('贪吃蛇') >= 0, '老曾点名的贪吃蛇在列表里');
    ok(!document.getElementById('game-prog-txt'), '「学习赚时间」那条进度条已经拿掉了');

    /* ── ② 点打地鼠进得去 ── */
    L.push('== ② 点进去能玩 ==');
    cards[0].click();
    await sleep(300);
    ok(scr() === 'screen-play', '点「打地鼠」进了游戏（' + scr() + '）');
    /* 先过「数洞」这一关才进主玩法 */
    const holes = document.querySelectorAll('#mole-count-grid .mole-hole').length;
    let answered = false;
    [].forEach.call(document.querySelectorAll('#mole-count-opts .mole-opt'), b => {
      if (!answered && b.textContent.trim() === String(holes)) { b.click(); answered = true; }
    });
    ok(answered, '数洞阶段：数出 ' + holes + ' 个洞并答对');
    await sleep(1100);
    /* ── 打地鼠速度档（老曾 2026-09-20：「打地鼠应该也要有可以调节速度的」）── */
    const mSpd = document.querySelectorAll('#moleSpeed-row .spd-btn');
    ok(mSpd.length === 3, '打地鼠有 3 档速度可点（实际 ' + mSpd.length + ' 个）');
    ok(document.querySelector('#moleSpeed-row .spd-btn.on') !== null, '地鼠速度有一档是选中状态');
    const mSlow = [].find.call(mSpd, b => b.dataset.k === 'slow'), mFast = [].find.call(mSpd, b => b.dataset.k === 'fast');
    ok(!!mSlow && !!mFast, '找得到「慢」「快」两个按钮');
    if (mSlow && mFast) {
      const d0 = G()._spd();
      ok(d0 && d0.pop >= 1000, '默认档比原来的 850ms 慢：间隔 ' + d0.pop + 'ms、地鼠停 ' + d0.hide + 'ms');
      mFast.click(); await sleep(150);
      ok(G()._spd().pop === 850, '点「🚀 快」→ 冒头间隔变 850ms（实际 ' + G()._spd().pop + '）');
      ok(G()._spd().hide === 1900, '地鼠停留时间也跟着变（' + G()._spd().hide + 'ms）');
      mSlow.click(); await sleep(150);
      ok(G()._spd().pop === 1250, '点「🐢 慢」→ 变 1250ms（实际 ' + G()._spd().pop + '）');
      ok(window.__hm.state().opts.moleSpeed === 'slow', '地鼠速度被记住（存档 moleSpeed=' + window.__hm.state().opts.moleSpeed + '）');
    }
    document.getElementById('play-back').click();
    await sleep(200);

    /* ── ③ 贪吃蛇：真吃 ── */
    L.push('== ③ 贪吃蛇 ==');
    const cards2 = document.querySelectorAll('#games-grid .game-card');
    let snakeIdx = -1;
    [].forEach.call(cards2, (x, i) => { if (x.querySelector('.gc-name').textContent.indexOf('贪吃蛇') >= 0) snakeIdx = i; });
    ok(snakeIdx >= 0, '找得到贪吃蛇卡片');
    if (snakeIdx < 0) { flush(); return; }
    cards2[snakeIdx].click();
    await sleep(300);
    ok(scr() === 'screen-play', '点「贪吃蛇」进了游戏（' + scr() + '）');

    const p0 = G()._probe(), q0 = G()._peek();
    ok(!!p0 && !!q0, '拿得到蛇的状态和当前题目');
    if (!p0 || !q0) { flush(); return; }
    L.push('  ℹ️ 题目：「' + q0.prompt.replace(/<[^>]*>/g, '') + '」，答案 ' + q0.answer);
    ok(p0.foods.length === 4, '场上 4 个候选食物（实际 ' + p0.foods.length + '）');
    ok(p0.foods.some(f => f.text === q0.answer), '4 个候选里有正确答案 ' + q0.answer);
    const len0 = p0.len;

    /* ── 速度档（老曾 2026-09-20：「贪吃蛇目前的速度太快了，能不能加一个调速度的」）── */
    const spdBtns = document.querySelectorAll('#snakeSpeed-row .spd-btn');
    ok(spdBtns.length === 3, '贪吃蛇画面上有 3 档速度可点（实际 ' + spdBtns.length + ' 个）');
    ok(document.querySelector('#snakeSpeed-row .spd-btn.on') !== null, '有一档是选中状态（默认档）');
    const spdDefault = G()._probe().speed;
    ok(spdDefault >= 340, '默认档比原来慢：' + spdDefault + 'ms（原来一上来就是 260ms）');
    let slow = null, fast = null;
    [].forEach.call(spdBtns, b => { if (b.dataset.k === 'slow') slow = b; if (b.dataset.k === 'fast') fast = b; });
    slow.click(); await sleep(120);
    ok(G()._probe().speed === 460, '点「🐢 慢」→ 变成 460ms（实际 ' + G()._probe().speed + '）');
    ok(G()._probe().spd === 'slow' && slow.classList.contains('on'), '选中状态跟着走');
    fast.click(); await sleep(120);
    ok(G()._probe().speed === 250, '点「🚀 快」→ 变成 250ms（实际 ' + G()._probe().speed + '）');
    ok(window.__hm.state().opts && window.__hm.state().opts.snakeSpeed === 'fast',
      '选择被记住了（存档里 snakeSpeed=' + (window.__hm.state().opts || {}).snakeSpeed + '，下次进来还是这一档）');
    slow.click(); await sleep(120);                 // 后面引导小蛇的那段用慢档，稳
    ok(G()._probe().speed === 460, '切回「🐢 慢」也生效');

    /* 引导蛇去吃正确答案：每 40ms 修正一次方向，直到吃够 2 个或超时。
       🔴 记的是**峰值**长度、以及吃过几道**不同**的题：
          吃对会长一节，但之后再吃错会被扣回去（身体最短 3 节），
          只看结束时刻的长度会把「真长过」误判成「没长」（第一版就是这么红的）。 */
    let got = 0, maxLen = len0, lastQ = q0.prompt + '|' + q0.answer, qSeen = 1;
    for (let tick = 0; tick < 600 && got < 2; tick++) {
      const p = G()._probe(), q = G()._peek();
      if (!p || !q) break;
      if (p.right > got) got = p.right;
      if (p.len > maxLen) maxLen = p.len;
      const tag = q.prompt + '|' + q.answer;
      if (tag !== lastQ) { lastQ = tag; qSeen++; }
      const target = p.foods.filter(f => f.text === q.answer)[0];
      if (target) {
        const d = steerTo(p, target, 8);
        if (d.x || d.y) G()._steer(d.x, d.y);
      }
      await sleep(40);
    }
    ok(got >= 1, '🔴 吃到正确答案会得分（实际吃到 ' + got + ' 个）');
    ok(maxLen > len0, '🔴 吃到正确答案会变长（最长长到 ' + maxLen + ' 节，出发时 ' + len0 + ' 节）');
    ok(qSeen >= 2, '吃完会换新题（一路上换过 ' + qSeen + ' 道题）');

    /* ── ④ 每日上限仍然拦得住 ── */
    L.push('== ④ 防沉迷硬顶没被拆掉 ==');
    const st = window.__hm.state();
    const keep = st.profiles.er.gamePlayedSec;
    st.profiles.er.gamePlayedSec = 99999;
    ok(window.HMBridge.gameRemainSec() === 0, '玩满上限后剩余归零');
    document.getElementById('play-back').click();
    await sleep(200);
    const cards3 = document.querySelectorAll('#games-grid .game-card');
    if (cards3[0]) cards3[0].click();
    await sleep(300);
    ok(scr() === 'screen-games', '🔴 玩到上限后再点游戏就进不去了（停在 ' + scr() + '）');
    st.profiles.er.gamePlayedSec = keep;                // 还原，别把测试的账留在存档里
    flush();
  }
  main();
})();
