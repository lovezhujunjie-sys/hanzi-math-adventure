/* 截图：认汉字卡片上点组词里的字 → 出拼音 + 朗读 */
kid('da');
setTimeout(()=>{ pickMod('认汉字').click(); },80);
setTimeout(()=>{ pickMap('第一单元').click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#learn-info', 0) || tapCharIn('#learn-ju', 0); },420);
