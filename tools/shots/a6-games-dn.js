/* 截图：小恐龙跳跳（等第一个气球飘进画面再拍）。 */
kid('er');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () {
  document.querySelectorAll('#games-grid .game-card').forEach(function (c) {
    if (c.querySelector('.gc-name').textContent.indexOf('小恐龙') >= 0) c.click();
  });
}, 2300);
