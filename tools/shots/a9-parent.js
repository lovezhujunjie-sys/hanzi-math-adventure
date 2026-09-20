/* 截图：家长设置页（游戏时长那两块）。确认拆掉「学习赚时间」后这里没留下空壳。 */
kid('er');
setTimeout(function () { pickModTitle('游戏乐园').click(); }, 2000);
setTimeout(function () { document.getElementById('games-parent').click(); }, 2300);
setTimeout(function () {
  var q = document.getElementById('parent-q');
  if (!q) return;
  document.getElementById('parent-ans').value = eval(q.textContent.replace('?', '').replace('=', ''));
  document.getElementById('parent-unlock').click();
}, 2600);
