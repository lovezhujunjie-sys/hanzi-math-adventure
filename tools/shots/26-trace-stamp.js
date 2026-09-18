kid('er');
setTimeout(()=>{
  const m = pickMod('描一描'); if(m) m.click();
  setTimeout(()=>{ drawTrace(traceCellSize()*2.4); },120);   // 写满一格 → 盖章
},80);
