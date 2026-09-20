/* 驱动脚本共用的小工具：一律「按名字点」，不按序号点——
   🔴 关卡表插一个新关卡，所有按序号点的截图脚本就会集体串位（已经踩过一次）。 */
function pickMod(name){
  const ms=document.querySelectorAll('#home-mods .mod');
  for(const m of ms) if(m.textContent.indexOf(name)>=0) return m;
  return null;
}
/* 按**标题**找首页模块。
   🔴 pickMod 是按整块文字模糊找的，会误伤：「星星」两个字也出现在
      「数学闯关」的说明「11 个关卡，答对拿星星」里，于是找星星会点到数学去
      （2026-09-18 错题本测试就踩了，症状是「点了星星却站在关卡地图上」）。
      模块的名字在 .tt 里，按它找才准。 */
function pickModTitle(name){
  const ms=document.querySelectorAll('#home-mods .mod');
  for(const m of ms){ const t=m.querySelector('.tt'); if(t && t.textContent.indexOf(name)>=0) return m; }
  return null;
}
function pickMap(name){
  const its=document.querySelectorAll('#map-grid .map-item');
  for(const it of its) if(it.textContent.indexOf(name)>=0) return it;
  return null;
}
function kid(k){ const c=document.querySelector('.kid-card.'+k); if(c) c.click(); }

/* 🔴 真用户点一下＝先 pointerdown 再 click。App 的点字注音现在要求「click 必须由本页近期
   pointerdown 引发」（防打开链接的残留 ghost click 误弹字并朗读），所以驱动脚本也得成对派发，
   否则注音测试会因为「没有配套按下」而全部点不响。 */
function fireTap(el, x, y){
  const opt = { clientX: x, clientY: y, bubbles: true, cancelable: true };
  if (typeof PointerEvent === 'function') el.dispatchEvent(new PointerEvent('pointerdown', opt));
  else el.dispatchEvent(new MouseEvent('pointerdown', opt));
  el.dispatchEvent(new MouseEvent('click', opt));
}

/* 「把屏幕上一个真字点一下」——算出该字的屏幕坐标，走真命中测试派发真事件。
   截图脚本用：要看的正是「孩子点下去之后屏幕上长什么样」。 */
function findCharNode(ch){
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()){
    const n = w.currentNode, k = n.nodeValue.indexOf(ch);
    if (k < 0 || !n.parentNode) continue;
    if (n.parentNode.closest('.py-pop,#TESTOUT,script,style')) continue;
    const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1);
    const b = r.getBoundingClientRect();
    if (b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight) {
      return { node: n, off: k, rect: b };
    }
  }
  return null;
}
function tapCharAt(ch){
  const c = findCharNode(ch);
  if (!c) return '找不到这个字：' + ch;
  const x = c.rect.left + c.rect.width / 2, y = c.rect.top + c.rect.height / 2;
  const el = document.elementFromPoint(x, y);
  if (!el) return '坐标没命中任何元素';
  fireTap(el, x, y);
  return el.tagName + (el.className ? '.' + el.className : '');
}
/* 屏幕上第一段「足够长的中文」里的第 i 个字（用来在认字卡/组词上随便挑个真字点） */
function tapFirstCjk(i){
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()){
    const n = w.currentNode, v = n.nodeValue || '';
    if (!n.parentNode || n.parentNode.closest('.py-pop,#TESTOUT,script,style')) continue;
    const m = v.match(/[一-龥]{3,}/);
    if (!m) continue;
    const k = m.index + i;
    const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1);
    const b = r.getBoundingClientRect();
    if (b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight) {
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const el = document.elementFromPoint(x, y);
      if (el) fireTap(el, x, y);
      return v.slice(m.index, m.index + 6) + ' 第' + i + '字 → ' + (el ? el.tagName : 'None');
    }
  }
  return '屏幕上没找到中文';
}
/* 🔴 截图驱动**自己不会叫**——跑完就看图，点没点到根本不知道。这是假绿的温床：
   22 号脚本原写 `tapCharIn('#learn-info',0) || tapCharIn('#learn-ju',0)`，
   而 `#learn-info` 里全是**组词按钮**（按设计不弹气泡），偏偏 tapCharIn 失败时
   也返回**非空字符串**，`||` 永远短路 → 后面的兜底一次都没跑过，截出来的图里
   一个气泡都没有，看着像功能没做。（2026-09-18 逐张看图才发现。）
   所以：凡是「点字出拼音」的截图脚本，末尾一律挂这条自检——
   **气泡没弹出来就在页面上糊一条大红横幅，让看图的人一眼看见这张图没验到东西。** */
function expectPop(what){
  setTimeout(function(){
    const pop = document.getElementById('py-pop');
    const on = !!(pop && pop.classList.contains('on'));
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'padding:8px 6px;font:bold 15px/1.4 system-ui,sans-serif;text-align:center;color:#fff;' +
      'background:' + (on ? '#1a9c62' : '#d33');
    bar.textContent = on
      ? '✅ 截图自检：气泡已弹出（' + what + '）'
      : '🔴 截图自检失败：气泡没弹出来（' + what + '）——这张图没验到东西';
    document.body.appendChild(bar);
  }, 400);
}

/* 在描红画布上"描一遍字"（派发真 pointer 事件，走 pointerdown/move/up 那条路 = 鼠标/触控笔）。
   🔴 不要绕过界面直接调 markTraced——那是自己验自己，判据错了永远抓不到。
   🔴 判据已经从「笔迹总长」改成「**盖住字形的比例**」（见 05_app.js 的蒙版），
      所以夹具也必须真的去盖字形：整格蛇形涂一遍（像孩子沿着字描）＝ 盖满；
      只在角落划一道 ＝ 盖不到多少，**不盖章**。
   frac ≥ 0.6 → 整格蛇形描一遍；frac < 0.6 → 只在左上角划一道。
   另配 traceOneLine()：只描正中一条横线（用来验「一」该盖章、「三」还不该盖）。 */
function drawTrace(frac){
  const cv = document.getElementById('trace-canvas');
  const r = cv.getBoundingClientRect();
  const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type,
    { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }));
  if (frac !== undefined && frac < 0.6) {          // 只在左上角划一道
    const x = r.left + r.width * 0.2, y = r.top + r.height * 0.22;
    ev('pointerdown', x, y);
    for (let i = 1; i <= 3; i++) ev('pointermove', x + i * 5, y + (i % 2 ? 7 : -7));
    ev('pointerup', x + 15, y);
    return 3;
  }
  const x0 = r.left + r.width * 0.08, x1 = r.left + r.width * 0.92;
  const rows = 11;
  ev('pointerdown', x0, r.top + r.height * 0.08);
  for (let i = 0; i < rows; i++) {
    const y = r.top + r.height * (0.08 + 0.84 * i / (rows - 1));
    ev('pointermove', i % 2 ? x0 : x1, y);
  }
  ev('pointerup', x1, r.top + r.height * 0.92);
  return rows;
}
/* 只描正中一条横线（横贯整格）。「一」应该盖到章，「三」不该。 */
function traceOneLine(){
  const cv = document.getElementById('trace-canvas');
  const r = cv.getBoundingClientRect();
  const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type,
    { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }));
  const y = r.top + r.height * 0.5;
  ev('pointerdown', r.left + r.width * 0.07, y);
  for (let i = 1; i <= 6; i++) ev('pointermove', r.left + r.width * (0.07 + 0.86 * i / 6), y);
  ev('pointerup', r.left + r.width * 0.93, y);
}
/* 屏幕上的描红画布边长（门槛按它算） */
function traceCellSize(){
  const w = document.getElementById('trace-wrap');
  return w ? w.clientWidth : 0;
}

/* 在某个容器里点第 i 个中文字（容器里的字才是孩子要读的题面/词） */
function tapCharIn(sel, i){
  const box = document.querySelector(sel);
  if (!box) return '没有 ' + sel;
  const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  let seen = 0;
  while (w.nextNode()){
    const n = w.currentNode, v = n.nodeValue || '';
    for (let k = 0; k < v.length; k++){
      if (!/[一-龥]/.test(v[k])) continue;
      if (seen++ < i) continue;
      const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1);
      const b = r.getBoundingClientRect();
      if (b.width <= 0 || b.top < 0 || b.bottom > window.innerHeight) return '这个字不在屏幕里：' + v[k];
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const el = document.elementFromPoint(x, y);
      if (!el) return '坐标没命中';
      fireTap(el, x, y);
      return '点了「' + v[k] + '」（' + sel + ' 里第' + i + '个中文字）→ ' + el.tagName;
    }
  }
  return sel + ' 里没有中文字';
}

/* 造几条真错题（走真界面答错），再进星星页，滚到指定卡片。
   报告卡和错题本卡都在首屏之外，不滚过去截图里就只有一排奖章。 */
function makeWrongsThenStars(n, scrollTo, done){
  kid('da');
  setTimeout(function(){
    const mods = document.querySelectorAll('#home-mods .mod');
    let mod = null;
    for (let i=0;i<mods.length;i++) if (/认/.test(mods[i].textContent) && /字/.test(mods[i].textContent)) mod = mods[i];
    if (mod) mod.click();
    setTimeout(function(){
      const big = document.querySelector('#map-grid .map-item.big');
      if (big) big.click();
      setTimeout(function(){ one(0); }, 150);
    },150);
  },80);
  function one(k){
    if (k >= n) {
      document.querySelector('#screen-quiz .icon-btn').click();     // 退出闯关 → 关卡地图
      setTimeout(function(){
        document.querySelector('#screen-map [data-back]').click();  // → 首页
        setTimeout(function(){
          const t = pickModTitle('星星');
          if (t) t.click();
          setTimeout(function(){
            const el = document.getElementById(scrollTo);
            if (el) el.scrollIntoView({block:'center'});
            if (done) done();
          }, 250);
        },150);
      },150);
      return;
    }
    const hm = window.__hm, Q = hm.quiz();
    if (!Q || !Q.list || Q.i >= Q.list.length) return;
    const q = Q.list[Q.i];
    let w = null;
    [].slice.call(document.querySelectorAll('#q-choices .choice')).forEach(function(b){
      if (!w && b.textContent.trim() !== String(q.answer).trim()) w = b;
    });
    if (w) w.click();
    const nx = document.getElementById('q-next');
    if (nx && !nx.classList.contains('hide')) nx.click();
    setTimeout(function(){ one(k+1); }, 120);
  }
}
