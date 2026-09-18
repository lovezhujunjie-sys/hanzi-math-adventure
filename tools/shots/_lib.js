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
