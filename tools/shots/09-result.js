kid('da');
setTimeout(()=>{ pickMod('数学闯关').click(); },80);
setTimeout(()=>{ pickMap('比大小').click(); },200);
/* 一路答完 8 题，停在结算页。答对会自动跳下一题（约 1 秒），所以间隔给 1.2 秒 */
let i=0;
const t=setInterval(()=>{
  const c=document.querySelector('#q-choices .choice');
  if(c) c.click();
  setTimeout(()=>{ const nx=document.querySelector('#q-next'); if(nx && !nx.classList.contains('hide')) nx.click(); },150);
  if(++i>9) clearInterval(t);
},1200);
