/* 截图：二宝（小班）那侧点字也能出拼音 */
kid('er');
setTimeout(()=>{ pickMod('认字卡').click(); },80);
setTimeout(()=>{ const a=document.querySelectorAll('#map-grid .map-item'); if(a[1]) a[1].click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#learn-ju', 0); },420);
