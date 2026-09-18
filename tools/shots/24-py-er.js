/* 截图：二宝（小班）那侧点字也能出拼音——点例句「我们家里有很多人。」的第 1 个字 */
kid('er');
setTimeout(()=>{ pickMod('认字卡').click(); },80);
setTimeout(()=>{ const a=document.querySelectorAll('#map-grid .map-item'); if(a[1]) a[1].click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#learn-ju', 0); },420);
setTimeout(()=>{ expectPop('二宝例句第1个字：' + window.__t); },700);
