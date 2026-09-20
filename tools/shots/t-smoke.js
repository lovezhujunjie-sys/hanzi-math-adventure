/* 冒烟测试：把 App 里**每一个入口都真点一遍**，看有没有哪个点开是空的/报错的。
   🔴 为什么需要它：单元测试只验「出题器算得对」，验不出「这个关卡点开是白屏」。
      白屏是孩子那边最致命、我们这边最难发现的一类 bug——它不报错，只是没了。
   🔴 判据是「屏幕上真的有字」，不是「函数没抛异常」：
      渲染函数静默 return 掉一半内容时，异常是 0，但孩子看到的是空白。
   🔴 全程走真实点击路径（跟孩子的手指一样），不直接调内部函数——
      直接调函数会绕过路由，路由断了也测不出来。 */
(function () {
  const ERR = [];
  window.addEventListener('error', e => ERR.push('JS错：' + (e.message || e)));
  const out = [], bad = [];
  const flat = s => (s || '').replace(/\s/g, '');
  const txt = sel => { const el = document.querySelector(sel); return el ? (el.innerText || '').trim() : ''; };
  const on = id => document.getElementById(id).classList.contains('on');
  const allScreens = () => document.querySelectorAll('.screen');

  function need(sel, min, what) {          // 内容短于 min 个字 = 等于没渲染
    const t = txt(sel);
    if (flat(t).length < min) { bad.push(what + ' → 空白/太短：「' + t.slice(0, 24) + '」'); return false; }
    return true;
  }
  function toKid(k) {                       // 回「选小朋友」再真点进去
    allScreens().forEach(s => s.classList.remove('on'));
    document.getElementById('screen-kid').classList.add('on');
    const c = document.querySelector('.kid-card.' + k);
    if (!c) { bad.push('选人屏上找不到 ' + k + ' 的卡片'); return false; }
    c.click();
    return on('screen-home');
  }
  function mod(name) {
    return [...document.querySelectorAll('#home-mods .mod')]
      .find(x => (x.textContent || '').indexOf(name) >= 0) || null;
  }
  function backOut() {                      // 从任何子页面回首页
    const b = document.querySelector('.screen.on .icon-btn[data-back]');
    if (b) { b.click(); return; }
    allScreens().forEach(s => s.classList.remove('on'));
    document.getElementById('screen-home').classList.add('on');
  }

  /* ── A. 每个数学关卡：点开，题干/图/说明至少有一个有内容 ── */
  for (const k of ['er', 'da']) {
    if (!toKid(k)) continue;
    const m = mod('数学');
    if (!m) { bad.push(k + '：首页没有「数学」入口'); continue; }
    m.click();
    const items = [...document.querySelectorAll('#map-grid .map-item')];
    if (!items.length) { bad.push(k + '：数学地图一个关卡都没有'); continue; }
    out.push('【' + k + '】数学地图 ' + items.length + ' 关');
    for (const it of items) {
      const nm = (it.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '?';
      it.click();
      if (!on('screen-quiz')) { bad.push(nm + '：点了没进答题屏'); backOut(); continue; }
      const okBig = need('#q-big', 0, nm) && flat(txt('#q-big')).length > 0;
      const hasSub = flat(txt('#q-sub')).length > 0;
      const hasPic = flat(txt('#q-emoji')).length > 0;
      const hasChoices = document.querySelectorAll('#q-choices .choice').length > 0;
      const hasPad = !document.getElementById('q-answer-area').classList.contains('hide');
      if (!okBig && !hasSub && !hasPic) bad.push(nm + '：题干、说明、图全空');
      if (!hasChoices && !hasPad) bad.push(nm + '：既没有选项也没有数字键盘，孩子没法作答');
      out.push('   ✓ ' + nm + '｜' + (txt('#q-big') || txt('#q-sub') || txt('#q-emoji')).replace(/\n/g, ' ').slice(0, 30) +
        (hasChoices ? ' 〔选项' + document.querySelectorAll('#q-choices .choice').length + '〕' : ' 〔键盘〕'));
      document.getElementById('quiz-back').click();
    }
    backOut();
  }

  /* ── B. 汉字学习卡：每一个分组、每一册，第一个字卡都要有字/拼音/组词 ── */
  for (const k of ['er', 'da']) {
    if (!toKid(k)) continue;
    const m = mod(k === 'da' ? '认汉字' : '认字卡') || mod('汉字') || mod('认字');
    if (!m) { bad.push(k + '：首页没有汉字入口'); continue; }
    m.click();
    if (!on('screen-map')) { bad.push(k + '：点了汉字没进地图'); backOut(); continue; }
    const books = k === 'da' ? [...document.querySelectorAll('#map-grid .chip')] : [null];
    out.push('【' + k + '】汉字分组');
    for (let bi = 0; bi < books.length; bi++) {
      if (books[bi]) books[bi].click();     // 真点「二年级下册」切册
      const items = [...document.querySelectorAll('#map-grid .map-item:not(.big)')];
      if (!items.length) { bad.push(k + ' 第' + (bi + 1) + '册：一个字表分组都没有'); continue; }
      let okcnt = 0;
      for (const it of items) {
        const nm = (it.innerText || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join(' ') || '?';
        it.click();
        if (!on('screen-learn')) { bad.push('汉字「' + nm + '」：点了没进学习卡'); backOut(); backOut(); continue; }
        const a = need('#learn-hz', 1, '汉字「' + nm + '」的田字格');
        const b = need('#learn-py', 1, '汉字「' + nm + '」的拼音');
        const c = need('#learn-info', 1, '汉字「' + nm + '」的组词/出处');
        if (a && b && c) okcnt++;
        backOut();
      }
      out.push('   ✓ ' + (books[bi] ? books[bi].textContent.trim() : '主题') + '：' + items.length +
        ' 个分组全点开，' + okcnt + ' 个有字有拼音有组词');
      if (k === 'da' && bi === 0) { backOut(); m.click(); }   // 切册后地图被重画，回地图再点下一册
    }
    backOut();
  }

  /* ── C. 独立单页：限时口算 / 乘法口诀 / 描红 / 星星 ── */
  for (const k of ['er', 'da']) {
    if (!toKid(k)) continue;
    /* 游戏乐园有「先学习才能进」的门（老曾 2026-09-20 要的）；这份是"入口都打得开"的冒烟，
       门自己由 tools/shots/t-gate.js 专门验，这里先按家长那个开关放行。 */
    if (window.__hm && window.__hm.gate) window.__hm.gate.forceOpen();
    const pages = [['限时', '#timed-q'], ['口诀', '#mul-table'], ['描', '#trace-canvas'], ['星星', '#achv-grid']];
    for (const [name, sel] of pages) {
      const m = mod(name);
      if (!m) { out.push('   · ' + k + ' 首页没有「' + name + '」入口（正常，二宝就是没有限时口算）'); continue; }
      m.click();
      if (sel === '#trace-canvas') {         // 描红是 canvas，量它有没有真画上格子
        const cv = document.getElementById('trace-canvas');
        if (!cv || !cv.width || !cv.height) bad.push(k + ' 描红：canvas 尺寸是 0，孩子看到的是空白');
        else out.push('   ✓ ' + k + ' 描红 canvas ' + cv.width + '×' + cv.height);
      } else if (need(sel, 1, k + ' 「' + name + '」页 ' + sel)) {
        out.push('   ✓ ' + k + ' 「' + name + '」渲染正常');
      }
      backOut();
    }
  }

  /* ── D. 全局 JS 错误 ── */
  if (ERR.length) bad.push('页面抛出 ' + ERR.length + ' 个 JS 错误：' + ERR.slice(0, 4).join(' ｜ '));

  const pre = document.createElement('pre');
  pre.id = 'TESTOUT';
  pre.textContent =
    '===== 冒烟：每个入口真点一遍 =====\n' + out.join('\n') +
    '\n\n===== 问题 ' + bad.length + ' 处 =====\n' +
    (bad.length ? bad.map(x => '  🔴 ' + x).join('\n') : '  ✅ 没有空白入口、没有 JS 错误') +
    '\n\n' + (bad.length ? '❌ 有 ' + bad.length + ' 处问题' : '✅ 全部入口都能打开');
  document.body.appendChild(pre);
})();
