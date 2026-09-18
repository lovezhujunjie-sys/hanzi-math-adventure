/* 答错后的「这几个都念什么？」揭示条（字题）：截图看长相。
   逐题答错，直到碰上选项全是单个汉字的题再停，让图里一定是字题。 */
kid('da');
setTimeout(function(){
  var mods = document.querySelectorAll('#home-mods .mod'), mod = null;
  for (var i=0;i<mods.length;i++) if (/认/.test(mods[i].textContent) && /字/.test(mods[i].textContent)) mod = mods[i];
  if (mod) mod.click();
  setTimeout(function(){
    var big = document.querySelector('#map-grid .map-item.big');
    if (big) big.click();
    setTimeout(run, 120);
  },150);
},80);
function run(){
  var hm = window.__hm, Q = hm.quiz();
  if (!Q || !Q.list || Q.i >= Q.list.length) {
    var again = document.getElementById('rs-again');
    if (again && !document.getElementById('quiz-result').classList.contains('hide')) { again.click(); return setTimeout(run, 120); }
    return;
  }
  var q = Q.list[Q.i];
  var allOne = q.choices.every(function(c){ return String(c).length === 1 && /[一-龥]/.test(String(c)); });
  if (!allOne) {                                  // 不是字题：随便答错跳过去
    var nx = document.querySelector('#q-choices .choice');
    if (nx) nx.click();
    var n = document.getElementById('q-next');
    if (n && !n.classList.contains('hide')) n.click();
    return setTimeout(run, 150);
  }
  var btns = [].slice.call(document.querySelectorAll('#q-choices .choice')), w = null;
  btns.forEach(function(b){ if (!w && b.textContent.trim() !== String(q.answer).trim()) w = b; });
  if (w) w.click();
}
