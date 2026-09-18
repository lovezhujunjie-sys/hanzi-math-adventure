/* ══════════════════════════════════════════════════════════════
   汉字数学大冒险 · 主逻辑
   数据层（进度/星星/打卡）和界面层都在这里，通过 localStorage 持久化。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── 常量 ─────────── */
  const LS = 'hm_state_v1';
  const KIDS = {
    da: { id: 'da', name: '曾麟轩', av: '🧒', tag: '小学二年级', lv: 'da' },
    er: { id: 'er', name: '曾强',   av: '👶', tag: '幼儿园小班 · 3岁半', lv: 'er' }
  };
  const STUDY_SCREENS = ['screen-learn', 'screen-quiz', 'screen-timed', 'screen-mul', 'screen-trace'];

  /* ─────────── 状态 ─────────── */
  function blankProfile() {
    return {
      stars: 0, totalPlays: 0, perfectCount: 0, mulPassed: 0, hanziLearned: 0,
      days: {},                    // 'YYYY-MM-DD' → 学习秒数
      lastDay: '',
      levelStars: {},              // 关卡id → 历史最高星
      hanziSeen: {},               // 认过的字
      mulDone: {},                 // 背熟的乘法口诀 key
      wrong: [],                   // 错题本 [{q,a,why,t}]
      stats: {}                    // 关卡id → {right,total}
    };
  }
  function blankState() {
    return { cur: null, goal: 20, rate: 1, profiles: { da: blankProfile(), er: blankProfile() } };
  }
  let S = blankState();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS) || 'null');
      if (raw && raw.profiles) {
        S = Object.assign(blankState(), raw);
        ['da', 'er'].forEach(k => { S.profiles[k] = Object.assign(blankProfile(), S.profiles[k] || {}); });
      }
    } catch (e) { /* 存档坏了就从零开始，不能白屏 */ }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
  const ME = () => S.profiles[S.cur] || blankProfile();
  const KID = () => KIDS[S.cur] || KIDS.da;

  /* ─────────── 日期 / 打卡 ─────────── */
  const dayKey = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); };
  function todaySec() { return ME().days[dayKey()] || 0; }
  function touchDay() {
    const p = ME(), k = dayKey();
    if (p.lastDay !== k) { p.lastDay = k; save(); }
  }
  function streak() {
    const p = ME(); let n = 0; const d = new Date();
    for (let i = 0; i < 400; i++) {
      const k = dayKey(d);
      if ((p.days[k] || 0) >= 60) { n++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }     // 今天还没学，不算断
      else break;
    }
    return n;
  }
  function addSec(n) {
    const p = ME(), k = dayKey();
    p.days[k] = (p.days[k] || 0) + n;
    p.lastDay = k;
    save();
  }

  /* ─────────── 声音 ─────────── */
  let VOICE = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices() || [];
    const zh = vs.filter(v => /zh|cmn|Chinese/i.test(v.lang + ' ' + v.name));
    if (!zh.length) return;
    const best = ['Tingting', '婷婷', 'Ting-Ting', 'Xiaoxiao', '晓晓', 'Meijia', 'Sinji', 'Yaoyao']
      .map(n => zh.find(v => v.name.includes(n))).find(Boolean);
    VOICE = best || zh.find(v => /zh[-_]CN/i.test(v.lang)) || zh[0];
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, rate) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'zh-CN'; if (VOICE) u.voice = VOICE;
      u.rate = rate || S.rate || 1;
      u.pitch = 1.05;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* 音效：Web Audio 现场合成，零文件 */
  let AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function beep(freq, dur, type, vol, delay) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const sfx = {
    ok()  { beep(880, 0.12, 'sine', 0.14); beep(1320, 0.16, 'sine', 0.12, 0.09); },
    no()  { beep(240, 0.18, 'sawtooth', 0.10); beep(180, 0.22, 'sawtooth', 0.09, 0.1); },
    tap() { beep(660, 0.05, 'square', 0.05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'sine', 0.13, i * 0.11)); }
  };

  /* ─────────── 撒花 / 提示 ─────────── */
  function confetti(n) {
    const box = document.getElementById('confetti');
    if (!box) return;
    const emo = ['🎉','⭐','✨','🌟','🎊','💛','🏆'];
    for (let i = 0; i < (n || 14); i++) {
      const s = document.createElement('span');
      s.className = 'cf';
      s.textContent = emo[Math.floor(Math.random() * emo.length)];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      s.style.animationDelay = (Math.random() * 0.3) + 's';
      s.style.fontSize = (16 + Math.random() * 18) + 'px';
      box.appendChild(s);
      setTimeout(() => s.remove(), 3200);
    }
  }
  let toastT = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600);
  }
  function combo(n) {
    if (n < 2) return;
    const c = document.getElementById('combo');
    if (!c) return;
    c.textContent = n >= 5 ? '🔥 连对 ' + n + ' 题！' : '👍 连对 ' + n + ' 题';
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  }

  /* ─────────── 屏幕切换 ─────────── */
  let curScreen = 'screen-kid';
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('on', el.id === id));
    curScreen = id;
    window.scrollTo(0, 0);
  }
  let lastAct = Date.now();
  document.addEventListener('pointerdown', () => { lastAct = Date.now(); }, true);

  /* 打卡计时：只在学习界面、页面可见、且 2 分钟内有操作时才算 */
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (STUDY_SCREENS.indexOf(curScreen) < 0) return;
    if (Date.now() - lastAct > 120000) return;
    addSec(5);
  }, 5000);

  /* ═══════════ 选小朋友 ═══════════ */
  function renderKids() {
    const box = document.getElementById('kid-grid');
    box.innerHTML = '';
    Object.values(KIDS).forEach(k => {
      const p = S.profiles[k.id];
      const st = Object.values(p.levelStars).reduce((a, b) => a + b, 0);
      const el = document.createElement('div');
      el.className = 'kid-card ' + k.id;
      el.innerHTML = '<div class="kid-avatar">' + k.av + '</div>' +
        '<div class="kid-name">' + k.name + '</div>' +
        '<div class="kid-tag">' + k.tag + '</div>' +
        '<div class="kid-tag" style="margin-top:8px;color:var(--brand);font-weight:700">⭐ ' + st + '</div>';
      el.onclick = () => { S.cur = k.id; save(); sfx.tap(); goHome(); };
      box.appendChild(el);
    });
  }

  /* ═══════════ 首页 ═══════════ */
  const qiCount = () => Object.values(HANZI_QI).reduce((a, g) => a + g.words.length, 0);
  const HOME_MODS = {
    da: [
      /* 关卡数现算，别写死——加了关卡忘了改文案，首页就会说假话 */
      { goto: 'math',   wide: true, ico: '🚀', tt: '数学闯关',
        ds: LEVELS.da.math.length + ' 个关卡，答对拿星星', color: 'blue' },
      { goto: 'timed',  ico: '⏱️', tt: '限时口算', ds: '60 秒，看能答对几题' },
      { goto: 'mul',    ico: '🔢', tt: '乘法口诀', ds: '点一句听一句' },
      { goto: 'hanzi',  ico: '🔤', tt: '认汉字', ds: '二年级字库 · 拼音组词' },
      { goto: 'trace',  ico: '✍️', tt: '写一写', ds: '手指描红练笔画' },
      { goto: 'stars',  ico: '🏆', tt: '星星奖章', ds: '看攒了多少颗' }
    ],
    er: [
      { goto: 'hanzi',  wide: true, ico: '🔤', tt: '认字卡',
        ds: qiCount() + ' 个字，每个都配图配声音', color: 'orange' },
      { goto: 'math',   ico: '🚀', tt: '数学游戏', ds: '数一数 · 比多少 · 找规律' },
      { goto: 'mul',    ico: '🔢', tt: '数到十', ds: '一、二、三…十' },
      { goto: 'trace',  ico: '✍️', tt: '描一描', ds: '用手指写大字' },
      { goto: 'stars',  ico: '🏆', tt: '我的星星', ds: '看看攒了几颗' }
    ]
  };
  function goHome() {
    if (!S.cur) { showScreen('screen-kid'); return; }
    const k = KID(), p = ME();
    document.getElementById('home-av').textContent = k.av;
    document.getElementById('home-name').textContent = k.name;
    const mins = Math.round(todaySec() / 60);
    document.getElementById('home-sub').textContent = mins > 0
      ? '今天已经学了 ' + mins + ' 分钟，真棒！'
      : '今天还没开始哦，挑一个玩吧';
    document.getElementById('st-min').innerHTML = mins + '<span class="u">分</span>';
    document.getElementById('st-star').textContent = p.stars;
    document.getElementById('st-streak').innerHTML = streak() + '<span class="u">天</span>';

    const grid = document.getElementById('home-mods');
    grid.innerHTML = '';
    (HOME_MODS[S.cur] || []).forEach(m => {
      const el = document.createElement('div');
      el.className = 'mod' + (m.wide ? ' wide' : '');
      el.innerHTML = '<div class="ico">' + m.ico + '</div>' +
        '<div class="' + (m.wide ? 'txt' : '') + '"><div class="tt">' + m.tt + '</div><div class="ds">' + m.ds + '</div></div>';
      el.onclick = () => { sfx.tap(); route(m.goto); };
      grid.appendChild(el);
    });

    const td = document.getElementById('home-today');
    const rows = Object.keys(p.days).sort().slice(-7).reverse()
      .filter(d => p.days[d] > 0)
      .map(d => '<div class="list-row"><span class="k">' + d + '</span><span class="v">' +
        Math.max(1, Math.round(p.days[d] / 60)) + ' 分钟</span></div>');
    td.innerHTML = rows.length ? rows.join('') : '<div class="empty-tip">还没开始，随便挑一个玩吧 👆</div>';
    showScreen('screen-home');
  }

  function route(g) {
    if (g === 'math')  return openMathMap();
    if (g === 'hanzi') return openHanziMap();
    if (g === 'timed') return openTimedMenu();
    if (g === 'mul')   return openMul();
    if (g === 'trace') return openTrace();
    if (g === 'stars') return openStars();
  }

  /* ═══════════ 关卡地图 / 主题选择 ═══════════ */
  let MAP_CTX = null;   // {kind:'math'|'hanzi', ...}
  function openMathMap() {
    const lv = LEVELS[S.cur];
    MAP_CTX = { kind: 'math', lv };
    document.getElementById('map-title').textContent = '🚀 数学闯关';
    const p = ME();
    const total = lv.math.length;
    const got = lv.math.filter(m => (p.levelStars[m.id] || 0) > 0).length;
    document.getElementById('map-star').textContent = '⭐ ' + p.stars;
    document.getElementById('map-sub').textContent = '已通关 ' + got + ' / ' + total +
      ' 关。每关 3 星，全对才能拿满 ⭐⭐⭐。点哪个都可以，没有锁。';
    document.getElementById('map-foot').textContent = '答错的题会自动进错题本，回家可以复习';
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    lv.math.forEach(m => {
      const st = p.levelStars[m.id] || 0;
      const el = document.createElement('div');
      el.className = 'map-item' + (st > 0 ? ' done' : '');
      el.innerHTML = '<div class="mi-ico">' + m.icon + '</div><div class="mi-name">' + m.name + '</div>' +
        '<div class="mi-desc">' + m.desc + '</div>' +
        '<div class="mi-stars">' + [1,2,3].map(i => i <= st ? '⭐' : '<span class="off">⭐</span>').join('') + '</div>';
      el.onclick = () => { sfx.tap(); startMath(m); };
      grid.appendChild(el);
    });
    showScreen('screen-map');
  }

  /* ═══════════ 认汉字：两套数据，统一成一种「字表」 ═══════════
     二宝 HANZI_QI = { 主题: {icon, words:[{z,py,pic,ci,ju}]} }
     大宝 HANZI_G2 = { books:[{short, units:[{u,name,theme,emoji,xie,shi}]}] }，xie/shi 是
                     [汉字,拼音,组词1,组词2] 的紧凑数组（1100 多个字，省字节）
     统一成：{ key, name, icon, sub, words:[{z,py,ci,pic,ju,book,unit,kind}] }
     🔴 只在 hanziGroups() 这一处转换——下游（地图/认字卡/闯关/描红）都吃同一种结构，
        免得四处各解各的、改一处漏三处。 */
  let G2_BOOK = 's1';                       // 大宝当前在看哪一册
  function hanziGroups() {
    if (S.cur === 'er') {
      return Object.keys(HANZI_QI).map(k => {
        const g = HANZI_QI[k];
        return { key: k, name: k, icon: g.icon || '📖', sub: '', words: g.words,
                 kind: 'theme', book: 'qi' };
      });
    }
    const b = HANZI_G2.books.find(x => x.id === G2_BOOK) || HANZI_G2.books[0];
    const out = [];
    for (const kind of ['xie', 'shi']) {
      for (const u of b.units) {
        const rows = u[kind];
        if (!rows || !rows.length) continue;
        out.push({
          key: b.id + '-' + kind + '-' + u.u,
          name: u.name,
          u: u.u,
          /* 🔴 单元卡上不重复写「要会写的字」——上面那行「✍️ 写字表」已经说过了，
             卡片上再写一遍就是三行废话。有主题名就显示主题名，没有就留空。 */
          icon: u.emoji || '',
          sub: u.theme || '',
          kind: kind,
          book: b.short,
          words: rows.map(r => ({ z: r[0], py: r[1], ci: [r[2], r[3]], book: b.short, unit: u.name, kind: kind }))
        });
      }
    }
    return out;
  }
  const countHanzi = list => list.reduce((a, g) => a + g.words.length, 0);
  const hanziPool = () => (S.cur === 'er')
    ? Object.values(HANZI_QI).reduce((a, x) => a.concat(x.words), [])
    : HANZI_G2.pool();

  function openHanziMap() {
    MAP_CTX = { kind: 'hanzi' };
    const er = S.cur === 'er';
    const groups = hanziGroups();
    const all = hanziPool();
    document.getElementById('map-title').textContent = '🔤 认汉字';
    document.getElementById('map-star').textContent = '📖 ' + ME().hanziLearned;
    document.getElementById('map-sub').textContent = er
      ? '一共 ' + groups.length + ' 组、' + countHanzi(groups) + ' 个字，都是能看图联想的基础字。'
      : '部编版二年级上册 + 下册，' + all.length + ' 个不重复的生字。✍️是第一遍要会写的，👀是认得就行的。';
    document.getElementById('map-foot').textContent = '点一组进去，一个一个认，认完记得点 🔊 听一遍';
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';

    const testBtn = document.createElement('div');
    testBtn.className = 'map-item big';
    testBtn.innerHTML = '<div class="mi-ico">⚡</div><div style="flex:1"><div class="mi-name">认字闯关</div>' +
      '<div class="mi-desc">' + (er ? '看图选字 · 看拼音选字' : '看拼音选字 · 看字选拼音 · 看字选词') + '</div></div>';
    testBtn.onclick = () => { sfx.tap(); startHanziQuiz(all, null); };
    grid.appendChild(testBtn);

    if (!er) {
      /* 册切换：一次只显示一册，否则 16 个单元铺一屏太乱 */
      const bar = document.createElement('div');
      bar.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;margin:2px 0 2px';
      HANZI_G2.books.forEach(b => {
        const c = document.createElement('button');
        c.className = 'chip' + (b.id === G2_BOOK ? ' on' : '');
        c.textContent = b.name;
        c.onclick = () => { sfx.tap(); G2_BOOK = b.id; openHanziMap(); };
        bar.appendChild(c);
      });
      grid.appendChild(bar);
    }

    let lastKind = null;
    groups.forEach(g => {
      if (!er && g.kind !== lastKind) {
        lastKind = g.kind;
        const h = document.createElement('div');
        h.className = 'sect-title';
        h.style.cssText = 'grid-column:1/-1;margin:14px 0 2px';
        h.innerHTML = g.kind === 'xie'
          ? '✍️ 写字表 <span class="hint">第一遍要会写的字</span>'
          : '👀 识字表 <span class="hint">认得出来就行</span>';
        grid.appendChild(h);
      }
      const n = g.words.length;
      const seen = g.words.filter(w => ME().hanziSeen[w.z]).length;
      const el = document.createElement('div');
      el.className = 'map-item' + (seen >= n ? ' done' : '');
      /* 有主题就显示主题 emoji，没有就用单元号——16 张卡片全顶一个 ✍️ 既认不出谁是谁，
         也白占一行高度。再露出 4 个样字，孩子一眼知道这单元学啥。 */
      const head = g.icon ? '<div class="mi-ico">' + g.icon + '</div>'
                          : '<div class="mi-num">' + (g.u || '') + '</div>';
      const sample = g.words.slice(0, 4).map(w => w.z).join(' ');
      el.innerHTML = head + '<div class="mi-name">' + g.name + '</div>' +
        '<div class="mi-desc">' + (g.sub ? g.sub + '<br>' : '') + n + ' 个字 · 认了 ' + seen + '</div>' +
        '<div class="mi-sample kai">' + sample + '</div>';
      el.onclick = () => { sfx.tap(); openLearn(g.key); };
      grid.appendChild(el);
    });
    showScreen('screen-map');
  }

  /* ═══════════ 认字卡（学习模式） ═══════════ */
  let LEARN = null;
  function openLearn(key, idx) {
    const g = hanziGroups().find(x => x.key === key);
    if (!g) return;
    LEARN = { g, key, list: g.words, i: idx || 0 };
    document.getElementById('learn-title').textContent = g.name + (g.book && g.book !== 'qi' ? '（' + g.book + '）' : '');
    renderLearn();
    showScreen('screen-learn');
  }
  function renderLearn() {
    const w = LEARN.list[LEARN.i];
    const pic = document.getElementById('learn-pic');
    pic.textContent = w.pic || '';
    document.getElementById('learn-hz').textContent = w.z;
    document.getElementById('learn-py').textContent = w.py;
    /* 组词做成能点的按钮：二年级的字大多没法配图，「词」就是它的场景，
       点一下就念出来，孩子听得到这个词怎么用。 */
    const info = document.getElementById('learn-info');
    info.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'ci-wrap';
    (w.ci || []).forEach(c => {
      const b = document.createElement('button');
      b.className = 'ci-chip';
      b.innerHTML = c + '<span class="sp">🔊</span>';
      b.onclick = () => speak(c);
      wrap.appendChild(b);
    });
    info.appendChild(wrap);
    const ju = document.getElementById('learn-ju');
    if (w.ju) { ju.innerHTML = w.ju; ju.classList.remove('hide'); }
    else if (w.book && w.book !== 'qi') {
      /* 没有例句就不编——编错了比不写更糟。改成告诉孩子在课本的哪儿 */
      ju.innerHTML = '📚 部编版二年级' + (w.book === '二上' ? '上册' : '下册') + ' · ' + w.unit +
        (w.kind === 'xie' ? ' · 写字表' : ' · 识字表');
      ju.classList.remove('hide');
    } else { ju.innerHTML = ''; ju.classList.add('hide'); }
    document.getElementById('learn-pos').textContent = (LEARN.i + 1) + ' / ' + LEARN.list.length;
    // 记录认过的字
    const p = ME();
    if (w.z && !p.hanziSeen[w.z]) {
      p.hanziSeen[w.z] = 1;
      p.hanziLearned = Object.keys(p.hanziSeen).length;
      save();
    }
    speak(w.z);
  }

  /* ═══════════ 通用闯关引擎 ═══════════ */
  let Q = null;
  function startQuiz(cfg) {
    // cfg: {title, n, make, key, backFn}
    Q = { cfg, i: 0, right: 0, wrongs: [], combo: 0, list: [] };
    for (let i = 0; i < cfg.n; i++) Q.list.push(cfg.make());
    document.getElementById('quiz-title').textContent = cfg.title;
    document.getElementById('quiz-result').classList.add('hide');
    document.getElementById('quiz-body').classList.remove('hide');
    showScreen('screen-quiz');
    renderQ();
  }
  function renderQ() {
    if (!Q) return;
    if (Q.i >= Q.list.length) return showResult();
    const q = Q.list[Q.i];
    document.getElementById('quiz-count').textContent = (Q.i + 1) + '/' + Q.list.length;
    document.getElementById('quiz-bar').style.width = (Q.i / Q.list.length * 100) + '%';
    const big = document.getElementById('q-big'), em = document.getElementById('q-emoji'), sub = document.getElementById('q-sub');
    big.innerHTML = q.big || '';
    big.classList.toggle('hide', !q.big);
    big.classList.toggle('hz', !!q.bigHz);
    em.innerHTML = q.emoji || '';
    em.classList.toggle('hide', !q.emoji);
    sub.innerHTML = q.story ? '<b>' + (q.sub || '') + '</b><div style="margin-top:8px;font-size:17px;color:var(--ink)">' + q.story + '</div>' : (q.sub || '');
    document.getElementById('q-feedback').classList.add('hide');
    document.getElementById('q-feedback').innerHTML = '';
    document.getElementById('q-next').classList.add('hide');

    const chBox = document.getElementById('q-choices');
    const ansBox = document.getElementById('q-answer-area');
    if (q.input) {
      chBox.innerHTML = ''; chBox.classList.add('hide');
      ansBox.classList.remove('hide');
      Q.typed = '';
      renderTyped();
      renderPad();
    } else {
      ansBox.classList.add('hide');
      chBox.classList.remove('hide');
      /* 3 个短符号（> < =）横排三列，别排成一竖列白白占掉半屏 */
      chBox.className = 'choices' +
        (q.choices.length <= 3 ? (q.choiceClass === 'sym' ? ' three' : ' one') : '');
      chBox.innerHTML = '';
      q.choices.forEach(c => {
        const b = document.createElement('button');
        b.className = 'choice' + (q.choiceClass ? ' ' + q.choiceClass : (isHanzi(c) ? ' hz' : ''));
        b.innerHTML = c;
        b.onclick = () => answer(c, b);
        chBox.appendChild(b);
      });
    }
    speakQ(q);
  }
  const isHanzi = s => /^[一-龥]$/.test(String(s).replace(/<[^>]+>/g, ''));
  function speakQ(q) {
    const t = q.say || String(q.big || '').replace(/<[^>]+>/g, '');
    if (t) speak(t);
  }
  function renderTyped() {
    const box = document.getElementById('answer-box');
    box.innerHTML = Q.typed ? Q.typed : '<span class="caret"></span>';
  }
  function renderPad() {
    const pad = document.getElementById('numpad');
    pad.innerHTML = '';
    /* 有余数的除法要写「5……2」，键盘上得给一个「……」键；
       普通口算不需要，就把这一格还给「⌫」（底下本来就有独立的「确定」按钮）。 */
    const sep = !!(Q.list[Q.i] && Q.list[Q.i].padSep);
    const keys = ['1','2','3','4','5','6','7','8','9',
                  sep ? '……' : '⌫', '0', sep ? '⌫' : '✓'];
    keys.forEach(k => {
      const b = document.createElement('button');
      b.textContent = k;
      if (k === '……') b.style.fontSize = '30px';   // 省略号本身小，不放大根本看不清
      b.onclick = () => {
        sfx.tap();
        if (k === '⌫') Q.typed = Q.typed.slice(0, -1);
        else if (k === '✓') return answer(Q.typed);
        else if (k === '……') { if (Q.typed.indexOf('……') < 0) Q.typed += '……'; }
        else if (Q.typed.length < 6) Q.typed += k;
        renderTyped();
      };
      pad.appendChild(b);
    });
  }
  function answer(val, btn) {
    if (!Q || Q.locked) return;
    const q = Q.list[Q.i];
    if (q.input && !val) { toast('先写上答案哦'); return; }
    Q.locked = true;
    const ok = String(val) === String(q.answer);
    const fb = document.getElementById('q-feedback');
    if (ok) {
      Q.right++; Q.combo++;
      sfx.ok(); confetti(8); combo(Q.combo);
      if (btn) btn.classList.add('right');
      fb.className = 'feedback ok';
      fb.innerHTML = '✅ 答对啦！' + (q.why ? '<span class="why">' + q.why + '</span>' : '') + (q.whyHtml || '');
      fb.classList.remove('hide');
      record(q, true);
      setTimeout(() => { Q.locked = false; Q.i++; renderQ(); }, q.whyHtml ? 1900 : 1000);
    } else {
      Q.combo = 0;
      sfx.no();
      if (btn) btn.classList.add('wrong');
      document.querySelectorAll('#q-choices .choice').forEach(b => {
        if (b.textContent.trim() === String(q.answer).trim()) b.classList.add('right');
        else if (b !== btn) b.classList.add('dim');
      });
      fb.className = 'feedback no';
      fb.innerHTML = '再想想～ 正确答案是 <b>' + q.answer + '</b>' +
        (q.why ? '<span class="why">' + q.why + '</span>' : '') + (q.whyHtml || '');
      fb.classList.remove('hide');
      record(q, false);
      addWrong(q, val);
      const nx = document.getElementById('q-next');
      nx.classList.remove('hide');
      nx.onclick = () => { sfx.tap(); Q.locked = false; Q.i++; renderQ(); };
    }
  }
  function record(q, ok) {
    const p = ME(), key = q._key || 'misc';
    const s = p.stats[key] = p.stats[key] || { right: 0, total: 0 };
    s.total++; if (ok) s.right++;
    save();
  }
  function addWrong(q, val) {
    const p = ME();
    const label = (q.story || q.sub || String(q.big || '').replace(/<[^>]+>/g, ' ')).slice(0, 40).trim();
    p.wrong.unshift({ q: label, you: String(val), a: String(q.answer), why: q.why || '', t: Date.now() });
    if (p.wrong.length > 60) p.wrong.length = 60;
    save();
  }
  function showResult() {
    const cfg = Q.cfg, n = Q.list.length, right = Q.right;
    const pct = right / n;
    const stars = pct >= 1 ? 3 : pct >= 0.8 ? 2 : pct >= 0.6 ? 1 : 0;
    document.getElementById('quiz-body').classList.add('hide');
    document.getElementById('quiz-result').classList.remove('hide');
    document.getElementById('quiz-bar').style.width = '100%';
    document.getElementById('quiz-count').textContent = n + '/' + n;

    const p = ME();
    p.totalPlays++;
    if (right === n) p.perfectCount++;
    if (cfg.key) {
      const prev = p.levelStars[cfg.key] || 0;
      if (stars > prev) { p.stars += (stars - prev); p.levelStars[cfg.key] = stars; }
    } else {
      p.stars += stars;
    }
    if (Q.mulKeys) { Q.mulKeys.forEach(k => { if (!p.mulDone[k]) { p.mulDone[k] = 1; } }); p.mulPassed = Object.keys(p.mulDone).length; }
    save();
    touchDay();

    const emo = stars === 3 ? '🏆' : stars === 2 ? '🎉' : stars === 1 ? '👍' : '💪';
    const ttl = stars === 3 ? '全对！太厉害了' : stars === 2 ? '很稳，就差一点' : stars === 1 ? '过关啦' : '再练一次会更好';
    document.getElementById('rs-emoji').textContent = emo;
    document.getElementById('rs-title').textContent = ttl;
    document.getElementById('rs-stars').innerHTML = [1,2,3].map(i => i <= stars ? '⭐' : '<span class="star-off">⭐</span>').join('');
    /* 🔴 「这一关历史最好：」后面一个星星都没有的那次，是第一次玩且没拿到星——
       光秃秃一个冒号看着像 App 坏了。没拿到星就直说，别留个空标签。 */
    const best = p.levelStars[cfg.key] || 0;
    document.getElementById('rs-detail').innerHTML = '答对 <b>' + right + '</b> / ' + n + ' 题' +
      (cfg.key ? '<br><span style="font-size:13px;color:var(--ink3)">' +
        (best > 0 ? '这一关历史最好：' + '⭐'.repeat(best) : '这一关还没拿到星星，再来一次就有了') +
        '</span>' : '');
    const wl = document.getElementById('rs-wrong');
    if (Q.wrongs.length) {
      wl.classList.remove('hide');
      document.getElementById('rs-wrong-items').innerHTML = Q.wrongs.map(w =>
        '<div class="item"><b>' + w.label + '</b> → 正确：<b style="color:var(--green)">' + w.answer + '</b></div>').join('');
    } else wl.classList.add('hide');
    if (stars >= 2) { sfx.win(); confetti(30); } else if (stars >= 1) { sfx.ok(); confetti(10); }
  }

  /* ═══════════ 数学关卡 ═══════════ */
  function startMath(m) {
    startQuiz({
      title: m.icon + ' ' + m.name,
      n: m.n,
      key: m.id,
      backFn: () => openMathMap(),
      make: () => { const q = GEN[m.gen](); q._key = m.id; return q; }
    });
  }
  function openTimedMenu() {
    MAP_CTX = { kind: 'timed' };
    document.getElementById('map-title').textContent = '⏱️ 限时口算';
    document.getElementById('map-star').textContent = '⏱️ 60秒';
    document.getElementById('map-sub').textContent = '60 秒内尽量多答对。答对越多星星越多，答错不扣分，放心冲。';
    document.getElementById('map-foot').textContent = 'iPad 上可以横过来，键盘更大';
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    TIMED_MODES[S.cur].forEach(m => {
      const el = document.createElement('div');
      el.className = 'map-item big';
      el.innerHTML = '<div class="mi-ico">⏱️</div><div style="flex:1"><div class="mi-name">' + m.name + '</div>' +
        '<div class="mi-desc">60 秒挑战</div></div>';
      el.onclick = () => { sfx.tap(); startTimed(m); };
      grid.appendChild(el);
    });
    showScreen('screen-map');
  }

  /* ═══════════ 限时口算 ═══════════ */
  let T = null;
  function startTimed(mode) {
    T = { mode, i: 0, right: 0, wrong: 0, typed: '', wrongs: [], t: 60 };
    showScreen('screen-timed');
    document.getElementById('timed-result').classList.add('hide');
    document.getElementById('timed-run').classList.remove('hide');
    document.getElementById('timed-right').textContent = '0';
    document.getElementById('timed-wrong').textContent = '0';
    nextTimed();
    clearInterval(T.timer);
    T.timer = setInterval(() => {
      T.t--;
      document.getElementById('timed-left').textContent = T.t;
      document.getElementById('timed-bar').style.width = (T.t / 60 * 100) + '%';
      if (T.t <= 0) endTimed();
    }, 1000);
    document.getElementById('timed-left').textContent = '60';
    document.getElementById('timed-bar').style.width = '100%';
  }
  function nextTimed() {
    T.q = GEN[pick(T.mode.gens)]();
    T.typed = '';
    /* 🔴 限时口算是 60 秒速度赛，题面就该是一道**光溜溜的算式**，所以优先用生成器给的
       drill（'37 + 46 = ?'）。原来这里只认 sub/big，而 100 以内加减的 sub 是
       「一捆 10 根　一根 1　一共有多少根小棒？」——**题面上写着要看小棒，小棒却没渲染**，
       孩子根本没法答（小棒图在 emoji 里，这条路径从来没读过它）。
       关卡屏不受影响，图都在；只有限时屏吃 drill。 */
    const b = document.getElementById('timed-q');
    const face = T.q.drill || T.q.big || T.q.sub || '';
    b.innerHTML = face;
    b.style.fontSize = face.length > 16 ? '30px' : '';
    document.getElementById('timed-ans').innerHTML = '<span class="caret"></span>';
    const pad = document.getElementById('timed-pad');
    if (!pad.dataset.built) {
      pad.dataset.built = '1';
      ['1','2','3','4','5','6','7','8','9','⌫','0','✓'].forEach(k => {
        const b2 = document.createElement('button');
        b2.textContent = k;
        b2.onclick = () => {
          if (k === '⌫') T.typed = T.typed.slice(0, -1);
          else if (k === '✓') return checkTimed();
          else if (T.typed.length < 6) T.typed += k;
          document.getElementById('timed-ans').innerHTML = T.typed || '<span class="caret"></span>';
          // 限时模式：位数够了就自动判，省得每次都点确定
          if (T.typed.length >= String(T.q.answer).length) checkTimed();
        };
        pad.appendChild(b2);
      });
    }
  }
  function checkTimed() {
    if (!T || T.done) return;
    const ok = String(T.typed) === String(T.q.answer);
    if (ok) { T.right++; sfx.ok(); beep(1200, 0.08, 'sine', 0.1); }
    else { T.wrong++; sfx.no(); T.wrongs.push({ label: (T.q.sub || T.q.big || '').replace(/<[^>]+>/g, ' ').slice(0, 30), answer: T.q.answer }); }
    document.getElementById('timed-right').textContent = T.right;
    document.getElementById('timed-wrong').textContent = T.wrong;
    nextTimed();
  }
  function endTimed() {
    clearInterval(T.timer);
    T.done = true;
    document.getElementById('timed-run').classList.add('hide');
    document.getElementById('timed-result').classList.remove('hide');
    document.getElementById('timed-score').textContent = T.right;
    document.getElementById('timed-final-right').textContent = T.right;
    const p = ME();
    const stars = T.right >= 25 ? 3 : T.right >= 15 ? 2 : T.right >= 8 ? 1 : 0;
    p.stars += stars; p.totalPlays++;
    if (T.wrong === 0 && T.right > 0) p.perfectCount++;
    const key = 'timed_' + T.mode.id;
    if (stars > (p.levelStars[key] || 0)) p.levelStars[key] = stars;
    save(); touchDay();
    const wl = document.getElementById('timed-wrong-list');
    if (T.wrongs.length) {
      wl.classList.remove('hide');
      document.getElementById('timed-wrong-items').innerHTML = T.wrongs.slice(0, 12).map(w =>
        '<div class="item">' + w.label + ' → <b style="color:var(--green)">' + w.answer + '</b></div>').join('');
    } else wl.classList.add('hide');
    if (stars >= 2) { sfx.win(); confetti(30); } else { sfx.ok(); confetti(8); }
    document.getElementById('timed-left').textContent = '0';
  }

  /* ═══════════ 乘法口诀 ═══════════ */
  let MUL = { reciting: false, i: 0 };
  function openMul() {
    const box = document.getElementById('mul-table');
    box.innerHTML = '';
    if (S.cur === 'er') {
      // 二宝：数到十
      document.getElementById('mul-show').innerHTML = '一二三四五…';
      const CN = ['一','二','三','四','五','六','七','八','九','十'];
      CN.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = 'mul-cell';
        el.innerHTML = '<span class="r">' + (i + 1) + '</span>' + c;
        el.onclick = () => { speak(c); speak(String(i + 1)); };
        box.appendChild(el);
      });
      document.getElementById('mul-title') || null;
      document.querySelector('#screen-mul .tb-title').textContent = '🔢 数到十';
      document.getElementById('mul-recite').onclick = () => reciteCount();
      document.getElementById('mul-quiz').onclick = () => { sfx.tap(); startNumQuiz(); };
      showScreen('screen-mul');
      return;
    }
    document.querySelector('#screen-mul .tb-title').textContent = '🔢 乘法口诀';
    MUL_KOUJUE.forEach((k, i) => {
      const el = document.createElement('div');
      el.className = 'mul-cell' + (ME().mulDone[k.a + 'x' + k.b] ? ' learned' : '');
      el.innerHTML = '<span class="r">' + k.a + '×' + k.b + '=' + k.p + '</span>' + k.txt;
      el.onclick = () => {
        document.getElementById('mul-show').innerHTML = k.txt.replace(String(k.p), '<span class="hl">' + k.p + '</span>');
        speak(k.txt);
        const p = ME();
        if (!p.mulDone[k.a + 'x' + k.b]) { p.mulDone[k.a + 'x' + k.b] = 1; p.mulPassed = Object.keys(p.mulDone).length; save(); }
        el.classList.add('learned');
      };
      box.appendChild(el);
    });
    document.getElementById('mul-recite').onclick = () => reciteMul();
    document.getElementById('mul-quiz').onclick = () => {
      startQuiz({
        title: '🔢 口诀抽背', n: 10, key: 'mul_quiz', backFn: () => openMul(),
        make: () => { const q = GEN.mj(); q._key = 'mul_quiz'; return q; }
      });
    };
    showScreen('screen-mul');
  }
  function reciteMul() {
    if (MUL.reciting) { speechSynthesis.cancel(); MUL.reciting = false; toast('停下来了'); return; }
    MUL.reciting = true;
    let i = 0;
    const step = () => {
      if (!MUL.reciting || i >= MUL_KOUJUE.length) { MUL.reciting = false; return; }
      const k = MUL_KOUJUE[i];
      document.getElementById('mul-show').innerHTML = k.txt.replace(String(k.p), '<span class="hl">' + k.p + '</span>');
      speak(k.txt);
      const cells = document.querySelectorAll('#mul-table .mul-cell');
      cells.forEach((c, ci) => c.style.outline = ci === i ? '3px solid var(--brand)' : '');
      i++;
      setTimeout(step, 2100);
    };
    step();
  }
  function reciteCount() {
    const CN = ['一','二','三','四','五','六','七','八','九','十'];
    if (MUL.reciting) { speechSynthesis.cancel(); MUL.reciting = false; return; }
    MUL.reciting = true;
    let i = 0;
    const step = () => {
      if (!MUL.reciting || i >= 10) { MUL.reciting = false; return; }
      document.getElementById('mul-show').innerHTML = '<span class="hl">' + CN[i] + '</span>　' + (i + 1);
      speak(CN[i]); speak(String(i + 1));
      i++; setTimeout(step, 2000);
    };
    step();
  }
  function startNumQuiz() {
    const CN = ['一','二','三','四','五','六','七','八','九','十'];
    startQuiz({
      title: '⚡ 认数字', n: 8, key: 'num10', backFn: () => goHome(),
      make: () => {
        const n = ri(1, 10), e = pick(WORD_ITEMS).e;
        const o = options4(n, [n+1, n-1, n+2], 1, 12);
        return { big: '<span style="font-size:40px">' + CN[n-1] + '</span>', sub: '这个字是几？',
                 choices: o.choices.map(c => String(c)), answer: o.answer, choiceClass: 'txt',
                 say: '这个字是几', why: CN[n-1] + ' 就是 ' + n };
      }
    });
  }

  /* ═══════════ 认字闯关 ═══════════ */
  /* ═══════════ 认字闯关 ═══════════
     🔴 干扰项有两条硬规矩，破了就出「两个正确答案」的烂题：
        ① 干扰字的拼音不能跟答案相同（她/它 都读 tā，同时出现就成了双黄蛋）
        ② 看字选拼音时，干扰拼音也必须两两不同
     🔴 故意不做「组词填空（古▢）」这类题——没法保证干扰字组不出真词（古书/古诗），
        会出歧义题。宁可少一种题型，也不给孩子出没有唯一答案的题。 */
  /* 出题器单独抽出来，是为了让自动化测试能直接跑几千道题查「有没有两个正确答案」
     （测试跑的就是线上这一份代码，不是另写一套判据） */
  function hanziQFactory(all) {
    const er = S.cur === 'er';
    const pool = all.length >= 8 ? all : all.concat(all, all);
    return () => {
        const w = pick(all);
        const others = shuffle(pool.filter(x => x.z !== w.z && x.py !== w.py)).slice(0, 3);
        /* 看字选拼音专用的干扰项：拼音必须两两不同，还得跟答案不同。
           🔴 这里踩过真坑——只保证「干扰字拼音≠答案拼音」不够，
              两个干扰字自己撞音（住 zhù / 助 zhù）会渲染出两个一模一样的按钮，
              孩子点哪个都对（或都错），这题就废了。 */
        const pyOthers = (() => {
          const seen = new Set([w.py]), out = [];
          for (const o of shuffle(pool.filter(x => x.z !== w.z))) {
            if (out.length >= 3) break;
            if (seen.has(o.py)) continue;
            seen.add(o.py); out.push(o);
          }
          return out;
        })();
        let type = er ? pick(w.pic ? ['pic', 'py'] : ['py'])
                      : pick(['py', 'zi', 'ci']);
        if (type === 'zi' && pyOthers.length < 3) type = 'ci';   // 同音字太多凑不齐 4 个读音，换题型
        if (type === 'pic') {
          return { big: '<span style="font-size:80px">' + w.pic + '</span>', sub: '这是哪个字？',
                   choices: shuffle([w.z].concat(others.map(o => o.z))), answer: w.z,
                   say: '这个图是哪个字', why: w.z + '（' + w.py + '）' + (w.ci ? '　组词：' + w.ci.join('、') : '') };
        }
        if (type === 'py') {
          return { big: '<span style="font-size:44px;color:var(--brand)">' + w.py + '</span>',
                   sub: '这个拼音是哪个字？',
                   choices: shuffle([w.z].concat(others.map(o => o.z))), answer: w.z,
                   say: '这个拼音是哪个字', why: w.z + ' 读作 ' + w.py +
                   (w.ci ? '，组词：' + w.ci.join('、') : '') };
        }
        if (type === 'zi') {
          const pys = shuffle([w.py].concat(pyOthers.map(o => o.py)));
          return { big: '<span style="font-size:96px" class="kai">' + w.z + '</span>',
                   sub: '这个字读什么？', choices: pys, answer: w.py, choiceClass: 'txt',
                   say: '这个字读什么', why: w.z + ' 读作 ' + w.py +
                   (w.ci ? '，组词：' + w.ci.join('、') : '') };
        }
        // 看字选词：正确项必须含这个字，干扰项都不含（含了就也是对的）
        const rightWord = pick(w.ci || [w.z]);
        const notMine = c => c.indexOf(w.z) < 0 && c !== rightWord;
        const wordsOf = list => list.filter(x => x.z !== w.z && x.ci).map(x => pick(x.ci)).filter(notMine);
        let bads = shuffle([...new Set(wordsOf(all))]).slice(0, 3);
        /* 从认字卡点进来的闯关，手上只有一组字（30 来个），干扰词可能凑不满 3 个，
           这时从全库借——总比只给孩子 2 个选项强。 */
        if (bads.length < 3) {
          const extra = shuffle([...new Set(wordsOf(hanziPool()))]).filter(c => bads.indexOf(c) < 0);
          bads = bads.concat(extra).slice(0, 3);
        }
        return { big: '<span style="font-size:86px" class="kai">' + w.z + '</span>', sub: '哪个词里有这个字？',
                 choices: shuffle([rightWord].concat(bads)), answer: rightWord, choiceClass: 'txt',
                 say: w.z + '，哪个词里有这个字',
                 why: '「' + rightWord + '」里面有「' + w.z + '」。' + w.z + ' 读作 ' + w.py + '。' };
    };
  }
  function startHanziQuiz(all) {
    startQuiz({
      title: '⚡ 认字闯关', n: 10, key: 'hanzi_quiz',
      backFn: () => openHanziMap(),
      make: hanziQFactory(all)
    });
  }

  /* ═══════════ 描红 ═══════════ */
  let TRACE = null;
  function openTrace(startWord) {
    const pool = hanziPool();
    const w = (startWord && typeof startWord === 'object') ? startWord : pick(pool);
    TRACE = { pool, w };
    document.getElementById('trace-title').textContent = '✍️ 写「' + w.z + '」';
    document.getElementById('trace-py').textContent = w.py;
    showScreen('screen-trace');
    setupCanvas();
    speak(w.z);
  }
  function setupCanvas() {
    const cv = document.getElementById('trace-canvas');
    const wrap = document.getElementById('trace-wrap');
    const dpr = window.devicePixelRatio || 1;
    const size = wrap.clientWidth || 290;
    wrap.style.height = size + 'px';
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTraceBase(ctx, size);
    let drawing = false;
    const pos = e => {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    };
    const start = e => { drawing = true; e.preventDefault(); ctx.beginPath(); const p = pos(e); ctx.moveTo(p.x, p.y); };
    const move = e => {
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ctx.strokeStyle = '#4d8df6'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineTo(p.x, p.y); ctx.stroke();
    };
    const end = () => { drawing = false; };
    cv.onpointerdown = start; cv.onpointermove = move; cv.onpointerup = end; cv.onpointerleave = end;
    cv.onpointercancel = end;
    TRACE.reset = () => { ctx.clearRect(0, 0, size, size); drawTraceBase(ctx, size); };
  }
  function drawTraceBase(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.strokeStyle = '#ffd9bd'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(size / 2, size * 0.06); ctx.lineTo(size / 2, size * 0.94);
    ctx.moveTo(size * 0.06, size / 2); ctx.lineTo(size * 0.94, size / 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#f0ece5';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (size * 0.72) + 'px "Kaiti SC","STKaiti","KaiTi",serif';
    ctx.fillText(TRACE.w.z, size / 2, size / 2 + size * 0.03);
    ctx.restore();
  }

  /* ═══════════ 星星 / 报告 / 错题本 / 设置 ═══════════ */
  function openStars() {
    const p = ME();
    document.getElementById('achv-star').textContent = p.stars;
    document.getElementById('achv-sub').textContent = p.stars >= 150 ? '星星王！' : '再攒 ' + Math.max(0, 20 - p.stars) + ' 颗就能换第一个大奖章';
    const ag = document.getElementById('achv-grid');
    ag.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const unlocked = a.test(Object.assign({ streak: streak() }, p));
      const el = document.createElement('div');
      el.className = 'achv' + (unlocked ? '' : ' locked');
      el.innerHTML = '<div class="e">' + a.e + '</div><div class="t">' + a.t + '</div>';
      ag.appendChild(el);
    });

    // 学习报告
    const totalMin = Object.values(p.days).reduce((a, b) => a + b, 0) / 60;
    const days = Object.keys(p.days).length;
    const lv = LEVELS[S.cur];
    const rows = [];
    rows.push(['今天学了', Math.round(todaySec() / 60) + ' 分钟']);
    rows.push(['一共学了', Math.round(totalMin) + ' 分钟 · ' + days + ' 天']);
    rows.push(['连续打卡', streak() + ' 天']);
    rows.push(['闯关次数', p.totalPlays + ' 次']);
    rows.push(['认过的字', p.hanziLearned + ' 个']);
    if (S.cur === 'da') rows.push(['背熟口诀', p.mulPassed + ' / 45 句']);
    const scored = lv.math.map(m => ({ m, s: p.stats[m.id] })).filter(x => x.s && x.s.total >= 3);
    const weak = scored.map(x => ({ n: x.m.name, r: x.s.right / x.s.total })).sort((a, b) => a.r - b.r);
    document.getElementById('report-card').innerHTML = rows.map(r =>
      '<div class="list-row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>').join('') +
      (weak.length ? '<div style="margin-top:12px;font-size:13px;color:var(--ink2)">各关正确率（低→高）：</div>' +
        weak.map(w => '<div class="list-row"><span class="k">' + w.n + '</span><span class="v" style="color:' +
          (w.r >= 0.8 ? 'var(--green)' : w.r >= 0.6 ? 'var(--brand)' : 'var(--red)') + '">' +
          Math.round(w.r * 100) + '%</span></div>').join('') : '');

    // 错题本
    const wb = document.getElementById('wrongbook-card');
    if (!p.wrong.length) {
      wb.innerHTML = '<div class="empty-tip">还没有错题，继续保持 👍</div>';
    } else {
      wb.innerHTML = p.wrong.slice(0, 12).map((w, i) =>
        '<div class="list-row"><span class="k">' + w.q + '<br><span style="color:var(--red);font-size:12px">你写的：' + (w.you || '—') + '</span></span>' +
        '<span class="v">' + w.a + '</span></div>').join('') +
        '<div class="btn-row"><button class="btn ghost sm" id="wb-clear">清空错题本</button></div>';
      const c = document.getElementById('wb-clear');
      if (c) c.onclick = () => { p.wrong = []; save(); openStars(); toast('错题本清空了'); };
    }

    document.getElementById('set-goal').textContent = S.goal;
    document.getElementById('set-rate').textContent = S.rate < 1 ? '慢' : S.rate > 1 ? '快' : '正常';
    showScreen('screen-stars');
  }

  /* ═══════════ 事件绑定 ═══════════ */
  function bind() {
    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => {
        const t = b.getAttribute('data-back');
        if (t === 'screen-map' && MAP_CTX) { sfx.tap(); if (MAP_CTX.kind === 'hanzi') openHanziMap(); else openMathMap(); return; }
        sfx.tap(); goHome();
      };
    });
    document.getElementById('home-switch').onclick = () => { sfx.tap(); S.cur = null; save(); renderKids(); showScreen('screen-kid'); };

    /* 认字卡 */
    document.getElementById('learn-prev').onclick = () => { if (LEARN) { sfx.tap(); LEARN.i = (LEARN.i - 1 + LEARN.list.length) % LEARN.list.length; renderLearn(); } };
    document.getElementById('learn-next').onclick = () => { if (LEARN) { sfx.tap(); LEARN.i = (LEARN.i + 1) % LEARN.list.length; renderLearn(); } };
    document.getElementById('learn-sound').onclick = () => { if (LEARN) speak(LEARN.list[LEARN.i].z); };
    document.getElementById('learn-trace').onclick = () => { if (LEARN) openTrace(LEARN.list[LEARN.i]); };
    /* 从认字卡点「认字闯关」：先考刚学的这一组，孩子刚看完就有反馈 */
    document.getElementById('learn-quiz').onclick = () => {
      sfx.tap();
      const list = (LEARN && LEARN.list && LEARN.list.length >= 8)
        ? LEARN.list : hanziPool();
      startHanziQuiz(list, null);
    };

    /* 闯关 */
    document.getElementById('quiz-back').onclick = () => { sfx.tap(); if (Q && Q.cfg.backFn) Q.cfg.backFn(); else goHome(); };
    document.getElementById('quiz-sound').onclick = () => { if (Q && Q.list[Q.i]) speakQ(Q.list[Q.i]); };
    document.getElementById('answer-ok').onclick = () => answer(Q && Q.typed);

    /* 结算 */
    document.getElementById('rs-home').onclick = () => { sfx.tap(); goHome(); };
    document.getElementById('rs-again').onclick = () => {
      sfx.tap();
      const cfg = Q.cfg;
      startQuiz(cfg);
    };

    /* 限时 */
    document.getElementById('timed-back').onclick = () => { sfx.tap(); clearInterval(T && T.timer); openTimedMenu(); };
    document.getElementById('timed-ok').onclick = () => checkTimed();
    document.getElementById('timed-home').onclick = () => { sfx.tap(); goHome(); };
    document.getElementById('timed-again').onclick = () => { sfx.tap(); startTimed(T.mode); };

    /* 乘法口诀 */
    document.getElementById('mul-sound').onclick = () => {
      const t = document.getElementById('mul-show').textContent;
      if (t) speak(t);
    };

    /* 描红 */
    document.getElementById('trace-clear').onclick = () => { if (TRACE && TRACE.reset) TRACE.reset(); };
    document.getElementById('trace-sound').onclick = () => { if (TRACE) speak(TRACE.w.z); };
    document.getElementById('trace-next').onclick = () => {
      if (!TRACE) return;
      let w = pick(TRACE.pool);
      let guard = 0;
      while (w.z === TRACE.w.z && guard++ < 20) w = pick(TRACE.pool);
      openTrace(w);
    };

    /* 设置 */
    document.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => {
      S.goal = Math.max(5, Math.min(120, S.goal + Number(b.getAttribute('data-goal'))));
      save(); document.getElementById('set-goal').textContent = S.goal;
    });
    document.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => {
      S.rate = Number(b.getAttribute('data-rate'));
      save(); document.getElementById('set-rate').textContent = S.rate < 1 ? '慢' : S.rate > 1 ? '快' : '正常';
      toast('语速调好了，读一句听听');
    });
    document.getElementById('set-reset').onclick = () => {
      if (!confirm('确定清空「' + KID().name + '」的全部进度吗？（另一个小朋友不受影响）')) return;
      S.profiles[S.cur] = blankProfile(); save(); goHome(); toast('已经清空');
    };
  }

  /* ═══════════ 启动 ═══════════ */
  load();
  bind();
  renderKids();
  if (S.cur) goHome(); else showScreen('screen-kid');

  // 暴露给自动化测试用（只读，不改界面行为）
  window.__hm = {
    GEN, LEVELS, MUL_KOUJUE, HANZI_QI, HANZI_G2, hanziPool: () => hanziPool(),
    hanziGroups: () => hanziGroups(),
    hanziQFactory: (all) => hanziQFactory(all),
    state: () => S, blankProfile,
    quiz: () => Q, learn: () => LEARN, screen: () => curScreen
  };
})();
