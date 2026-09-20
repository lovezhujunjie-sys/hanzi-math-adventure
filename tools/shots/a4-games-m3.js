/* 截图：三消配对开局盘面（同色的字读同一个音）。 */
kid('er');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () {
  document.querySelectorAll('#games-grid .game-card').forEach(function (c) {
    if (c.querySelector('.gc-name').textContent.indexOf('三消配对') >= 0) c.click();
  });
}, 2300);
