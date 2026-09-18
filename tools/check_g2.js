/* 校验生成的二年级生字数据： node tools/check_g2.js
   🔴 校验的就是 App 真正会加载的那个文件（src/03b_data_g2.js），不是中间产物——
      历史上吃过「校验的是 A、上线的是 B」的亏。 */
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'src', '03b_data_g2.js'), 'utf8');
const HANZI_G2 = new Function(code + '\n;return HANZI_G2;')();

let fail = 0;
const bad = (m) => { console.log('  ❌ ' + m); fail++; };

const pool = HANZI_G2.pool();
console.log('去重后字池：' + pool.length + ' 个不同的字');

/* 1. 每个字必须是单字、NFC 规范化（macOS 抓来的中文可能是 NFD，会造成比对失败） */
for (const r of pool) {
  if ([...r.z].length !== 1) bad('不是单字：' + r.z);
  if (r.z.normalize('NFC') !== r.z) bad('NFD 未规范化：' + r.z);
  if (r.py.normalize('NFC') !== r.py) bad('拼音 NFD：' + r.py);
  if (!/^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜê]+$/.test(r.py)) bad('拼音含怪字符：' + r.z + ' ' + r.py);
}

/* 2. 拼音必须有声调（轻声除外：啊/嘛 这类语气词） */
const QING = new Set(['啊', '嘛', '呢', '吧', '吗', '呀', '哇', '啦']);
const hasTone = (py) => /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(py);
let noTone = [];
for (const r of pool) if (!hasTone(r.py) && !QING.has(r.z)) noTone.push(r.z + '(' + r.py + ')');
if (noTone.length) bad('拼音没声调：' + noTone.join(' '));

/* 3. 组词必须含本字（这条能挡掉大部分张冠李戴） */
for (const r of pool) for (const c of r.ci) if (!c.includes(r.z)) bad('组词不含本字：' + r.z + ' → ' + c);
for (const r of pool) if (r.ci[0] === r.ci[1]) bad('两个组词重复：' + r.z + ' → ' + r.ci[0]);

/* 4. 同一个单元里，同一个字不能有两种拼音（多音字要按课文语境锁死一个）。
      🔴 跨单元/跨册允许不同读音——那是真·多音字（炸 zhà 爆炸 / zhá 油炸；量 liàng 力量 / liáng 量一量），
         课本本来就是分开教的，强行统一反而是错的。 */
for (const b of HANZI_G2.books) for (const u of b.units) {
  const pyMap = new Map();
  for (const k of ['xie', 'shi']) for (const r of u[k]) {
    const key = k + '·' + r[0];
    if (pyMap.has(key) && pyMap.get(key) !== r[1]) bad('同一单元同一个字两个拼音：' + b.short + u.name + ' ' + r[0] + ' ' + pyMap.get(key) + '/' + r[1]);
    pyMap.set(key, r[1]);
  }
}

/* 4b. 出题会用到的一对一索引：一个字只能对应一个拼音，多音字只留第一次出现的（题目里不考多音字） */
const DUP_PY_OK = new Set(['炸', '量']);

/* 5. 单元结构完整 */
HANZI_G2.books.forEach(b => {
  console.log(b.name + '：' + b.units.length + ' 个单元 · 写字表 ' +
    b.units.reduce((s, u) => s + u.xie.length, 0) + ' 字 · 识字表 ' +
    b.units.reduce((s, u) => s + u.shi.length, 0) + ' 字');
  if (b.units.length !== 8) bad(b.name + ' 不是 8 个单元');
  b.units.forEach((u, i) => {
    if (u.u !== i + 1) bad(b.name + ' 单元号乱序：' + u.name);
    if (!u.xie.length) bad(b.name + ' ' + u.name + ' 写字表是空的');
  });
});

/* 6. 抽几个课标里铁定有的字做哨兵——数据全丢/串册会立刻暴露 */
const SENTINEL = { '二上': ['两', '识', '庐', '瀑'], '二下': ['诗', '村', '童', '碧'] };
for (const [bk, list] of Object.entries(SENTINEL)) {
  const b = HANZI_G2.books.find(x => x.short === bk);
  const all = new Set();
  for (const u of b.units) for (const k of ['xie', 'shi']) for (const r of u[k]) all.add(r[0]);
  for (const z of list) if (!all.has(z)) bad(bk + ' 少了哨兵字：' + z);
}

console.log(fail ? '\n🔴 共 ' + fail + ' 处问题' : '\n✅ 全部校验通过');
process.exit(fail ? 1 : 0);
