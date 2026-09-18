/* 截图：乘法口诀表里点「得」→ 出 dé（不是 déi/de） */
kid('da');
setTimeout(()=>{ pickMod('口诀').click(); },80);
setTimeout(()=>{ window.__t = tapCharAt('得'); },420);
setTimeout(()=>{ expectPop('口诀里的「得」：' + window.__t); },700);
