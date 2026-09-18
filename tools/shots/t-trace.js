/* 「写一写 / 描一描」描红回执的硬核验。
   这一块**没有测试能替人看图**，但「机制」必须能被断言抓住，所以分开验：
     · 这里验机制：什么时候算写过、计数涨不涨、星星发不发、重复写会不会重复发。
     · 长相（章盖在哪、字好看不好看）另走截图逐张看，不在这份里。

   🔴 判据是「真在画布上画了一道」而不是「调了 markTraced」——
      直接调内部函数等于自己验自己，笔画长度不够就盖章这种错永远抓不到。
      所以这里全部派发真的 pointer 事件，走 cv.onpointerdown/move/up 那条路。 */
setTimeout(function () {
  var out = [], fails = [];
  function line(ok, msg) { out.push((ok ? '  ✅ ' : '  🔴 ') + msg); if (!ok) fails.push(msg); }
  function head(t) { out.push('\n== ' + t + ' =='); }

  var hm = window.__hm;
  if (!hm) { out.push('🔴 没有 window.__hm'); return done(); }

  var S = hm.state(), p = S.profiles.er;
  p.traced = {}; p.traceStars = 0;                 // 从干净状态起验
  var stars0 = p.stars;

  var cv = document.getElementById('trace-canvas');
  var wrap = document.getElementById('trace-wrap');
  var stamp = document.getElementById('trace-stamp');
  var got = document.getElementById('trace-got');
  var nTraced = function () { return Object.keys(p.traced).length; };
  /* 当前在描哪个字：从标题「✍️ 写「意」」里抠出来。
     🔴 别用「把非汉字字符全删掉」那种写法——标题里还有个「写」字会一起被留下。 */
  var cur = function () {
    var m = document.getElementById('trace-title').textContent.match(/「(.)」/);
    return m ? m[1] : '?';
  };

  /* 画一笔走 _lib.js 里那份 drawTrace（截图脚本也用它，只有一处实现） */
  function draw(total) { drawTrace(total); }

  function stampOn() { return !stamp.classList.contains('hide'); }
  function stampText() { return stamp.textContent.trim(); }

  function begin(next) {
    var card = document.querySelector('.kid-card.er');
    if (card) card.click();
    setTimeout(function () {
      var mod = pickMod('描一描') || pickMod('写一写');
      if (!mod) { line(false, '找不到描红入口｜现在屏幕=' + hm.screen()); return next(); }
      mod.click();
      setTimeout(function () {
        if (hm.screen() !== 'screen-trace') { line(false, '没进到描红屏，停在 ' + hm.screen()); return next(); }
        if (got.textContent.indexOf('0 个字') < 0) line(false, '清空后计数不是 0：' + got.textContent);
        next();
      }, 100);
    }, 100);
  }

  /* ── 一、笔画不够长不算写过 ── */
  function t1(next) {
    head('写不满一格 · 不算写过');
    var z0 = cur(), n0 = nTraced();
    var short = wrap.clientWidth * 0.3;            // 门槛是 1.6 倍边长，这个差得远
    draw(short);
    setTimeout(function () {
      line(!stampOn(), '随手划一道没有盖章（章=' + (stampOn() ? stampText() : '没出') + '）');
      line(nTraced() === n0, '随手划一道没算进「写过的字」（' + n0 + ' → ' + nTraced() + '）');
      line(got.textContent.indexOf(String(n0) + ' 个字') >= 0, '计数没动：' + got.textContent);
      /* 🔴 关键：随手划一道要能「接着写」。如果这里把 marked 提前置真，
         真描完那一遍就永远盖不上章——这是最阴的一种错。 */
      draw(wrap.clientWidth * 2.2);
      setTimeout(function () {
        line(stampOn(), '短划之后接着真描一遍，章照样盖得出来（说明门槛没把状态弄脏）');
        next();
      }, 120);
    }, 120);
  }

  /* ── 二、真描一遍：记账 + 回执 ── */
  var tracedAfter1;
  function t2(next) {
    head('真描一遍 · 记账与回执');
    var z0 = cur(), n0 = nTraced();
    line(nTraced() === n0, '（接上一步，已经把「' + z0 + '」记下了，共 ' + n0 + ' 个）');
    line(!!p.traced[z0], '写过的字里确实记着「' + z0 + '」');
    tracedAfter1 = nTraced();
    /* 同一个字再写一遍：不许重复记账、不许重复发星 */
    var starsB = p.stars;
    draw(wrap.clientWidth * 2.2);
    setTimeout(function () {
      line(nTraced() === tracedAfter1, '同一个字重写不重复记账（' + tracedAfter1 + ' → ' + nTraced() + '）');
      line(p.stars === starsB, '同一个字重写不重复发星（' + starsB + ' → ' + p.stars + '）');
      line(stampOn(), '重写照样给回执（孩子看得见才有动力）');
      next();
    }, 200);
  }

  /* ── 三、章会自己消失 ── */
  function t3(next) {
    head('章 1.4 秒后自动消失');
    line(stampOn(), '（此刻章还在）');
    setTimeout(function () {
      line(!stampOn(), '等 1.5 秒后章自动收起来了');
      next();
    }, 1500);
  }

  /* ── 四、擦掉重写：章要能再盖，但账不重复记 ── */
  function t4(next) {
    head('擦掉重写');
    var z0 = cur(), n0 = nTraced(), s0 = p.stars;
    draw(wrap.clientWidth * 2.2);
    setTimeout(function () {
      if (!stampOn()) { line(false, '写满了却没盖章，后面不用验了'); return next(); }
      document.getElementById('trace-clear').click();
      setTimeout(function () {
        line(!stampOn(), '擦掉之后章收走了（不然孩子会以为还没擦）');
        line(nTraced() === n0 && p.stars === s0, '擦掉本身不改变已记账的成果');
        draw(wrap.clientWidth * 2.2);
        setTimeout(function () {
          line(stampOn(), '擦掉重写还能再盖一次章');
          line(nTraced() === n0, '重写同一个字还是不重复记账');
          next();
        }, 150);
      }, 100);
    }, 150);
  }

  /* 一直换字写到 nTraced() 到 target 为止（撞到写过的字就再换一个） */
  function writeUntil(target, next) {
    var guard = 0;
    (function one() {
      if (nTraced() >= target) return next();
      if (guard++ > 60) { line(false, '换了 60 次字还没凑齐 ' + target + ' 个不同的字'); return next(); }
      document.getElementById('trace-next').click();
      setTimeout(function () {
        var z = cur();
        if (p.traced[z]) return one();             // 撞到写过的字：换一个再来，这一趟不算
        draw(wrap.clientWidth * 2.2);
        setTimeout(one, 220);
      }, 120);
    })();
  }

  /* ── 五、换 5 个字 → 恰好 1 颗星 ── */
  function t5(next) {
    head('每写满 5 个字发 1 颗星');
    var s0 = p.stars, n0 = nTraced();
    var target = (Math.floor(n0 / 5) + 1) * 5;     // 下一个 5 的整数倍
    writeUntil(target, function () {
      setTimeout(function () {
        line(p.stars === s0 + 1, '写到 ' + nTraced() + ' 个字（跨过 ' + target + '）后，星星恰好 +1（' + s0 + ' → ' + p.stars + '）');
        line(p.traceStars === Math.floor(nTraced() / 5), 'traceStars 跟字数对得上（' + p.traceStars + ' = floor(' + nTraced() + '/5)）');
        next();
      }, 250);
    });
  }

  /* ── 五之二、写到 10 个：奖章要真的亮起来 ── */
  function t5b(next) {
    head('写过 10 个字 · 奖章');
    var s0 = p.stars;
    writeUntil(10, function () {
      setTimeout(function () {
        line(p.stars === s0 + 1, '第 5→10 个之间又恰好 +1 颗星（' + s0 + ' → ' + p.stars + '）');
        line(p.traceStars === 2, 'traceStars = 2');
        next();
      }, 250);
    });
  }

  /* ── 六、星星页读数 + 奖章 ── */
  function t6(next) {
    head('星星页读数');
    document.querySelector('#screen-trace [data-back]').click();
    setTimeout(function () {
      var mod = pickMod('星星') || pickMod('奖章');
      if (mod) mod.click();
      setTimeout(function () {
        var txt = document.getElementById('report-card').textContent;
        line(txt.indexOf('写过的字') >= 0, '学习报告里有「写过的字」这一行');
        line(txt.indexOf(String(nTraced()) + ' 个') >= 0, '报告里写的字数 ' + nTraced() + ' 跟账一致｜报告片段=' +
          (txt.match(/写过的字[^｜\n]{0,12}/) || ['（没找到）'])[0]);
        line(document.getElementById('achv-star').textContent === String(p.stars),
          '星星页顶端的大数字跟账一致（' + document.getElementById('achv-star').textContent + ' vs ' + p.stars + '）');
        /* 奖章：写过 10 个字那枚必须已经亮着（locked 是灰的） */
        var tr = null;
        [].slice.call(document.querySelectorAll('#achv-grid .achv')).forEach(function (el) {
          if (el.textContent.indexOf('写过 10 个字') >= 0) tr = el;
        });
        if (!tr) line(false, '奖章格里没有「写过 10 个字」这枚（数据里加了、界面没渲染出来？）');
        else line(!tr.classList.contains('locked'), '「写过 10 个字」奖章已点亮（写够了还是灰的就是判据没接上）');
        next();
      }, 150);
    }, 150);
  }

  begin(function () {
    t1(function () { t2(function () { t3(function () { t4(function () {
      t5(function () { t5b(function () { t6(report); }); });
    }); }); }); });
  });

  function report() {
    out.push('\n共写满 ' + nTraced() + ' 个字 · 星星 ' + stars0 + ' → ' + p.stars);
    out.push(fails.length === 0 ? '✅ 描红回执的机制全部对得上' : '🔴 描红回执有 ' + fails.length + ' 处问题');
    done();
  }
  function done() {
    var pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  }
}, 300);
