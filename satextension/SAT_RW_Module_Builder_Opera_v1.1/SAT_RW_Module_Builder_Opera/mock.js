const CURRENT_MOCK_KEY='satRwBuilder.currentMock';
const $=s=>document.querySelector(s);
let D=null,mod=1,qs=[],idx=0,answers={},left=1920,tick=null;

chrome.storage.local.get(CURRENT_MOCK_KEY).then(s=>{
  D=s[CURRENT_MOCK_KEY];
  $('#loading').classList.add('hidden');
  if(!D?.m1?.length||!D?.m2?.length){
    $('#loading').classList.remove('hidden');
    $('#loading').innerHTML='<h1>No mock found</h1><p>Open the extension popup and click <b>Build & Open Mock</b>.</p>';
    return;
  }
  $('#intro').classList.remove('hidden');
});

const key=()=> 'm'+mod+'q'+idx;
function begin(n){
  mod=n; qs=n===1?D.m1:D.m2; idx=0; left=1920;
  $('#intro').classList.add('hidden'); $('#between').classList.add('hidden'); $('#test').classList.remove('hidden');
  render(); clearInterval(tick); tick=setInterval(()=>{left--;timer();if(left<=0){clearInterval(tick);finishModule();}},1000); timer();
}
function timer(){let m=Math.floor(left/60),s=left%60;$('#timer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function render(){
  const q=qs[idx]; $('#qLabel').textContent='Question '+(idx+1)+' of '+qs.length;
  $('#modTitle').textContent='Module '+mod+(mod===2?' — Hard Route':'');
  $('#content').innerHTML=(q.stimulus?'<div class="stimulus">'+q.stimulus+'</div>':'')+(q.prompt?'<div class="prompt">'+q.prompt+'</div>':'');
  const a=$('#answers'); a.innerHTML='';
  q.answerOptions.forEach(o=>{const d=document.createElement('div');d.className='ans'+(answers[key()]===o.letter?' sel':'');d.innerHTML='<span class="letter">'+o.letter+'</span><span>'+o.content+'</span>';d.onclick=()=>{answers[key()]=o.letter;render();};a.appendChild(d)});
  $('#prev').disabled=idx===0; $('#next').textContent=idx===qs.length-1?'Finish Module':'Next';
  const g=$('#grid'); g.innerHTML=''; qs.forEach((_,i)=>{const b=document.createElement('button');b.textContent=i+1;b.className=(answers['m'+mod+'q'+i]?'done ':'')+(i===idx?'cur':'');b.onclick=()=>{idx=i;render()};g.appendChild(b)});
}
$('#prev').onclick=()=>{if(idx>0){idx--;render()}};
$('#next').onclick=()=>{if(idx<qs.length-1){idx++;render()}else finishModule()};
function finishModule(){clearInterval(tick);$('#test').classList.add('hidden');if(mod===1)$('#between').classList.remove('hidden');else showResults();}
function showResults(){
  const all=[...D.m1.map((q,i)=>[1,i,q]),...D.m2.map((q,i)=>[2,i,q])];let correct=0;const stats={};
  for(const [m,i,q] of all){const chosen=answers['m'+m+'q'+i];const ok=q.correctAnswers.includes(chosen);if(ok)correct++;const k=q.domain||q.domainCode;stats[k]??=[0,0];stats[k][1]++;if(ok)stats[k][0]++;}
  let h='<h1>Results</h1><div class="result"><h2>'+correct+' / '+all.length+' correct</h2><table class="breakdown"><tr><th>Domain</th><th>Correct</th></tr>';
  for(const [k,v] of Object.entries(stats))h+='<tr><td>'+k+'</td><td>'+v[0]+' / '+v[1]+'</td></tr>';
  h+='</table></div><h2>Review</h2>';
  all.forEach(([m,i,q])=>{const chosen=answers['m'+m+'q'+i]||'—',ok=q.correctAnswers.includes(chosen);h+='<div class="result"><b>Module '+m+', Q'+(i+1)+'</b> <span class="'+(ok?'correct':'wrong')+'">'+(ok?'Correct':'Incorrect')+'</span><div class="meta">'+q.domain+' · '+q.skill+' · '+q.difficulty+'</div><div>'+q.stimulus+'</div><div>'+q.prompt+'</div><p>Your answer: <b>'+chosen+'</b> · Correct: <b>'+q.correctAnswers.join(', ')+'</b></p>'+(q.rationale?'<div class="review">'+q.rationale+'</div>':'')+'</div>'});
  $('#results').innerHTML=h; $('#results').classList.remove('hidden');
}
$('#start').onclick=()=>begin(1); $('#start2').onclick=()=>begin(2);
