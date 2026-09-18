/* 截图：数学题里点一个不认识的汉字 → 出拼音 + 朗读。
   题目每次随机，所以不定死点哪个字：点题面（#q-sub）里第 2 个中文字。
   末尾 expectPop 自检——气泡没弹就在图上糊红条（别让这张图变成假绿）。 */
kid('da');
setTimeout(()=>{ pickMod('数学闯关').click(); },80);
setTimeout(()=>{ pickMap('表内乘法').click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#q-sub', 1); },420);
/* 参数只写容器名：tapCharIn 的序号是 0-based，写死「第2个」会跟它自己的回显打架。 */
setTimeout(()=>{ expectPop('题面 #q-sub：' + window.__t); },700);
