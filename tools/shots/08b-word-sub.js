/* 专门盯「应用题·减法」这一支（送走 N 颗 ➖）：
   这支的数量标注原来是行内的，12 个 emoji 撑满一行后标注被挤断成两截。
   抽题是随机的，所以反复进出这一关，直到抽到减法题为止。
   （🔴 这里自带 pickMod/pickMap，不吃 _lib.js——browser_test.sh 不挂它。） */
function pickMod(name){ var ms=document.querySelectorAll('#home-mods .mod');
  for(var i=0;i<ms.length;i++) if(ms[i].textContent.indexOf(name)>=0) return ms[i]; return null; }
function pickMap(name){ var its=document.querySelectorAll('#map-grid .map-item');
  for(var i=0;i<its.length;i++) if(its[i].textContent.indexOf(name)>=0) return its[i]; return null; }
var back=document.querySelector('#screen-quiz .back') || document.querySelector('.back');
function enter(){ var b=document.querySelector('#screen-quiz .back'); if(b) b.click();
  setTimeout(function(){ var m=pickMod('数学闯关'); if(m) m.click(); },60);
  setTimeout(function(){ var it=pickMap('应用题'); if(it) it.click(); },140); }
function tryIt(n){
  if(n>25){ var p=document.createElement('pre'); p.id='TESTOUT';
    p.textContent='🔴 25 次都没抽到减法应用题'; document.body.appendChild(p); return; }
  setTimeout(function(){
    if(document.body.innerText.indexOf('送走')>=0){
      var p=document.createElement('pre'); p.id='TESTOUT';
      p.textContent='✅ 抽到减法题：'+document.body.innerText.replace(/\s+/g,' ').slice(0,200);
      document.body.appendChild(p);
    } else { enter(); tryIt(n+1); }
  }, 320);
}
setTimeout(function(){
  var c=document.querySelector('.kid-card.da'); if(c) c.click();
  setTimeout(function(){ var m=pickMod('数学闯关'); if(m) m.click(); },80);
  setTimeout(function(){ var it=pickMap('应用题'); if(it) it.click(); },200);
  tryIt(1);
}, 60);
