/* 截图：认字卡上点一个真字 → 出拼音 + 朗读。
   🔴 这里踩过坑：原来点的是 `#learn-info`，可那里面**全是组词按钮**
   （按设计点按钮不弹气泡，它有自己的活干），而 tapCharIn 失败也返回非空字符串，
   `||` 短路让兜底从没跑过 → 截出来的图一个气泡都没有，白验。
   现在改点 `#learn-ju`：大宝那侧它是「📚 部编版二年级上册 · 第一单元 · 写字表」，
   是**真文字**，点「部」应该出 bù。 */
kid('da');
setTimeout(()=>{ pickMod('认汉字').click(); },80);
setTimeout(()=>{ pickMap('第一单元').click(); },200);
setTimeout(()=>{ window.__t = tapCharIn('#learn-ju', 0); },420);
setTimeout(()=>{ expectPop('课本出处那行的第1个字：' + window.__t); },700);
