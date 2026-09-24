const CURRENT_MOCK_KEY='satRwBuilder.currentMock';
const $=s=>document.querySelector(s);

let D=null, mod=1, qs=[], idx=0, answers={}, flagged={}, eliminated={}, times={};
let left=1920, tick=null, paused=false, timerHidden=false, warned5=false;
let elimOn=false, view='question', splitPct=50, shownAt=0;

function key(m,i){return 'm'+(m??mod)+'q'+(i??idx)}
function sectionKey(){return D?.section==='math'?'math':'rw'}
function moduleSeconds(){return Number(D?.seconds)|| (sectionKey()==='math'?2100:1920)}
function sectionLabel(){return sectionKey()==='math'?'Math':'Reading and Writing'}
function sectionTitle(n){return 'Section 1, Module '+n+': '+sectionLabel()}
function isSpr(q){return !q?.answerOptions?.length}
function accrue(){
  if(!shownAt){ shownAt=Date.now(); return; }
  if(paused || !qs.length){ shownAt=Date.now(); return; }
  const dt=Math.max(0, Math.round((Date.now()-shownAt)/1000));
  const k=key();
  times[k]=(times[k]||0)+dt;
  shownAt=Date.now();
}
function modulePayload(n){
  const outAnswers={}, outFlags={}, outTimes={};
  qs.forEach((_,i)=>{
    const k=key(n,i);
    if(answers[k]!=null && answers[k]!=='') outAnswers[k]=answers[k];
    if(flagged[k]) outFlags[k]=true;
    if(times[k]!=null) outTimes[k]=times[k];
  });
  return {answers:outAnswers, flagged:outFlags, seconds_spent:outTimes};
}
async function syncModule(n, timedOut){
  accrue();
  const body={
    op:'module',
    attempt_id:D.attemptId,
    module_token:D.moduleToken,
    module:n,
    seconds_left: timedOut?0:left,
    ...modulePayload(n)
  };
  if(typeof chrome!=='undefined' && chrome.runtime?.sendMessage){
    try{ await chrome.runtime.sendMessage({type:'moduleComplete', ...body}); return; }catch{}
  }
  if(D.appOrigin && D.attemptId && D.moduleToken){
    try{
      await fetch(String(D.appOrigin).replace(/\/$/,'')+'/api/sat-practice/ingest',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body)
      });
    }catch{}
  }
}
function fmt(sec){
  const s=Math.max(0,sec|0);
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), r=s%60;
  return h+':'+String(m).padStart(2,'0')+':'+String(r).padStart(2,'0');
}
function closePopovers(){
  $('#qMenu').classList.add('hidden');
  $('#directionsPanel').classList.add('hidden');
  $('#moreMenu').classList.add('hidden');
}

async function loadData(){
  const el=document.getElementById('DATA');
  if(el && el.textContent.trim()){
    try{return JSON.parse(el.textContent)}catch{}
  }
  if(typeof chrome!=='undefined' && chrome.storage?.local){
    const s=await chrome.storage.local.get(CURRENT_MOCK_KEY);
    return s[CURRENT_MOCK_KEY]||null;
  }
  return null;
}

loadData().then(data=>{
  D=typeof fixMockMath==='function'?fixMockMath(data):data;
  $('#loading').classList.add('hidden');
  if(!D?.m1?.length||!D?.m2?.length){
    $('#loading').classList.remove('hidden');
    $('#loading').innerHTML='<div class="gate-card"><div class="sat-mark">SAT<sup>®</sup></div><h1>No mock found</h1><p>Open the extension popup and click <b>Build &amp; Open Mock</b>.</p></div>';
    return;
  }
  const count=D.m1.length;
  const mins=Math.round(moduleSeconds()/60);
  $('#introTitle').textContent='Section 1: '+sectionLabel();
  $('#introLead').textContent='This mock uses '+count+' questions in each module and '+mins+' minutes per module. Module 2 is intentionally the harder route.';
  $('#introMeta').textContent='Module 1 · '+count+' questions · '+mins+' minutes';
  $('#betweenLead').textContent='Module 2 is the harder route and has '+mins+' minutes.';
  $('#betweenMeta').textContent='Module 2 · '+D.m2.length+' questions · '+mins+' minutes';
  $('#intro').classList.remove('hidden');
});

function begin(n){
  mod=n; qs=n===1?D.m1:D.m2; idx=0; left=moduleSeconds(); paused=false; timerHidden=false; warned5=false; elimOn=false; view='question'; shownAt=Date.now();
  document.body.classList.remove('is-paused');
  $('#pauseBtn').textContent='Pause';
  $('#pauseBtn').classList.remove('is-paused');
  $('#pauseOverlay').classList.add('hidden');
  $('#intro').classList.add('hidden');
  $('#between').classList.add('hidden');
  $('#results').classList.add('hidden');
  $('#test').classList.remove('hidden');
  $('#modTitle').textContent=sectionTitle(n);
  $('#qMenuTitle').textContent=sectionTitle(n);
  applySplit();
  showQuestionView();
  render();
  startTick();
  timer();
}

function startTick(){
  clearInterval(tick);
  tick=setInterval(()=>{
    if(paused) return;
    left--;
    timer();
    if(left===300) warn5();
    if(left<=0){clearInterval(tick); finishModule(true)}
  },1000);
}

function timer(){
  const t=fmt(left);
  $('#timer').textContent=timerHidden?'\u00a0':t;
  $('#timer').classList.toggle('is-hidden', timerHidden);
  $('#hideTimerLabel').textContent=timerHidden?'Show':'Hide';
  $('#pauseTime').textContent=t;
}

function setTimerHidden(on){
  timerHidden=!!on;
  if(left<=300) timerHidden=false;
  timer();
}

function warn5(){
  if(warned5) return;
  warned5=true;
  setTimerHidden(false);
  if(paused) return;
  openModal('5 minutes remaining','You have 5 minutes remaining in this module.',[{label:'OK',primary:true}]);
}

function setPaused(on){
  const next=!!on;
  if(next===paused) return;
  if(next) accrue();
  paused=next;
  if(!next) shownAt=Date.now();
  document.body.classList.toggle('is-paused', paused);
  $('#pauseBtn').textContent=paused?'Resume':'Pause';
  $('#pauseBtn').classList.toggle('is-paused', paused);
  $('#pauseOverlay').classList.toggle('hidden', !paused);
  closePopovers();
  if(paused){
    clearInterval(tick);
    $('#passage').innerHTML='';
    $('#prompt').innerHTML='';
    $('#answers').innerHTML='';
    timer();
  }else{
    startTick();
    if(view==='review') renderReview();
    else render();
  }
}

function showQuestionView(){
  view='question';
  $('#workspace').classList.remove('hidden');
  $('#reviewView').classList.add('hidden');
  $('#next').textContent=idx===qs.length-1?'Review':'Next';
}

function showReviewView(){
  view='review';
  closePopovers();
  $('#workspace').classList.add('hidden');
  $('#reviewView').classList.remove('hidden');
  $('#next').textContent='Submit';
  renderReview();
}

function render(){
  if(paused) return;
  const q=qs[idx];
  $('#elimBtn').classList.toggle('hidden', isSpr(q));
  $('#qNum').textContent=String(idx+1);
  $('#qMenuLabel').textContent='Question '+(idx+1)+' of '+qs.length;
  $('#modTitle').textContent=sectionTitle(mod);
  $('#passage').innerHTML=q.stimulus||'';
  $('#prompt').innerHTML=q.prompt||'';
  renderAnswers(q);
  const marked=!!flagged[key()];
  $('#markBtn').classList.toggle('on', marked);
  $('#elimBtn').classList.toggle('on', elimOn);
  $('#prev').disabled=idx===0 && view==='question';
  $('#next').textContent=idx===qs.length-1?'Review':'Next';
  renderGrid();
}

function renderAnswers(q){
  const a=$('#answers'); a.innerHTML='';
  if(isSpr(q)){
    const wrap=document.createElement('div');
    wrap.className='spr-wrap';
    wrap.innerHTML='<label for="spr">Your answer</label>';
    const input=document.createElement('input');
    input.id='spr';
    input.className='spr-input';
    input.autocomplete='off';
    input.value=answers[key()]||'';
    input.oninput=()=>{ answers[key()]=input.value.trim(); renderGrid(); };
    wrap.appendChild(input);
    a.appendChild(wrap);
    return;
  }
  const sel=answers[key()];
  const elim=eliminated[key()]||{};
  (q.answerOptions||[]).forEach(o=>{
    const row=document.createElement('div');
    row.className='choice'+(sel===o.letter?' sel':'')+(elim[o.letter]?' elim':'');
    row.setAttribute('role','button');
    row.tabIndex=0;
    row.innerHTML='<span class="bubble">'+o.letter+'</span><span class="choice-body">'+o.content+'</span>';
    if(elimOn){
      const x=document.createElement('button');
      x.type='button';
      x.className='elim-x'+(elim[o.letter]?' on':'');
      x.textContent='/';
      x.title='Eliminate '+o.letter;
      x.onclick=e=>{
        e.stopPropagation();
        eliminated[key()]=eliminated[key()]||{};
        eliminated[key()][o.letter]=!eliminated[key()][o.letter];
        render();
      };
      row.appendChild(x);
    }
    row.onclick=()=>{answers[key()]=o.letter; render()};
    a.appendChild(row);
  });
}

function renderGrid(){
  const g=$('#grid'); g.innerHTML='';
  qs.forEach((_,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=i+1;
    const k=key(mod,i);
    b.className=(answers[k]?'answered ':'')+(i===idx && view==='question'?'cur ':'')+(flagged[k]?'flagged':'');
    b.onclick=()=>{accrue(); idx=i; closePopovers(); showQuestionView(); render()};
    g.appendChild(b);
  });
}

function renderReview(){
  if(paused) return;
  const unanswered=qs.filter((_,i)=>!answers[key(mod,i)]).length;
  const marked=qs.filter((_,i)=>flagged[key(mod,i)]).length;
  $('#reviewSummary').textContent=(unanswered?unanswered+' unanswered. ':'All questions answered. ')+(marked?marked+' marked for review.':'');
  const g=$('#reviewGrid'); g.innerHTML='';
  qs.forEach((_,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=i+1;
    const k=key(mod,i);
    b.className=(answers[k]?'answered ':'')+(flagged[k]?'flagged':'');
    b.onclick=()=>{accrue(); idx=i; showQuestionView(); render()};
    g.appendChild(b);
  });
  $('#qMenuLabel').textContent='Review';
  $('#prev').disabled=false;
  renderGrid();
}

function openModal(title, body, actions){
  $('#modalTitle').textContent=title;
  $('#modalBody').innerHTML=typeof body==='string'?'<p>'+body+'</p>':body;
  const box=$('#modalActions'); box.innerHTML='';
  (actions||[]).forEach(act=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='bb-btn '+(act.primary?'bb-btn-primary':'bb-btn-ghost');
    b.textContent=act.label;
    b.onclick=()=>{ $('#modal').classList.add('hidden'); act.onClick&&act.onClick() };
    box.appendChild(b);
  });
  $('#modal').classList.remove('hidden');
}

function requestSubmit(){
  const unanswered=qs.filter((_,i)=>!answers[key(mod,i)]).length;
  const extra=unanswered?('<p>You have <b>'+unanswered+' unanswered</b> question'+(unanswered===1?'':'s')+'.</p>'):'';
  openModal(
    'Submit this module?',
    extra+'<p>Once you leave this module, you will not be able to return to it.</p>',
    [
      {label:'Cancel'},
      {label:'Submit',primary:true,onClick:()=>finishModule(false)}
    ]
  );
}

function finishModule(timedOut){
  accrue();
  paused=false;
  document.body.classList.remove('is-paused');
  $('#pauseBtn').textContent='Pause';
  $('#pauseBtn').classList.remove('is-paused');
  $('#pauseOverlay').classList.add('hidden');
  clearInterval(tick);
  closePopovers();
  $('#modal').classList.add('hidden');
  $('#test').classList.add('hidden');
  const done=mod;
  syncModule(done, !!timedOut);
  if(done===1) $('#between').classList.remove('hidden');
  else showResults();
}

function showResults(){
  const all=[...D.m1.map((q,i)=>[1,i,q]),...D.m2.map((q,i)=>[2,i,q])];
  let correct=0; const stats={};
  for(const [m,i,q] of all){
    const chosen=answers['m'+m+'q'+i];
    const ok=q.correctAnswers.includes(chosen);
    if(ok) correct++;
    const k=q.domain||q.domainCode;
    stats[k]??=[0,0]; stats[k][1]++; if(ok) stats[k][0]++;
  }
  let h='<div class="results-wrap"><div class="sat-mark">SAT<sup>®</sup></div><h1>Results</h1><div class="result"><h2>'+correct+' / '+all.length+' correct</h2><table class="breakdown"><tr><th>Domain</th><th>Correct</th></tr>';
  for(const [k,v] of Object.entries(stats)) h+='<tr><td>'+k+'</td><td>'+v[0]+' / '+v[1]+'</td></tr>';
  h+='</table></div><h2>Review</h2>';
  all.forEach(([m,i,q])=>{
    const chosen=answers['m'+m+'q'+i]||'—';
    const ok=q.correctAnswers.includes(chosen);
    const mark=flagged['m'+m+'q'+i]?' · Marked for review':'';
    h+='<div class="result"><b>Module '+m+', Q'+(i+1)+'</b> <span class="'+(ok?'correct':'wrong')+'">'+(ok?'Correct':'Incorrect')+'</span>'+mark+'<div class="meta">'+q.domain+' · '+q.skill+' · '+q.difficulty+'</div><div class="content-html">'+(q.stimulus||'')+'</div><div class="content-html">'+(q.prompt||'')+'</div><p>Your answer: <b>'+chosen+'</b> · Correct: <b>'+q.correctAnswers.join(', ')+'</b></p>'+(q.rationale?'<div class="review content-html">'+q.rationale+'</div>':'')+'</div>';
  });
  h+='</div>';
  $('#results').innerHTML=h;
  $('#results').classList.remove('hidden');
}

function applySplit(){
  $('#passage').style.flexBasis=splitPct+'%';
}

(function splitter(){
  const el=$('#splitter');
  let dragging=false;
  el.addEventListener('mousedown',e=>{dragging=true; el.classList.add('dragging'); e.preventDefault()});
  window.addEventListener('mouseup',()=>{dragging=false; el.classList.remove('dragging')});
  window.addEventListener('mousemove',e=>{
    if(!dragging) return;
    const rec=$('#workspace').getBoundingClientRect();
    splitPct=Math.min(72,Math.max(28,((e.clientX-rec.left)/rec.width)*100));
    applySplit();
  });
})();

$('#start').onclick=()=>begin(1);
$('#start2').onclick=()=>begin(2);
$('#prev').onclick=()=>{
  if(paused) return;
  closePopovers();
  accrue();
  if(view==='review'){ idx=qs.length-1; showQuestionView(); render(); return; }
  if(idx>0){idx--; render()}
};
$('#next').onclick=()=>{
  if(paused) return;
  closePopovers();
  accrue();
  if(view==='review'){ requestSubmit(); return; }
  if(idx<qs.length-1){idx++; render()}
  else showReviewView();
};
$('#markBtn').onclick=()=>{ flagged[key()]=!flagged[key()]; render() };
$('#elimBtn').onclick=()=>{ elimOn=!elimOn; render() };
$('#hideTimer').onclick=()=>setTimerHidden(!timerHidden);
$('#pauseBtn').onclick=()=>setPaused(!paused);
$('#resumeBtn').onclick=()=>setPaused(false);
$('#directionsBtn').onclick=()=>{
  $('#moreMenu').classList.add('hidden');
  $('#directionsPanel').classList.toggle('hidden');
};
$('#closeDirections').onclick=()=>$('#directionsPanel').classList.add('hidden');
$('#qMenuBtn').onclick=()=>{
  if(paused) return;
  $('#directionsPanel').classList.add('hidden');
  $('#qMenu').classList.toggle('hidden');
  renderGrid();
};
$('#closeQMenu').onclick=()=>$('#qMenu').classList.add('hidden');
$('#gotoReview').onclick=()=>{ closePopovers(); showReviewView() };
$('#submitModule').onclick=()=>requestSubmit();
$('#moreBtn').onclick=e=>{
  e.stopPropagation();
  $('#moreMenu').classList.toggle('hidden');
};
$('#shortcutsBtn').onclick=()=>{
  $('#moreMenu').classList.add('hidden');
  openModal('Keyboard shortcuts',
    '<table class="shortcuts-table"><tr><td>Back</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">B</span></td></tr><tr><td>Next</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">X</span></td></tr><tr><td>Question menu</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">G</span></td></tr><tr><td>Hide / show timer</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">T</span></td></tr><tr><td>Pause</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">P</span></td></tr><tr><td>Mark for Review</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">V</span></td></tr><tr><td>Option eliminator</td><td><span class="kbd">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">O</span></td></tr><tr><td>Select A–D</td><td><span class="kbd">Ctrl</span> <span class="kbd">Shift</span> <span class="kbd">1–4</span></td></tr></table>',
    [{label:'Close',primary:true}]
  );
};
document.addEventListener('click',e=>{
  if(!e.target.closest('.more-wrap')) $('#moreMenu').classList.add('hidden');
});

document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea') return;
  const testOn=!$('#test').classList.contains('hidden');
  if(!testOn) return;
  const a=e.altKey, c=e.ctrlKey||e.metaKey, s=e.shiftKey, k=e.key.toLowerCase();
  if(c&&a&&k==='p'){e.preventDefault(); setPaused(!paused); return}
  if(paused) return;
  if(c&&a&&k==='b'){e.preventDefault(); $('#prev').click()}
  else if(c&&a&&k==='x'){e.preventDefault(); $('#next').click()}
  else if(c&&a&&k==='g'){e.preventDefault(); $('#qMenuBtn').click()}
  else if(c&&a&&k==='t'){e.preventDefault(); setTimerHidden(!timerHidden)}
  else if(c&&a&&k==='v'){e.preventDefault(); $('#markBtn').click()}
  else if(c&&a&&k==='o'){e.preventDefault(); $('#elimBtn').click()}
  else if(c&&a&&s&&k==='d'){e.preventDefault(); $('#directionsBtn').click()}
  else if(c&&s&&['1','2','3','4'].includes(e.key)){
    e.preventDefault();
    const letter='ABCD'[+e.key-1];
    const q=qs[idx];
    if(view==='question' && q?.answerOptions?.some(o=>o.letter===letter)){ answers[key()]=letter; render() }
  }
});
