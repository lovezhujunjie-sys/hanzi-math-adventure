/* 写一写「手指写不出来」的硬核验（老曾 2026-09-20 报的 bug）。

   症状：手机/iPad 上写**竖笔画**写不出来（横着写没事）。
   根因两条，两条都要有测试守着：
     ① iOS 把竖向触摸当成翻页/回弹手势 → 竖向笔迹被整页滚动抢走。
        修法＝写一写整页锁死（html.lock-scroll）+ touchmove 非被动拦截 + 手指走 touch 那条路。
     ② 「写满一格」的门槛原来是 1.6 倍格子边长，而孩子把「一」「丨」这种单笔字
        完整描一遍只有 0.88 倍 → 第一次正确描完屏幕上什么都不发生。门槛改成 0.8 倍。

   🔴 这里派发的是**真的 TouchEvent**（不是 pointer 事件）——
      上一版的测试全用 pointerType:'mouse'，跟真机上那根手指走的根本是两条路，
      所以这个 bug 在测试全绿的情况下照样漏到了老曾手上。 */
setTimeout(function () {
  var out = [], fails = [];
  function line(ok, msg) { out.push((ok ? '  ✅ ' : '  🔴 ') + msg); if (!ok) fails.push(msg); }
  function head(t) { out.push('\n== ' + t + ' =='); }
  function done() {
    var pre = document.createElement('pre'); pre.id = 'TESTOUT';
    pre.textContent = out.join('\n'); document.body.appendChild(pre);
  }
  var hm = window.__hm;
  if (!hm) { out.push('🔴 没有 window.__hm'); return done(); }

  var cv = document.getElementById('trace-canvas');
  var stamp = document.getElementById('trace-stamp');
  var p = hm.state().profiles.er;

  function mkTouch(id, x, y) {
    return new Touch({ identifier: id, target: cv, clientX: x, clientY: y, pageX: x, pageY: y });
  }
  function fire(type, touches, changed) {
    var ev = new TouchEvent(type, {
      touches: touches, targetTouches: touches, changedTouches: changed || touches,
      bubbles: true, cancelable: true,
    });
    return cv.dispatchEvent(ev);          // false = preventDefault 被调过（页面不会被拖走）
  }
  function inkPixels() {
    var ctx = cv.getContext('2d');
    var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var n = 0;
    for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  }
  function r2() { return cv.getBoundingClientRect(); }
  function cur() {
    var m = document.getElementById('trace-title').textContent.match(/「(.)」/);
    return m ? m[1] : '?';
  }
  function tracedCount() { return Object.keys(p.traced).length; }
  function stampOn() { return !stamp.classList.contains('hide'); }

  /* 用手指在画布上真画一笔：从比例点 (fx,fy) 到 (tx,ty)，中间分 steps 步。
     返回 true＝每一步 touchmove 都拦住了页面滚动（preventDefault 生效）。 */
  function fingerDraw(id, fx, fy, tx, ty, steps) {
    var b = r2(), X = function (u) { return b.left + b.width * u; }, Y = function (v) { return b.top + b.height * v; };
    var t0 = mkTouch(id, X(fx), Y(fy));
    fire('touchstart', [t0], [t0]);
    var blocked = true;
    for (var i = 1; i <= steps; i++) {
      var t = mkTouch(id, X(fx + (tx - fx) * i / steps), Y(fy + (ty - fy) * i / steps));
      if (fire('touchmove', [t], [t]) !== false) blocked = false;
    }
    var tEnd = mkTouch(id, X(tx), Y(ty));
    fire('touchend', [], [tEnd]);
    return blocked;
  }

  function enter(next) {
    var card = document.querySelector('.kid-card.er');
    if (card) card.click();
    setTimeout(function () {
      var mod = pickModTitle('写一写') || pickMod('写一写') || pickMod('描一描');
      if (!mod) { line(false, '找不到「写一写」入口'); return next(); }
      mod.click();
      setTimeout(function () {
        if (hm.screen() !== 'screen-trace') { line(false, '没进到描红屏，停在 ' + hm.screen()); return; }
        next();
      }, 120);
    }, 120);
  }

  /* ── 一、整页锁死 ── */
  function t1(next) {
    head('进写一写 = 整页锁死');
    line(document.documentElement.classList.contains('lock-scroll'),
      'html 上挂上了 lock-scroll（滚动锁）');
    line(document.documentElement.scrollHeight <= window.innerHeight + 1,
      '锁死的同时「一屏装得下」：内容 ' + document.documentElement.scrollHeight + ' ≤ 视口 ' + window.innerHeight);
    var btn = document.getElementById('trace-next').getBoundingClientRect();
    line(btn.top >= 0 && btn.bottom <= window.innerHeight + 1,
      '「换一个字」按钮还在屏幕里（锁了滚动也点得到）：' + Math.round(btn.top) + '~' + Math.round(btn.bottom) +
      ' / 视口高 ' + window.innerHeight);
    next();
  }

  /* ── 二、竖着用手指写：画得出来 + 页面被拦住 ── */
  function t2(next) {
    head('手指竖着写一笔（老曾报的就是这一笔）');
    var ink0 = inkPixels(), traced0 = tracedCount(), z = cur();
    var blocked = fingerDraw(7, 0.5, 0.12, 0.5, 0.9, 12);   // 0.78 格长的竖画
    setTimeout(function () {
      line(inkPixels() > ink0 + 500, '画布上真的出现了竖向笔迹（像素 ' + ink0 + ' → ' + inkPixels() + '）');
      line(blocked, '每一步 touchmove 都被拦住（preventDefault）——页面不会被竖向手势拖走');
      line(stampOn(), '描满一条边就盖章（门槛已从 1.6 倍降到 0.6 倍）');
      line(tracedCount() === traced0 + 1, '「' + z + '」记进了写过的字（' + traced0 + ' → ' + tracedCount() + '）');
      next();
    }, 200);
  }

  /* ── 三、横着写也照样行（别为了修竖向把横向弄坏） ── */
  function t3(next) {
    head('手指横着写一笔');
    document.getElementById('trace-clear').click();
    setTimeout(function () {
      var ink0 = inkPixels();
      var blocked = fingerDraw(8, 0.12, 0.5, 0.9, 0.5, 10);
      setTimeout(function () {
        line(inkPixels() > ink0 + 500, '横向笔迹也在（像素 ' + ink0 + ' → ' + inkPixels() + '）');
        line(blocked, '横向的 touchmove 同样被拦住');
        next();
      }, 150);
    }, 120);
  }

  /* ── 四、掌根/第二根手指不许打断这一笔 ── */
  function t4(next) {
    head('写到一半，第二根手指碰上来（小孩写字总有掌根）');
    document.getElementById('trace-clear').click();
    setTimeout(function () {
      var b = r2(), X = function (u) { return b.left + b.width * u; }, Y = function (v) { return b.top + b.height * v; };
      var a = mkTouch(11, X(0.5), Y(0.15));
      fire('touchstart', [a], [a]);
      var mid = mkTouch(11, X(0.5), Y(0.5));
      fire('touchmove', [mid], [mid]);
      var inkMid = inkPixels();
      var palm = mkTouch(12, X(0.9), Y(0.9));
      fire('touchstart', [mid, palm], [palm]);         // 掌根落下
      fire('touchend', [mid], [palm]);                  // 掌根抬起：不该收笔
      var more = mkTouch(11, X(0.5), Y(0.88));
      fire('touchmove', [more], [more]);
      var inkAfter = inkPixels();
      line(inkAfter > inkMid + 500, '掌根抬起之后，原来那根手指还能接着往下写（像素 ' + inkMid + ' → ' + inkAfter + '）');
      fire('touchend', [], [more]);
      setTimeout(function () {
        line(stampOn(), '这一笔收笔后照样盖章');
        next();
      }, 150);
    }, 120);
  }

  /* ── 五、离开写一写要解锁 ── */
  function t5(next) {
    head('离开写一写 = 解锁');
    document.querySelector('#screen-trace [data-back]').click();
    setTimeout(function () {
      line(!document.documentElement.classList.contains('lock-scroll'), '回到首页后滚动锁摘掉了（别的屏还能正常滚）');
      line(hm.screen() !== 'screen-trace', '确实离开了写一写屏（' + hm.screen() + '）');
      next();
    }, 200);
  }

  enter(function () {
    t1(function () { t2(function () { t3(function () { t4(function () { t5(report); }); }); }); });
  });

  function report() {
    out.push('\n共 ' + tracedCount() + ' 个字记进了账');
    out.push(fails.length === 0 ? '✅ 写一写的触屏书写与整页锁定全部对得上' : '🔴 写一写有 ' + fails.length + ' 处问题');
    done();
  }
}, 300);
