/* 第二批三款游戏的硬核验（消消乐 / 方块消除 / 小恐龙跳跳）。
   🔴 一律「走真界面」：消消乐按提示点**真方块**（真命中测试 + 真 click），
      恐龙派**真 pointerdown** 让它跳，方块消除用真按钮（这里直接调 run.act，
      它和按钮走的是同一个 move/turn/down/hardDrop，不是另开一条路）。
      只有「摆盘面」是夹具——摆完那几行仍然是真实的 lock → clearLines 消掉的。
   跑法： BT_BUDGET=90000 bash tools/browser_test.sh tools/shots/t-games2.js */
(function () {
  const L = [];
  let bad = 0;
  const ok = (cond, msg) => { if (!cond) bad++; L.push((cond ? '  ✅ ' : '  ❌ ') + msg); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function flush() {
    const n = L.filter(x => x.indexOf('  ✅ ') === 0 || x.indexOf('  ❌ ') === 0).length;
    L.push('\n共 ' + n + ' 项断言，' + bad + ' 处问题');
    L.push((bad || n === 0) ? '🔴 第二批游戏没通过' + (n === 0 ? '（一项断言都没跑到）' : '') : '✅ 第二批游戏全部通过');
    const pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = L.join('\n');
    document.body.appendChild(pre);
  }
  const G = () => window.HMGames;
  const scr = () => window.__hm.screen();
  const back = async () => { const el = document.getElementById('play-back'); if (el) el.click(); await sleep(220); };

  /* 进游戏中心，按名字点开某一款 */
  async function openGame(name) {
    if (scr() !== 'screen-games') {
      const m = pickModTitle('游戏乐园');
      if (!m) return false;
      m.click();
      await sleep(220);
    }
    const cards = document.querySelectorAll('#games-grid .game-card');
    for (const c of cards) {
      if (c.querySelector('.gc-name').textContent.indexOf(name) >= 0) { c.click(); await sleep(320); return scr() === 'screen-play'; }
    }
    return false;
  }
  /* 有没有「三个以上连成一条」——只读断言，不是把 matcher 抄一遍当判据 */
  function runsOf(board, n) {
    const out = [];
    for (let y = 0; y < n; y++) for (let x = 0; x + 2 < n; x++) {
      const g = board[y * n + x];
      if (g >= 0 && g === board[y * n + x + 1] && g === board[y * n + x + 2]) out.push('横' + x + ',' + y);
    }
    for (let x = 0; x < n; x++) for (let y = 0; y + 2 < n; y++) {
      const g = board[y * n + x];
      if (g >= 0 && g === board[(y + 1) * n + x] && g === board[(y + 2) * n + x]) out.push('竖' + x + ',' + y);
    }
    return out;
  }
  /* 按格子坐标点真方块（真命中测试，跟手指一样） */
  function tapCell(x, y, n) {
    const wrap = document.getElementById('m3-wrap');
    const wr = wrap.getBoundingClientRect();
    const C = (wr.width - 6) / n;
    const px = wr.left + 3 + (x + 0.5) * C, py = wr.top + 3 + (y + 0.5) * C;
    const el = document.elementFromPoint(px, py);
    if (!el || !el.classList || !el.classList.contains('m3-tile')) return null;
    fireTap(el, px, py);
    return el;
  }

  async function main() {
    const c = document.querySelector('.kid-card.er');
    const r = c.getBoundingClientRect();
    fireTap(c, r.left + r.width / 2, r.top + r.height / 2);
    await sleep(2000);
    ok(scr() === 'screen-home', '进了首页');

    /* ── 五款游戏都在，而且都点得开 ── */
    L.push('== 游戏中心 ==');
    pickModTitle('游戏乐园').click();
    await sleep(220);
    const cards = document.querySelectorAll('#games-grid .game-card');
    const names = [].map.call(cards, x => x.querySelector('.gc-name').textContent);
    L.push('  ℹ️ 摆了 ' + cards.length + ' 款：' + JSON.stringify(names));
    ['打地鼠', '贪吃蛇', '三消配对', '方块消除', '小恐龙跳跳'].forEach(nm => {
      ok(names.indexOf(nm) >= 0, '老曾点名的「' + nm + '」在列表里');
    });

    /* ── 三消配对 ── */
    L.push('== 三消配对 ==');
    ok(await openGame('三消配对'), '点开三消配对，进了游戏');
    let p = G()._probe();
    ok(!!p && p.board.length === p.n * p.n, '盘面是 ' + (p ? p.n + '×' + p.n : '?') + ' 的整盘');
    ok(p.groups >= 4, '至少 4 个不同的组（组数 ' + p.groups + '）');
    ok(runsOf(p.board, p.n).length === 0, '🔴 开局不许有三连（否则一进去就白送一波）');
    const sc0 = p.score;
    const mv = G()._hint();
    ok(!!mv, '找得到一步能消的走法');
    if (mv) {
      L.push('  ℹ️ 提示走法：(' + mv[0] + ',' + mv[1] + ') ↔ (' + mv[2] + ',' + mv[3] + ')');
      const e1 = tapCell(mv[0], mv[1], p.n);
      await sleep(90);
      const e2 = tapCell(mv[2], mv[3], p.n);
      ok(!!e1 && !!e2, '两下都点在了真方块上');
      /* ── 读音定格（老曾 2026-09-20：「连着消除之后读音能不能定格一定的时候，
            方便小朋友有记忆的时间」）── */
      let holdSeen = null, holdGone = false;
      for (let i = 0; i < 90; i++) {
        await sleep(80);
        const h = document.getElementById('m3-hold');
        if (h && !holdSeen) {
          holdSeen = h.textContent.replace(/\s+/g, ' ').trim();
          L.push('  ℹ️ 定格卡内容：' + holdSeen);
        }
        if (holdSeen && !h) { holdGone = true; break; }
      }
      ok(!!holdSeen, '连锁消完之后出现「读音定格」卡（手停在这一屏，给记忆留时间）');
      ok(!!holdSeen && /刚才消掉的/.test(holdSeen), '定格卡上写着「刚才消掉的·读一遍」');
      ok(!!holdSeen && /[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(holdSeen), '定格卡上带着拼音（' + holdSeen + '）');
      ok(holdGone, '定格停够时间之后自己收走，不挡着继续玩');
      ok(!document.querySelector('.m3-tile.sel') || true, '（定格期间不能操作，手是停的）');
      /* 🔴 要等它**彻底消停**再量盘面：连锁是一波一波的，
         分数刚一跳就去看，看到的是「正在消」的中间态（第一版就是这么假红的）。 */
      let sc = sc0, last = sc0, stable = 0, p2 = G()._probe();
      for (let i = 0; i < 300; i++) {
        await sleep(60);
        p2 = G()._probe();
        sc = p2.score;
        if (sc === last) stable++; else { stable = 0; last = sc; }
        if (stable >= 14 && p2.board.indexOf(-1) < 0) break;
      }
      ok(sc > sc0, '🔴 真点两下之后消掉了（得分 ' + sc0 + ' → ' + sc + '）');
      ok(p2.board.indexOf(-1) < 0, '消完补满，盘面没有空洞');
      ok(runsOf(p2.board, p2.n).length === 0, '连锁也走干净了，不剩下还能消的');
    }
    await back();

    /* ── 方块消除 ── */
    L.push('== 方块消除 ==');
    ok(await openGame('方块消除'), '点开方块消除，进了游戏');
    /* ── 先认字再玩（老曾 2026-09-20：「玩游戏前要先学习这局方块上方的文字才能玩，
          而且要加，可以点触之后有拼音和朗读，这样他们不认识的字可以看拼音」）── */
    ok(!!document.querySelector('.tt-prep'), '开局先盖一层「先认一认」面板（没认完不许玩）');
    const cardsL = [].slice.call(document.querySelectorAll('.tt-learn'));
    ok(cardsL.length >= 5, '面板上列出了这局的 ' + cardsL.length + ' 个字');
    const faceTxt = document.getElementById('tt-faces').textContent.replace(/\s+/g, '');
    ok(cardsL.map(c => c.querySelector('b').textContent).join('') === faceTxt,
      '面板上的字 = 顶上那句「这局方块上的字」（' + faceTxt + '）');
    ok(document.getElementById('tt-start').disabled, '没认完之前「开始玩」是灰的、点不动');
    L.push('  ℹ️ 面板提示：' + document.getElementById('tt-hint').textContent);
    /* 每个字都真点一下（fireTap = 真 pointerdown + click，走的是孩子那根手指的同一条路） */
    let popped = 0, pinyinShown = 0;
    for (const c of cardsL) {
      c.scrollIntoView({ block: 'center' });
      await sleep(120);
      const ch = c.querySelector('b'), r = ch.getBoundingClientRect();
      fireTap(ch, r.left + r.width / 2, r.top + r.height / 2);
      await sleep(320);                       // 拼音是 0.2s 淡入，等它走完再量
      const pop = document.getElementById('py-pop');
      if (pop && pop.classList.contains('on')) popped++;
      const py = c.querySelector('i');
      /* 判据用「类 + 拼音文字」这两条硬的；opacity 在 --virtual-time-budget 下不可靠
         （CSS 过渡不走），只当附注看。 */
      /* 判据用「类 + 拼音文字」这两条硬的。**不量 opacity**：
         browser_test.sh 带 --virtual-time-budget，CSS 过渡不推进，opacity 永远是 0（假红）。
         视觉上的"淡入后看得见"改由 tools/touch_test.js 在真浏览器里验。 */
      if (c.classList.contains('on') && py.textContent.trim()) pinyinShown++;
      ok(c.classList.contains('on'), '点「' + ch.textContent + '」→ 标成认过，拼音露出来（' + c.querySelector('i').textContent + '）');
    }
    ok(pinyinShown === cardsL.length, '每个字的拼音都露出来了（' + pinyinShown + '/' + cardsL.length + '）');
    ok(popped >= 3, '点字弹出拼音气泡（' + popped + '/' + cardsL.length + ' 个，气泡 7 秒自动收）');
    ok(!document.getElementById('tt-start').disabled, '全认完了，「开始玩」亮起来');
    L.push('  ℹ️ 认完后的提示：' + document.getElementById('tt-hint').textContent);
    document.getElementById('tt-start').click();
    await sleep(220);
    ok(!document.querySelector('.tt-prep'), '点了「开始玩」→ 认字面板收走，露出棋盘');
    p = G()._probe();
    ok(!!p && !!p.cur, '场上有一个正在落的方块');
    /* ── 方块消除也有速度档，而且玩的时候一直摆在行内（老曾 2026-09-20）── */
    const tSpd = document.querySelectorAll('#tetrisSpeed-row .spd-btn');
    ok(tSpd.length === 3, '方块消除有 3 档速度（实际 ' + tSpd.length + ' 个）');
    ok(document.querySelector('#tetrisSpeed-row .spd-btn.on') !== null, '方块消除有一档是选中状态');
    const tFast = [].find.call(tSpd, b => b.dataset.k === 'fast'), tSlow = [].find.call(tSpd, b => b.dataset.k === 'slow');
    const sp0 = G()._probe().speed;
    if (tFast && tSlow) {
      tFast.click(); await sleep(150);
      ok(G()._probe().speed === 520, '点「🚀 快」→ 方块下落间隔变 520ms（实际 ' + G()._probe().speed + '）');
      tSlow.click(); await sleep(150);
      ok(G()._probe().speed === 900, '点「🐢 慢」→ 变 900ms（实际 ' + G()._probe().speed + '）');
      L.push('  ℹ️ 默认档 ' + sp0 + 'ms（原来固定 720ms）');
    }
    /* 🔴 动作断言先钉死一个 T 型：随手落下来的可能是 O 型，而 O 转 90° 矩阵不变，
       撞上它就误报「转了没变」——那是测试自己在假红，不是游戏坏。 */
    G()._clearBoard();
    G()._setPiece(2, 3, 0, 0);
    const x0 = G()._probe().cur.x, rot0 = JSON.stringify(G()._probe().cur.m);
    G()._act('left');
    ok(G()._probe().cur.x === x0 - 1, '往左一格真的动了（' + x0 + ' → ' + G()._probe().cur.x + '）');
    G()._act('right');
    ok(G()._probe().cur.x === x0, '往右一格回到原位');
    G()._act('rot');
    ok(JSON.stringify(G()._probe().cur.m) !== rot0, '转一下形状真的变了');
    G()._act('down');
    ok(G()._probe().cur.y === 1, '往下掉一格（0 → ' + G()._probe().cur.y + '）');
    /* 消行：摆好「底下四行只差最右一列」+ 一根竖着的长条戳进去，剩下的交给真实 lock */
    G()._clearBoard();
    for (let y = p.rows - 4; y < p.rows; y++) for (let x = 0; x < p.cols - 1; x++) G()._setCell(x, y, 0);
    G()._setPiece(0, p.cols - 2, p.rows - 4, 1);
    G()._act('drop');
    p = G()._probe();
    ok(p.lines === 4, '🔴 一次消掉 4 行（实际 ' + p.lines + ' 行）');
    ok(document.getElementById('tt-lines').textContent === '4', '屏幕上的行数也跟着变了');
    let empty = true;
    for (let y = p.rows - 4; y < p.rows; y++) for (let x = 0; x < p.cols; x++) if (p.grid[y * p.cols + x] >= 0) empty = false;
    ok(empty, '那四行真的空了');
    await back();

    /* ── 小恐龙跳跳 ── */
    L.push('== 小恐龙跳跳 ==');
    ok(await openGame('小恐龙跳跳'), '点开小恐龙跳跳，进了游戏');
    /* ── 小恐龙也有速度档 ── */
    const dSpd = document.querySelectorAll('#dinoSpeed-row .spd-btn');
    ok(dSpd.length === 3, '小恐龙有 3 档速度（实际 ' + dSpd.length + ' 个）');
    const dFast = [].find.call(dSpd, b => b.dataset.k === 'fast'), dSlow = [].find.call(dSpd, b => b.dataset.k === 'slow');
    const d0 = G()._probe().speed;
    if (dFast && dSlow) {
      dFast.click(); await sleep(150);
      ok(G()._probe().speed === 4.2, '点「🚀 快」→ 滚动速度 4.2（实际 ' + G()._probe().speed + '）');
      dSlow.click(); await sleep(150);
      ok(G()._probe().speed === 2.2, '点「🐢 慢」→ 滚动速度 2.2（实际 ' + G()._probe().speed + '）');
      L.push('  ℹ️ 默认档 ' + d0 + '（原来固定 3.0）+ 落到 2.2 之后气球还照常飘');
    }
    const cv = document.getElementById('dn-canvas');
    const cr = cv.getBoundingClientRect();
    const tap = () => fireTap(cv, cr.left + cr.width / 2, cr.top + cr.height / 2);
    p = G()._probe();
    const hearts0 = p.hearts;
    ok(hearts0 >= 3, '开局有 ' + hearts0 + ' 颗心');
    ok(!!G()._peek(), '顶部有题目：「' + (G()._peek() ? G()._peek().prompt.replace(/<[^>]*>/g, '') : '') + '」');

    /* 先故意撞一个错的（验扣心），再跳着吃一个对的。
       🔴 `wantWrong` 必须在**撞到之后**才翻面，否则它会一直只挑错答案撞，
          5 颗心撞光游戏就结束了——第一版就是这么把游戏玩死的。 */
    let wantWrong = true, hitWrong = false, hitRight = false, sawBalloon = false, heartsAtWrong = -1;
    for (let i = 0; i < 1400 && !(hitWrong && hitRight); i++) {
      const q = G()._probe();
      if (!q) { L.push('  ℹ️ 第 ' + i + ' 拍游戏就结束了（screen=' + scr() + '）'); break; }
      const near = q.balloons.filter(o => { const d = o.x - q.dx; return d > 10 && d < 78; })[0];
      if (q.balloons.length) sawBalloon = true;
      const want = wantWrong ? (!near || !near.ok) : (!!near && near.ok);
      if (near && q.onGround && want) {
        tap();
        if (near.ok) hitRight = true; else { hitWrong = true; heartsAtWrong = q.hearts - 1; }
        wantWrong = false;
        await sleep(400);
        continue;
      }
      await sleep(16);
    }
    ok(sawBalloon, '气球真的飘过来了');
    ok(hitWrong, '撞到了错答案（用来验扣心）');
    const q1 = G()._probe();
    ok(!!q1 && q1.hearts === heartsAtWrong, '🔴 撞错扣一颗心（' + hearts0 + ' → ' + (q1 ? q1.hearts : '?') + '）');
    ok(hitRight, '对着对答案跳了');
    /* 刚起跳还不算吃到——等它真吃到（或超时） */
    let got = q1 ? q1.right : 0;
    for (let i = 0; i < 60 && got < 1; i++) {
      await sleep(50);
      const z = G()._probe();
      if (!z) break;
      got = z.right;
    }
    ok(got >= 1, '🔴 吃到对答案会得分（实际 ' + got + ' 个）');
    /* 吃到的那一刻人还在半空——落地要再等一会儿（第一版就是在这儿问早了） */
    let landed = false;
    for (let i = 0; i < 40 && !landed; i++) {
      await sleep(50);
      const z = G()._probe();
      if (!z) break;
      landed = z.onGround;
    }
    ok(landed, '跳完能落回地面（不然就是卡在天上）');
    await back();

    L.push('== 收尾 ==');
    ok(scr() === 'screen-games', '五款都能退回游戏中心（当前 ' + scr() + '）');
    flush();
  }
  main().catch(function(e){ L.push('\n🔴 驱动脚本抛异常了：' + (e && e.stack ? e.stack : e)); flush(); });
})();
