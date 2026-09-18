/* 认字闯关答错后的「选项读音揭示条」硬核验。
   驱动的是真界面：切小朋友 → 进认字闯关 → **点一个错的选项** → 查揭示条。

   判据不是「揭示条存在」，而是「拼音跟字对得上」——
   🔴 揭示条最容易出的错是**错位**（拼音按未打乱的顺序算、字按打乱的顺序显示），
      那样孩子看到的每一个读音都是错的，比不做还糟。所以逐张卡交叉核对：
        · 答案那张：拼音必须等于**题面自己声称的读音**（py 型题面就是拼音；
          二宝的看图题去 HANZI_QI 里查这个字自己的 py）——独立于 PY_CHAR 的一份来源。
        · 干扰那几张：拼音必须等于 PY_CHAR[这个字]。
      只要两张卡的字和音错开一位，这里立刻报。
   另外还查：字池有没有串（二宝的闯关不能拿二年级的字考）。 */
setTimeout(function () {
  var out = [], fails = [];
  function line(ok, msg) { out.push((ok ? '  ✅ ' : '  🔴 ') + msg); if (!ok) fails.push(msg); }
  function head(t) { out.push('\n== ' + t + ' =='); }

  var hm = window.__hm;
  if (!hm) { out.push('🔴 没有 window.__hm'); return done(); }

  var PY = hm.py.char;
  var QI = hm.HANZI_QI;
  var HANZI_G2 = hm.HANZI_G2;
  var QI_CHARS = {}, G2_CHARS = {};
  Object.keys(QI).forEach(function (k) {
    (QI[k].words || []).forEach(function (w) { QI_CHARS[w.z] = w.py; });
  });
  (function walk(o) {
    if (Array.isArray(o)) {
      if (o.length === 4 && typeof o[0] === 'string' && o[0].length === 1) G2_CHARS[o[0]] = o[1];
      else o.forEach(walk);
    } else if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { walk(o[k]); }); }
  })(HANZI_G2);

  var nWrong = 0, nRev = 0, nNoRev = 0, nAlien = 0, wordChecked = 0;

  /* ── 主循环：点错 → 查揭示条 → 下一题（答完一轮就再来一轮） ── */
  /* 二宝首页上这块叫「认字卡」，大宝叫「认汉字」——按名字找就得两个都认。
     🔴 用 /认.字/ 而不是 indexOf('认字')：大宝那个名字中间**隔着一个「汉」**，
        拿两字连排去找永远找不到（这次就踩了，报「找不到认字入口」但屏幕上明明有）。 */
  function pickHanziMod() {
    var ms = document.querySelectorAll('#home-mods .mod');
    for (var i = 0; i < ms.length; i++) if (/认/.test(ms[i].textContent) && /字/.test(ms[i].textContent)) return ms[i];
    return null;
  }

  function check(kid, label, rounds, next) {
    var card = document.querySelector('.kid-card.' + kid);
    if (card) card.click();
    setTimeout(function () {
      var mod = pickHanziMod();
      if (!mod) {
        var box = document.getElementById('home-mods');
        line(false, label + ' 找不到认字入口｜现在屏幕=' + hm.screen() +
          '｜首页模块数=' + (box ? box.children.length : '无盒子') +
          '｜模块文字=' + (box ? box.textContent.slice(0, 60) : '') +
          '｜选到小朋友了吗=' + (hm.state().cur || '没选'));
        return next();
      }
      mod.click();
      setTimeout(function () {
        var big = document.querySelector('#map-grid .map-item.big');
        if (!big) { line(false, label + ' 找不到「认字闯关」入口'); return next(); }
        big.click();
        setTimeout(function () { step(0); }, 60);

        function step(r) {
          if (r >= rounds) return next();
          var Q = hm.quiz();
          /* 一轮答完会停在结算页，再开一轮接着点 */
          var rs = document.getElementById('quiz-result');
          if (!Q || !Q.list || Q.i >= Q.list.length || (rs && !rs.classList.contains('hide'))) {
            var again = document.getElementById('rs-again');
            if (again && rs && !rs.classList.contains('hide')) { again.click(); return setTimeout(function () { step(r); }, 60); }
            line(false, label + ' 拿不到题目就停在第 ' + r + ' 轮');
            return next();
          }
          var q = Q.list[Q.i];

          /* 字池不能串：二宝的闯关里不许出现二年级的字，反过来也一样 */
          var alien = q.choices.filter(function (c) {
            var t = String(c);
            if (t.length !== 1 || !/[一-龥]/.test(t)) return false;
            return kid === 'er' ? !QI_CHARS[t] : !G2_CHARS[t];
          });
          if (alien.length) { nAlien++; line(false, label + ' 拿到别的字池的字：' + alien.join('、')); }

          var btns = [].slice.call(document.querySelectorAll('#q-choices .choice'));
          var wrongBtn = null;
          btns.forEach(function (b) {
            if (!wrongBtn && b.textContent.trim() !== String(q.answer).trim()) wrongBtn = b;
          });
          if (!wrongBtn) { line(false, label + ' 找不到错误选项'); return next(); }
          wrongBtn.click();
          nWrong++;

          var isWord = q.choices.some(function (c) { return String(c).length > 1; });
          var allPy = q.choices.every(function (c) {
            return /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]+$/.test(String(c));
          });

          var row = document.getElementById('q-feedback').querySelector('.rv-row');
          if (!row) {
            /* 只该有一种情况没有揭示条：选项本来就是拼音的「看字选拼音」，没字可揭示 */
            if (allPy) nNoRev++;
            else { line(false, label + ' 答错了却没出「这几个字念什么」：' + q.answer); }
            return advance();
          }
          nRev++;
          var cards = [].slice.call(row.querySelectorAll('.rv-card'));
          if (cards.length !== q.choices.length) {
            line(false, label + ' 揭示条张数 ' + cards.length + ' ≠ 选项数 ' + q.choices.length);
          }
          var shown = cards.map(function (c) {
            var z = c.querySelector('.z') || c.querySelector('.w');
            return z ? z.textContent.trim() : '?';
          });
          var want = q.choices.map(String);
          if (shown.slice().sort().join('|') !== want.slice().sort().join('|')) {
            line(false, label + ' 揭示的字跟选项对不上：' + shown.join('、') + ' vs ' + want.join('、'));
          }
          if (new Set(shown).size !== shown.length) line(false, label + ' 揭示条里有重复的字');

          /* 🔴 逐张核对「字 ↔ 拼音」有没有错位 */
          var mis = [];
          cards.forEach(function (c) {
            var ch = ((c.querySelector('.z') || c.querySelector('.w')) || {}).textContent.trim();
            var pe = c.querySelector('.p');
            var py = pe ? pe.textContent.trim() : '';
            if (!py) { mis.push(ch + ' 没拼音'); return; }
            var expect = null;
            if (isWord) expect = null;
            else if (ch === String(q.answer)) expect = QI_CHARS[ch] || q.big.replace(/<[^>]+>/g, '').trim();
            else expect = PY[ch];
            if (expect && py !== expect) mis.push(ch + ' 显示「' + py + '」应为「' + expect + '」');
          });
          if (mis.length) line(false, label + ' 字↔音错位：' + mis.join('；'));

          /* 词题：揭示条上的拼音，要跟**点字注音那条路**（py.read 真点坐标）对得上。
             这是两条不同的代码路径（揭示条直接算 vs 气泡从屏幕坐标反推），
             两条路都说一样才叫对；自己跟自己比是假绿。 */
          if (isWord) {
            var misW = [];
            cards.forEach(function (c) {
              var we = c.querySelector('.w') || c.querySelector('.z');
              var w = we.textContent.trim();
              var pe = c.querySelector('.p');
              var py = pe ? pe.textContent.trim().split(/\s+/) : [];
              if (py.length !== w.length || py.join('').indexOf('undefined') >= 0) {
                misW.push(w + '(长' + w.length + ') 拼音节数 ' + py.length + ' ≠ 字数 ' + w.length +
                          '｜原始串=' + JSON.stringify(pe ? pe.textContent : null) +
                          '｜卡片HTML=' + c.outerHTML.slice(0, 120));
                return;
              }
              we.scrollIntoView({ block: 'center' });          // 屏幕外的点 caretRangeFromPoint 会返回 null
              for (var i = 0; i < w.length; i++) {
                var r = document.createRange();
                r.setStart(we.firstChild, i); r.setEnd(we.firstChild, i + 1);
                var b = r.getBoundingClientRect();
                if (!b.width) { misW.push(w + ' 第' + (i + 1) + '字量不到位置'); continue; }
                var info = hm.py.read(b.left + b.width / 2, b.top + b.height / 2);
                if (!info) { misW.push(w + ' 第' + (i + 1) + '字点字注音读不到'); continue; }
                wordChecked++;
                if (info.py !== py[i]) misW.push(w + ' 第' + (i + 1) + '字「' + w[i] + '」揭示条写 ' + py[i] + '，点字注音给 ' + info.py);
              }
            });
            if (misW.length) line(false, label + ' 整词拼音对不上：' + misW.join('；'));
          }

          var ansCards = cards.filter(function (c) { return c.classList.contains('ans'); });
          if (ansCards.length !== 1 || ansCards[0].textContent.indexOf(String(q.answer)) < 0) {
            line(false, label + ' 正确答案那张没标出来／标错了');
          }
          advance();

          function advance() {
            var nx = document.getElementById('q-next');
            if (nx && !nx.classList.contains('hide')) nx.click();
            setTimeout(function () { step(r + 1); }, 60);
          }
        }
      }, 120);
    }, 120);
  }

  /* ── 答对时不许出揭示条（产品决定：不拖慢连对的节奏） ── */
  function checkNoRevealOnRight(kid, label, rounds, next) {
    var card = document.querySelector('.kid-card.' + kid);
    if (card) card.click();
    setTimeout(function () {
      var mod = pickHanziMod(); if (mod) mod.click();
      setTimeout(function () {
        var big = document.querySelector('#map-grid .map-item.big'); if (big) big.click();
        setTimeout(function () { step(0); }, 60);
        var seen = 0, bad = 0;
        function step(r) {
          if (r >= rounds) {
            line(bad === 0 && seen > 0, label + ' 答对时不出揭示条（查了 ' + seen + ' 题，冒出 ' + bad + ' 次）');
            return next();
          }
          var Q = hm.quiz();
          var rs = document.getElementById('quiz-result');
          if (!Q || !Q.list || Q.i >= Q.list.length || (rs && !rs.classList.contains('hide'))) {
            if (rs && !rs.classList.contains('hide')) {
              document.getElementById('rs-again').click();
              return setTimeout(function () { step(r); }, 60);
            }
            return next();
          }
          var q = Q.list[Q.i];
          var btns = [].slice.call(document.querySelectorAll('#q-choices .choice'));
          var right = null;
          btns.forEach(function (b) { if (b.textContent.trim() === String(q.answer).trim()) right = b; });
          if (!right) { return step(r + 1); }              // 拼音选项题跳过
          seen++;
          right.click();
          if (document.getElementById('q-feedback').querySelector('.rv-row')) bad++;
          setTimeout(function () { step(r + 1); }, 2300);   // 答对是自动跳下一题
        }
      }, 120);
    }, 120);
  }

  head('大宝 · 认字闯关（答错 → 揭示条）');
  check('da', '大宝', 26, function () {
    head('二宝 · 看图选字（答错 → 揭示条）');
    check('er', '二宝', 18, function () {
      head('答对时不该出揭示条');
      checkNoRevealOnRight('da', '大宝', 12, function () { report(); });
    });
  });

  function report() {
    var total = fails.length;
    /* 词题的字是靠「点字注音」那条路交叉核对的，一个字都没核到就是假绿 */
    line(wordChecked > 0, '词题拼音跟点字注音逐字交叉核对了 ' + wordChecked + ' 个字（>0 才不是假绿）');
    out.push('\n共点错 ' + nWrong + ' 题：出揭示条 ' + nRev + ' 次、无字可揭示 ' + nNoRev + ' 次' +
             (nAlien ? '，字池串了 ' + nAlien + ' 次' : '，字池没串'));
    out.push(fails.length === 0 ? '✅ 揭示条的读音跟字全部对得上' : '🔴 揭示条有 ' + fails.length + ' 处问题');
    done();
  }
  function done() {
    var pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  }
}, 300);
