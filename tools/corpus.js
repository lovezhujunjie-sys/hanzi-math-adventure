/* 把孩子「实际能看到的中文」全部吐出来，一份 JSON 给 build_pinyin.py 用。
   用法： node tools/corpus.js > /tmp/corpus.json

   🔴 为什么不用 source 里的字符串字面量了事：
      index.html 里有我写的一大堆**中文注释**，直接扫字符会把永远不会显示的字也算进来
      （上一版就这么把字表撑到 1730，其中一半是注释里的字）。
      所以这里分两路取，两路都只取「真会渲染出来」的：
        ① 静态：src/*.html 的标签之间 + src/*.js 里剥掉注释后的字符串字面量
        ② 动态：出题引擎现场跑出来的题面字段（数学题是生成的，注释里扫不到）
   两路合起来才等于孩子的屏幕。 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 剥 JS 注释（字符串/模板串里的 // 和 星号不算注释） ── */
function stripJsComments(s) {
  let out = '', i = 0, st = null;
  while (i < s.length) {
    const c = s[i], c2 = s.slice(i, i + 2);
    if (st === null) {
      if (c2 === '//') { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j; continue; }
      if (c2 === '/*') { const j = s.indexOf('*/', i); i = j < 0 ? s.length : j + 2; continue; }
      if (c === '"' || c === "'" || c === '`') { st = c; out += c; i++; continue; }
      out += c; i++;
    } else {
      if (c === '\\') { out += s.slice(i, i + 2); i += 2; continue; }
      if (c === st) st = null;
      out += c; i++;
    }
  }
  return out;
}

const CJK = /[一-龥]/;
const frags = [];

/* 取一段 JS 里「真会显示出来」的中文：剥注释 → 只留字符串字面量。
   ⚠️ 不能整块当正文用：注释里全是我写的中文（「绝不让它弹个红字吓到小孩」这种），
      算进来会让字表多出一批孩子永远看不到的字，更糟的是会让我照着假条目去定读音。 */
function jsStrings(src, push) {
  const raw = stripJsComments(src);
  for (const m of raw.matchAll(/(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) if (CJK.test(m[2])) push(m[2]);
  for (const m of raw.matchAll(/`((?:\\.|[^`\\])*)`/g)) if (CJK.test(m[1])) push(m[1]);
}

/* ①a 静态 HTML：标签之间的正文。
   🔴 <style> 整块丢掉（里面唯一的中文是字体名 "楷体"，孩子看不到）；
      <script> 走 jsStrings，剥注释后只取字符串字面量。 */
for (const f of ['01_head.html', '02_body.html', '06_foot.html']) {
  let h = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, (m, body) => { jsStrings(body, s => frags.push(s)); return ' '; })
    .replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of h.matchAll(/>([^<>]*[一-龥][^<>]*)</g)) frags.push(m[1]);
}

/* ①b 静态 JS 文件 */
for (const f of ['03_data_hanzi.js', '03b_data_g2.js', '04_data_math.js', '05_app.js']) {
  jsStrings(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), s => frags.push(s));
}

/* ② 动态：出题引擎现场生成
   🔴 题目是 Math.random 现场生成的，不固定种子的话**每次跑出来的语料都不一样**，
      拼音表就不可复现（实测覆盖条数在 157/158/161 之间飘），
      「复核快照」那道闸门会被随机噪声反复误触发。
      所以这里换成一个定种子的伪随机数，让同一份源码永远生成同一份语料。
      换种子 = 换一批取样，那是**有意**扩大覆盖面时才做的事，跑完要重新复核残留。 */
const SEED = 20260918;
let _s = SEED >>> 0;
Math.random = function () {          // mulberry32
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pure = ['03_data_hanzi.js', '03b_data_g2.js', '04_data_math.js']
  .map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
const API = new Function(pure + '\n;return {GEN,LEVELS};')();
const FIELDS = ['big', 'emoji', 'sub', 'story', 'say', 'why', 'whyHtml', 'answer', 'drill', 'choices'];
for (const [name, fn] of Object.entries(API.GEN)) {
  if (typeof fn !== 'function') continue;
  for (let i = 0; i < 4000; i++) {
    let q; try { q = fn.call(API.GEN); } catch (e) { continue; }
    for (const f of FIELDS) {
      const v = q[f]; if (v == null) continue;
      if (Array.isArray(v)) v.forEach(x => frags.push(String(x))); else frags.push(String(v));
    }
  }
}
/* 静态标题/描述（关卡名、模块名、奖章名）也要算——它们不在题面字段里。
   LEVELS 是对象（id → 关卡），不是数组。 */
for (const L of Object.values(API.LEVELS || {})) {
  if (!L || typeof L !== 'object') continue;
  for (const k of ['name', 'desc', 'title']) if (L[k]) frags.push(String(L[k]));
}

process.stdout.write(JSON.stringify(frags));
