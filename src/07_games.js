/* ══════════════════════════════════════════════════════════════
   游戏乐园 · 「边玩边学」小游戏引擎
   ─ 学习达标 → 赚游戏时间 → 玩这些游戏，而游戏过程本身还在学
   ─ 「边玩边学」范式（老曾定）：①开局有学习点（打地鼠前先数洞）
     ②游戏元素承载学习内容（地鼠头顶字/算式答案，打对的那只）
   ─ 依赖 window.HMBridge（05_app.js 末尾暴露）：
       sfx/beep/speak/toast/confetti/showScreen/KID/openGames
       cfg()/gameRemainSec()/spendGameSec(n)/hanziPool()
   ─ 第一批：打地鼠（大宝算式·汉字 / 二宝数字，都能玩）
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const B = () => window.HMBridge;                 // 运行时取桥，保证 app 已挂载
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* 游戏清单：首页 / 游戏中心渲染用。kid = 适合的档案 */
  const GAMES = [
    { id: 'mole', icon: '🔨', name: '打地鼠', desc: '先数洞，再打对的地鼠', kid: ['da', 'er'], tag: '数数·口算·认字' }
    /* 第二批预留：{ id:'snake', ... 贪吃蛇 }, { id:'match3', ... 三消 } */
  ];

  let RUN = null;   // 当前运行中的游戏 {timer, cleanup, done}

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  /* ─────────── 游戏外壳：单次计时 + 扣时间 + 防沉迷 + 退出 ─────────── */
  /* mount(run, stage, finish) 里搭具体游戏；把自己的定时器登记到 run.cleanup，退出时统一清。 */
  function shell(title, mount) {
    const b = B();
    b.showScreen('screen-play');
    $('play-title').textContent = title;
    const stage = $('play-stage');
    stage.innerHTML = '';

    // 单次可玩 = min(家长设的单次时长, 剩余游戏余额)
    let left = Math.max(0, Math.round(Math.min(b.cfg().sessionMin * 60, b.gameRemainSec())));
    const timeEl = $('play-time');
    timeEl.textContent = '⏱ ' + fmt(left);

    const run = { timer: null, cleanup: null, done: false };
    RUN = run;

    function finish(msg) {
      if (run.done) return;
      run.done = true;
      clearInterval(run.timer);
      if (run.cleanup) { try { run.cleanup(); } catch (e) {} }
      RUN = null;
      b.openGames();                       // 回游戏中心（顺带刷新剩余时间）
      if (msg) b.toast(msg);
    }

    run.timer = setInterval(() => {
      left--;
      b.spendGameSec(1);                   // 扣余额 + 记当日已玩（防沉迷）
      timeEl.textContent = '⏱ ' + fmt(left);
      if (left === 60) b.toast('还有 1 分钟哦～');
      if (left <= 0) finish('⏱ 时间到啦，休息一下眼睛吧！');
      else if (b.gameRemainSec() <= 0) finish('今天玩得够多啦，明天再来！');
    }, 1000);

    $('play-back').onclick = () => { b.sfx.tap(); finish(''); };
    mount(run, stage, finish);
  }

  /* ─────────── 出题：打地鼠的「地鼠顶什么」 ─────────── */
  /* 返回 {prompt:HTML, speak:朗读文本, answer:正确头顶, cands:[含answer的候选], kind} */
  function moleQ(kid) {
    const b = B();
    if (kid === 'er') {
      // 二宝（3岁半）：认数字 或 5以内加法
      if (Math.random() < 0.5) {
        const n = 1 + rnd(10);
        return { kind: 'num', prompt: '找出数字 <b>' + n + '</b>', speak: '找出数字 ' + n, answer: String(n), cands: numCands(n, 1, 10) };
      }
      const a = 1 + rnd(4), c = 1 + rnd(5 - a > 0 ? 5 - a : 1);
      const s = a + c;
      return { kind: 'num', prompt: '<b>' + a + ' + ' + c + ' = ?</b>', speak: a + ' 加 ' + c + ' 等于几', answer: String(s), cands: numCands(s, 1, 10) };
    }
    // 大宝（二年级）：口算 或 汉字（拼音选字），各半
    if (Math.random() < 0.5) {
      const pool = b.hanziPool();
      const w = pick(pool);
      const others = shuffle(pool.filter(x => x.z !== w.z)).slice(0, 3).map(x => x.z);
      const cands = shuffle([w.z].concat(others));
      return { kind: 'zi', prompt: '拼音 <b>' + w.py + '</b> 是哪个字？', speak: w.py + '，是哪个字', answer: w.z, cands: cands };
    }
    const op = pick(['+', '-', '×']);
    let a, c, ans;
    if (op === '+') { a = 10 + rnd(80); c = rnd(100 - a); ans = a + c; }
    else if (op === '-') { a = 20 + rnd(79); c = rnd(a); ans = a - c; }
    else { a = 2 + rnd(8); c = 2 + rnd(8); ans = a * c; }
    return { kind: 'num', prompt: '<b>' + a + ' ' + op + ' ' + c + ' = ?</b>', speak: a + op + c + ' 等于几', answer: String(ans), cands: numCands(ans, Math.max(0, ans - 6), ans + 6) };
  }

  /* 生成 4 个数字候选（含正确 answer），去重、都在 [lo,hi] 附近 */
  function numCands(ans, lo, hi) {
    const set = new Set([String(ans)]);
    let guard = 0;
    while (set.size < 4 && guard++ < 60) {
      const d = lo + rnd(Math.max(1, hi - lo + 1));
      if (d >= 0) set.add(String(d));
    }
    while (set.size < 4) set.add(String(ans + set.size * 2));
    return shuffle(Array.from(set));
  }

  /* ─────────── 打地鼠 ─────────── */
  function mole(run, stage, finish) {
    const b = B();
    const kid = b.KID().id;

    /* 阶段①：数洞（开局学习点 = 数数） */
    const holeN = 5 + rnd(5);                      // 5~9 个洞
    stage.innerHTML =
      '<div class="mole-count">' +
        '<div class="mole-ask">🔢 数一数，一共有几个洞？</div>' +
        '<div class="mole-grid count" id="mole-count-grid"></div>' +
        '<div class="mole-opts" id="mole-count-opts"></div>' +
      '</div>';
    const cg = $('mole-count-grid');
    for (let i = 0; i < holeN; i++) {
      const h = document.createElement('div');
      h.className = 'mole-hole show';
      h.innerHTML = '<div class="mole-face">🕳️</div>';
      cg.appendChild(h);
    }
    b.speak('数一数，一共有几个洞');
    const opts = shuffle([holeN, holeN + 1, Math.max(1, holeN - 1), holeN + 2].map(String))
      .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);
    const ob = $('mole-count-opts');
    opts.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'btn ghost mole-opt';
      btn.textContent = v;
      btn.onclick = () => {
        if (String(holeN) === v) { b.sfx.ok(); b.confetti(12); setTimeout(play, 700); }
        else { b.sfx.no(); btn.classList.add('bad'); b.toast('再数一遍～'); }
      };
      ob.appendChild(btn);
    });

    /* 阶段②：打地鼠主玩法 */
    function play() {
      if (run.done) return;
      let right = 0, wrong = 0, q = null, ansUp = 0;
      stage.innerHTML =
        '<div class="mole-play">' +
          '<div class="mole-ask" id="mole-q"></div>' +
          '<div class="mole-score">打对 <b class="g" id="mole-right">0</b> · 打错 <b class="r" id="mole-wrong">0</b></div>' +
          '<div class="mole-grid" id="mole-grid"></div>' +
        '</div>';
      const grid = $('mole-grid');
      const holes = [];
      for (let i = 0; i < 9; i++) {
        const h = document.createElement('div');
        h.className = 'mole-hole';
        h.innerHTML = '<div class="mole"><span class="mole-tag"></span><span class="mole-face">🐹</span></div>';
        grid.appendChild(h);
        holes.push({ el: h, mole: h.querySelector('.mole'), tag: h.querySelector('.mole-tag'), busy: false });
      }

      function nextQ() {
        /* 换题先清场：把还在冒头的地鼠全部缩回，免得上一题的答案残留到新题里误导孩子 */
        holes.forEach(h => { if (h.busy) hide(h); });
        ansUp = 0;
        q = moleQ(kid);
        run.q = q;                     // 只读测试探针用（HMGames._peek）
        $('mole-q').innerHTML = q.prompt;
        b.speak(q.speak);
      }
      nextQ();

      /* 冒地鼠：每 ~850ms 找个空洞冒一只。
         🔴 场上「同时只允许一只」顶正确答案，其余一律是**不等于答案**的干扰项——
            否则大半地鼠都是对的，孩子乱打也能对，就白玩了（这是出题区分度的命门）。 */
      const pop = setInterval(() => {
        if (run.done || !q) return;
        const free = holes.filter(h => !h.busy);
        if (!free.length) return;
        const wrongs = q.cands.filter(c => c !== q.answer);
        if (!wrongs.length) return;                 // 没有干扰项可用，跳过这次冒头
        const h = pick(free);
        let face, isAns;
        if (ansUp === 0 && Math.random() < 0.55) { face = q.answer; isAns = true; ansUp++; }
        else { face = pick(wrongs); isAns = false; }
        h.busy = true; h.isAns = isAns;
        h.tag.textContent = face;
        h.mole.classList.add('up');
        h.mole.onclick = () => {
          if (!h.busy) return;
          if (h.isAns) {
            right++; $('mole-right').textContent = right;
            b.sfx.ok(); b.beep(1200, 0.08, 'sine', 0.1); b.confetti(6);
            h.mole.classList.add('hit');
            hide(h);
            nextQ();
          } else {
            wrong++; $('mole-wrong').textContent = wrong;
            b.sfx.no();
            h.mole.classList.add('shake');
            setTimeout(() => h.mole.classList.remove('shake'), 320);
          }
        };
        // 没被打中，1.9s 后自己缩回
        h.auto = setTimeout(() => hide(h), 1900);
      }, 850);

      function hide(h) {
        clearTimeout(h.auto);
        h.mole.classList.remove('up', 'hit');
        h.mole.onclick = null;
        if (h.isAns) { ansUp = Math.max(0, ansUp - 1); h.isAns = false; }
        h.busy = false;
      }

      run.cleanup = () => { clearInterval(pop); holes.forEach(hide); };
    }
  }

  /* ─────────── 对外入口 ─────────── */
  function launch(id) {
    const b = B();
    const g = GAMES.find(x => x.id === id);
    if (!g) return;
    if (!g.kid.includes(b.KID().id)) { b.toast('这个游戏适合' + (b.KID().id === 'er' ? '哥哥' : '弟弟') + '玩哦'); return; }
    if (b.gameRemainSec() <= 0) { b.toast('还没有游戏时间，先去学习赚一赚吧！'); b.sfx.no(); return; }
    if (id === 'mole') shell('🔨 打地鼠', mole);
  }

  window.HMGames = { GAMES, launch, fmt, _peek: () => (RUN && RUN.q) ? { answer: RUN.q.answer, prompt: RUN.q.prompt } : null };
})();
