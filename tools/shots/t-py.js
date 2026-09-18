/* 点字注音的浏览器硬核验： bash tools/browser_test.sh tools/shots/t-py.js
   🔴 为什么非得进浏览器：点字靠 document.caretRangeFromPoint（「屏幕上的这个点对应哪个字」），
      这件事在 node 里根本没有对应物。而且这里驱动的是 index.html 里那份真实现
      （window.__hm.py），不另抄一套匹配逻辑——抄一遍就是判据分叉。
   🔴 每条断言自己打印结果行；最后汇总，别只看退出码。 */
(function () {
  /* 先把真界面开到位（乘法口诀表要打开才渲染），再跑断言。
     browser_test.sh 用 --virtual-time-budget，setTimeout 会被推进。 */
  kid('da');
  setTimeout(() => { const m = pickMod('数学闯关'); if (m) m.click(); }, 60);
  setTimeout(() => { const it = pickMap('表内乘法'); if (it) it.click(); }, 160);

  setTimeout(run, 220);

function run() {
  const L = [];
  let bad = 0;
  const ok = (cond, msg) => { if (!cond) bad++; L.push((cond ? '  ✅ ' : '  ❌ ') + msg); };
  const flush = () => {
    const n = L.filter(x => x.indexOf('  ✅ ') === 0 || x.indexOf('  ❌ ') === 0).length;
    /* 🔴 0 项断言 = 测试根本没跑起来，绝不能报绿（假绿灯吃过亏）。 */
    const verdict = (bad || n === 0)
      ? '🔴 点字注音没通过' + (n === 0 ? '（一项断言都没跑到，脚本没跑起来）' : '')
      : '✅ 点字注音全部通过';
    L.push('\n共 ' + n + ' 项断言，' + bad + ' 处问题');
    L.push(verdict);
    const pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = L.join('\n');
    document.body.appendChild(pre);
  };
  const PY = window.__hm && window.__hm.py;
  if (!PY) { bad++; L.push('  ❌ window.__hm.py 不存在——内部件没暴露出来？忘了 build.sh？'); flush(); return; }

  /* ── 1. 取音：给一段文字和「第几个字」，看它取到哪个音 ── */
  L.push('== 取音（按词定音的最长匹配）==');
  const FIND = [
    ['个数', 1, 'shù', '「数目」义，不是「数一数」的 shǔ'],
    ['丁丁的个数是麟轩的', 4, 'shù', '长句里也要按词判，认词不认整句'],
    ['数一数', 0, 'shǔ', '点着数＝shǔ'],
    ['数到十', 0, 'shǔ', '数数义'],
    ['弹珠', 0, 'dàn', '名词'],
    ['教室', 0, 'jiào', '名词'],
    ['跑得快', 1, 'de', '程度补语，轻声'],
    ['二二得四', 2, 'dé', '口诀'],
    ['本子', 1, 'zi', '轻声后缀'],
    ['擦掉重写', 2, 'chóng', '重新义']
  ];
  for (const [text, i, want, why] of FIND) {
    const hit = PY.find(text, i);
    const got = hit ? hit.py.split(' ')[hit.at] : PY.char[text[i]];
    ok(got === want, `「${text}」第${i}字 → ${got}（应为 ${want}：${why}）`);
  }

  /* ── 2. 点字：真在屏幕上点一下，看气泡弹不弹、内容对不对 ── */
  L.push('== 点字 → 气泡（真事件 + 真坐标）==');
  const probe = document.createElement('div');
  probe.id = 'py-probe';
  probe.style.cssText = 'font-size:34px;line-height:1.6;padding:20px;text-align:center';
  probe.textContent = '丁丁的个数是麟轩的';
  const APP = document.querySelector('.app');
  APP.insertBefore(probe, APP.firstChild);        // 放最前面，保证在屏幕内
  /* 🔴 追加到 .app 末尾会落到屏幕外（乘法口诀表有 45 格，页面很高），
     那样 caretRangeFromPoint 对屏幕外的坐标直接返回 null，测试会假绿。 */
  ok(probe.getBoundingClientRect().top >= 0 &&
     probe.getBoundingClientRect().bottom <= window.innerHeight,
     '探针在屏幕内（top=' + Math.round(probe.getBoundingClientRect().top) +
     ' bottom=' + Math.round(probe.getBoundingClientRect().bottom) + ' 窗高=' + window.innerHeight + '）');
  const pop = document.getElementById('py-pop');

  /* 把「第 i 个字」的屏幕坐标算出来：用一个 Range 框住那个字，取它的中心。
     这样点的是**真字的真位置**，不是编的坐标。 */
  function centerOf(node, i) {
    const r = document.createRange();
    r.setStart(node, i); r.setEnd(node, i + 1);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, rect: b };
  }
  /* 一律走浏览器的真命中测试：这个坐标到底落在谁身上。点不到就返回 null，
     让断言去叫——绝不用「传个 target 进去强行派发」把失败糊过去。 */
  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    el.dispatchEvent(new MouseEvent('click',
      { clientX: x, clientY: y, bubbles: true, cancelable: true }));
    return el;
  }

  const tn = probe.firstChild;                       // 那个文字节点
  ok(tn && tn.nodeType === 3, '探针文字节点就位：' + (tn ? tn.nodeValue : '(没有)'));
  pop.classList.remove('on');
  const c4 = centerOf(tn, 4);                        // 「丁丁的个数是麟轩的」第4字＝数
  ok(tn.nodeValue[4] === '数', '第4个字确实是「数」（实际「' + tn.nodeValue[4] + '」）');
  const hitEl = clickAt(c4.x, c4.y);
  ok(hitEl === probe, '坐标真的落在探针上（命中的是 ' + (hitEl ? hitEl.tagName + '#' + hitEl.id : 'None') + '）');
  ok(pop.classList.contains('on'), '点了「数」→ 气泡弹出来了');
  const txt = pop.textContent || '';
  ok(txt.indexOf('数') >= 0, '气泡里有这个字：' + JSON.stringify(txt));
  ok(txt.indexOf('shù') >= 0, '气泡里的拼音是 shù（不是 shǔ）：' + JSON.stringify(txt));
  ok(txt.indexOf('个数') >= 0 && txt.indexOf('gè shù') >= 0, '气泡里带出了它所在的词「个数 gè shù」');
  const pb = pop.getBoundingClientRect();
  ok(pb.width > 0 && pb.height > 0, '气泡有实际尺寸 ' + Math.round(pb.width) + '×' + Math.round(pb.height));
  /* 真正的意图是「不许盖住被点的那个字」，不是「必须在上方」。
     字的上面没地方时翻到下面，那是对的。 */
  const above = pb.bottom <= c4.rect.top + 2, below = pb.top >= c4.rect.bottom - 2;
  ok(above || below, '气泡没盖住字（' + (above ? '在上方' : below ? '翻到了下方' : '🔴 压在字上了') + '）');
  ok(below, '字在屏幕最上沿、上面没地方 → 自动翻到下方');
  ok(pb.left >= -1 && pb.right <= window.innerWidth + 1, '气泡没跑出屏幕（left=' + Math.round(pb.left) + ' right=' + Math.round(pb.right) + ' 屏宽=' + window.innerWidth + '）');

  /* 再验一次「有地方就该在上方」：在探针前面塞一块高的占位，把字挤到屏幕中间 */
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height:260px';
  APP.insertBefore(spacer, probe);
  const c4b = centerOf(tn, 4);
  pop.classList.remove('on');
  ok(clickAt(c4b.x, c4b.y) === probe, '垫高之后坐标仍落在探针上');
  const pb2 = pop.getBoundingClientRect();
  ok(pop.classList.contains('on') && pb2.bottom <= c4b.rect.top + 2,
     '字挪到屏幕中间 → 气泡弹到它上方（bottom=' + Math.round(pb2.bottom) + ' vs 字顶=' + Math.round(c4b.rect.top) + '）');
  ok(!pop.classList.contains('below'), '没有误加「翻到下方」的样式');
  spacer.remove();

  /* 换个字再点：气泡要跟着走，不能停在老地方 */
  const c0 = centerOf(tn, 0);                        // 「丁」
  ok(clickAt(c0.x, c0.y) === probe, '点「丁」时坐标也落在探针上');
  const txt2 = pop.textContent || '';
  ok(txt2.indexOf('丁') >= 0 && txt2.indexOf('数') < 0, '点「丁」→ 气泡换成「丁」：' + JSON.stringify(txt2));

  /* 数字、标点不该弹气泡 */
  const probe2 = document.createElement('div');
  probe2.style.cssText = 'font-size:34px;padding:20px;text-align:center';
  probe2.textContent = '3 + 5 = ?';
  APP.insertBefore(probe2, APP.firstChild);
  pop.classList.remove('on');
  const n0 = probe2.firstChild;
  const cn = centerOf(n0, 0);
  ok(clickAt(cn.x, cn.y) === probe2, '点数字时坐标落在第二个探针上');
  ok(!pop.classList.contains('on'), '点数字「3」不弹气泡（数字没有拼音）');

  /* 能点的东西有自己的活干，不许被抢 */
  const btn = document.createElement('button');
  btn.textContent = '个数';
  btn.style.cssText = 'font-size:34px;padding:20px';
  APP.insertBefore(btn, APP.firstChild);
  pop.classList.remove('on');
  const bn = btn.firstChild, cb = centerOf(bn, 1);
  ok(clickAt(cb.x, cb.y) === btn, '点按钮时坐标落在按钮上');
  ok(!pop.classList.contains('on'), '点按钮里的字不弹气泡（按钮要留给它自己的功能）');

  /* ── 2b. 真界面：数学题的题干里点「行」──
     🔴 这一段是「上线后逐张看图」才发现的洞：题干是「每行 9 颗糖果，一共 6 行」，
        「行」在 App 的文字里 22,002/22,009 都是「排/行」义（háng），可单字默认是
        xíng，pypinyin 也判 xíng——两边一致地错，任何自动闸门都看不见。
        所以这里必须**在真题面上**再钉一遍。 */
  L.push('== 真界面（数学题的题干）==');
  const qsub = document.getElementById('q-sub');
  if (!qsub || !qsub.textContent) {
    ok(false, '数学题题干没渲染出来（q-sub 是空的）');
  } else {
    const qtext = qsub.textContent;
    const w2 = document.createTreeWalker(qsub, NodeFilter.SHOW_TEXT);
    let hit = null;
    while (w2.nextNode()) {
      const k = w2.currentNode.nodeValue.indexOf('行');
      if (k >= 0) { hit = { node: w2.currentNode, off: k }; break; }
    }
    ok(!!hit, '题干里有「行」：' + JSON.stringify(qtext.slice(0, 30)));
    if (hit) {
      qsub.scrollIntoView({ block: 'center' });
      pop.classList.remove('on');
      const rc = centerOf(hit.node, hit.off);
      ok(clickAt(rc.x, rc.y) === qsub || qsub.contains(document.elementFromPoint(rc.x, rc.y)),
         '题干里的「行」点得到');
      const t4 = pop.textContent || '';
      ok(t4.indexOf('háng') >= 0, '题干里点「行」→ háng（不是 xíng）：' + JSON.stringify(t4));
    }
  }

  /* 回首页，接着验乘法口诀表 */
  const backBtn = document.querySelector('.screen.on .icon-btn[data-back]');
  if (backBtn) backBtn.click();
  const mulMod = pickMod('口诀');
  if (mulMod) mulMod.click();

  /* ── 3. 真界面：乘法口诀表里的「得」── */
  L.push('== 真界面（乘法口诀表）==');
  const mulCell = document.querySelector('#mul-table .mul-cell');
  if (!mulCell) {
    ok(false, '乘法口诀表没渲染出来，点不了');
  } else {
    pop.classList.remove('on');
    const cellText = mulCell.textContent;
    const idx = cellText.indexOf('得');
    ok(idx >= 0, '口诀格里找到「得」：' + JSON.stringify(cellText));
    if (idx >= 0) {
      /* 口诀格的文字不是单一节点（里面还套了 <span class="r">1×1=1</span>），
         所以找那个装着口诀的文字节点。 */
      const w = document.createTreeWalker(mulCell, NodeFilter.SHOW_TEXT);
      let node = null, off = -1;
      while (w.nextNode()) {
        const k = w.currentNode.nodeValue.indexOf('得');
        if (k >= 0) { node = w.currentNode; off = k; break; }
      }
      ok(!!node, '口诀那个「得」在单独的文字节点里');
      if (node) {
        mulCell.scrollIntoView({ block: 'center' });
        const cc = centerOf(node, off);
        const hit2 = clickAt(cc.x, cc.y);
        ok(hit2 === mulCell || (hit2 && mulCell.contains(hit2)),
           '口诀格滚进视口后点得到（命中的是 ' + (hit2 ? hit2.tagName + '.' + hit2.className : 'None') + '）');
        ok(pop.classList.contains('on'), '点口诀里的「得」→ 气泡弹出来');
        const t3 = pop.textContent || '';
        ok(t3.indexOf('dé') >= 0, '气泡里的拼音是 dé（乘法口诀义）：' + JSON.stringify(t3));
      }
    }
  }

  probe.remove(); probe2.remove(); btn.remove();
  flush();
}
})();
