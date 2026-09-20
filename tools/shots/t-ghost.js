/* 复现老曾 2026-09-20 报的「一点开 / 换人时冒出一个大字还自动朗读」。
   机制假设：click 冒泡到 document 时才做点字命中测试，而那一刻屏幕可能**已经切走了**
            （元素的 onclick 先跑、document 的 listener 后跑）——于是旧坐标落到新屏幕上取字。
   两条嫌疑路径都测：
     A. 选人页点孩子卡 → 切首页，孩子卡坐标落回首页文字上
     B. 首页点模块卡片 → 切到别的屏幕，卡片坐标落回新屏幕文字上
   跑法： bash tools/browser_test.sh tools/shots/t-ghost.js */
(function () {
  const L = [];
  let bad = 0;
  const ok = (cond, msg) => { if (!cond) bad++; L.push((cond ? '  ✅ ' : '  ❌ ') + msg); };
  const pop = () => document.getElementById('py-pop');
  const popOn = () => pop().classList.contains('on');
  const popTxt = () => (pop().textContent || '').trim().replace(/\s+/g, ' ');
  const reset = () => { pop().classList.remove('on'); pop().innerHTML = ''; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function flush() {
    const n = L.filter(x => x.indexOf('  ✅ ') === 0 || x.indexOf('  ❌ ') === 0).length;
    L.push('\n共 ' + n + ' 项断言，' + bad + ' 处问题');
    L.push((bad || n === 0) ? '🔴 复现脚本发现问题' + (n === 0 ? '（一项都没跑到）' : '') : '✅ 全部通过');
    const pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = L.join('\n');
    document.body.appendChild(pre);
  }
  function charRects(root) {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!n.parentNode || n.parentNode.closest('.py-pop,script,style')) continue;
      const t = n.nodeValue;
      for (let i = 0; i < t.length; i++) {
        if (!/[一-龥]/.test(t[i])) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
        const b = r.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) out.push({ ch: t[i], r: b });
      }
    }
    return out;
  }
  const tapEl = el => { const r = el.getBoundingClientRect(); fireTap(el, r.left + r.width / 2, r.top + r.height / 2); };
  const backToKid = () => { tapEl(document.getElementById('home-switch')); };

  const found = [];        // 复现到的（冒了字的）案例
  let spoke = '';

  async function main() {
    /* ── 进首页 ── */
    tapEl(document.querySelector('.kid-card.er'));
    await sleep(250);
    L.push('== ① 路径 A：换人 → 点孩子卡 ==');
    ok(window.__hm.screen() === 'screen-home', '第一次进首页');

    /* 记下首页每个汉字的位置（供交集用） */
    const homeChars = charRects(document.getElementById('home-mods'));
    L.push('  ℹ️ 首页模块区 ' + homeChars.length + ' 个汉字');

    backToKid();
    await sleep(250);
    ok(window.__hm.screen() === 'screen-kid', '回到选小朋友');

    const cr = document.querySelector('.kid-card.er').getBoundingClientRect();
    const hits = homeChars.filter(h =>
      h.r.left + h.r.width / 2 >= cr.left && h.r.left + h.r.width / 2 <= cr.right &&
      h.r.top + h.r.height / 2 >= cr.top && h.r.top + h.r.height / 2 <= cr.bottom);
    L.push('  ℹ️ 孩子卡内有 ' + hits.length + ' 个点落回首页时压着汉字：' +
      JSON.stringify(hits.map(h => h.ch)));

    const oldSpeak = window.HMBridge.speak;
    window.HMBridge.speak = function (t) { spoke += '[' + t + ']'; return oldSpeak.apply(this, arguments); };
    for (const h of hits) {
      reset(); spoke = '';
      const x = h.r.left + h.r.width / 2, y = h.r.top + h.r.height / 2;
      fireTap(document.querySelector('.kid-card.er'), x, y);
      await sleep(120);
      if (popOn()) found.push({ path: 'A 点孩子卡', at: h.ch, got: popTxt(), said: spoke });
      backToKid();
      await sleep(150);
    }
    L.push('== ② 路径 B：首页点模块卡片 ==');
    /* 回首页 */
    tapEl(document.querySelector('.kid-card.er'));
    await sleep(250);
    const mods = document.querySelectorAll('#home-mods .mod');
    for (let i = 0; i < mods.length; i++) {
      /* 每次都要先回首页 */
      if (window.__hm.screen() !== 'screen-home') {
        const b = document.querySelector('.btn-back,#back-home,.back');
        if (b) tapEl(b);
        await sleep(200);
        if (window.__hm.screen() !== 'screen-home') { backToKid(); await sleep(200); tapEl(document.querySelector('.kid-card.er')); await sleep(250); }
      }
      const ms = document.querySelectorAll('#home-mods .mod');
      if (!ms[i]) continue;
      const chars = charRects(ms[i]);
      if (!chars.length) continue;
      const c = chars[Math.floor(chars.length / 2)];
      const x = c.r.left + c.r.width / 2, y = c.r.top + c.r.height / 2;
      reset(); spoke = '';
      fireTap(ms[i], x, y);
      await sleep(150);
      if (popOn()) found.push({ path: 'B 点卡片', at: ms[i].querySelector('.tt').textContent + '/' + c.ch, got: popTxt(), said: spoke });
      /* 回首页 */
      const bk = document.querySelector('.btn-back,#back-home,.back');
      if (bk) { tapEl(bk); await sleep(200); }
      if (window.__hm.screen() !== 'screen-home') { backToKid(); await sleep(200); tapEl(document.querySelector('.kid-card.er')); await sleep(250); }
    }
    window.HMBridge.speak = oldSpeak;

    L.push('== 结果 ==');
    L.push('  ℹ️ 复现到 ' + found.length + ' 例「点一下 → 冒出字并朗读」：');
    found.slice(0, 10).forEach(f => L.push('     · ' + f.path + '：落点原字「' + f.at + '」→ 气泡「' + f.got + '」，朗读 ' + f.said));
    ok(found.length === 0, '🔴 切屏那一下不该冒出注音气泡（实际 ' + found.length + ' 例）');
    flush();
  }
  main();
})();
