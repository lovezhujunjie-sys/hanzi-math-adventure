/* 错题本「能练」的硬核验。
   以前错题本只能看：它存的是题干**字符串**（label），存完就扔掉了题目本身，
   想重出都无从下手。现在每道题带一张「凭据」(_src)，错题本照着重出。

   这份测试要盯死的是**凭据有没有接错**——最容易出、也最难肉眼发现的错法有两种：
     · 重练时把字丢了：重出的是随机别的字，孩子练了一晚上没练到错的那个；
     · 重练时记错账：成绩记到别的关卡/别的单元头上，报告从此是错的。
   所以判据不是「有重练按钮」，而是「重练出来的每道题，都能对上错题本里的那个字/那一关」。
   另外这里还盯一件旧账：汉字闯关的成绩以前**进不了学习报告**（_key 没设，全落 stats.misc）。 */
setTimeout(function () {
  var out = [], fails = [], ERRS = [];
  window.addEventListener('error', function (e) { ERRS.push(String(e.message)); });
  function line(ok, msg) { out.push((ok ? '  ✅ ' : '  🔴 ') + msg); if (!ok) fails.push(msg); }
  function head(t) { out.push('\n== ' + t + ' =='); }

  var hm = window.__hm;
  if (!hm) { out.push('🔴 没有 window.__hm'); return done(); }

  var S = hm.state(), p = S.profiles.da;
  p.wrong = []; p.stats = {};                 // 从干净账本起验
  var QI_CHARS = {};
  Object.keys(hm.HANZI_QI).forEach(function (k) {
    (hm.HANZI_QI[k].words || []).forEach(function (w) { QI_CHARS[w.z] = 1; });
  });
  var G2_CHARS = {}, Z_PY = {};
  hm.hanziPool().forEach(function (w) { Z_PY[w.z] = w.py; });
  (function walk(o) {
    if (Array.isArray(o)) {
      if (o.length === 4 && typeof o[0] === 'string' && o[0].length === 1) G2_CHARS[o[0]] = 1;
      else o.forEach(walk);
    } else if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { walk(o[k]); }); }
  })(hm.HANZI_G2);

  /* 二宝首页那块叫「认字卡」，大宝叫「认汉字」——按名字找就得两个都认 */
  function pickHanziMod() {
    var ms = document.querySelectorAll('#home-mods .mod');
    for (var i = 0; i < ms.length; i++) if (/认/.test(ms[i].textContent) && /字/.test(ms[i].textContent)) return ms[i];
    return null;
  }
  function backHome() {
    var b = document.querySelector('#screen-stars [data-back]') || document.querySelector('#screen-quiz .icon-btn');
    if (b) b.click();
  }
  /* 一路点错，直到这一轮答完（结算页出现） */
  var nAns = 0, nChoice = 0, nType = 0, nEmpty = 0;
  function answerAllWrong(next, limit) {
    var n = 0;
    (function step() {
      var Q = hm.quiz(), rs = document.getElementById('quiz-result');
      if (!Q || !Q.list || Q.i >= Q.list.length || (rs && !rs.classList.contains('hide'))) return next(n);
      if (n++ > (limit || 40)) { line(false, '答了 40 题还没结束一轮，停'); return next(n); }
      var q = Q.list[Q.i];
      var btns = [].slice.call(document.querySelectorAll('#q-choices .choice')), w = null;
      btns.forEach(function (b) { if (!w && b.textContent.trim() !== String(q.answer).trim()) w = b; });
      nAns++;
      if (!w) {                                    // 填空型：随便写个 0 交上去（多半是错的）
        var pad = document.querySelectorAll('#numpad button');
        for (var i = 0; i < pad.length; i++) if (pad[i].textContent === '0') { pad[i].click(); break; }
        nType++;
        if (!hm.quiz().typed) nEmpty++;
        var ok = document.getElementById('answer-ok'); if (ok) ok.click();
      } else { w.click(); nChoice++; }
      var nx = document.getElementById('q-next');
      if (nx && !nx.classList.contains('hide')) nx.click();
      setTimeout(step, 90);
    })();
  }

  /* ── 一、汉字错题：凭据必须精确到「字」 ── */
  function t1(next) {
    head('汉字错题 · 凭据');
    var card = document.querySelector('.kid-card.da'); if (card) card.click();
    setTimeout(function () {
      var mod = pickHanziMod(); if (!mod) { line(false, '找不到认字入口'); return next(); }
      mod.click();
      setTimeout(function () {
        var big = document.querySelector('#map-grid .map-item.big');
        if (!big) { line(false, '找不到认字闯关入口'); return next(); }
        big.click();
        setTimeout(function () {
          answerAllWrong(function (n) {
            line(p.wrong.length >= 10, '答错了一轮，错题本收进来 ' + p.wrong.length + ' 条');
            /* 标题必须带上「考的是什么」——只写「哪个词里有这个字？」等于没写。
               考「字」的题标题里该有那个字，考「拼音」的题该有那行拼音，两者有其一即可。 */
            var blank = p.wrong.filter(function (w) {
              if (!w.src || !w.src.z) return false;
              return w.q.indexOf(w.src.z) < 0 && (!Z_PY[w.src.z] || w.q.indexOf(Z_PY[w.src.z]) < 0);
            });
            line(blank.length === 0, '每条标题里都带着考的内容（缺 ' + blank.length + ' 条）' +
              (blank.length ? '：' + blank.slice(0, 3).map(function (w) { return w.q; }).join(' ｜ ') : '') +
              '｜样例：' + p.wrong.slice(0, 3).map(function (w) { return w.q; }).join(' ／ '));
            var bad = p.wrong.filter(function (w) { return !w.src || w.src.k !== 'hanzi' || !w.src.z; });
            line(bad.length === 0, '每条错题都带「哪个字」的凭据（缺 ' + bad.length + ' 条）');
            var alien = p.wrong.filter(function (w) { return w.src && w.src.z && !G2_CHARS[w.src.z]; });
            line(alien.length === 0, '凭据里的字都是大宝字库里的（例外 ' + alien.length + ' 条）');
            var st = p.stats.hanzi_quiz;
            line(!!st && st.total >= 10, '认字闯关的成绩记进了 hanzi_quiz（' + (st ? st.right + '/' + st.total : '没这本账') + '）');
            next();
          });
        }, 150);
      }, 150);
    }, 150);
  }

  /* ── 二、重练：出的必须还是那些字 ── */
  function t2(next) {
    head('重练 · 出的还得是那些字');
    var want = {};
    p.wrong.slice(0, 10).forEach(function (w) { if (w.src) want[w.src.z] = 1; });
    var nWant = Object.keys(want).length;   // 不同的字有几个
    backHome();
    setTimeout(function () {
      var mod = pickModTitle('星星') || pickMod('奖章'); if (mod) mod.click();
      setTimeout(function () {
        var rd = document.getElementById('wb-redo');
        if (!rd) {
          line(false, '错题本上没有「再练」按钮｜屏幕=' + hm.screen() +
            '｜报告卡字符数=' + document.getElementById('report-card').textContent.length +
            '｜错题卡=' + document.getElementById('wrongbook-card').textContent.slice(0, 40) +
            '｜JS错误=' + (ERRS.join(' / ') || '无'));
          return next();
        }
        /* 按钮上的数字＝**题目条数**，不是「不同的字数」（同一个字可能错了两次，
           🔴 我第一版就是拿不同的字数去比，条数 10 比 9 就误报了一条）。
           所以这里从按钮读数字，再跟点开之后的卷子长度对——不去重算产品那套取数规则。 */
        var nBtn = (rd.textContent.match(/\d+/) || ['0'])[0] * 1;
        line(nBtn > 0, '按钮上写着要练几道：' + rd.textContent.trim());
        rd.click();
        setTimeout(function () {
          var Q = hm.quiz();
          if (!Q || !Q.list) { line(false, '点了重练却没进答题界面（屏幕=' + hm.screen() + '）'); return next(); }
          line(Q.list.length === nBtn, '卷子长度跟按钮上的数字一致（按钮 ' + nBtn + ' / 卷子 ' + Q.list.length + '）');
          /* 🔴 核心判据：每道重练题「考的字」必须等于错题本里那个字，
             而且要真的出现在题面里（不是光在字段里挂着）。 */
          var mis = [];
          Q.list.forEach(function (q) {
            var z = q._src && q._src.z;
            if (!z) { mis.push('第' + (Q.list.indexOf(q) + 1) + '题没有凭据'); return; }
            if (!want[z]) { mis.push('出了没做错过的字「' + z + '」'); return; }
            var stem = String(q.big || '') + String(q.sub || '') + String(q.story || '');
            var hit = String(q.answer) === z || stem.indexOf(z) >= 0 ||
                      String(q.answer).indexOf(z) >= 0 ||
                      (q.reveal && q.reveal.items.some(function (it) { return it.t === z && it.ans; }));
            if (!hit) mis.push('「' + z + '」没出现在它自己的题里');
          });
          line(mis.length === 0, '每道重练题都对得上做错过的那个字' + (mis.length ? '：' + mis.join('；') : ''));
          var tt = document.getElementById('quiz-title').textContent;
          line(tt === '🎯 再练错题', '标题是「🎯 再练错题」：' + tt);
          next();
        }, 250);
      }, 150);
    }, 150);
  }

  /* ── 三、重练的成绩不许另开一本账 ── */
  function t3(next) {
    head('重练 · 账还是记原来那本');
    var n0 = (p.stats.hanzi_quiz || {}).total || 0;
    answerAllWrong(function () {
      var n1 = (p.stats.hanzi_quiz || {}).total || 0;
      line(n1 > n0, '重练的成绩并进了「认字闯关」这本账（' + n0 + ' → ' + n1 + '）');
      line(!p.stats.wrong_redo, '没有多出一本叫 wrong_redo 的账（有的话报告会漏统计）');
      next();
    });
  }

  /* ── 四、数学错题：凭据是「哪一关」，重练出同一关的题 ── */
  function t4(next) {
    head('数学错题 · 凭据');
    p.wrong = [];                      // 只清错题本；stats 留着，后面报告那步还要看汉字成绩
    backHome();
    setTimeout(function () {
      var m = pickMod('数学'); if (!m) { line(false, '找不到数学入口'); return next(); }
      m.click();
      setTimeout(function () {
        var it = null;
        [].slice.call(document.querySelectorAll('#map-grid .map-item')).forEach(function (el) {
          if (!it && /加法|减法|乘法|除法/.test(el.textContent)) it = el;
        });
        if (!it) { line(false, '关卡表里找不到加减法关卡'); return next(); }
        var lvName = it.querySelector('.mi-name').textContent.trim();
        it.click();
        setTimeout(function () {
          var Q0 = hm.quiz();
          var lvId = Q0 && Q0.list[0] && Q0.list[0]._key;
          line(!!lvId && lvId !== 'misc', '数学题带上了关卡号 _key = ' + lvId + '（以前是 misc，成绩看不见）');
          answerAllWrong(function () {
            line(p.wrong.length > 0, '数学错题收了 ' + p.wrong.length + ' 条');
            var bad = p.wrong.filter(function (w) { return !w.src || w.src.k !== 'math'; });
            line(bad.length === 0, '数学错题都带「哪一关」的凭据（缺 ' + bad.length + ' 条）');
            line(p.wrong.length > 0 && p.wrong[0].src.id === lvId,
              '凭据里的关卡号跟刚才那关一致（' + (p.wrong[0] && p.wrong[0].src.id) + ' vs ' + lvId + '，关名「' + lvName + '」）');
            out.push('  （下面验重练：数学题是现场生成的，出来的是**同一关的另一道**，不是原题）');
            out.push('  （诊断：stats=' + JSON.stringify(p.stats) + ' 答了 ' + nAns + ' 题，'
              + '其中点选项 ' + nChoice + ' 次、写字 ' + nType + ' 次、写出空值 ' + nEmpty + ' 次）');
            backHome();
            setTimeout(function () {
              var mod = pickModTitle('星星') || pickMod('奖章'); if (mod) mod.click();
              setTimeout(function () {
                var rd = document.getElementById('wb-redo');
                if (!rd) { line(false, '数学错题在错题本上没有「再练」按钮'); return next(); }
                rd.click();
                setTimeout(function () {
                  var Q = hm.quiz();
                  if (!Q || !Q.list) { line(false, '数学错题重练没进答题界面'); return next(); }
                  var wantKey = p.wrong[0].src.id;
                  var wrongKey = Q.list.filter(function (q) { return q._key !== wantKey; });
                  line(Q.list.length > 0, '重练卷子出了 ' + Q.list.length + ' 道');
                  line(wrongKey.length === 0, '每道都记原来那一关（不对的 ' + wrongKey.length + ' 道）');
                  next();
                }, 250);
              }, 150);
            }, 150);
          });
        }, 200);
      }, 200);
    }, 200);
  }

  /* ── 五、报告里看得见汉字成绩 ── */
  function t5(next) {
    head('学习报告 · 认字闯关');
    backHome();
    setTimeout(function () {
      var mod = pickModTitle('星星') || pickMod('奖章'); if (mod) mod.click();
      setTimeout(function () {
        var row = null;
        [].slice.call(document.querySelectorAll('#report-card .list-row')).forEach(function (r) {
          var k = r.querySelector('.k');
          if (!row && k && k.textContent.trim() === '认字闯关') row = r;
        });
        if (!row) { line(false, '报告里没有「认字闯关」这一行'); return next(); }
        var v = row.querySelector('.v').textContent.trim();
        var st = p.stats.hanzi_quiz;
        line(/\d+\s*\/\s*\d+\s*对/.test(v), '「认字闯关」这一行是「对/总 · 百分比」：' + v);
        line(v.indexOf(String(st.total) + ' 对') >= 0 || v.indexOf('/ ' + st.total) >= 0,
          '这一行的总数跟账本一致（界面「' + v + '」vs 账本 ' + st.right + '/' + st.total + '）');
        next();
      }, 150);
    }, 150);
  }

  t1(function () { t2(function () { t3(function () { t4(function () { t5(report); }); }); }); });

  function report() {
    if (ERRS.length) out.push('\n🔴 页面上出过 JS 错误：' + ERRS.join(' / '));
    out.push('\n错题本共 ' + p.wrong.length + ' 条 · stats 账本：' + Object.keys(p.stats).join('、'));
    out.push(fails.length === 0 ? '✅ 错题本能练，凭据没错位' : '🔴 错题本重练有 ' + fails.length + ' 处问题');
    done();
  }
  function done() {
    var pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  }
}, 300);
