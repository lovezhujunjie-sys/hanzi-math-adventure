/* 截图：换人 → 点孩子卡 → 停在首页。看首页上还有没有漂着的注音气泡（老曾 2026-09-20 报的）。 */
kid('er');
setTimeout(function () {
  const sw = document.getElementById('home-switch');
  const r = sw.getBoundingClientRect();
  fireTap(sw, r.left + r.width / 2, r.top + r.height / 2);   // 点「换人」
}, 2000);
setTimeout(function () {
  const c = document.querySelector('.kid-card.er');
  const n = c.querySelector('.kid-name').getBoundingClientRect();
  fireTap(c, n.left + 4, n.top + n.height / 2);              // 点孩子卡上的字
}, 2300);
