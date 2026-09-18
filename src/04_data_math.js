/* ══════════════════════════════════════════════════════════════
   数学数据 + 出题引擎
   🔴 设计原则：数学题**不存题库，现场生成**——同一个关卡永远不重样，
      孩子刷多少遍都不会背答案，家长也不用担心"题做完了"。
   ══════════════════════════════════════════════════════════════ */

/* ── 乘法口诀（小九九 45 句，和课本一致） ── */
const MUL_KOUJUE = (() => {
  const CN = ['','一','二','三','四','五','六','七','八','九'];
  const out = [];
  for (let b = 1; b <= 9; b++) {
    for (let a = 1; a <= b; a++) {
      const p = a * b;
      let tail;
      if (p < 10) tail = '得' + CN[p];
      else tail = (p < 20 ? '十' : CN[Math.floor(p / 10)] + '十') + (p % 10 ? CN[p % 10] : '');
      out.push({ a, b, p, txt: CN[a] + CN[b] + tail });
    }
  }
  return out;                                  // 45 句
})();

/* ── 应用题素材池 ── */
const WORD_ITEMS = [
  {n:'苹果', e:'🍎', m:'个'}, {n:'铅笔', e:'✏️', m:'支'}, {n:'糖果', e:'🍬', m:'颗'}, {n:'本子', e:'📒', m:'本'},
  {n:'气球', e:'🎈', m:'个'}, {n:'鸡蛋', e:'🥚', m:'个'}, {n:'橘子', e:'🍊', m:'个'}, {n:'贴纸', e:'⭐', m:'张'},
  {n:'图书', e:'📚', m:'本'}, {n:'饼干', e:'🍪', m:'块'}, {n:'弹珠', e:'🔵', m:'颗'}, {n:'草莓', e:'🍓', m:'颗'}
];
/* 🔴 m 是量词，**必须跟物品名一起用**，不许再写死「个」。
   踩过的坑：出现过「数一数，有几个图书？」——中文里图书论「本」、铅笔论「支」，
   一个给中国小孩学中文的 App 教错量词，比算错一道题严重得多。
   「个」是万能量词，只在确实通用时才用（苹果/气球/鸡蛋/橘子）。
   判据在 tests/gen.test.js 里有一道通用断言兜底：任何物品名前面那个量词，
   必须等于它自己的 m。 */
/* 🔴 人名分两类：主角只能是小朋友（应用题的钱物都发生在孩子身上），
      长辈只出现在「给他/送他」这一侧。原来混在一起会出「李老师有68元…妈妈又给了他28元」
      这种别扭句子——老师怎么会从妈妈那儿拿钱？ */
const WORD_KIDS   = ['麟轩','曾强','小明','小红','丁丁','冬冬'];
const WORD_ELDERS = ['妈妈','奶奶','外婆','姑姑'];
const WORD_PLACES = ['超市','学校','家里','书店'];

/* ── 小工具 ── */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));   // [a,b] 整数
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* 把正确答案和一堆干扰项凑成 4 个不重复选项 */
function options4(ans, extra = [], lo = 0, hi = 400) {
  const set = new Set([String(ans)]);
  const cand = shuffle(extra.filter(v => Number.isFinite(v) && v >= lo && v <= hi));
  for (const c of cand) { if (set.size >= 4) break; set.add(String(c)); }
  let guard = 0;
  while (set.size < 4 && guard++ < 200) {
    const d = ans + (Math.random() < 0.5 ? -1 : 1) * ri(1, Math.max(2, Math.round(Math.abs(ans) * 0.2) + 2));
    if (d >= lo && d <= hi) set.add(String(d));
  }
  while (set.size < 4 && guard++ < 400) { const d = ri(lo, Math.min(hi, lo + 30)); set.add(String(d)); }
  const arr = shuffle([...set]);
  return { choices: arr, answer: String(ans) };
}

/* 干扰项：把两个数做错运算（加变减、乘变加…），这是孩子最常犯的错 */
function wrongOps(a, b, right) {
  const cand = [a + b, a - b, a * b, a / b, b - a, a + b + 1, a + b - 1, a * b + a, a * b - a];
  return cand.map(v => Math.round(v)).filter(v => Number.isInteger(v) && v !== right && v > 0);
}

/* ══ 看得见的数学：把抽象数字画成实物 ══
   🔴 老曾 2026-09-18 定调：「都需要是那种孩子能联想的、场景化图片化游戏化的」。
      所以每个式子旁边都要有「实物图」，让孩子先看见、再算数。 */

// 小棒：十位一捆（10 根扎一起），个位一根
// 🔴 用 SVG 画，不用 emoji——试过 🎋/🪵，🎋 长得像棵竹子，孩子根本看不出是「一捆小棒」
const _BARS = Array.from({ length: 10 }, (_, i) =>
  '<line x1="' + (2.8 + i * 1.6).toFixed(1) + '" y1="4" x2="' + (2.8 + i * 1.6).toFixed(1) + '" y2="24" stroke="#c9a061" stroke-width="0.9"/>').join('');
const SVG_BUNDLE = '<svg viewBox="0 0 20 28" width="17" height="24" style="vertical-align:-5px">' +
  '<rect x="1" y="2" width="18" height="24" rx="3.5" fill="#fdf3e3" stroke="#c9a678" stroke-width="1.2"/>' + _BARS + '</svg>';
const SVG_STICK = '<svg viewBox="0 0 6 28" width="6" height="24" style="vertical-align:-5px">' +
  '<line x1="3" y1="3" x2="3" y2="25" stroke="#c9a061" stroke-width="3" stroke-linecap="round"/></svg>';
/* 小棒图：两位数画真小棒（几捆几根，进位借位看得见）。
   🔴 **三位数绝对不许画小棒**——599 要画 59 捆 + 9 根 = 一小半屏幕的内联 SVG，
      既把「确定」按钮顶出屏幕（孩子得往下滚才能交卷），又白白烧手机的渲染时间。
      三位数改画数位分解（「5 个百　9 个十　9 个一」），这正是课本教三位数的方式。
   🔴 这道闸门**只写在这里一处**。以前 cmpPic() 里另写了一份，结果 vert() 绕过它
      直接调 sticks(599)，一口气画出 121 个 SVG 把按钮顶飞——判据写两份就一定会漏。 */
function sticks(n) {
  if (n >= 100) {
    const ds = String(n).split('');
    return '<span style="font-size:15px">' + ds.map((d, i) =>
      d + ' 个' + CN_UNIT[3 - ds.length + i]).join('　') + '</span>';
  }
  const t = Math.floor(n / 10), o = n % 10;
  return SVG_BUNDLE.repeat(t) + (t && o ? '<span style="display:inline-block;width:7px"></span>' : '') + SVG_STICK.repeat(o);
}
const STICK_LEGEND = SVG_BUNDLE + ' <span style="font-size:12px">一捆 10 根</span>　' +
                     SVG_STICK + ' <span style="font-size:12px">一根 1</span>';
// 几个几：rows 行 × cols 列 的点阵（乘法就是「几行几个」）
function dotArray(rows, cols, e) {
  return Array.from({ length: rows }, () => e.repeat(cols)).join('<br>');
}
// 平均分：几个盘子/几个小朋友的空位
function plates(n, e) { return e.repeat(n); }
// 十格阵：把 10 以内的数画进格子里，一眼看出多少
function tenFrame(n, e) {
  return Array.from({ length: 10 }, (_, i) => i < n ? e : '⬜').join('');
}
/* 比大小的「看得见」：两位数画小棒，三位数改画数位分解。
   🔴 三位数绝不能用 sticks()——999 要画 99 捆小棒，几百个 SVG 会把页面卡死。 */
const CN_UNIT = ['百', '十', '一'];
/* cmpPic 已删除：它就是 sticks() 的重复实现，而重复实现必然分叉。
   比大小直接用 sticks() —— 两位数画小棒、三位数画数位分解，由 sticks 自己决定。 */
/* 比大小的讲法：先看位数，位数相同再从左往右一位一位比 */
function cmpWhy(a, b) {
  const sa = String(a), sb = String(b);
  if (sa.length !== sb.length) return '先看位数：' + a + ' 是 ' + sa.length + ' 位数，' + b + ' 是 ' + sb.length +
    ' 位数，位数多的那个大。';
  /* 🔴 说清楚比的是**哪一位**。原来写「位数一样，就从高位比起：5 和 3，5 大，所以 592 大。」——
     8 岁的孩子读到「5 和 3」得自己回头找这俩数是哪儿来的。写出「百位」他才知道眼睛往哪儿看。 */
  const PLACE = { 3: ['百位', '十位', '个位'], 2: ['十位', '个位'] };
  const place = PLACE[sa.length] || [];
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) {
      const bigger = Number(sa[i]) > Number(sb[i]);
      /* i=0 是「从最高位比起」，i>0 说明前面几位打平了——那时再说「从最高位比起」就不通，
         得说「前面几位都一样，再看……」 */
      return (i === 0 ? '位数一样，就从最高位比起：' : '前面几位都一样，再看') +
        (place[i] || '最高位') + '上 ' + sa[i] + ' 比 ' + sb[i] +
        (bigger ? ' 大，所以 ' + a + ' 比 ' + b + ' 大。' : ' 小，所以 ' + a + ' 比 ' + b + ' 小。');
    }
  }
  return '每一位都一样，所以两边相等，填「=」。';
}

/* ══════════════ 各关卡出题器 ══════════════
   返回 {big, emoji, sub, choices|input, answer, say, why}
   ═══════════════════════════════════════════ */

const GEN = {
  /* —— 二宝：数一数 —— */
  count() {
    const it = pick(WORD_ITEMS), n = ri(1, 10);
    const o = options4(n, [n+1, n-1, n+2, n-2, 10-n], 1, 12);
    return { big: '', emoji: '<div style="letter-spacing:12px;line-height:1.6">' + it.e.repeat(n) + '</div>',
             sub: '数一数，有几' + it.m + it.n + '？',
             say: '数一数，一共有几' + it.m + it.n, ...o,
             why: '一个一个点着数：' + Array.from({length:n},(_,i)=>i+1).join('、'),
             whyHtml: '<div style="font-size:26px;letter-spacing:8px">' + tenFrame(n, it.e) + '</div><div style="font-size:12px">十格阵：摆满 10 格，就是 10 ' + it.m + '</div>' };
  },
  /* —— 二宝：比多少 —— */
  /* 🔴 比多少原来整道题是空的：两组东西塞在 groups 字段里，而答题屏根本不读 groups
     （只读 emoji），于是孩子看到一张「哪一边多？」的卡加两个按钮，左右什么都没有，
     只能瞎蒙。**数据生成了、却没接到渲染链路上，就是没有。**
     现在直接画成左右两个框，框下面标「左边 / 右边」。 */
  more() {
    let a = ri(2, 8), b = ri(2, 8);
    if (a === b) b = a + 1;
    /* 两边用**同一种**东西：3 岁半要比的是「哪边数量多」，不是「这是啥」。
       换成两种不同物品，他还得先分辨哪边是什么，难度就跑偏了。 */
    const it = pick(WORD_ITEMS);
    const box = (n, label) =>
      '<div style="flex:1;background:var(--bg2);border-radius:14px;padding:10px 4px;border:2px solid var(--line2)">' +
        '<div style="font-size:23px;letter-spacing:2px;line-height:1.45;min-height:76px">' + it.e.repeat(n) + '</div>' +
        '<div style="font-size:13px;color:var(--ink3);margin-top:4px;letter-spacing:0">' + label + '</div>' +
      '</div>';
    const ans = a > b ? '左边多' : '右边多';
    return { big: '', sub: '哪一边多？',
             emoji: '<div style="display:flex;gap:10px;align-items:stretch">' + box(a, '左边') + box(b, '右边') + '</div>',
             choices: shuffle(['左边多','右边多']), answer: ans,
             say: '哪一边多',
             why: '左边 ' + a + ' ' + it.m + '，右边 ' + b + ' ' + it.m + '，' + a + ' 比 ' + b + ' ' + (a>b?'多':'少') };
  },
  /* —— 二宝：认形状（真的画出形状，不用 emoji） —— */
  shape() {
    const SVG = {
      '圆形':   '<svg viewBox="0 0 100 100" width="150" height="150"><circle cx="50" cy="50" r="44" fill="#ff8a3d"/></svg>',
      '正方形': '<svg viewBox="0 0 100 100" width="150" height="150"><rect x="8" y="8" width="84" height="84" rx="3" fill="#4d8df6"/></svg>',
      '三角形': '<svg viewBox="0 0 100 100" width="150" height="150"><polygon points="50,8 94,90 6,90" fill="#37bf7a"/></svg>',
      '长方形': '<svg viewBox="0 0 100 100" width="150" height="150"><rect x="4" y="22" width="92" height="56" rx="3" fill="#9b6ef3"/></svg>'
    };
    const names = Object.keys(SVG);
    const t = pick(names);
    return { big: SVG[t], sub: '这是什么形状？',
             choices: shuffle(names), answer: t, choiceClass: 'txt', say: '这是什么形状',
             whyHtml: t + '：' + (t==='圆形'?'圆圆的，没有角，会滚':t==='正方形'?'四条边一样长，四个角都是直角':'三条边，三个角'),
             why: t + (t==='圆形'?' 圆圆的，没有角':t==='正方形'?' 四条边一样长':' 三条边，三个角') };
  },
  /* —— 二宝：找规律 —— */
  pattern() {
    const A = pick(['🔴','🔵','⭐','🍎','🐟']), B = pick(['🟩','🟨','🌸','🍇','🐤'].filter(x => x !== A));
    const unit = Math.random() < 0.5 ? [A,B] : [A,A,B];
    const seq = [];
    while (seq.length < 7) seq.push(...unit);
    const ans = seq[7], shown = seq.slice(0, 7);
    const pool = shuffle([A, B, ...[ '🔺','🟣','🍀' ]]).slice(0, 4);
    if (!pool.includes(ans)) pool[0] = ans;
    return { big: '<span style="font-size:44px;letter-spacing:6px">' + shown.join('') + '❓</span>',
             sub: '接下来应该是什么？', choices: shuffle([...new Set(pool)]), answer: ans,
             choiceClass: 'txt', say: '接下来应该是什么', why: '它一直按「' + unit.join('') + '」这样重复。' };
  },
  /* —— 二宝：10 以内加法（实物 + 十格阵，把「凑十」看见） —— */
  add10() { return this._as(ri(1,5), ri(1,4)); },
  add5()  { return this._as(ri(1,3), ri(1,2)); },
  _as(a, b) {
    const it = pick(WORD_ITEMS);
    return { big: '',
             emoji: '<div style="letter-spacing:6px">' + it.e.repeat(a) + ' ➕ ' + it.e.repeat(b) + '</div>',
             sub: a + ' ' + it.m + it.n + ' 加上 ' + b + ' ' + it.m + it.n + '，一共几' + it.m + '？',
             choices: shuffle(options4(a+b, wrongOps(a,b,a+b), 0, 20).choices), answer: String(a+b),
             say: a + ' 加 ' + b + ' 等于几',
             why: '把 ' + a + ' 和 ' + b + ' 合起来，一个一个数：' + (a+b) + ' ' + it.m + '。',
             whyHtml: '<div style="font-size:26px;letter-spacing:3px">' + tenFrame(a, it.e) + '</div>' +
                      '<div style="font-size:26px;letter-spacing:3px">' + tenFrame(b, it.e) + '</div>' +
                      '<div style="font-size:13px;margin-top:6px">凑十法：' + a + ' 和 ' + b + ' 合起来就是 ' + (a+b) + '</div>' };
  },
  /* —— 二宝：10 以内减法 —— */
  sub10() { const a = ri(3,10), b = ri(1,a-1); return this._ss(a,b); },
  _ss(a, b) {
    const it = pick(WORD_ITEMS);
    const boxes = Array.from({ length: 10 }, (_, i) => i < a ? it.e : '⬜');
    for (let i = a - b; i < a; i++) boxes[i] = '❌';
    return { big: '',
             emoji: '<div style="letter-spacing:6px">' + it.e.repeat(a) + '</div><div style="font-size:16px;color:#f2544b">划掉 ' + b + ' ' + it.m + ' ❌</div>',
             sub: a + ' ' + it.m + it.n + '，吃掉 ' + b + ' ' + it.m + '，还剩几' + it.m + '？',
             choices: shuffle(options4(a-b, wrongOps(a,b,a-b), 0, 20).choices), answer: String(a-b),
             say: a + ' 减 ' + b + ' 等于几',
             why: a + ' ' + it.m + '划掉 ' + b + ' ' + it.m + '，还剩 ' + (a-b) + ' ' + it.m + '。',
             whyHtml: '<div style="font-size:26px;letter-spacing:3px">' + boxes.join('') + '</div>' +
                      '<div style="font-size:13px;margin-top:6px">划掉的 ' + b + ' ' + it.m + '不算，剩下 ' + (a-b) + ' ' + it.m + '</div>' };
  },
  /* —— 大宝：100 以内加法 —— */
  add100() {
    const carry = Math.random() < 0.6;
    let a, b;
    if (carry) { a = ri(11, 88); b = ri(10, 99 - a); if ((a%10)+(b%10) < 10) a += (10 - (a%10)); if (a > 89) a = 35; }
    else { a = ri(10, 60); b = ri(10, 80 - a); if ((a%10)+(b%10) >= 10) b -= ((a%10)+(b%10)) - 9; }
    const s = a + b;
    return { big: '', input: true, answer: String(s),
             emoji: '<div style="font-size:19px;line-height:1.9">' + sticks(a) + '<br>➕<br>' + sticks(b) + '</div>',
             sub: STICK_LEGEND + '<div style="margin-top:6px">一共有多少根小棒？</div>',
             say: a + ' 加 ' + b + ' 等于几',
             /* 🔴 drill = 限时口算用的「光溜溜的算式」。限时是 60 秒速度赛，
                把小棒图搬进来既拖慢速度、又会把键盘和「确定」顶出屏幕。
                关卡屏不受影响，图都还在（drill 只有限时屏读）。 */
             drill: a + ' + ' + b + ' = ?',
             why: '个位 ' + (a%10) + '+' + (b%10) + ('=' + ((a%10)+(b%10))) + '，十位 ' + Math.floor(a/10) + '+' + Math.floor(b/10) + '，得 ' + s + '。',
             whyHtml: '<div style="font-size:22px;line-height:1.8">' + sticks(s) + '</div>' +
                      '<div style="font-size:13px;margin-top:4px">' + a + ' 根加 ' + b + ' 根，一共 ' + s + ' 根。</div>' };
  },
  /* —— 大宝：100 以内减法 —— */
  sub100() {
    const borrow = Math.random() < 0.6;
    let a, b;
    if (borrow) { a = ri(31, 95); b = ri(12, a - 10); if ((a%10) >= (b%10)) { a = a - (a%10) + ri(1,8); if (a <= b) a = b + ri(11,30); } }
    else { a = ri(30, 99); b = ri(10, a - 5); if ((a%10) < (b%10)) b = b - (b%10); if (b < 10) b = 10; }
    const s = a - b;
    return { big: '', input: true, answer: String(s),
             emoji: '<div style="font-size:19px;line-height:1.9">' + sticks(a) + '<br>➖ ' + b + ' 根<br>' + sticks(b) + '</div>',
             sub: STICK_LEGEND + '<div style="margin-top:6px">拿走 ' + b + ' 根，还剩多少根？</div>',
             say: a + ' 减 ' + b + ' 等于几',
             drill: a + ' − ' + b + ' = ?',
             why: '个位不够减就向十位借 1 个十：' + a + ' − ' + b + ' = ' + s + '。',
             whyHtml: '<div style="font-size:22px;line-height:1.8">' + sticks(s) + '</div>' +
                      '<div style="font-size:13px;margin-top:4px">个位不够减，就把一捆拆开当 10 根。</div>' };
  },
  /* —— 大宝：表内乘法（画成「几行几个」，乘法就不再是死记） —— */
  mul() {
    const a = ri(2,9), b = ri(2,9), p = a*b;
    const it = pick(WORD_ITEMS);
    const k = MUL_KOUJUE.find(x => x.a === Math.min(a,b) && x.b === Math.max(a,b));
    const show = p <= 36
      ? '<div style="font-size:22px;line-height:1.35;letter-spacing:2px">' + dotArray(b, a, it.e) + '</div>' +
        '<div style="font-size:13px;color:#8a8177;margin-top:6px">' + b + ' 行，每行 ' + a + ' ' + it.m + '</div>'
      : '<div style="font-size:22px;letter-spacing:2px">' + it.e.repeat(a) + '</div>' +
        '<div style="font-size:13px;color:#8a8177;margin-top:6px">这样的 ' + b + ' 组（图太小画不下，自己数数看）</div>';
    return { big: '', input: true, answer: String(p),
             emoji: show,
             sub: '每行 ' + a + ' ' + it.m + it.n + '，一共 ' + b + ' 行，一共有多少' + it.m + '？',
             say: a + ' 乘 ' + b + ' 等于几',
             drill: a + ' × ' + b + ' = ?',
             why: '口诀：' + k.txt + ' → ' + p + '。',
             whyHtml: '<div style="font-size:20px;line-height:1.3;letter-spacing:2px">' + dotArray(b, a, it.e) + '</div>' +
                      '<div style="font-size:14px;margin-top:6px">口诀「' + k.txt + '」，' + a + ' × ' + b + ' = ' + p + '</div>' };
  },
  /* —— 大宝：有余数的除法（二年级下册的重头，也最容易马虎） ——
     画成「往盘子里分，分不下的剩在一边」，商和余数一眼看得见。 */
  rem() {
    const b = ri(3, 9), q = ri(2, 8), r = ri(1, b - 1), a = b * q + r;
    const it = pick(WORD_ITEMS);
    /* 图就按「每 b 个一行」画：一行正好是一袋，最后那行不满 b 个的，一眼就是余数。
       🔴 原来画成一长串，孩子光看数字看不出「几袋」，量词才对上。 */
    const rows = Array.from({ length: Math.ceil(a / b) }, (_, i) =>
      it.e.repeat(Math.min(b, a - i * b)));
    const full = Array.from({ length: b }, () => it.e.repeat(q)).join('　');
    const left = it.e.repeat(r);
    return { big: '', input: true, padSep: true, answer: String(q) + '……' + String(r),
             emoji: '<div style="font-size:20px;letter-spacing:3px;line-height:1.5">' + rows.join('<br>') + '</div>' +
                    '<div style="font-size:13px;color:#8a8177;margin-top:6px">每 ' + b + ' ' + it.m + '一行，最后一行不够 ' + b + ' ' + it.m + '的就是剩下的</div>',
             sub: a + ' ' + it.m + it.n + '，每 ' + b + ' ' + it.m + '装一袋，能装几袋？还剩几' + it.m + '？<br>' +
                  '<span style="font-size:13px;color:#8a8177">答案写成「几……几」，比如 5……2</span>',
             say: a + ' 除以 ' + b + '，商几余几',
             why: '想口诀：' + (b * q) + ' 比 ' + a + ' 小，' + (b * (q + 1)) + ' 又比 ' + a + ' 大了，' +
                  '所以商是 ' + q + '，剩下 ' + a + ' − ' + (b * q) + ' = ' + r + '。答：' + q + '……' + r + '。',
             whyHtml: '<div style="font-size:17px;line-height:1.9">' + full + '</div>' +
                      '<div style="font-size:17px;line-height:1.9;color:#ff8a3d">剩下 ' + left + '（' + r + ' ' + it.m + '）</div>' +
                      '<div style="font-size:13px;margin-top:4px">' + b + ' × ' + q + ' = ' + (b * q) + '，还多 ' + r + ' ' + it.m + '，不够再装一袋。</div>' };
  },
  /* —— 大宝：表内除法（画成「平均分到盘子里」） —— */
  div() {
    const b = ri(2,9), q = ri(2,9), a = b*q;
    const it = pick(WORD_ITEMS);
    const k = MUL_KOUJUE.find(x => x.a === Math.min(b,q) && x.b === Math.max(b,q));
    return { big: '', input: true, answer: String(q),
             emoji: '<div style="font-size:20px;letter-spacing:3px;line-height:1.8">' + it.e.repeat(a) + '</div>' +
                    '<div style="font-size:34px;letter-spacing:10px;margin-top:6px">' + plates(b, '🍽️') + '</div>',
             sub: a + ' ' + it.m + it.n + '平均放到 ' + b + ' 个盘子里，每盘几' + it.m + '？',
             say: a + ' 除以 ' + b + ' 等于几',
             drill: a + ' ÷ ' + b + ' = ?',
             why: '想口诀：' + k.txt + '，所以 ' + a + ' ÷ ' + b + ' = ' + q + '。',
             whyHtml: '<div style="font-size:22px;letter-spacing:2px;line-height:1.5">' + dotArray(b, q, it.e) + '</div>' +
                      '<div style="font-size:13px;margin-top:6px">每盘放 ' + q + ' ' + it.m + '，一共 ' + b + ' 盘，正好 ' + a + ' ' + it.m + '。</div>' };
  },
  /* —— 大宝：混合运算（先买盒装再买散的，生活场景） —— */
  mix() {
    const a = ri(2,9), b = ri(2,9), c = ri(2,20);
    const it = pick(WORD_ITEMS);
    if (Math.random() < 0.5) {
      const s = a*b + c;
      return { big: '', input: true, answer: String(s),
               emoji: '<div style="font-size:20px;letter-spacing:2px;line-height:1.4">' + dotArray(b, a, it.e) + '</div>' +
                      '<div style="font-size:22px;margin-top:6px">➕ ' + it.e.repeat(Math.min(c,10)) + (c>10?'…':'') + '</div>',
               sub: '每盒 ' + a + ' ' + it.m + it.n + '，买了 ' + b + ' 盒，又另外买了 ' + c + ' ' + it.m + '，一共几' + it.m + '？',
               say: a + ' 乘 ' + b + ' 加 ' + c + ' 等于几',
               drill: a + ' × ' + b + ' + ' + c + ' = ?',
               why: '先算盒子里的：' + a + '×' + b + '=' + (a*b) + '，再加散的 ' + c + ' ' + it.m + ' = ' + s + '。' };
    }
    const p = a*b, s = p - c > 0 ? p - c : p + c, op = p - c > 0 ? '−' : '+';
    return { big: '', input: true, answer: String(s),
             emoji: '<div style="font-size:20px;letter-spacing:2px;line-height:1.4">' + dotArray(b, a, it.e) + '</div>' +
                    '<div style="font-size:18px;margin-top:6px">' + op + ' ' + it.e.repeat(Math.min(c,10)) + (c>10?'…':'') + ' （' + c + ' ' + it.m + '）</div>',
             sub: '一共 ' + p + ' ' + it.m + it.n + '，' + (op==='−'?'吃掉':'又得到') + ' ' + c + ' ' + it.m + '，现在几' + it.m + '？',
             say: a + ' 乘 ' + b + (op === '−' ? ' 减 ' : ' 加 ') + c + ' 等于几',
             drill: a + ' × ' + b + ' ' + op + ' ' + c + ' = ?',
             why: '先算乘法 ' + a + '×' + b + '=' + p + '，再' + (op === '−' ? '减' : '加') + c + ' = ' + s + '。' };
  },
  /* —— 大宝：口诀填空（抽背） —— */
  mj() {
    const k = pick(MUL_KOUJUE);
    const it = pick(WORD_ITEMS);
    const CN = ['','一','二','三','四','五','六','七','八','九'];
    const pic = '<div style="font-size:19px;line-height:1.3;letter-spacing:2px">' + dotArray(Math.min(k.b,9), Math.min(k.a,9), it.e) + '</div>';
    if (Math.random() < 0.5) {
      const o = options4(k.p, [k.a+k.b, k.p+k.a, k.p-k.a, k.p+1, k.p-1], 1, 90);
      return { big: '<span style="font-size:34px">' + CN[k.a] + CN[k.b] + '（　）</span>',
               sub: '口诀里应该填几？', ...o, whyHtml: pic,
               say: CN[k.a] + CN[k.b] + '，括号里是几', why: '口诀是「' + k.txt + '」，填 ' + k.p + '。' };
    }
    const show = Math.random() < 0.5 ? k.a : k.b, other = show === k.a ? k.b : k.a;
    const o = options4(other, [other+1, other-1, other+2, 9-other], 1, 9);
    return { big: '<span style="font-size:34px">' + CN[show] + '（　）' + k.txt.slice(2) + '</span>',
             sub: '括号里是几？', ...o, whyHtml: pic,
             say: CN[show] + '几' + k.txt.slice(2) + '，括号里是几',
             why: '完整口诀是「' + k.txt + '」，括号里是 ' + other + '。' };
  },
  /* —— 大宝：比大小填符号（配小棒图，一眼看出谁多） —— */
  cmpnum() {
    const a = ri(10, 999);
    /* 🔴 有 1/5 的机会故意出「相等」——不然孩子做一百遍也见不到「=」，
       会默认「=」是废选项，而课本里「=」是必考的一种。 */
    const b = Math.random() < 0.2 ? a : ri(10, 999);
    const ans = a > b ? '>' : a < b ? '<' : '=';
    const why = cmpWhy(a, b);
    /* 🔴 两张图必须各自标明是哪个数：不标的话，二年级孩子会把「3 捆 1 根」
       和「1 个百 2 个十 4 个一」当成同一件事（一个是画、一个是字，还是两套表示法）。 */
    const row = (n) => '<div style="margin:3px 0"><span style="font-size:19px;font-weight:800;' +
      'color:var(--brand);vertical-align:middle">' + n + '</span>' +
      '<span style="font-size:17px;vertical-align:middle;margin-left:8px">→ ' + sticks(n) + '</span></div>';
    return { big: a + '　○　' + b, sub: '○ 里填什么？',
             emoji: '<div style="font-size:17px;line-height:1.9">' + row(a) + row(b) + '</div>',
             choices: ['>','<','='], answer: ans, choiceClass: 'sym',
             say: a + ' 和 ' + b + ' 哪个大',
             why: why };
  },
  /* —— 大宝：单位换算 —— */
  unit() {
    const U = [
      {q:'1 米 = （　）厘米', a:100, pic:'📏', why:'1 米 = 100 厘米。尺子上从 0 到 100 厘米，正好 1 米。'},
      {q:'2 米 = （　）厘米', a:200, pic:'📏', why:'1 米 = 100 厘米，2 米就是 200 厘米。'},
      {q:'1 元 = （　）角',   a:10,  pic:'💰', why:'1 元 = 10 角，就像 1 张 1 元能换 10 个 1 角硬币。'},
      {q:'3 元 = （　）角',   a:30,  pic:'💰', why:'1 元 = 10 角，3 元就是 30 角。'},
      {q:'1 时 = （　）分',   a:60,  pic:'⏰', why:'1 时 = 60 分，分针走一整圈就是 1 小时。'},
      {q:'1 分 = （　）秒',   a:60,  pic:'⏰', why:'1 分 = 60 秒，秒针走一整圈就是 1 分钟。'},
      /* 🔴 「千米」是三年级内容，二年级不教——超纲的东西只会让孩子以为自己笨 */
      {q:'1 千克 = （　）克', a:1000,pic:'⚖️', why:'1 千克 = 1000 克，1 千克差不多是两瓶矿泉水的重量。'},
      {q:'60 分 = （　）时',  a:1,   pic:'⏰', why:'60 分 = 1 时。'},
      {q:'100 厘米 = （　）米', a:1, pic:'📏', why:'100 厘米 = 1 米。'}
    ];
    const u = pick(U);
    const o = options4(u.a, [u.a*10, u.a/10, u.a+10, u.a-1, u.a+1, u.a*2], 1, 2000);
    return { big: u.pic + '<div style="font-size:30px;margin-top:6px">' + u.q.replace('（　）','<span style="color:#ff8a3d">（　）</span>') + '</div>',
             sub: '括号里填几？', ...o, say: u.q.replace('（　）','几'), why: u.why };
  },
  /* —— 大宝：列竖式（配小棒图，看得见进位和借位） —— */
  vert() {
    const isAdd = Math.random() < 0.5;
    let a, b, s;
    if (isAdd) { a = ri(105, 480); b = ri(105, 460); s = a + b; }
    else { a = ri(320, 950); b = ri(105, a - 100); s = a - b; }
    const w = String(Math.max(a, b)).length;
    const pad = v => String(v).padStart(w + 1, ' ');
    const html = '<div class="vert">' + pad(a) + '<br>' +
      (isAdd ? '+ ' : '− ') + pad(b) + '<div class="line"></div></div>';
    return { big: html, sub: '列竖式算一算，得多少？', input: true, answer: String(s),
             emoji: '<div style="font-size:17px;line-height:1.9">' + sticks(a) + '<br>' + (isAdd ? '➕' : '➖') + '<br>' + sticks(b) + '</div>' +
                    '<div style="margin-top:4px">' + STICK_LEGEND + '</div>',
             say: (isAdd ? a + ' 加 ' + b : a + ' 减 ' + b) + ' 等于几',
             why: (isAdd ? '个位对个位、十位对十位相加' : '个位不够减就向前一位借 1') + '：' + a + (isAdd ? ' + ' : ' − ') + b + ' = ' + s + '。',
             whyHtml: '<div style="font-size:20px;line-height:1.8">' + sticks(s) + '</div>' +
                      '<div style="font-size:13px;margin-top:4px">' + (isAdd ? '满 10 根就捆成一捆，搬到十位去。' : '个位不够减，就拆开一捆当 10 根。') + '</div>' };
  },
  /* —— 大宝：应用题（每题都配一张「看得见的场景」） —— */
  word() {
    const it = pick(WORD_ITEMS), who = pick(WORD_KIDS);
    /* 第二个人：从「别的小朋友 + 长辈」里挑，且不能跟主角同名。
       🔴 句子一律重复姓名、不用「他/她」——主角可能是小红，写「他」就错了。 */
    const others = WORD_KIDS.filter(k => k !== who).concat(WORD_ELDERS);
    const who2 = pick(others);
    const t = ri(1, 7);
    /* 「画不下就画一截、旁边标出真实数量」——这个标注有两条硬要求：
       🔴 ① 量词跟物品走（草莓论颗、铅笔论支），「…共 36 个」是错的；
       🔴 ② 标注**必须自成一行**。原来是接在 emoji 尾巴上的行内 span，12 个 emoji
          把一行撑满之后，标注被挤得从中间断开——「…共 36」一行、光秃秃一个「颗」
          又一行，孩子读起来像两个不相干的数（这是看图才发现的，测试全绿）。
          所以 emoji 限 10 个（320px 的老手机上也不会撑破），标注一律另起一行。 */
    const many = (n, e, pre, cap) => {
      cap = cap || 10;
      const shown = Math.min(n, cap);
      return '<div style="line-height:1.55">' + (pre || '') + e.repeat(shown) + '</div>' +
        (n > shown
          ? '<div style="font-size:13px;color:#8a8177;line-height:1.4">…还有很多，一共 <b>' + n + '</b> ' + it.m + '</div>'
          : '');
    };
    const Q = '📖 读一读，算一算';
    if (t === 1) { const a = ri(15,45), b = ri(12,40), s = a+b;
      return { big:'', sub:Q, story: who + '有 ' + a + ' ' + it.m + it.n + '，' + who2 + '又给了' + who + ' ' + b + ' ' + it.m + '，现在一共有多少' + it.m + '？',
               emoji:'<div style="font-size:19px">' + many(a,it.e) + many(b,it.e,'➕ ') + '</div>',
               input:true, answer:String(s), say: who + '有 ' + a + ' ' + it.m + it.n + '，' + who2 + '又给了' + who + ' ' + b + ' ' + it.m + '，现在一共有多少' + it.m + '',
               why:'求一共，用加法：' + a + ' + ' + b + ' = ' + s + '（' + it.m + '）' }; }
    if (t === 2) { const a = ri(30,80), b = ri(10,25), s = a-b;
      return { big:'', sub:Q, story: who + '有 ' + a + ' ' + it.m + it.n + '，送给同学 ' + b + ' ' + it.m + '，还剩多少' + it.m + '？',
               emoji:'<div style="font-size:19px">' + many(a,it.e) + '<div style="font-size:15px;color:#f2544b">送走 ' + b + ' ' + it.m + ' ➖</div></div>',
               input:true, answer:String(s), say: who + '有 ' + a + ' ' + it.m + it.n + '，送给同学 ' + b + ' ' + it.m + '，还剩多少' + it.m + '',
               why:'求还剩，用减法：' + a + ' − ' + b + ' = ' + s + '（' + it.m + '）' }; }
    if (t === 3) { const a = ri(3,9), b = ri(3,9), s = a*b;
      return { big:'', sub:Q, story: '每盒有 ' + a + ' ' + it.m + it.n + '，' + b + ' 盒一共有多少' + it.m + '？',
               emoji:'<div style="font-size:20px;line-height:1.45;letter-spacing:2px">' + dotArray(b, a, it.e) + '</div><div style="font-size:13px;color:#8a8177;margin-top:4px">' + b + ' 盒，每盒 ' + a + ' ' + it.m + '</div>',
               input:true, answer:String(s), say: '每盒有 ' + a + ' ' + it.m + it.n + '，' + b + ' 盒一共有多少' + it.m + '',
               why:'求几个几，用乘法：' + a + ' × ' + b + ' = ' + s + '（' + it.m + '）' }; }
    if (t === 4) { const b = ri(3,8), q = ri(3,9), a = b*q;
      return { big:'', sub:Q, story: a + ' ' + it.m + it.n + '平均分给 ' + b + ' 个小朋友，每人分到几' + it.m + '？',
               emoji:'<div style="font-size:19px">' + many(a,it.e) + '<div style="font-size:22px">' + '👦'.repeat(b) + '</div></div>',
               input:true, answer:String(q), say: a + ' ' + it.m + it.n + '平均分给 ' + b + ' 个小朋友，每人分到几' + it.m + '',
               why:'平均分，用除法：' + a + ' ÷ ' + b + ' = ' + q + '（' + it.m + '）' }; }
    if (t === 5) { const a = ri(40,90), b = ri(10,30), c = ri(10,40), s = a-b+c;
      return { big:'', sub:Q, story: who + '有 ' + a + ' 元，买' + it.n + '花了 ' + b + ' 元，' + pick(WORD_ELDERS) + '又给了' + who + ' ' + c + ' 元，现在有多少元？',
               emoji:'<div style="font-size:22px;line-height:1.8">💰 × ' + a + '<br><span style="font-size:15px;color:#f2544b">花了 ' + b + ' ➖</span>　<span style="font-size:15px;color:#37bf7a">又得到 ' + c + ' ➕</span></div>',
               input:true, answer:String(s), say: who + '有 ' + a + ' 元，花了 ' + b + ' 元，又得到 ' + c + ' 元，现在有多少元',
               why:'先减后加：' + a + ' − ' + b + ' + ' + c + ' = ' + s + '（元）' }; }
    if (t === 6) { const b = ri(10,40); const a = b + ri(5,30);
      return { big:'', sub:Q, story: who + '摘了 ' + a + ' ' + it.m + it.n + '，' + who2 + '摘了 ' + b + ' ' + it.m + '，' + who + '比' + who2 + '多摘几' + it.m + '？',
               /* 🔴 两行都要标出「多少个」：不标的话，42 个和 26 个都被截断到 10 个，
                  画出来一样长——一道「比多少」的题，图却在说两边一样多。 */
               emoji:'<div style="font-size:18px">' + many(a,it.e, who + '：') + many(b,it.e, who2 + '：') + '</div>',
               input:true, answer:String(a-b), say: who + '摘了 ' + a + ' ' + it.m + '，' + who2 + '摘了 ' + b + ' ' + it.m + '，多几' + it.m + '',
               why:'求多几' + it.m + '，用大数减小数：' + a + ' − ' + b + ' = ' + (a-b) + '（' + it.m + '）' }; }
    const a = ri(3,9), k = ri(2,6), s = a*k;
    return { big:'', sub:Q, story: who + '有 ' + a + ' ' + it.m + it.n + '，' + who2 + '的' + it.m + '数是' + who + '的 ' + k + ' 倍，' + who2 + '有多少' + it.m + '？',
             emoji:'<div style="font-size:19px;line-height:1.6">' + who + '：' + it.e.repeat(a) + '<br>' + who2 + '：' + '❓'.repeat(k) + '（是' + who + '的 ' + k + ' 倍）</div>',
             input:true, answer:String(s), say: who + '有 ' + a + ' ' + it.m + it.n + '，' + who2 + '的' + it.m + '数是' + who + '的 ' + k + ' 倍，' + who2 + '有多少' + it.m + '',
             why:'几倍就是几个几：' + a + ' × ' + k + ' = ' + s + '（' + it.m + '）' };
  }
};

/* ══════════════ 关卡表 ══════════════ */
const LEVELS = {
  er: {                                     // 二宝 · 幼儿园小班（3岁半）
    hanzi: 'qi',
    math: [
      { id:'count',  icon:'🍎', name:'数一数',   desc:'1~10 数一数',        gen:'count',  n:8,  choice:true },
      { id:'more',   icon:'⚖️', name:'比多少',   desc:'哪边多呀',           gen:'more',   n:8,  story:true },
      { id:'shape',  icon:'🔺', name:'认形状',   desc:'圆形 正方形 三角形', gen:'shape',  n:8 },
      { id:'pattern',icon:'🎨', name:'找规律',   desc:'接下来是什么',       gen:'pattern',n:8 },
      { id:'add5',   icon:'➕', name:'5以内加法',desc:'先数手指头',         gen:'add5',   n:8 },
      { id:'add10',  icon:'🔟', name:'10以内加法',desc:'凑一凑就出来了',    gen:'add10',  n:8 },
      { id:'sub10',  icon:'➖', name:'10以内减法',desc:'去掉几个还剩几个',   gen:'sub10',  n:8 }
    ]
  },
  da: {                                     // 大宝 · 小学二年级
    hanzi: 'g2',
    math: [
      { id:'add100', icon:'➕', name:'100以内加法', desc:'进位加法',        gen:'add100', n:10, star:true },
      { id:'sub100', icon:'➖', name:'100以内减法', desc:'退位减法',        gen:'sub100', n:10, star:true },
      { id:'mul',    icon:'✖️', name:'表内乘法',   desc:'乘法口诀要熟',    gen:'mul',    n:10, star:true },
      { id:'div',    icon:'➗', name:'表内除法',   desc:'想口诀就会了',    gen:'div',    n:10 },
      { id:'rem',    icon:'🍽️', name:'有余数除法', desc:'分不完剩几个',    gen:'rem',    n:8 },
      { id:'mix',    icon:'🧮', name:'混合运算',   desc:'先乘除后加减',    gen:'mix',    n:8 },
      { id:'mj',     icon:'🔢', name:'口诀抽背',   desc:'填括号里的数',    gen:'mj',     n:10 },
      { id:'cmpnum', icon:'⚖️', name:'比大小',     desc:'填 > < =',        gen:'cmpnum', n:8, choice:true },
      { id:'vert',   icon:'📐', name:'列竖式',     desc:'两位三位数加减',  gen:'vert',   n:8 },
      { id:'unit',   icon:'📏', name:'单位换算',   desc:'米厘米 元角分',   gen:'unit',   n:8, choice:true },
      { id:'word',   icon:'📖', name:'应用题',     desc:'读懂题再动笔',    gen:'word',   n:6 }
    ]
  }
};

/* ── 限时口算的难度档 ── */
const TIMED_MODES = {
  er: [ {id:'t10', name:'10以内加减', gens:['add10','sub10']} ],
  da: [
    { id:'t100', name:'100以内加减', gens:['add100','sub100'] },
    { id:'tmul', name:'表内乘除',    gens:['mul','div'] },
    { id:'tmix', name:'全都来',      gens:['add100','sub100','mul','div','mix'] }
  ]
};

/* ── 奖章 ── */
const ACHIEVEMENTS = [
  {id:'first',  e:'🌱', t:'第一次闯关',  test:s => s.totalPlays >= 1},
  {id:'p10',    e:'🔥', t:'闯关 10 次',  test:s => s.totalPlays >= 10},
  {id:'p50',    e:'🚀', t:'闯关 50 次',  test:s => s.totalPlays >= 50},
  {id:'s20',    e:'⭐', t:'攒够 20 星',  test:s => s.stars >= 20},
  {id:'s60',    e:'🌟', t:'攒够 60 星',  test:s => s.stars >= 60},
  {id:'s150',   e:'💫', t:'攒够 150 星', test:s => s.stars >= 150},
  {id:'d3',     e:'📅', t:'连续 3 天',   test:s => s.streak >= 3},
  {id:'d7',     e:'🗓️', t:'连续 7 天',   test:s => s.streak >= 7},
  {id:'d30',    e:'🏅', t:'连续 30 天',  test:s => s.streak >= 30},
  {id:'hz50',   e:'📖', t:'认字 50 个',  test:s => s.hanziLearned >= 50},
  {id:'mult',   e:'✖️', t:'口诀全通关',  test:s => s.mulPassed >= 45},
  {id:'perfect',e:'💯', t:'一次全对',    test:s => s.perfectCount >= 1}
];
