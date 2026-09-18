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
  el.dispatchEvent(new MouseEvent('click',
    { clientX: x, clientY: y, bubbles: true, cancelable: true }));
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
      if (el) el.dispatchEvent(new MouseEvent('click',
        { clientX: x, clientY: y, bubbles: true, cancelable: true }));
      return v.slice(m.index, m.index + 6) + ' 第' + i + '字 → ' + (el ? el.tagName : 'None');
    }
  }
  return '屏幕上没找到中文';
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
      el.dispatchEvent(new MouseEvent('click',
        { clientX: x, clientY: y, bubbles: true, cancelable: true }));
      return '点了「' + v[k] + '」（' + sel + ' 里第' + i + '个中文字）→ ' + el.tagName;
    }
  }
  return sel + ' 里没有中文字';
}
