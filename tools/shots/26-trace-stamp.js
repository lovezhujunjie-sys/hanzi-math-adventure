/* 描红「写满一格 → 盖章」这一瞬间的样子。
   🔴 这张图的**成败全在 SHOT_BUDGET**：章 1.4 秒后自己收走，而截图是在虚拟时间预算
      跑完那一刻拍的。预算给大了（比如默认的 9 万）拍到的就是章收走之后——图上只有
      计数没有章，看着像功能没做，其实是没拍到。
      正确用法： SHOT_BUDGET=1200 bash tools/shot.sh tools/shots/26-trace-stamp.js out/26.png
      （画在 ~300ms，章 ~1700ms 收走，1200 落在窗口里。） */
kid('er');
setTimeout(function(){ drawTrace(traceCellSize()*0.5); }, 120);   // 随手划一道：不该盖章
setTimeout(function(){
  const m = pickMod('描一描'); if(m) m.click();
},80);
setTimeout(function(){ drawTrace(traceCellSize()*2.4); }, 300);   // 真写满 → 盖章
