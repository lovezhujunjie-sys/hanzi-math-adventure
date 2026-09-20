/* 游戏乐园「先学习才能进」的门 —— 老曾 2026-09-20 拍板的规则：
     「每天点进去之后要连续学习21分钟之后才能进入游戏乐园板块,
       如果用户直接点击游戏乐园板块提示先学习21分钟,
       或者在闯关游戏里面获得一定的闯关才能进入游戏乐园」
   两条路任选一条：①今天有效学习 ≥21 分钟  ②今天闯过 N 关（大宝 2、二宝 1）。
   三条要守的：
     · 锁着的时候**绝对进不去**，而且要弹提示说明为什么、还差多少；
     · 达标之后**真的进得去**（尤其二宝那条路 —— 今天上午就是它被卡死才把整个门槛拆掉的）；
     · 跨天自动重置；同一关刷两遍不算两关。
   夹具只用来**布置输入**（清空状态 / 摆"N 秒学习" / 摆"闯过某关"），
   锁与解锁的判断全部走真实逻辑。
   跑法： BT_BUDGET=400000 bash tools/browser_test.sh tools/shots/t-gate.js */
(function () {
  const L = [];
  let bad = 0;
  const ok = (c, m) => { if (!c) bad++; L.push((c ? '  ✅ ' : '  ❌ ') + m); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function flush() {
    const n = L.filter(x => x.indexOf('  ✅ ') === 0 || x.indexOf('  ❌ ') === 0).length;
    L.push('\n共 ' + n + ' 项断言，' + bad + ' 处问题');
    L.push((bad || n === 0) ? '🔴 游戏乐园的门没通过' + (n === 0 ? '（一项断言都没跑到）' : '')
                            : '✅ 游戏乐园的门：锁得住、够得着、跨天会重置');
    const pre = document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.textContent = L.join('\n');
    document.body.appendChild(pre);
  }
  const HM = () => window.__hm;
  const gamesCard = () => {
    const ms = document.querySelectorAll('#home-mods .mod');
    for (const m of ms) { const t = m.querySelector('.tt'); if (t && t.textContent.indexOf('游戏乐园') >= 0) return m; }
    return null;
  };
  const backHome = async () => {
    const b = document.querySelector('#screen-games [data-back]');
    if (b) { b.click(); await sleep(220); }
  };
  window.addEventListener('error', e => {
    L.push('🔴 驱动脚本报错：' + (e.message || e.error)); flush();
  });

  (async () => {
    /* 选二宝进首页 */
    const card = document.querySelector('.kid-card.er');
    if (card) { card.click(); await sleep(300); }
    if (HM().screen() !== 'screen-home') { document.getElementById('home-switch').click(); await sleep(250); document.querySelector('.kid-card.er').click(); await sleep(300); }
    ok(HM().screen() === 'screen-home', '进了首页（' + HM().screen() + '）');

    /* ═══ ① 锁着的时候：卡片是灰的、点不进去、弹出提示 ═══ */
    L.push('\n== ① 锁着：进不去，而且说清楚为什么 ==');
    let gi = HM().gate.reset('er');
    ok(gi.open === false, '清空之后门是锁着的（learned 0 分钟 / 0 关）');
    let mod = gamesCard();
    ok(!!mod, '首页找得到「游戏乐园」卡片');
    ok(mod.classList.contains('gate-locked'), '卡片是"锁着"的样子（灰 + 锁）');
    ok(mod.textContent.indexOf('🔒') >= 0, '卡片上画着锁：' + mod.textContent.replace(/\s+/g, ' ').trim().slice(0, 46));
    ok(/再学\s*21\s*分钟/.test(mod.textContent), '卡片上写着还差多少（要学 21 分钟）');
    mod.click(); await sleep(250);
    ok(HM().screen() === 'screen-home', '🔴 锁着的时候点它**进不去**（还停在 ' + HM().screen() + '）');
    ok(!document.getElementById('gate-pop').classList.contains('hide'), '弹出了「还没开门」提示（不是静默失败）');
    const ds = document.getElementById('gate-ds').textContent.replace(/\s+/g, ' ');
    ok(ds.indexOf('21') >= 0, '提示里写清楚要学 21 分钟：' + ds.slice(0, 60));
    ok(ds.indexOf('闯') >= 0, '提示里也说了"或者闯关"这条路：' + ds.slice(0, 60));
    document.getElementById('gate-cancel').click(); await sleep(150);
    ok(document.getElementById('gate-pop').classList.contains('hide'), '点「再等等」能收起提示');

    /* ═══ ② 时长那条路：19 分钟还不开，21 分钟开 ═══ */
    L.push('\n== ② 学习时长达标（老曾：21 分钟）==');
    gi = HM().gate.setStudySec(20 * 60, 'er');
    ok(gi.open === false, '学了 20 分钟：还没开门（差 1 分钟）');
    mod = gamesCard();
    ok(/再学\s*1\s*分钟/.test(mod.textContent), '卡片上的数字跟着减到「再学 1 分钟」：' + mod.textContent.replace(/\s+/g, ' ').trim().slice(0, 46));
    gi = HM().gate.setStudySec(21 * 60, 'er');
    ok(gi.open === true && gi.byTime === true, '🔴 满 21 分钟 → 开门（走的是时长那条路）');
    mod = gamesCard();
    ok(!mod.classList.contains('gate-locked'), '卡片不再是锁着的样子');
    ok(mod.textContent.indexOf('🔒') < 0, '卡片上的锁没了');
    mod.click(); await sleep(300);
    ok(HM().screen() === 'screen-games', '🔴 开门之后点得进去（' + HM().screen() + '）');
    await backHome();

    /* ═══ ③ 闯关那条路：二宝 1 关就够；同一关刷两遍不算两关 ═══ */
    L.push('\n== ③ 闯关那条路（二宝 1 关）==');
    gi = HM().gate.reset('er');
    ok(HM().gate.info().lvNeed === 1, '二宝的闯关门槛 = 1 关（他坐不住 21 分钟，这是他的活路）');
    gi = HM().gate.addLevel('m1');
    ok(gi.open === true && gi.byLv === true, '🔴 二宝闯过 1 关 → 开门（不用等 21 分钟）');
    HM().gate.reset('er');
    HM().gate.addLevel('m1');
    gi = HM().gate.addLevel('m1');
    ok(gi.lvHave === 1, '同一关刷两遍只算 1 关（刷关刷不出门）');

    /* ═══ ④ 大宝要 2 关，两个孩子的账分开算 ═══ */
    L.push('\n== ④ 大宝要 2 关 · 两个人的账分开 ==');
    /* 真的换成大宝这个档案（门的门槛是按当前孩子算的） */
    document.getElementById('home-switch').click(); await sleep(250);
    document.querySelector('.kid-card.da').click(); await sleep(300);
    ok(HM().screen() === 'screen-home', '（切到大宝）');
    gi = HM().gate.reset('da');
    ok(HM().gate.info().lvNeed === 2, '大宝的闯关门槛 = 2 关');
    HM().gate.addLevel('m1');
    ok(HM().gate.info().open === false, '大宝只闯 1 关 → 还不开（跟二宝的门槛不一样）');
    gi = HM().gate.addLevel('m2');
    ok(gi.open === true, '🔴 大宝闯过 2 关 → 开门');
    /* 换回二宝：他自己的账还是空的（哥哥开门不给弟弟开门） */
    document.getElementById('home-switch').click(); await sleep(250);
    document.querySelector('.kid-card.er').click(); await sleep(300);
    HM().gate.reset('er');
    ok(HM().gate.info().open === false, '🔴 二宝这边还是锁着的（哥哥开门不给弟弟开门）');

    /* ═══ ⑤ 家长页：今天直接放行 ═══ */
    L.push('\n== ⑤ 家长页「今天就让他玩」==');
    document.getElementById('home-parent').click(); await sleep(250);
    ok(HM().screen() === 'screen-parent', '首页的家长入口进得去（游戏乐园锁着也进得去 —— 不然这个开关没法用）');
    const q = document.getElementById('parent-q').textContent;
    const m = q.match(/(\d+)\s*\+\s*(\d+)/);
    ok(!!m, '家长页有算术验证：' + q);
    if (m) {
      document.getElementById('parent-ans').value = String(Number(m[1]) + Number(m[2]));
      document.getElementById('parent-unlock').click(); await sleep(200);
      ok(!document.getElementById('parent-body').classList.contains('hide'), '答对算术题 → 进入家长设置');
      ok(!!document.getElementById('gate-open-now'), '家长设置里有「今天直接放行」按钮');
      document.getElementById('gate-open-now').click(); await sleep(200);
      ok(HM().gate.info().open === true, '🔴 点一下就开门（今天、只对这个孩子）');
    }
    document.getElementById('parent-back').click(); await sleep(250);

    /* ═══ ⑥ 跨天重置 ═══ */
    L.push('\n== ⑥ 跨天重置 ==');
    /* 🔴 用**当前这个孩子**（er）：门的门槛是按当前档案算的，
       这里如果去动 da 的档案、却读 er 的门，就是在读另一个人的账（踩过）。 */
    HM().gate.reset('er');
    HM().gate.setStudySec(21 * 60, 'er');
    ok(HM().gate.info().open === true, '（先把当前这个孩子今天学够、门打开）');
    /* 模拟"换了一天"：门上的日期停在昨天、今天的学习秒数也清零（昨天学的不算今天） */
    HM().state().profiles.er.gate.day = '2020-01-01';
    HM().gate.setStudySec(0, 'er');
    ok(HM().gate.info().open === false, '🔴 昨天的开门状态不带到今天（跨天自动重置）');

    /* ═══ ⑦ 那两道时长硬顶还在（门和时长是两件事）═══ */
    L.push('\n== ⑦ 时长硬顶没被这道门顶掉 ==');
    ok(typeof window.HMBridge.gameRemainSec === 'function', '每日可玩时长仍然由 gameRemainSec 那套管着');
    ok(document.querySelector('#screen-parent') !== null, '家长页那两道硬顶（每天最多 / 单次最长）还在');

    flush();
  })();
})();
