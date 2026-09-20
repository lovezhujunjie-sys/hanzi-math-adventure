/* 截图：方块消除（方块上带着数字/字）。 */
kid('er');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () {
  document.querySelectorAll('#games-grid .game-card').forEach(function (c) {
    if (c.querySelector('.gc-name').textContent.indexOf('方块消除') >= 0) c.click();
  });
}, 2300);
