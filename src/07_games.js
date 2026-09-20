/* ══════════════════════════════════════════════════════════════
   游戏乐园 · 「边玩边学」小游戏引擎
   ─ 🔴 2026-09-20 起：**进去就能玩，不设「学满才给玩」的门槛**。
     老曾拍板原话见 05_app.js 的 DEFAULT_GAME_CFG 注释：门槛原本是
     「学满 15 分钟奖励 10 分钟」，而二宝 3 岁半根本坐不住 15 分钟，
     余额永远是 0:00 —— 游戏乐园对他等于坏的。而且游戏本身就长在
     学习内容上，再锁一道逻辑不通。
     防沉迷改由两道**硬顶**兜底：①家长设的每天上限 ②单次进入上限。
   ─ 「边玩边学」范式（老曾定）：①开局有学习点（打地鼠前先数洞）
     ②游戏元素承载学习内容（地鼠头顶字/算式答案，打对的那只）
   ─ 依赖 window.HMBridge（05_app.js 末尾暴露）：
       sfx/beep/speak/toast/confetti/showScreen/KID/openGames
       cfg()/gameRemainSec()/spendGameSec(n)/hanziPool()
   ─ 五款：打地鼠 / 贪吃蛇 / 三消配对 / 方块消除 / 小恐龙跳跳
     （大宝走算式·汉字，二宝走数字·图形，两款档案都能玩）
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const B = () => window.HMBridge;                 // 运行时取桥，保证 app 已挂载
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* 数字的读音（二宝那套：方块、消消乐上写的是数字，拼音表里只有汉字）。
     两处都要用：方块消除的「先认字」面板、三消的读音定格。 */
  const NUM_PY = {
    '1': 'yī', '2': 'èr', '3': 'sān', '4': 'sì', '5': 'wǔ',
    '6': 'liù', '7': 'qī', '8': 'bā', '9': 'jiǔ', '10': 'shí'
  };
  const pyOfSay = (face, say) => NUM_PY[say] || NUM_PY[face] || say;

  /* ═══════════ 游戏内的速度档（贪吃蛇 / 打地鼠共用一套） ═══════════
     老曾 2026-09-20：「贪吃蛇目前的速度太快了，能不能加一个调速度的」
                 「打地鼠应该也要有可以调节速度的」。
     三档 + **记住选择**（存进 S.opts，跟进度一起进 localStorage，下次进来还是这一档）。
     cfg 里每档的 v 由游戏自己解释：蛇＝每步毫秒数，地鼠＝{pop: 冒头间隔, hide: 停留时长}。
     🔴 默认档**比原来慢**（原来蛇 260ms、地鼠 850/1900ms 对 3 岁半太快），
        而且二宝（3 岁半）默认「慢」、大宝默认「中」。 */
  function speedCtl(storeKey, cfg, defKey, onChange) {
    const b = B();
    const keys = Object.keys(cfg);
    const saved = b.opt(storeKey);
    let key = cfg[saved] ? saved : (cfg[defKey] ? defKey : keys[0]);
    const rowId = storeKey + '-row';
    return {
      get key() { return key; },
      get v() { return cfg[key].v; },
      get entry() { return cfg[key]; },
      html: '<div class="spd-row" id="' + rowId + '">' + keys.map(k =>
        '<button type="button" class="spd-btn' + (k === key ? ' on' : '') + '" data-k="' + k + '">' +
        cfg[k].ico + ' ' + cfg[k].name + '</button>').join('') + '</div>',
      bind() {
        const row = $(rowId);
        if (!row) return;
        const btns = [].slice.call(row.querySelectorAll('.spd-btn'));
        btns.forEach(el => {
          el.onclick = () => {
            if (!cfg[el.dataset.k] || el.dataset.k === key) return;
            key = el.dataset.k;
            b.opt(storeKey, key);                       // 记住选择
            btns.forEach(x => x.classList.toggle('on', x.dataset.k === key));
            b.sfx.tap();
            if (onChange) onChange(key, cfg[key].v);
          };
        });
      }
    };
  }

  /* 游戏清单：首页 / 游戏中心渲染用。kid = 适合的档案 */
  const GAMES = [
    { id: 'mole',   icon: '🔨', name: '打地鼠',     desc: '先数洞，再打对的地鼠',   kid: ['da', 'er'], tag: '数数·口算·认字' },
    { id: 'snake',  icon: '🐍', name: '贪吃蛇',     desc: '吃对答案才变长',         kid: ['da', 'er'], tag: '口算·认字' },
    { id: 'match3', icon: '💎', name: '三消配对',   desc: '同色连成三个就消掉',     kid: ['da', 'er'], tag: '认数·同音字' },
    { id: 'tetris', icon: '🧱', name: '方块消除',   desc: '方块上带着字，消行时读', kid: ['da', 'er'], tag: '认数·认字' },
    { id: 'dino',   icon: '🦖', name: '小恐龙跳跳', desc: '跳起来吃对的答案',       kid: ['da', 'er'], tag: '口算·认字' }
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

    /* 认字/备课阶段：先不扣时长。老曾要「玩之前先认这局的字」，那段时间不该算他玩掉了。 */
    let held = false;
    run.hold = () => { held = true; };
    run.resume = () => { held = false; };

    run.timer = setInterval(() => {
      if (held) return;                    // 备课/认字阶段不计时也不扣余额（见 run.hold）
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
      /* 速度档（老曾 2026-09-20：「打地鼠应该也要有可以调节速度的」
                         + 稍后「每个游戏都要可以调节速度的地方吧！最好随时都可以调节速度」）。
         原来是写死的：每 850ms 冒一只、1900ms 自己缩回 —— 对 3 岁半太快。
         慢档 1250/2600：地鼠停 2.6 秒，够他看清数字再打。**打着的时候也一直能改。** */
      const SPD = speedCtl('moleSpeed', {
        slow: { v: { pop: 1250, hide: 2600 }, ico: '🐢', name: '慢' },
        mid:  { v: { pop: 1000, hide: 2200 }, ico: '🚶', name: '中' },
        fast: { v: { pop: 850,  hide: 1900 }, ico: '🚀', name: '快' }
      }, kid === 'er' ? 'slow' : 'mid', () => restartPop());
      stage.innerHTML =
        '<div class="mole-play">' +
          '<div class="mole-ask" id="mole-q"></div>' +
          '<div class="mole-score">打对 <b class="g" id="mole-right">0</b> · 打错 <b class="r" id="mole-wrong">0</b></div>' +
          SPD.html +
          '<div class="mole-grid" id="mole-grid"></div>' +
        '</div>';
      SPD.bind();
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

      /* 冒地鼠：每 SPD.v.pop 毫秒找个空洞冒一只（速度档由孩子自己调）。
         🔴 场上「同时只允许一只」顶正确答案，其余一律是**不等于答案**的干扰项——
            否则大半地鼠都是对的，孩子乱打也能对，就白玩了（这是出题区分度的命门）。 */
      let pop = null;
      function popTick() {
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
        // 没被打中，过一会儿自己缩回（按当前速度档）
        h.auto = setTimeout(() => hide(h), SPD.v.hide);
      }
      function restartPop() { clearInterval(pop); pop = setInterval(popTick, SPD.v.pop); }
      restartPop();

      function hide(h) {
        clearTimeout(h.auto);
        h.mole.classList.remove('up', 'hit');
        h.mole.onclick = null;
        if (h.isAns) { ansUp = Math.max(0, ansUp - 1); h.isAns = false; }
        h.busy = false;
      }

      run.cleanup = () => { clearInterval(pop); holes.forEach(hide); };
      /* 测试探针：当前速度档（只读） */
      run.spd = () => ({ key: SPD.key, pop: SPD.v.pop, hide: SPD.v.hide });
    }
  }

  /* ─────────── 贪吃蛇（吃对的那个才变长） ─────────── */
  /* 学习承载：场上摆 4 个候选，只有吃到**正确答案**才变长得分；吃错扣一节 + 抖一下，
     题目不变，让他再找一次（不直接结束，3 岁半的孩子受不了）。
     撞墙从另一边钻出来（不挫败），撞到自己才结束——蛇只有 3 节，很难撞到。
     出题直接复用 moleQ：它给的 cands 正好就是 4 个候选。 */
  function snake(run, stage, finish) {
    const b = B();
    const kid = b.KID().id;
    const N = kid === 'er' ? 8 : 10;                 // 格子数：二宝格子大，好点好滑
    /* 速度档（老曾 2026-09-20：「贪吃蛇目前的速度太快了，能不能加一个调速度的」）。
       🔴 原来是固定 260ms 起步、每吃对一次 -12ms（下限 150），3 岁半的小孩根本反应不过来。
          现在三档可选，**默认比原来慢**，而且每档有自己的加速下限。
          「慢」460ms：从棋盘这头到那头约 3.7 秒，够小孩想。
       ⚠️ 必须**先建好**再拼 HTML —— stage.innerHTML 里用到了 SPD.html（踩过 TDZ）。 */
    const SPD = speedCtl('snakeSpeed', {
      slow: { v: 460, floor: 300, ico: '🐢', name: '慢' },
      mid:  { v: 340, floor: 230, ico: '🚶', name: '中' },
      fast: { v: 250, floor: 150, ico: '🚀', name: '快' }
    }, kid === 'er' ? 'slow' : 'mid', (k, v) => { speed = v; restart(); });
    stage.innerHTML =
      '<div class="sn-ask" id="sn-q"></div>' +
      '<div class="sn-score">吃到 <b class="g" id="sn-right">0</b> · 吃错 <b class="r" id="sn-wrong">0</b></div>' +
      SPD.html +
      '<canvas id="sn-canvas"></canvas>' +
      '<div class="sn-tip">手指在画面上滑动 · 指挥小蛇去吃对的答案</div>';
    SPD.bind();

    const cv = $('sn-canvas');
    const W = Math.max(180, Math.min(stage.clientWidth - 6, Math.round(window.innerHeight * 0.5)));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px'; cv.style.height = W + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const C = W / N;                                 // 一格多大

    const mid = Math.floor(N / 2);
    let body = [{ x: 2, y: mid }, { x: 1, y: mid }, { x: 0, y: mid }];
    let dir = { x: 1, y: 0 }, want = { x: 1, y: 0 };
    let foods = [], q = null, right = 0, wrong = 0, speed = SPD.v, hitAt = 0, timer = null;

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function placeFoods(cands) {
      const used = {};
      body.forEach(s => { used[s.x + ',' + s.y] = 1; });
      foods = [];
      cands.forEach(t => {
        let x = 0, y = 0, guard = 0;
        do { x = rnd(N); y = rnd(N); } while (used[x + ',' + y] && guard++ < 300);
        used[x + ',' + y] = 1;
        foods.push({ x: x, y: y, text: String(t) });
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, W);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          if ((x + y) % 2 === 0) { ctx.fillStyle = '#FFFDF9'; ctx.fillRect(x * C, y * C, C, C); }
        }
      }
      const shake = Date.now() < hitAt;
      foods.forEach(f => {
        const px = f.x * C, py = f.y * C;
        ctx.save();
        if (shake) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        ctx.fillStyle = '#FFE7D3';
        roundRect(px + 3, py + 3, C - 6, C - 6, C * 0.24); ctx.fill();
        ctx.fillStyle = '#A8481F';
        const digit = /[0-9]/.test(f.text.charAt(0));
        ctx.font = '900 ' + Math.round(C * (digit ? 0.52 : 0.44)) + 'px "PingFang SC","Heiti SC",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.text, px + C / 2, py + C / 2 + 1);
        ctx.restore();
      });
      /* 蛇身从尾往头画，头最后画（压在最上面） */
      for (let i = body.length - 1; i >= 0; i--) {
        const s = body[i];
        ctx.fillStyle = i === 0 ? '#FF7A59' : (i % 2 ? '#FFB03A' : '#FFCC7A');
        roundRect(s.x * C + 1.5, s.y * C + 1.5, C - 3, C - 3, C * 0.32); ctx.fill();
      }
      /* 眼睛：朝着行进方向看 */
      const h = body[0], cx = h.x * C + C / 2, cy = h.y * C + C / 2;
      const ex = dir.y !== 0 ? C * 0.17 : 0, ey = dir.x !== 0 ? C * 0.17 : 0;
      const fx = dir.x * C * 0.16, fy = dir.y * C * 0.16;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + fx + ex, cy + fy + ey, C * 0.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fx - ex, cy + fy - ey, C * 0.1, 0, 7); ctx.fill();
      ctx.fillStyle = '#2B2B2B';
      ctx.beginPath(); ctx.arc(cx + fx * 1.5 + ex, cy + fy * 1.5 + ey, C * 0.05, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fx * 1.5 - ex, cy + fy * 1.5 - ey, C * 0.05, 0, 7); ctx.fill();
    }

    function nextQ() {
      q = moleQ(kid);
      run.q = q;                                     // 只读测试探针（HMGames._peek）
      $('sn-q').innerHTML = q.prompt;
      b.speak(q.speak);
      placeFoods(q.cands);
      draw();
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(step, speed);
    }
    function step() {
      if (run.done || !q) return;
      if (!(want.x === -dir.x && want.y === -dir.y)) dir = want;   // 不许 180° 掉头
      const h = body[0];
      let nx = h.x + dir.x, ny = h.y + dir.y;
      if (nx < 0) nx = N - 1; else if (nx >= N) nx = 0;            // 撞墙从另一边出来
      if (ny < 0) ny = N - 1; else if (ny >= N) ny = 0;
      if (body.some((s, i) => i > 0 && s.x === nx && s.y === ny)) {
        finish('哎呀，小蛇咬到自己啦 —— 这次吃到 ' + right + ' 个');
        return;
      }
      const fi = foods.findIndex(f => f.x === nx && f.y === ny);
      if (fi >= 0 && foods[fi].text === q.answer) {                // 吃对了：变长 + 换题
        right++; $('sn-right').textContent = right;
        b.sfx.ok(); b.beep(1250, 0.08, 'sine', 0.1); b.confetti(8);
        body.unshift({ x: nx, y: ny });
        speed = Math.max(SPD.entry.floor, speed - 12);              // 越吃越快，但各档有自己的下限
        restart();
        nextQ();
        return;
      }
      if (fi >= 0) {                                               // 吃错了：扣一节，题不变
        wrong++; $('sn-wrong').textContent = wrong;
        b.sfx.no(); hitAt = Date.now() + 320;
        if (body.length > 3) body.pop();
        draw();
        return;
      }
      body.unshift({ x: nx, y: ny }); body.pop();
      draw();
    }

    /* 操作：手机滑动 + 电脑方向键/WASD */
    let sx = 0, sy = 0;
    function onDown(e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
    function onUp(e) {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;           // 太短当作没滑
      if (Math.abs(dx) > Math.abs(dy)) want = { x: dx > 0 ? 1 : -1, y: 0 };
      else want = { x: 0, y: dy > 0 ? 1 : -1 };
    }
    /* 滑完必须拦住页面滚动，否则手指一滑整页跟着动，蛇就不听使唤了 */
    function onMove(e) { if (e.cancelable) e.preventDefault(); }
    const KEYS = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 }
    };
    function onKey(e) {
      const m = KEYS[e.key];
      if (!m) return;
      want = m;
      if (e.preventDefault) e.preventDefault();
    }
    cv.addEventListener('touchstart', onDown, { passive: true });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onUp, { passive: true });
    document.addEventListener('keydown', onKey);

    run.cleanup = () => {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
    };

    /* 测试探针：让自动化脚本能把蛇**真的**引到正确答案那儿去（不是绕过玩法直接改分）。
       不带这个就只能靠随机撞食物，那种测试证明不了「吃对的会变长」。 */
   run.probe = () => ({
     len: body.length, right: right, wrong: wrong, speed: speed,
     spd: SPD.key,
      head: { x: body[0].x, y: body[0].y }, dir: { x: dir.x, y: dir.y },
      foods: foods.map(f => ({ x: f.x, y: f.y, text: f.text }))
    });
    run.steer = (x, y) => { want = { x: x, y: y }; };

    nextQ();
    restart();
  }

  /* ══════════ 第二批：老曾 2026-09-20 点名的另外三款 ══════════ */

  /* 画布上画圆角矩形（贪吃蛇里那份是它自己作用域内的，这里给新游戏共用一份） */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ─────────── 三消配对（消消乐） ─────────── */
  /* 学习承载：**同一个颜色 = 同一个组**。
       二宝：组就是数字 1~4，消掉的时候读出来（顺带认数）。
       大宝：组是**拼音**——一组里 2~3 个不同的字。颜色帮他找，但每消一次都把那个音读一遍，
             玩久了就记住「这些字同音」。诚实边界：它练的是「见字想音」的**眼熟**，
             不是听写，别指望玩这个就会写。
     三消规则本身是正宗的：相邻交换、连成 3 个以上才消、消完下落补新、连锁。 */
  function m3Groups() {
    const b = B();
    const COLORS = ['#FF7A59', '#FFB03A', '#4FC3A1', '#5AA9E6', '#B58BE0'];
    if (b.KID().id === 'er') {
      return [1, 2, 3, 4].map((n, i) => ({ color: COLORS[i], faces: [String(n)], say: String(n) }));
    }
    const byPy = {};
    b.hanziPool().forEach(w => { if (w && w.py && w.z) (byPy[w.py] = byPy[w.py] || []).push(w.z); });
    const keys = shuffle(Object.keys(byPy).filter(p => byPy[p].length >= 2));
    return keys.slice(0, 5).map((p, i) => ({ color: COLORS[i % 5], faces: byPy[p].slice(0, 3), say: p }));
  }

  function match3(run, stage, finish) {
    const b = B();
    const kid = b.KID().id;
    const N = kid === 'er' ? 6 : 8;                  // 二宝格子少，好认好点
    const G = m3Groups();
    stage.innerHTML =
      '<div class="m3-ask" id="m3-ask"></div>' +
      '<div class="m3-score">消掉 <b class="g" id="m3-score">0</b> 个</div>' +
      '<div class="m3-wrap" id="m3-wrap"></div>' +
      '<div class="m3-tip">点两个挨着的方块换位置 · 三个一样的连成一条就消掉</div>';
    const wrap = $('m3-wrap');
    const W = Math.max(180, Math.min(stage.clientWidth - 6, Math.round(window.innerHeight * 0.5)));
    const C = Math.floor(W / N);
    wrap.style.width = (C * N) + 'px';
    wrap.style.height = (C * N) + 'px';

    $('m3-ask').innerHTML = kid === 'er'
      ? '三个<b>一样的数字</b>连成一条就消掉'
      : '同一个<b>颜色</b>的字读同一个音，连成三个就消掉';

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let bd = new Array(N * N).fill(null);
    let score = 0, busy = false, sel = null, over = false;
    const at = (x, y) => (x >= 0 && x < N && y >= 0 && y < N) ? bd[y * N + x] : null;

    function styleTile(t) {
      const grp = G[t.g];
      t.el.style.background = grp.color;
      t.face = pick(grp.faces);
      t.el.textContent = t.face;
    }
    function newTile(g, x, y, startY) {
      const el = document.createElement('div');
      el.className = 'm3-tile';
      el.style.width = el.style.height = (C - 8) + 'px';
      el.style.lineHeight = (C - 8) + 'px';
      el.style.fontSize = Math.round(C * 0.46) + 'px';
      wrap.appendChild(el);
      const t = { g: g, el: el };
      styleTile(t);
      el.style.left = (x * C + 4) + 'px';
      el.style.top = ((startY === undefined ? y : startY) * C + 4) + 'px';
      return t;
    }
    const place = (t, x, y) => { t.el.style.left = (x * C + 4) + 'px'; t.el.style.top = (y * C + 4) + 'px'; };

    /* 开局摆盘：不许一上来就有三连（否则白白自消一波） */
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let g = 0, guard = 0;
      do { g = rnd(G.length); } while (guard++ < 60 && (
        (x >= 2 && at(x - 1, y) && at(x - 2, y) && at(x - 1, y).g === g && at(x - 2, y).g === g) ||
        (y >= 2 && at(x, y - 1) && at(x, y - 2) && at(x, y - 1).g === g && at(x, y - 2).g === g)));
      bd[y * N + x] = newTile(g, x, y);
    }

    /* 找出场上所有「三个以上连成一条」的格子（横竖各扫一遍） */
    function matches() {
      const hit = new Set();
      for (let y = 0; y < N; y++) {
        let run = 1;
        for (let x = 1; x <= N; x++) {
          const same = x < N && at(x, y) && at(x - 1, y) && at(x, y).g === at(x - 1, y).g;
          if (same) run++;
          else { if (run >= 3) for (let k = x - run; k < x; k++) hit.add(y * N + k); run = 1; }
        }
      }
      for (let x = 0; x < N; x++) {
        let run = 1;
        for (let y = 1; y <= N; y++) {
          const same = y < N && at(x, y) && at(x, y - 1) && at(x, y).g === at(x, y - 1).g;
          if (same) run++;
          else { if (run >= 3) for (let k = y - run; k < y; k++) hit.add(k * N + x); run = 1; }
        }
      }
      return hit;
    }
    /* 有没有能消的一步？没有就得洗牌，否则孩子对着死局白点（用真 matcher 试，不另写一套） */
    function findMove() {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
          const x2 = x + d.x, y2 = y + d.y;
          const a = at(x, y), c = at(x2, y2);
          if (!a || !c || a.g === c.g) continue;
          bd[y * N + x] = c; bd[y2 * N + x2] = a;
          const okMove = matches().size > 0;
          bd[y * N + x] = a; bd[y2 * N + x2] = c;
          if (okMove) return [x, y, x2, y2];
        }
      }
      return null;
    }
    function swapCells(x1, y1, x2, y2) {
      const a = at(x1, y1), c = at(x2, y2);
      bd[y1 * N + x1] = c; bd[y2 * N + x2] = a;
      place(a, x2, y2); place(c, x1, y1);
    }

    /* 消除 → 下落 → 补新 → 再查（连锁），一路走到底 */
    async function resolve() {
      /* 🔴 老曾 2026-09-20：「三消配对有时候连着消除之后，读音能不能定格一定的时候，
         这样方便小朋友有记忆的时间」。
         原来的毛病：每消一步就喊一句（`b.speak`），而连锁的每一步只隔 ~480ms，
         speak 会把上一句掐掉 —— 孩子听到的是零碎的音，字也没看清。
         现在改成：**整条链走完之后**把这一串读音一次性"定格"出来，
         一个字一个字地读，每个字在屏幕上停够 hold 毫秒，读完才放开手让下一手。 */
      const held = [];                       // [{face, say}] 整条链上消掉过的组（去重、保序）
      for (let guard = 0; guard < 40 && !run.done && !over; guard++) {
        const hit = matches();
        if (!hit.size) break;
        hit.forEach(i => {
          const t = bd[i];
          if (!t) return;
          if (held.some(x => x.say === G[t.g].say)) return;
          held.push({ face: (G[t.g].faces || [])[0] || '', say: G[t.g].say });
        });
        score += hit.size;
        $('m3-score').textContent = score;
        b.sfx.ok(); b.beep(1150, 0.08, 'sine', 0.1); b.confetti(6);
        hit.forEach(i => { if (bd[i]) bd[i].el.classList.add('pop'); });
        await sleep(240);
        hit.forEach(i => { if (bd[i]) { bd[i].el.remove(); bd[i] = null; } });
        for (let x = 0; x < N; x++) {
          let write = N - 1;
          for (let y = N - 1; y >= 0; y--) {
            const t = at(x, y);
            if (!t) continue;
            if (write !== y) { bd[write * N + x] = t; bd[y * N + x] = null; place(t, x, write); }
            write--;
          }
          const need = write + 1;
          for (let y = write; y >= 0; y--) {
            const t = newTile(rnd(G.length), x, y, y - need);
            bd[y * N + x] = t;
            t.el.offsetHeight;                       // 强制一次重排，保证下落有过渡
            place(t, x, y);
          }
        }
        await sleep(240);
      }
      /* 定格：把这一串读音慢慢过一遍（每个字停够时间 + 屏幕上大字写着） */
      if (held.length && !run.done && !over) {
        $('m3-ask').innerHTML = '🔊 读作 <b>' + held.map(x => x.say).join(' · ') + '</b>';
        await holdReading(held);
      }
      /* 死局：洗一遍再消（洗的是同一批方块，不改变难度） */
      if (!run.done && !over && !findMove()) {
        b.toast('没有能消的啦，重新洗一下～');
        bd.forEach(t => { if (t) { t.g = rnd(G.length); styleTile(t); } });
        await sleep(140);
        await resolve();
      }
    }

    /* 把刚消掉的字一个个"定格"给孩子看：大字 + 拼音，读一个停一会儿。
       停多久：每个字 1.2~1.8 秒（字多的链按 4.2 秒总预算摊，别让孩子等太久）。 */
    async function holdReading(list) {
      const per = Math.min(1800, Math.max(1200, Math.round(4200 / list.length)));
      const wrap = $('m3-wrap');
      let box = document.getElementById('m3-hold');
      if (!box) {
        box = document.createElement('div');
        box.id = 'm3-hold'; box.className = 'm3-hold';
        wrap.appendChild(box);
      }
      for (let i = 0; i < list.length; i++) {
        if (run.done || over) break;
        box.innerHTML =
          '<div class="m3-hold-tt">刚才消掉的 · 读一遍</div>' +
          '<div class="m3-hold-big">' + (list[i].face || '') + '<i>' + pyOfSay(list[i].face, list[i].say) + '</i></div>' +
          '<div class="m3-hold-dots">' + list.map((_, k) => k === i ? '●' : '○').join(' ') + '</div>';
        b.speak(list[i].say);
        await sleep(per);
      }
      box.remove();
    }

    async function onTap(el) {
      if (busy || over || run.done) return;
      const i = bd.findIndex(t => t && t.el === el);
      if (i < 0) return;
      const x = i % N, y = (i - x) / N;
      if (!sel) { sel = { x: x, y: y }; el.classList.add('sel'); b.sfx.tap(); return; }
      if (sel.x === x && sel.y === y) { el.classList.remove('sel'); sel = null; return; }
      if (Math.abs(sel.x - x) + Math.abs(sel.y - y) !== 1) {       // 不挨着：改选这个
        const old = at(sel.x, sel.y); if (old) old.el.classList.remove('sel');
        sel = { x: x, y: y }; el.classList.add('sel'); b.sfx.tap(); return;
      }
      const p = sel; sel = null;
      const pEl = at(p.x, p.y) ? at(p.x, p.y).el : null;
      if (pEl) pEl.classList.remove('sel');
      busy = true;
      swapCells(p.x, p.y, x, y);
      await sleep(200);
      if (!matches().size) {                                       // 换了也凑不成，换回去
        swapCells(p.x, p.y, x, y);
        b.sfx.no();
        await sleep(200);
      } else {
        await resolve();
      }
      busy = false;
    }
    function onClick(e) {
      const t = e.target.closest && e.target.closest('.m3-tile');
      if (t) onTap(t);
    }
    wrap.addEventListener('click', onClick);
    run.cleanup = () => { over = true; wrap.removeEventListener('click', onClick); };

    /* 测试探针：只读盘面；提示那一步用**真 matcher** 算，测试照着提示点真方块 */
    run.probe = () => ({ n: N, groups: G.length, score: score, board: bd.map(t => t ? t.g : -1) });
    run.hint = () => findMove();
  }

  /* ─────────── 方块消除（俄罗斯方块） ─────────── */
  /* 学习承载：一整块方块从头到尾带**同一个字/数字**（4 个格子写着同一个，颜色也跟着它走），
     消掉一行时把这一行消掉的字读一遍。
     诚实边界：这是「反复看见」式的眼熟，**不是考核**——别说成「玩这个就能认字」。
     二宝：方块上是数字 1~7；大宝：方块上是随机抽的 7 个二年级生字。 */
  function tetris(run, stage, finish) {
    const b = B();
    const kid = b.KID().id;
    const COLS = kid === 'er' ? 8 : 10, ROWS = kid === 'er' ? 14 : 16;
    const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const COLORS = ['#FF7A59', '#FFB03A', '#4FC3A1', '#5AA9E6', '#B58BE0', '#F06292', '#7BC96F'];
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
      T: [[0, 0, 0, 0], [0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0]],
      S: [[0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
      Z: [[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
      J: [[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0]],
      L: [[0, 0, 0, 0], [0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0]]
    };
    const FACES = kid === 'er'
      ? ['1', '2', '3', '4', '5', '6', '7']
      : shuffle(b.hanziPool().slice()).slice(0, 7).map(w => w.z);

    /* 速度档（老曾 2026-09-20：「每个游戏都要可以调节速度的地方吧！最好随时都可以调节速度」）。
       这里调的是方块**下落**的快慢（原来固定 720ms 一格，每消 8 行再自己快一档）。
       行内一直摆着，孩子玩着觉得跟不上就随手换。 */
    const TTSPD = speedCtl('tetrisSpeed', {
      slow: { v: 900, floor: 560, ico: '🐢', name: '慢' },
      mid:  { v: 720, floor: 420, ico: '🚶', name: '中' },
      fast: { v: 520, floor: 240, ico: '🚀', name: '快' }
    }, kid === 'er' ? 'slow' : 'mid', (k, v) => { speed = v; restart(); });

    stage.innerHTML =
      '<div class="tt-score">消掉 <b class="g" id="tt-lines">0</b> 行 · 这局方块上的字：<b id="tt-faces"></b></div>' +
      '<canvas id="tt-canvas"></canvas>' +
      TTSPD.html +
      '<div class="tt-pad">' +
        '<button type="button" class="btn ghost tt-btn" id="tt-l">◀</button>' +
        '<button type="button" class="btn ghost tt-btn" id="tt-rot">↻</button>' +
        '<button type="button" class="btn ghost tt-btn" id="tt-r">▶</button>' +
        '<button type="button" class="btn ghost tt-btn" id="tt-dn">▼</button>' +
      '</div>' +
      '<div class="tt-tip">也可以滑画面：左右滑移动 · 上滑转一下 · 下滑快点落</div>';
    TTSPD.bind();
    $('tt-faces').textContent = FACES.join(' ');

    const maxW = Math.max(160, stage.clientWidth - 6);
    const maxH = Math.round(window.innerHeight * 0.46);
    const C = Math.max(12, Math.floor(Math.min(maxW / COLS, maxH / ROWS)));
    const W = C * COLS, H = C * ROWS;
    const cv = $('tt-canvas');
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    let g = new Array(COLS * ROWS).fill(-1);        // -1 = 空；否则是方块类型下标
    let cur = null, lines = 0, speed = TTSPD.v, timer = null, dead = false;
    const gi = (x, y) => y * COLS + x;
    const rot = m => m.map((r, i) => r.map((_, j) => m[j][3 - i]));

    function collide(m, px, py) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (!m[i][j]) continue;
        const x = px + j, y = py + i;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && g[gi(x, y)] >= 0) return true;
      }
      return false;
    }
    function cell(x, y, t) {
      const px = x * C, py = y * C;
      ctx.fillStyle = COLORS[t];
      rr(ctx, px + 1, py + 1, C - 2, C - 2, C * 0.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.font = '900 ' + Math.round(C * 0.54) + 'px "PingFang SC","Heiti SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(FACES[t], px + C / 2, py + C / 2 + 1);
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#FFF8F1'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#F4E5D8'; ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * C, 0); ctx.lineTo(x * C, H); ctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * C); ctx.lineTo(W, y * C); ctx.stroke(); }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[gi(x, y)] >= 0) cell(x, y, g[gi(x, y)]);
      if (cur) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (cur.m[i][j] && cur.y + i >= 0) cell(cur.x + j, cur.y + i, cur.t);
    }
    function newPiece() {
      const t = rnd(TYPES.length);
      cur = { t: t, m: SHAPES[TYPES[t]].map(r => r.slice()), x: Math.floor((COLS - 4) / 2), y: 0 };
      if (collide(cur.m, cur.x, cur.y)) { finish('方块堆到顶啦，这局消了 ' + lines + ' 行'); return false; }
      return true;
    }
    function clearLines() {
      let n = 0, said = [];
      let y = ROWS - 1;
      while (y >= 0) {
        let full = true;
        for (let x = 0; x < COLS; x++) if (g[gi(x, y)] < 0) { full = false; break; }
        if (!full) { y--; continue; }
        for (let x = 0; x < COLS; x++) { const f = FACES[g[gi(x, y)]]; if (said.indexOf(f) < 0) said.push(f); }
        g.splice(y * COLS, COLS);
        for (let k = 0; k < COLS; k++) g.unshift(-1);
        n++;                                        // 🔴 消掉一行后上面的行会落下来，y 不能减
      }
      if (!n) return;
      lines += n;
      $('tt-lines').textContent = lines;
      b.sfx.ok(); b.beep(900 + n * 160, 0.14, 'triangle', 0.12); b.confetti(10 + n * 6);
      b.speak(said.join('，') + (n > 1 ? '，消了 ' + n + ' 行' : ''));
      if (lines % 8 === 0) speed = Math.max(TTSPD.entry.floor, speed - 90);   // 越消越快，但受当前档位的下限管着
    }
    function lock() {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (cur.m[i][j] && cur.y + i >= 0) g[gi(cur.x + j, cur.y + i)] = cur.t;
      }
      cur = null;
      clearLines();
      if (!newPiece()) return;
      restart();
      draw();
    }
    function tick() {
      if (dead || run.done || !cur) return;
      if (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; draw(); }
      else lock();
    }
    function restart() { clearInterval(timer); timer = setInterval(tick, speed); }

    function move(dx) {
      if (dead || !cur) return;
      if (!collide(cur.m, cur.x + dx, cur.y)) { cur.x += dx; draw(); b.sfx.tap(); }
    }
    function turn() {
      if (dead || !cur) return;
      const r = rot(cur.m);
      for (const k of [0, -1, 1, -2, 2]) {          // 贴着墙转不过去就挤一下（不然孩子以为坏了）
        if (!collide(r, cur.x + k, cur.y)) { cur.m = r; cur.x += k; draw(); b.sfx.tap(); return; }
      }
    }
    function down() {
      if (dead || !cur) return;
      if (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; draw(); } else lock();
    }
    function hardDrop() {
      if (dead || !cur) return;
      while (!collide(cur.m, cur.x, cur.y + 1)) cur.y++;
      lock();
    }

    $('tt-l').onclick = () => move(-1);
    $('tt-r').onclick = () => move(1);
    $('tt-rot').onclick = turn;
    $('tt-dn').onclick = hardDrop;

    let sx = 0, sy = 0;
    const onDown = e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onMove = e => { if (e.cancelable) e.preventDefault(); };
    const onUp = e => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy > 0) hardDrop(); else turn();
    };
    cv.addEventListener('touchstart', onDown, { passive: true });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onUp, { passive: true });
    const KEYS = { ArrowLeft: -1, ArrowRight: 1 };
    const onKey = e => {
      if (KEYS[e.key] !== undefined) { move(KEYS[e.key]); if (e.preventDefault) e.preventDefault(); }
      else if (e.key === 'ArrowUp') { turn(); if (e.preventDefault) e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === ' ') { hardDrop(); if (e.preventDefault) e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);

    run.cleanup = () => { dead = true; clearInterval(timer); document.removeEventListener('keydown', onKey); };

    run.probe = () => ({
      cols: COLS, rows: ROWS, lines: lines,
      grid: g.slice(),
      cur: cur ? { t: cur.t, x: cur.x, y: cur.y, m: cur.m.map(r => r.slice()) } : null,
      faces: FACES.slice(),
      speed: speed, spd: TTSPD.key
    });
    run.act = what => {
      if (what === 'left') move(-1); else if (what === 'right') move(1);
      else if (what === 'rot') turn(); else if (what === 'down') down(); else if (what === 'drop') hardDrop();
    };
    /* 测试夹具：摆盘面 / 指定当前方块。
       🔴 这是**布置输入**，不是绕过断言——那几行消掉仍然走真实的 lock → clearLines。 */
    run.setCell = (x, y, t) => { g[gi(x, y)] = t; draw(); };
    run.clearBoard = () => { g = new Array(COLS * ROWS).fill(-1); draw(); };
    run.setPiece = (t, x, y, rotN) => {
      let m = SHAPES[TYPES[t]].map(r => r.slice());
      for (let k = 0; k < (rotN || 0); k++) m = rot(m);
      cur = { t: t, m: m, x: x, y: y };
      draw();
    };

    draw();                                     // 空盘先画好（此刻被认字面板盖住）

    /* ═══ 先认字再玩（老曾 2026-09-20）═══
       原话：「玩游戏前要先学习这局方块上方的文字才能玩，而且要加，
              可以点触之后有拼音和朗读，这样他们不认识的字可以看拼音」。
       做法：开局用一块面板**盖住**棋盘，把这局要用的每个字/数字列出来，每个点一下——
         · 汉字走 App 自己的「点字注音」：点一下 → 拼音气泡 + 朗读（不另抄一套读音）；
         · 二宝的数字没有拼音表，这里自己念，并把读音（yī/èr/sān…）印在卡片上。
       认全了「开始玩」才亮。认字这段时间**不计游戏时长**（run.hold）。
       ⚠️ 是「盖住」不是「藏起来」：这样底下的按钮点不到、分也刷不了，
          而方块那套逻辑一行都不用挪。 */
    if (run.hold) run.hold();
    const isHan = kid !== 'er';
    const PY = isHan ? FACES.map(z => b.hanziPy(z)) : FACES.map(f => pyOfSay(f, f));
    const learned = {};
    const panel = document.createElement('div');
    panel.className = 'tt-prep';
    panel.innerHTML =
      '<div class="tt-prep-tt">' + (isHan ? '先认一认这局的字' : '先认一认这局的数') + '</div>' +
      '<div class="tt-prep-sub">每个都点一下，听听怎么念</div>' +
      '<div class="tt-learn-row">' +
        FACES.map((f, i) =>
          '<div class="tt-learn" data-i="' + i + '"><b>' + f + '</b><i>' + (PY[i] || '') + '</i><span class="ck">✓</span></div>').join('') +
      '</div>' +
      '<div class="tt-prep-hint" id="tt-hint"></div>' +
      '<button type="button" class="btn primary" id="tt-start" disabled>开始玩 ▶</button>';
    stage.appendChild(panel);
    let allDone = false;
    function renderPrep() {
      const left = FACES.length - Object.keys(learned).length;
      $('tt-hint').textContent = left ? '还要认 ' + left + ' 个' : '🎉 认全啦，开始玩吧！';
      $('tt-start').disabled = left > 0;
      if (!left && !allDone) { allDone = true; b.confetti(14); b.sfx.ok(); }
    }
    renderPrep();
    [].slice.call(panel.querySelectorAll('.tt-learn')).forEach(card => {
      card.onclick = () => {
        const i = +card.dataset.i;
        const face = card.querySelector('b');
        /* 点一下 = 弹拼音气泡 + 念出来（游戏屏关着全局点字注音，这里显式喊一声）。
           数字也带上读音（1 → yī），孩子一样能看到拼音。 */
        b.pyTap(FACES[i], face, PY[i]);
        if (learned[i]) return;                    // 认过的再点：只再听一遍
        learned[i] = 1;
        card.classList.add('on');
        renderPrep();
      };
    });
    $('tt-start').onclick = () => {
      if (Object.keys(learned).length < FACES.length) return;
      if (run.resume) run.resume();
      panel.remove();
      newPiece();
      draw();
      restart();
      b.sfx.ok();
    };
  }

  /* ─────────── 小恐龙跳跳（超级玛丽的替代） ─────────── */
  /* 学习承载：**跳起来吃对的答案**。
     一道题出 3 个候选，一个一个从右边飘过来（不是一起摆三个——
     一起摆的话孩子一跳就全撞上了，等于没得选）。颜色完全一样，不给任何提示，
     必须自己读。吃到对的 +1 换新题；撞到错的扣一颗心，5 颗心用完就收工。
     地面上不设纯障碍物：这个年纪「躲石头」和「读数字」同时来会直接放弃。 */
  function dino(run, stage, finish) {
    const b = B();
    const kid = b.KID().id;
    /* 速度档（老曾 2026-09-20：「每个游戏都要可以调节速度的地方吧！最好随时都可以调节速度」）。
       这里调的是**世界滚动的快慢**（原来固定 3.0 像素/帧 ≈ 每秒 180 像素）。
       行内一直摆着，跳着也能随手换档。⚠️ 先建好再拼 HTML（stage.innerHTML 里用到 DSPD.html）。 */
    const DSPD = speedCtl('dinoSpeed', {
      slow: { v: 2.2, ico: '🐢', name: '慢' },
      mid:  { v: 3.0, ico: '🚶', name: '中' },
      fast: { v: 4.2, ico: '🚀', name: '快' }
    }, kid === 'er' ? 'slow' : 'mid', (k, v) => { SPD = v; });
    stage.innerHTML =
      '<div class="dn-ask" id="dn-q"></div>' +
      '<div class="dn-score">吃到 <b class="g" id="dn-right">0</b> · 撞错 <b class="r" id="dn-wrong">0</b></div>' +
      DSPD.html +
      '<canvas id="dn-canvas"></canvas>' +
      '<div class="dn-tip">点画面（或按空格）跳一下 · 跳起来吃对的答案，别撞错的</div>';
    DSPD.bind();
    const cv = $('dn-canvas');
    const W = Math.max(220, Math.min(stage.clientWidth - 6, Math.round(window.innerHeight * 0.62)));
    const H = Math.max(180, Math.round(W * 0.55));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const GY = H - 46;                              // 地面线
    const DX = Math.round(W * 0.16);                // 小恐龙固定的横向位置
    const DW = 34, DH = 30;
    const BY = GY - 96;                             // 气球中心的高度：跳到最高点正好够着
    const R = 22;
    let SPD = DSPD.v;                               // 世界滚动速度（像素/帧），可由速度档随时改
    const GRAV = 0.9, JUMPV = -13.2;

    let dy = 0, vy = 0, onGround = true, scroll = 0;
    let balloons = [], q = null, queue = [], gap = 40;
    let right = 0, wrong = 0, hearts = 5, over = false, timer = null, shake = 0;

    function jump() {
      if (over || run.done || !onGround) return;
      vy = JUMPV; onGround = false;
      b.sfx.tap(); b.beep(760, 0.07, 'square', 0.08);
    }
    function nextQ() {
      q = moleQ(kid);
      run.q = q;
      $('dn-q').innerHTML = q.prompt;
      b.speak(q.speak);
      queue = shuffle(q.cands.map(c => ({ text: c, ok: c === q.answer })));
      gap = 40;
    }
    function step() {
      if (over || run.done) return;
      scroll += SPD;
      if (!onGround) {
        vy += GRAV; dy += vy;
        if (dy >= 0) { dy = 0; vy = 0; onGround = true; }
      }
      if (shake > 0) shake--;

      if (gap-- <= 0 && queue.length) {
        const c = queue.shift();
        balloons.push({ x: W + 30, text: c.text, ok: c.ok, dead: false });
        gap = 132;                                  // 两个气球之间拉开约 400px，够他读
      }
      balloons.forEach(o => { if (!o.dead) o.x -= SPD; });

      /* 碰撞：恐龙的方框和气球的方框有没有碰到 */
      const dx1 = DX, dy1 = GY - DH + dy, dx2 = DX + DW, dy2 = GY + dy;
      balloons.forEach(o => {
        if (o.dead || o.x + R < dx1 || o.x - R > dx2) return;
        if (BY + R < dy1 || BY - R > dy2) return;
        o.dead = true;
        if (o.ok) {
          right++; $('dn-right').textContent = right;
          b.sfx.ok(); b.beep(1350, 0.09, 'sine', 0.11); b.confetti(8);
          queue = [];                               // 这题的另外两个不放了，直接下一题
          balloons.forEach(z => { z.dead = true; });
          setTimeout(() => { if (!over && !run.done) nextQ(); }, 320);
        } else {
          wrong++; $('dn-wrong').textContent = wrong;
          hearts--; shake = 18;
          b.sfx.no(); b.beep(220, 0.16, 'sawtooth', 0.1);
          if (hearts <= 0) { finish('小恐龙没力气啦，这局吃到 ' + right + ' 个'); return; }
        }
      });
      balloons = balloons.filter(o => !o.dead && o.x > -R - 4);
      if (!queue.length && !balloons.length && !run.done && !over) nextQ();
      draw();
    }
    function draw() {
      const sx = shake > 0 ? (Math.random() - 0.5) * 7 : 0;
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#DCEFFF'); sky.addColorStop(1, '#FFF6EA');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      /* 远处飘过的云，让「在跑」这件事看得见 */
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 3; i++) {
        const cx = W - ((scroll * 0.35 + i * 150) % (W + 120)) + 40;
        ctx.beginPath(); ctx.arc(cx, 26 + i * 12, 13, 0, 7); ctx.arc(cx + 14, 26 + i * 12, 10, 0, 7); ctx.fill();
      }
      ctx.save();
      ctx.translate(sx, 0);
      /* 地面 + 跑动的短线 */
      ctx.fillStyle = '#E8D3BF'; ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = '#C9A98C'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
      ctx.strokeStyle = '#D8BCA3'; ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const x = W - ((scroll + i * 46) % (W + 60));
        ctx.beginPath(); ctx.moveTo(x, GY + 16); ctx.lineTo(x + 18, GY + 16); ctx.stroke();
      }
      /* 小恐龙 */
      const by = GY - DH + dy;
      ctx.fillStyle = '#4FC3A1';
      rr(ctx, DX, by + 8, DW, DH - 8, 8); ctx.fill();
      ctx.fillStyle = '#3FA98A';
      rr(ctx, DX + 6, by - 4, DW - 6, 16, 7); ctx.fill();          // 头
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(DX + DW - 8, by + 2, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#2B2B2B';
      ctx.beginPath(); ctx.arc(DX + DW - 7, by + 2, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#3FA98A';
      const leg = onGround ? Math.sin(scroll / 6) * 3 : 0;         // 跑起来腿在摆
      rr(ctx, DX + 4, GY - 8 + leg, 9, 8 - leg, 3); ctx.fill();
      rr(ctx, DX + 19, GY - 8 - leg, 9, 8 + leg, 3); ctx.fill();
      /* 气球：一律同一个样子，不许用颜色暗示哪个是对的 */
      balloons.forEach(o => {
        if (o.dead) return;
        ctx.strokeStyle = '#C9A98C'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(o.x, BY + R); ctx.lineTo(o.x, BY + R + 16); ctx.stroke();
        ctx.fillStyle = '#FFB03A';
        ctx.beginPath(); ctx.arc(o.x, BY, R, 0, 7); ctx.fill();
        ctx.fillStyle = '#FFF3E0';
        ctx.beginPath(); ctx.arc(o.x, BY, R - 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#8A4B14';
        ctx.font = '900 ' + (String(o.text).length > 1 ? 17 : 22) + 'px "PingFang SC","Heiti SC",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(o.text), o.x, BY + 1);
      });
      ctx.restore();
      /* 心 */
      ctx.font = '16px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      let hs = '';
      for (let i = 0; i < hearts; i++) hs += '❤️';
      ctx.fillText(hs, 8, 8);
    }

    cv.addEventListener('pointerdown', e => { if (e.cancelable) e.preventDefault(); jump(); });
    const onKey = e => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { jump(); if (e.preventDefault) e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    run.cleanup = () => { over = true; clearInterval(timer); document.removeEventListener('keydown', onKey); };

    run.probe = () => ({
      dx: DX, dw: DW, dy: dy, onGround: onGround, by: BY, r: R, w: W, speed: SPD,
      hearts: hearts, right: right, wrong: wrong,
      balloons: balloons.filter(o => !o.dead).map(o => ({ x: o.x, text: o.text, ok: o.ok }))
    });
    run.act = what => { if (what === 'jump') jump(); };

    nextQ();
    timer = setInterval(step, 16);
  }

  /* ─────────── 对外入口 ─────────── */
  function launch(id) {
    const b = B();
    const g = GAMES.find(x => x.id === id);
    if (!g) return;
    if (!g.kid.includes(b.KID().id)) { b.toast('这个游戏适合' + (b.KID().id === 'er' ? '哥哥' : '弟弟') + '玩哦'); return; }
    if (b.gameRemainSec() <= 0) { b.toast('今天玩够 ' + b.cfg().dailyCapMin + ' 分钟啦，明天再来！'); b.sfx.no(); return; }
    if (id === 'mole') shell('🔨 打地鼠', mole);
    else if (id === 'snake') shell('🐍 贪吃蛇', snake);
    else if (id === 'match3') shell('💎 三消配对', match3);
    else if (id === 'tetris') shell('🧱 方块消除', tetris);
    else if (id === 'dino') shell('🦖 小恐龙跳跳', dino);
  }

  /* 测试面：只读探针 + 驱动真玩法用的那几个动作。
     🔴 这里**不许**出现「直接把分改高」「直接把行消掉」这种口子——
        测试要验的正是那些动作本身，绕过去就等于自己验自己。 */
  window.HMGames = {
    GAMES, launch, fmt,
    _peek: () => (RUN && RUN.q) ? { answer: RUN.q.answer, prompt: RUN.q.prompt } : null,
    _probe: () => (RUN && RUN.probe) ? RUN.probe() : null,
    _steer: (x, y) => { if (RUN && RUN.steer) RUN.steer(x, y); },
    _hint: () => (RUN && RUN.hint) ? RUN.hint() : null,
    _act: what => { if (RUN && RUN.act) RUN.act(what); },
    _clearBoard: () => { if (RUN && RUN.clearBoard) RUN.clearBoard(); },
    _setCell: (x, y, t) => { if (RUN && RUN.setCell) RUN.setCell(x, y, t); },
    _setPiece: (t, x, y, rotN) => { if (RUN && RUN.setPiece) RUN.setPiece(t, x, y, rotN); }
    ,_spd: () => (RUN && RUN.spd) ? RUN.spd() : null      // 当前速度档（只读，给测试用）
  };
})();
