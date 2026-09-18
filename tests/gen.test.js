/* 出题引擎的硬核验： node tests/gen.test.js
   🔴 判据是「把题目文字里写的数扒出来，自己重新算一遍，看跟 answer 对不对得上」——
      不是只看 answer 存不存在。数学题答案算错，孩子会照着错答案学。
   🔴 每个测试自己打印结果行；最后汇总。历史上吃过「退出码被兜平、测试根本没跑」的亏。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 只加载纯数据 + 出题引擎（03/03b/04 不碰 DOM），不加载 05_app.js */
const pure = ['03_data_hanzi.js', '03b_data_g2.js', '04_data_math.js']
  .map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
const API = new Function(pure + '\n;return {GEN, LEVELS, HANZI_QI, HANZI_G2, MUL_KOUJUE, WORD_KIDS, WORD_ELDERS, WORD_ITEMS};')();

const N = 3000;
let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const num = s => { const m = String(s).replace(/<[^>]+>/g, ' ').match(/-?\d+/); return m ? Number(m[0]) : NaN; };

/* ── 每个题目所有会显示给孩子的字符串，都不许出现 undefined / NaN / null ── */
const FIELDS = ['big', 'emoji', 'sub', 'story', 'say', 'why', 'whyHtml', 'answer', 'drill'];
function noJunk(name, q) {
  for (const f of FIELDS) {
    const v = q[f];
    if (v === undefined || v === null) continue;
    ok(!/undefined|NaN|\[object/.test(String(v)), `${name}.${f} 里有脏字符串：${String(v).slice(0, 80)}`);
  }
  ok(typeof q.answer === 'string' && q.answer.length > 0, `${name} 没有 answer`);
  /* 选项：必须唯一、必须含正确答案 */
  if (q.choices) {
    /* 3/4 个是常规；二宝的「比多少」只有两个选项（左边多/右边多），是有意为之 */
    ok(q.choices.length === 4 || q.choices.length === 3 || q.choices.length === 2,
       `${name} 选项数不对：${q.choices.length}`);
    ok(new Set(q.choices.map(String)).size === q.choices.length, `${name} 选项有重复：${q.choices.join('|')}`);
    ok(q.choices.map(String).includes(String(q.answer)), `${name} 选项里没有正确答案：${q.answer} / ${q.choices.join('|')}`);
  } else {
    ok(q.input === true, `${name} 既没有选项也不是输入题`);
  }
}

/* ── 从题面文字里反向解析出运算数，独立重算一遍 ── */
const RE_ADD = /(\d+)\s*加\s*(\d+)\s*等于几/;
const RE_SUB = /(\d+)\s*减\s*(\d+)\s*等于几/;
const RE_MUL = /(\d+)\s*乘\s*(\d+)\s*等于几/;
const RE_DIV = /(\d+)\s*除以\s*(\d+)[，,]\s*商几余几/;
const RE_DIV2 = /(\d+)\s*除以\s*(\d+)\s*等于几/;

const ARITH = {
  add100: (q, s) => { const m = s.match(RE_ADD); ok(!!m, 'add100 say 解析失败：' + s);
    if (m) ok(Number(q.answer) === +m[1] + +m[2], `add100 算错：${m[1]}+${m[2]} 应为 ${+m[1]+ +m[2]}，实为 ${q.answer}`); },
  sub100: (q, s) => { const m = s.match(RE_SUB); ok(!!m, 'sub100 say 解析失败：' + s);
    if (m) ok(Number(q.answer) === +m[1] - +m[2], `sub100 算错：${m[1]}-${m[2]} 应为 ${+m[1]-+m[2]}，实为 ${q.answer}`);
    if (m) ok(+m[1] > +m[2], `sub100 出现负数题：${s}`); },
  mul: (q, s) => { const m = s.match(RE_MUL); ok(!!m, 'mul say 解析失败：' + s);
    if (m) ok(Number(q.answer) === +m[1] * +m[2], `mul 算错：${m[1]}×${m[2]} 应为 ${+m[1]*+m[2]}，实为 ${q.answer}`); },
  div: (q, s) => { const m = s.match(RE_DIV2); ok(!!m, 'div say 解析失败：' + s);
    if (m) { ok(Number(q.answer) === +m[1] / +m[2], `div 算错：${m[1]}÷${m[2]} 应为 ${+m[1]/+m[2]}，实为 ${q.answer}`);
             ok(+m[1] % +m[2] === 0, `div 除不尽：${s}`); } },
  rem: (q, s) => {
    const m = s.match(RE_DIV); ok(!!m, 'rem say 解析失败：' + s);
    const mm = String(q.answer).match(/^(\d+)……(\d+)$/);
    ok(!!mm, `rem 答案格式不对（应为 商……余）：${q.answer}`);
    if (!m || !mm) return;
    const a = +m[1], b = +m[2], qq = +mm[1], r = +mm[2];
    ok(b * qq + r === a, `rem 算错：${b}×${qq}+${r}=${b*qq+r} ≠ ${a}`);
    ok(r > 0 && r < b, `rem 余数越界：余 ${r}，除数 ${b}`);
    /* 题面里的被除数（「a 个XX」）也要跟 say 里的一致 */
    const sub = String(q.sub).match(/^(\d+)\s*个/);
    if (sub) ok(+sub[1] === a, `rem 题面被除数 ${sub[1]} 与算式 ${a} 不一致`);
  },
  vert: (q, s) => { const m = s.match(RE_ADD) || s.match(RE_SUB);
    ok(!!m, 'vert say 解析失败：' + s);
    if (m) { const isAdd = RE_ADD.test(s);
      ok(Number(q.answer) === (isAdd ? +m[1] + +m[2] : +m[1] - +m[2]), `vert 算错：${s} → ${q.answer}`); } },
  cmpnum: (q) => {
    const m = String(q.big).match(/^(\d+)\D+(\d+)$/);
    ok(!!m, 'cmpnum big 解析失败：' + q.big);
    if (m) { const a = +m[1], b = +m[2];
      const want = a > b ? '>' : a < b ? '<' : '=';
      ok(q.answer === want, `cmpnum 判错：${a} vs ${b} 应为 ${want}，实为 ${q.answer}`); }
    ok(q.choices.map(String).slice().sort().join('') === '<=>', 'cmpnum 选项不是 > < =');
  },
  count: (q) => { const n = Number(q.answer); ok(n >= 1 && n <= 10, `count 答案越界：${n}`);
    /* 图里画的个数必须等于答案 */
    const drawn = (String(q.emoji).match(/\p{Extended_Pictographic}/gu) || []).length;
    ok(drawn === n || drawn === 10, `count 图里画了 ${drawn} 个，答案却是 ${n}`); }
};

console.log('== 出题引擎（每个生成器跑 ' + N + ' 次）==');
for (const name of Object.keys(API.GEN).filter(n => n[0] !== '_')) {
  const gen = API.GEN[name];
  let bad0 = fails.length;
  for (let i = 0; i < N; i++) {
    let q;
    try { q = gen.call(API.GEN); }
    catch (e) { fails.push(`${name} 抛异常：${e.message}`); break; }
    noJunk(name, q);
    if (ARITH[name]) ARITH[name](q, String(q.say || ''));
    if (fails.length > bad0 + 3) break;   // 同一个生成器别刷屏
  }
  const bad = fails.length - bad0;
  console.log((bad ? '  ❌ ' : '  ✅ ') + name + (bad ? ' —— ' + bad + ' 处问题' : ' ' + N + ' 题全部通过'));
}

/* ── 人名场景：应用题不许再出现「老师拿妈妈的钱」那种别扭句，也不许用他/她 ── */
console.log('== 应用题人名与代词 ==');
const KID = new Set(API.WORD_KIDS), ELDER = new Set(API.WORD_ELDERS);
let badPron = 0, badWho = 0, badMoney = 0;
for (let i = 0; i < 4000; i++) {
  const q = API.GEN.word();
  const st = String(q.story);
  /* 🔴 代词要扫**所有**会显示给孩子的字段，不能只扫 story：
     曾经 story 干净、emoji 的小字里却写着「（是他的 3 倍）」——孩子照样看得见。
     只查一个字段的检查，等于没查。 */
  const shown = FIELDS.map(f => (q[f] == null ? '' : String(q[f]))).join(' ');
  if (/[他她]/.test(shown)) badPron++;
  /* 主语绝不允许是长辈或老师——「李老师有68元」正是当初的病灶。
     （「每盒有…」「N 个xx平均分给…」这两类题没有主角，主语是物/量词，不算违规） */
  const m = st.match(/^(\S+?)(有|摘了)/);
  if (m && ELDER.has(m[1])) badWho++;
  /* 涉及「元」的钱物题里，主角必须是小朋友、给钱的必须是长辈——
     小朋友之间互送东西可以，但「老师从妈妈那儿拿钱」这种就不通 */
  const g = st.match(/，(\S+?)又给了/);
  if (g && /元/.test(st)) {
    if (!ELDER.has(g[1])) badMoney++;
    if (m && !KID.has(m[1])) badWho++;
  }
}
ok(badPron === 0, `应用题里还有「他/她」这类代词：${badPron} 次`);
ok(badWho === 0, `应用题主角不是人名：${badWho} 次`);
ok(badMoney === 0, `给钱的人不是长辈：${badMoney} 次`);
console.log((badPron || badWho || badMoney ? '  ❌' : '  ✅') +
  ` 4000 题：代词 ${badPron} · 主角异常 ${badWho} · 给钱人异常 ${badMoney}`);

/* ── 量词搭配 ──
   🔴 这条是**通用**的，不针对某一个生成器：题干里只要出现「<量词><物品名>」，
      那个量词就必须等于该物品自己声明的 m。
      踩过的坑：出现过「数一数，有几个图书？」——图书论「本」、铅笔论「支」。
      一个给中国小孩学中文的 App 教错量词，比算错一道题严重得多，而且它不报错、只静静地教错。
   🔴 写成通用断言而不是逐句改文案，是因为逐句改只能保住改过的那几句，
      下次谁新加一个生成器、随手写个「个」，没人拦得住。 */
console.log('== 量词搭配 ==');
const ITEMS = API.WORD_ITEMS;
const MW_BAD = /[个支颗本张块条只]/;          // 会跟物品名撞车的量词
for (const it of ITEMS) {
  ok(typeof it.m === 'string' && it.m.length === 1, `物品「${it.n}」没有量词 m`);
}
let badMW = [];
/* 🔴 第二条判据：**悬空量词**——「数字 + 量词」后面没跟名词，量词照样得对。
   上面那条只查「量词+物品名」挨着写的情况，于是漏掉了「划掉 3 个 ❌」「送走 25 个 ➖」
   这种量词后面跟的是符号的写法（草莓该论颗、铅笔该论支，它俩全写成了「个」）。
   注意别误伤「平均分给 3 个小朋友」——那里量词后面跟着名词，是合法的，所以要求后面**没有**名词。 */
const MW_RE = /(\d+)\s*([个支颗本张块条只])(?![一-龥])/g;
let badDangling = [];
for (const [gname, fn] of Object.entries(API.GEN)) {
  if (typeof fn !== 'function') continue;
  for (let i = 0; i < 400; i++) {
    const q = fn.call(API.GEN);
    const plain = FIELDS.map(f => (q[f] == null ? '' : String(q[f]))).join(' ').replace(/<[^>]+>/g, ' ');
    /* 这题讲的是哪个物品？题目里出现哪个物品名，全题的量词就得跟它一致 */
    for (const it of ITEMS) {
      if (plain.indexOf(it.n) < 0) continue;
      for (const m of plain.matchAll(MW_RE)) {
        if (m[2] !== it.m) {
          badDangling.push(`${gname}：${it.n} 该论「${it.m}」，出现了悬空的「${m[1]} ${m[2]}」` +
                           `（…${plain.slice(Math.max(0, m.index - 12), m.index + m[0].length + 4).trim()}…）`);
        }
      }
    }
  }
}
for (const [gname, fn] of Object.entries(API.GEN)) {
  if (typeof fn !== 'function') continue;
  for (let i = 0; i < 400; i++) {
    const q = fn.call(API.GEN);
    const plain = FIELDS.map(f => (q[f] == null ? '' : String(q[f]))).join(' ').replace(/<[^>]+>/g, ' ');
    for (const it of ITEMS) {
      for (let p = plain.indexOf(it.n); p >= 0; p = plain.indexOf(it.n, p + 1)) {
        const ch = plain[p - 1];
        if (ch && MW_BAD.test(ch) && ch !== it.m) {
          badMW.push(`${gname}：「…${plain.slice(Math.max(0, p - 10), p + it.n.length + 4).trim()}…」` +
                     `${it.n} 该论「${it.m}」，写成了「${ch}」`);
        }
      }
    }
  }
}
ok(badMW.length === 0, `量词搭配错了 ${badMW.length} 处，例如：${badMW[0] || ''}`);
console.log((badMW.length ? '  ❌ ' : '  ✅ ') +
  ` ${ITEMS.length} 个物品 × 全部生成器 × 400 题：量词错 ${badMW.length} 处`);
ok(badDangling.length === 0, `悬空量词错了 ${badDangling.length} 处，例如：${badDangling[0] || ''}`);
console.log((badDangling.length ? '  ❌ ' : '  ✅ ') +
  ` ${ITEMS.length} 个物品 × 全部生成器 × 400 题：悬空量词错 ${badDangling.length} 处`);

/* ── 题目对象里只许出现「答题屏真的会读」的字段 ──
   🔴 这条抓的是最阴的一类 bug：**数据生成了、却没人渲染**。
      曾经 more()（比多少）把两组东西放进 `groups` 字段，而答题屏只读 emoji ——
      于是一道题只剩「哪一边多？」加两个按钮，左右两边什么都没有，孩子只能瞎蒙。
      单元测试全绿，因为**没有任何东西报错**；它是靠人肉看图才发现的。
      判据放这里：跑出来的题目里但凡冒出个渲染器不认识的 key，就说明有人写了不发光的代码。
   🔴 加新字段时必须同时确认答题屏会读它，然后把名字加进这个白名单——
      白名单是"渲染器认识的字段"，不是"想写就写"的许可。 */
console.log('== 题目字段 ↔ 渲染器 ==');
const RENDERED = new Set(['big', 'bigHz', 'emoji', 'sub', 'story', 'say', 'why', 'whyHtml',
                          'choices', 'answer', 'input', 'choiceClass', 'padSep', 'drill']);
let strayKeys = [];
for (const name of Object.keys(API.GEN).filter(n => n[0] !== '_')) {
  const q = API.GEN[name].call(API.GEN);
  for (const k of Object.keys(q)) if (!RENDERED.has(k)) strayKeys.push(`${name} 产出了渲染器不认识的字段「${k}」`);
}
ok(strayKeys.length === 0, strayKeys.join('；'));
console.log((strayKeys.length ? '  ❌ ' : '  ✅ ') +
  ` 每个生成器的字段都在渲染器认识的白名单里` + (strayKeys.length ? '：' + strayKeys.join('；') : ''));

/* ── 关卡表引用的生成器必须真实存在（历史坑：改了名字忘了改关卡表） ── */
console.log('== 关卡表 ↔ 生成器 ==');
let miss = 0;
for (const [kid, lv] of Object.entries(API.LEVELS)) {
  for (const m of lv.math) {
    if (typeof API.GEN[m.gen] !== 'function') { fails.push(`LEVELS.${kid} 的「${m.name}」指向不存在的生成器 ${m.gen}`); miss++; }
  }
  const ids = lv.math.map(m => m.id);
  ok(new Set(ids).size === ids.length, `LEVELS.${kid} 有重复的关卡 id`);
}
console.log((miss ? '  ❌ ' : '  ✅ ') + '关卡表引用的生成器都存在');

console.log('\n共 ' + checks.toLocaleString() + ' 项断言，' + fails.length + ' 处问题');
if (fails.length) { console.log('\n前 20 条：'); fails.slice(0, 20).forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('✅ 全部通过');
