/* 认字闯关的出题器硬核验：跑 6000 道题，查有没有「两个正确答案」的烂题。
   判据不是「答案存不存在」，而是「选项里是不是只有一个能满足题干」。 */
setTimeout(function () {
  var out = [], fails = [], n = 0;
  var hm = window.__hm;
  if (!hm) { document.title = 'no __hm'; return; }

  function run(kid, label) {
    // 切到指定小朋友
    var card = document.querySelector('.kid-card.' + kid);
    if (card) card.click();
    var all = hm.hanziPool();
    var mk = hm.hanziQFactory(all);
    var cnt = {}, bad = 0;
    for (var i = 0; i < 3000; i++) {
      var q = mk(); n++;
      var t = /这是哪个字/.test(q.sub) ? 'pic'
            : /这个拼音/.test(q.sub) ? 'py'
            : /读什么/.test(q.sub) ? 'zi' : 'ci';
      cnt[t] = (cnt[t] || 0) + 1;

      // ① 选项必须唯一
      var s = q.choices.map(String);
      if (new Set(s).size !== s.length) { fails.push(label + ' 选项重复：' + s.join('|')); bad++; }
      // ② 选项必须含正确答案（而且只含一次）
      if (s.indexOf(String(q.answer)) < 0) { fails.push(label + ' 选项没含答案：' + q.answer); bad++; }
      // ③ 看拼音选字：不能有第二个选项也读这个拼音（双黄蛋）
      if (t === 'py' || t === 'pic') {
        var py = null;
        for (var j = 0; j < all.length; j++) if (all[j].z === q.answer) { py = all[j].py; break; }
        if (py) {
          var same = all.filter(function (x) { return x.py === py && x.z !== q.answer; });
          var clash = s.filter(function (c) { return same.some(function (x) { return x.z === c; }); });
          if (clash.length) { fails.push(label + ' 同音双黄蛋：' + q.answer + '/' + py + ' 撞 ' + clash.join('|')); bad++; }
        }
      }
      // ④ 看字选拼音：干扰拼音不能等同于答案拼音
      if (t === 'zi') {
        if (s.filter(function (c) { return c === q.answer; }).length !== 1) { fails.push(label + ' zi 答案拼音重复'); bad++; }
      }
      // ⑤ 看字选词：干扰词里不许含这个字（含了就也是对的）
      if (t === 'ci') {
        var zi = String(q.big).replace(/<[^>]+>/g, '');
        s.forEach(function (c) {
          if (c !== q.answer && c.indexOf(zi) >= 0) { fails.push(label + ' 干扰词里有本字：' + zi + ' → ' + c); bad++; }
        });
      }
      // ⑥ 题面不许有脏字符串
      ['big', 'sub', 'say', 'why'].forEach(function (f) {
        if (/undefined|NaN/.test(String(q[f]))) { fails.push(label + ' ' + f + ' 有脏串'); bad++; }
      });
      if (bad > 5) break;
    }
    out.push((bad ? '❌ ' : '✅ ') + label + '：' + Object.keys(cnt).map(function (k) { return k + ' ' + cnt[k]; }).join(' · '));
  }

  run('er', '二宝');
  run('da', '大宝');

  var pre = document.createElement('pre');
  pre.id = 'TESTOUT';
  pre.textContent = out.join('\n') +
    '\n共 ' + n + ' 道题，' + fails.length + ' 处问题' +
    (fails.length ? '\n前 8 条：\n' + fails.slice(0, 8).join('\n') : '\n✅ 没有两个正确答案的题');
  document.body.appendChild(pre);
}, 300);
