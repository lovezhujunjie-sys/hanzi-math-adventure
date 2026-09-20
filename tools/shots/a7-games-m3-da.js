/* 截图：**大宝**的三消配对——组是拼音，一组里 2~3 个不同的字（同色 = 同音）。 */
kid('da');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () {
  document.querySelectorAll('#games-grid .game-card').forEach(function (c) {
    if (c.querySelector('.gc-name').textContent.indexOf('三消配对') >= 0) c.click();
  });
}, 2300);
