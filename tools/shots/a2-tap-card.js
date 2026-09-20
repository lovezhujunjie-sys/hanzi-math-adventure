/* 截图：点首页「游戏乐园」卡片 → 切到游戏中心。看切屏那一下有没有漂出注音气泡（老曾 2026-09-20 报的）。 */
kid('er');
setTimeout(function () {
  const m = pickModTitle('游戏乐园');
  const ds = m.querySelector('.ds').getBoundingClientRect();
  fireTap(m, ds.right - 6, ds.top + ds.height / 2);          // 点卡片上「边玩边学」末尾
}, 2000);
