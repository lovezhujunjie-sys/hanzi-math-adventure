/* 驱动脚本共用的小工具：一律「按名字点」，不按序号点——
   🔴 关卡表插一个新关卡，所有按序号点的截图脚本就会集体串位（已经踩过一次）。 */
function pickMod(name){
  const ms=document.querySelectorAll('#home-mods .mod');
  for(const m of ms) if(m.textContent.indexOf(name)>=0) return m;
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
