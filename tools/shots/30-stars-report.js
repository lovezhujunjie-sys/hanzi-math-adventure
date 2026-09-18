/* 学习报告 + 错题本长什么样：先造几条真错题（走真界面答错），再进星星页看图。 */
kid('da');
setTimeout(function(){
  var mods = document.querySelectorAll('#home-mods .mod'), mod = null;
  for (var i=0;i<mods.length;i++) if (/认/.test(mods[i].textContent) && /字/.test(mods[i].textContent)) mod = mods[i];
  if (mod) mod.click();
  setTimeout(function(){
    var big = document.querySelector('#map-grid .map-item.big');
    if (big) big.click();
    setTimeout(function(){ wrong(0); }, 150);
  },150);
},80);
function wrong(n){
  if (n >= 6) {                                  // 攒够错题 → 去星星页
    document.querySelector('#screen-quiz .icon-btn').click();
    setTimeout(function(){
      document.querySelector('#screen-map [data-back]').click();
      setTimeout(function(){
        var t = pickModTitle('星星');
        if (t) t.click();
      },150);
    },150);
    return;
  }
  var hm = window.__hm, Q = hm.quiz();
  if (!Q || !Q.list || Q.i >= Q.list.length) return;
  var q = Q.list[Q.i];
  var btns = [].slice.call(document.querySelectorAll('#q-choices .choice')), w = null;
  btns.forEach(function(b){ if (!w && b.textContent.trim() !== String(q.answer).trim()) w = b; });
  if (w) w.click();
  var nx = document.getElementById('q-next');
  if (nx && !nx.classList.contains('hide')) nx.click();
  setTimeout(function(){ wrong(n+1); }, 120);
}
