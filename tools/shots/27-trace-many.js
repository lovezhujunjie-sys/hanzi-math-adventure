/* 连写 3 个字：看计数、看星星提示、看第 3 个字写完后章自动收起的样子 */
kid('er');
setTimeout(()=>{
  const m = pickMod('描一描'); if(m) m.click();
  let n = 0;
  (function one(){
    if (n >= 3) return;
    drawTrace(traceCellSize()*2.4);
    n++;
    setTimeout(()=>{ document.getElementById('trace-next').click(); setTimeout(one, 1500); }, 1500);
  })();
},80);
