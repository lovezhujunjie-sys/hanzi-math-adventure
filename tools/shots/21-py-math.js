/* 截图：数学题里点一个不认识的汉字 → 出拼音 + 朗读。
   题目每次随机，所以不定死点哪个字：点题面（#q-sub）里第 2 个中文字。 */
kid('da');
setTimeout(()=>{ pickMod('数学闯关').click(); },80);
setTimeout(()=>{ pickMap('表内乘法').click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#q-sub', 1); },420);
