/* 截图：大宝的方块消除——方块上是随机抽的 7 个二年级生字。 */
kid('da');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () {
  document.querySelectorAll('#games-grid .game-card').forEach(function (c) {
    if (c.querySelector('.gc-name').textContent.indexOf('方块消除') >= 0) c.click();
  });
}, 2300);
