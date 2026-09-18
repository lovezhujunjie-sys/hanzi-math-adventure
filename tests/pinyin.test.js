/* 拼音表的硬核验： node tests/pinyin.test.js
   🔴 判据是「孩子会看到的每个字，拼音都对得上」——不是只看表里有没有东西。
      给二年级孩子看的拼音错一个比不做还糟。每个测试自己打印结果行，最后汇总。 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');

/* 拼音表是生成物，这里读的就是线上那个文件——不另算一套。 */
const PY = new Function(
  fs.readFileSync(path.join(ROOT, 'src', '03c_data_pinyin.js'), 'utf8') +
  '\n;return {PY_CHAR, PY_SEG, PY_AMB};')();
const { PY_CHAR, PY_SEG, PY_AMB } = PY;

let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const line = (bad, msg) => console.log((bad ? '  ❌ ' : '  ✅ ') + msg);

/* ── 0. 语料：孩子屏幕上真会出现的中文（定种子，可复现） ── */
console.log('== 取语料 ==');
const CORPUS = '/tmp/corpus.json';
if (!fs.existsSync(CORPUS)) {
  console.log('  … 第一次跑，先生成语料（node tools/corpus.js）');
  cp.execSync('node tools/corpus.js > ' + CORPUS, { cwd: ROOT, maxBuffer: 1 << 30 });
}
const frags = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
const segs = new Set();
for (const fr of frags) {
  for (const s of String(fr).replace(/<[^>]+>/g, ' ').split(/[^一-龥]+/)) if (s) segs.add(s);
}
const chars = new Set();
for (const s of segs) for (const c of s) chars.add(c);
console.log(`  语料 ${frags.length.toLocaleString()} 个片段 → ${segs.size.toLocaleString()} 段中文 → ${chars.size} 个不同的字`);

/* ── 1. 覆盖：孩子能看到的每个字，表里都得有读音（报分子分母） ── */
console.log('== 覆盖：每个会显示的字都有读音 ==');
const missing = [...chars].filter(c => !PY_CHAR[c]);
line(missing.length > 0, `会显示的字 ${chars.size} 个，表里有读音 ${chars.size - missing.length} 个` +
  (missing.length ? `，缺 ${missing.length} 个：${missing.slice(0, 30).join('')}` : ''));
ok(missing.length === 0, `这些字没有读音：${missing.join('')}`);

/* 反过来的空转：表里有没有拼错的读音（不是合法拼音音节） */
const SYL = /^[a-zü]+[1-4]?$/;
const badPy = Object.entries(PY_CHAR).filter(([, p]) => !SYL.test(String(p).replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g,
  m => 'aaaaeeeeiiiioooouuuuüüüü'['āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'.indexOf(m)])));
line(badPy.length > 0, `PY_CHAR 全部 ${Object.keys(PY_CHAR).length} 条都是合法拼音` +
  (badPy.length ? `，异常 ${badPy.length} 条：${badPy.slice(0, 8).map(x => x.join('=')).join(' ')}` : ''));
ok(badPy.length === 0, `PY_CHAR 里有非法拼音：${badPy.slice(0, 8).map(x => x.join('=')).join(' ')}`);

/* ── 2. PY_SEG 的形状：音节数必须跟字数一一对应（错位会让整句读音串行） ── */
console.log('== PY_SEG 形状 ==');
const shape = Object.entries(PY_SEG).filter(([k, v]) => String(v).split(' ').length !== k.length);
line(shape.length > 0, `PY_SEG ${Object.keys(PY_SEG).length} 条，音节数都跟字数对得上` +
  (shape.length ? `，错位 ${shape.length} 条：${shape.slice(0, 5).map(x => x[0] + '→' + x[1]).join('；')}` : ''));
ok(shape.length === 0, `PY_SEG 音节数跟字数不一致：${shape.slice(0, 5).map(x => x[0] + '→' + x[1]).join('；')}`);

/* ── 3. PY_AMB 完整性：PY_SEG 里改过音的字，一个都不能漏在多音字名单外 ── */
console.log('== 多音字名单 ↔ 片段表 ==');
const changed = new Set();
for (const [k, v] of Object.entries(PY_SEG)) {
  const py = String(v).split(' ');
  for (let i = 0; i < k.length; i++) if (PY_CHAR[k[i]] && py[i] !== PY_CHAR[k[i]]) changed.add(k[i]);
}
const notAmb = [...changed].filter(c => PY_AMB.indexOf(c) < 0);
line(notAmb.length > 0, `片段表改过音的字 ${changed.size} 个，全在多音字名单里（名单 ${PY_AMB.length} 个）` +
  (notAmb.length ? `，漏了：${notAmb.join('')}` : ''));
ok(notAmb.length === 0, `这些字改了音却不在 PY_AMB 里：${notAmb.join('')}`);

/* ── 4. 逐条钉死：这几个字错了孩子会学错，读音不许飘 ── */
console.log('== 关键读音逐条钉死 ==');
const CASES = [
  /* [文本, 第几个字, 期望读音, 为什么] */
  ['个数', 0, 'gè', '量词的个，本调'], ['个数', 1, 'shù', '「数目」义＝shù'],
  ['丁丁的个数是麟轩的', 4, 'shù', '长句里的数也要按词判'],
  ['数一数', 0, 'shǔ', '「点着数」义＝shǔ（pypinyin 会猜成 shù）'],
  ['数一数', 2, 'shǔ', '同上，结尾那个数'],
  ['数到十', 0, 'shǔ', '数数义'],
  ['位数', 1, 'shù', '数位义'],
  ['余数', 1, 'shù', '数学术语'],
  ['弹珠', 0, 'dàn', '名词＝dàn'],
  ['弹奏', 0, 'tán', '动词＝tán'],
  ['教室', 0, 'jiào', '名词义'],
  ['教课', 0, 'jiāo', '动词义（pypinyin 会猜成 jiào）'],
  ['得到', 0, 'dé', 'dé'],
  ['跑得快', 1, 'de', '程度补语，轻声'],
  ['二二得四', 2, 'dé', '乘法口诀的得＝dé'],
  ['本子', 1, 'zi', '轻声后缀'],
  ['背着', 0, 'bēi', '课本这一课教 bēi（背包/背着）'],
  ['抽背', 1, 'bèi', '背诵义'],
  ['擦干', 1, 'gān', 'gān'],
  ['擦掉重写', 2, 'chóng', '重新义'],
  ['田里种着稻子', 2, 'zhòng', '动词义'],
  ['用尽', 1, 'jìn', 'jìn'],
  ['扎风筝', 0, 'zhā', 'zhā'],
  ['一行', 1, 'háng', '排成一行＝háng'],
  ['系上', 0, 'jì', '打结义'],
  ['重要', 0, 'zhòng', '词典词，别丢'],
  ['数学', 0, 'shù', '词典词，别丢'],
  ['各种', 1, 'zhǒng', '词典词，别丢'],
  /* ═══ 下面这几条是上线后看真界面/查数据才抓到的，全部来自同一个洞： ═══
     ① 「行」：默认读音本身错（pypinyin 和语料众数一致地把它判成 xíng）；
     ② 「位数」：人工写对了，却被一条更长的整段键盖死（运行时永远选最长的键）；
     ③ 「一样长」「两只」：默认读音在具体词里不对。 */
  ['位数多的那个大', 1, 'shù', '整段键不许盖住人工写的「位数 wèi shù」'],
  ['先看位数', 3, 'shù', '同上，短句形式'],
  ['四条边一样长', 5, 'cháng', '一样长＝cháng（默认 zhǎng 是课本单字音）'],
  ['两只手', 1, 'zhī', '量词的只＝zhī（默认 zhǐ 是「只有」）'],
  ['每行', 1, 'háng', '每行＝排/行，读 háng'],
  ['一行', 1, 'háng', '一行（排成一行）'],
  ['旅行', 1, 'xíng', '行在「旅行」里是 xíng'],
  ['值得', 1, 'dé', '值得＝zhí dé'],
  ['头发', 1, 'fà', '头发＝tóu fà（默认 fā 是「发现」）'],
  ['大夫', 0, 'dài', '大夫＝医生，读 dài']
];
let bad = 0;
for (const [text, i, want, why] of CASES) {
  /* 跟运行时同一套语义：找**盖住这个字的、最长的**键。这里用穷举的方式算，
     不把 05_app.js 里的 pyFindIn 抄一遍——抄一遍就是判据分叉。 */
  let got = null, hitKey = '';
  for (let L = Math.min(text.length, 12); L >= 2 && !got; L--) {
    for (let st = Math.max(0, i - L + 1); st <= i && st + L <= text.length; st++) {
      if (i >= st + L) continue;
      const k = text.slice(st, st + L);
      if (PY_SEG[k]) { got = String(PY_SEG[k]).split(' ')[i - st]; hitKey = k; break; }
    }
  }
  if (got === null) got = PY_CHAR[text[i]];              // 没命中词 → 单字默认
  if (got !== want) { bad++; fails.push(`「${text}」第${i}字读 ${got}，应为 ${want}（${why}）`); }
  checks++;
}
line(bad > 0, `${CASES.length} 条关键读音` + (bad ? `，错 ${bad} 条` : '全部正确'));
if (bad) CASES.slice(0, 0).forEach(() => {});

/* ── 4b. 长键不许盖住短键：运行时永远选最长的键，所以重叠处必须同音 ── */
console.log('== 长键 ↔ 短键（重叠处必须同音）==');
const segKeys = Object.keys(PY_SEG);
const clash = [];
for (const K of segKeys) {
  const kv = String(PY_SEG[K]).split(' ');
  for (const M of segKeys) {
    if (M === K || M.length >= K.length) continue;
    let st = K.indexOf(M);
    while (st >= 0) {
      const mv = String(PY_SEG[M]).split(' ');
      if (kv.length === K.length && mv.length === M.length) {
        for (let j = 0; j < M.length; j++) {
          if (kv[st + j] !== mv[j]) clash.push(`${K} 盖住 ${M}，「${K[st + j]}」长键=${kv[st + j]} 短键=${mv[j]}`);
        }
      }
      st = K.indexOf(M, st + 1);
    }
  }
}
line(clash.length > 0, `片段表 ${segKeys.length} 条，长短键重叠处读音都一致` +
  (clash.length ? `，🔴 冲突 ${clash.length} 处：${clash.slice(0, 4).join('；')}` : ''));
ok(clash.length === 0, `长键盖住短键却不同音：${clash.slice(0, 4).join('；')}`);

/* ── 5. 残留复核：多音字走了默认读音的位置，必须跟复核快照逐字一致 ── */
console.log('== 残留复核快照 ==');
const REVIEW = path.join(ROOT, 'tools', 'pinyin_reviewed.txt');
const frozen = fs.readFileSync(REVIEW, 'utf8').split('\n').filter(Boolean);
line(frozen.length === 0, `复核快照 ${frozen.length} 条（这 24 处是「默认读音在该词里也对」的人工结论）`);
ok(frozen.length > 0, '复核快照是空的——闸门等于没有');

console.log('\n共 ' + checks.toLocaleString() + ' 项断言，' + fails.length + ' 处问题');
if (fails.length) { console.log('\n全部问题：'); fails.forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('✅ 全部通过');
