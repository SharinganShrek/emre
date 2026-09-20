const HOST='https://digitalpractice-api.collegeboard.org';
const API=HOST+'/mspractice-studentquestionbank-prod';
const AUTH_KEY='satRwBuilder.auth';
const HISTORY_KEY='satRwBuilder.history';
const CURRENT_MOCK_KEY='satRwBuilder.currentMock';
const LAST_SEEN_KEY='satRwBuilder.lastSeen';

async function storeAuth(authenticationToken,authorizationToken,capturedFrom='unknown',source='webRequest'){
  if(!authenticationToken||!authorizationToken) return false;
  await chrome.storage.local.set({[AUTH_KEY]:{authenticationToken,authorizationToken,capturedAt:Date.now(),capturedFrom,source}});
  return true;
}

chrome.webRequest.onBeforeSendHeaders.addListener(details=>{
  const h=details.requestHeaders||[];
  const get=n=>h.find(x=>String(x.name).toLowerCase()===n)?.value;
  const authenticationToken=get('x-cb-catapult-authentication-token');
  const authorizationToken=get('x-cb-catapult-authorization-token');
  if(authenticationToken&&authorizationToken){
    storeAuth(authenticationToken,authorizationToken,details.url,'webRequest').catch(()=>{});
  }
  chrome.storage.local.set({[LAST_SEEN_KEY]:{url:details.url,at:Date.now(),type:details.type}}).catch(()=>{});
},{urls:[API+'/*'],types:['xmlhttprequest']},['requestHeaders','extraHeaders']);

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==='pageAuthCaptured'){
    const a=msg.auth||{};
    storeAuth(a.authenticationToken,a.authorizationToken,msg.capturedFrom||sender?.url||'page','page-hook')
      .then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false,error:e.message}));
    return true;
  }
  if(msg?.type==='reconnect'){
    reconnectSession().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message}));
    return true;
  }
  if(msg?.type==='status'){
    chrome.storage.local.get([AUTH_KEY,CURRENT_MOCK_KEY]).then(s=>{
      const a=s[AUTH_KEY], current=s[CURRENT_MOCK_KEY];
      sendResponse({hasAuth:!!(a?.authenticationToken&&a?.authorizationToken),capturedAt:a?.capturedAt||null,authAgeMs:a?.capturedAt?Date.now()-a.capturedAt:null,capturedFrom:a?.capturedFrom||null,source:a?.source||null,hasCurrentMock:!!(current?.m1?.length&&current?.m2?.length)});
    });
    return true;
  }
  if(msg?.type==='clearAuth'){
    chrome.storage.local.remove(AUTH_KEY).then(()=>sendResponse({ok:true})); return true;
  }
  if(msg?.type==='resetHistory'){
    chrome.storage.local.remove(HISTORY_KEY).then(()=>sendResponse({ok:true})); return true;
  }
  if(msg?.type==='buildMock'){
    buildMock(msg.options||{},msg.action||'open').then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
  }
  if(msg?.type==='downloadCurrentMock'){
    downloadCurrentMock().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
  }
});

async function reconnectSession(){
  await chrome.storage.local.remove(AUTH_KEY);
  let tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/questionbank/*']});
  let tab=tabs.find(t=>String(t.url||'').includes('/questionbank/'));
  if(!tab?.id){
    tab=await chrome.tabs.create({url:'https://mypractice.collegeboard.org/questionbank/results',active:true});
  }
  if(!tab?.id) throw new Error('Could not open Student Question Bank.');
  try{ await chrome.tabs.reload(tab.id,{bypassCache:true}); }catch{ await chrome.tabs.update(tab.id,{url:'https://mypractice.collegeboard.org/questionbank/results'}); }
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,350));
    const s=await chrome.storage.local.get(AUTH_KEY); const a=s[AUTH_KEY];
    if(a?.authenticationToken&&a?.authorizationToken){
      return {ok:true,capturedAt:a.capturedAt,source:a.source||'unknown'};
    }
  }
  return {ok:false,error:'No College Board auth headers were detected after a hard reload. Make sure you are signed in and the Student Question Bank results page actually displays questions, then click Reconnect again.'};
}

async function apiPost(path,body,auth){
  const url=API+path;
  const headers={'accept':'application/json, text/plain, */*','content-type':'application/json','x-cb-catapult-authentication-token':auth.authenticationToken,'x-cb-catapult-authorization-token':auth.authorizationToken};

  // First try from the extension service worker (fast path).
  let r;
  try {
    r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body||{}),credentials:'include'});
    if(r.ok) return r.json();
    const text=await r.text().catch(()=>"");
    if(r.status!==401 && r.status!==403) throw new Error(`${path} failed (HTTP ${r.status})${text?`: ${text.slice(0,180)}`:''}`);
  } catch(e) {
    if(!/HTTP 40[13]/.test(String(e?.message||'')) && r?.status!==401 && r?.status!==403) throw e;
  }

  // College Board may reject calls whose browser Origin is an extension. Retry from
  // the actual mypractice.collegeboard.org tab, matching the official site's context.
  const pageResult=await apiPostFromQuestionBankTab(url,body,auth).catch(()=>null);
  if(pageResult?.ok) return pageResult.data;

  // 401/403 almost always means the captured Catapult token is stale/invalid.
  // Delete it so the popup cannot misleadingly keep saying "ready".
  await chrome.storage.local.remove(AUTH_KEY);
  const detail=pageResult?.status ? ` Page-context retry also returned HTTP ${pageResult.status}${pageResult.text?`: ${pageResult.text.slice(0,160)}`:''}.` : '';
  throw new Error(`${path} was rejected (HTTP ${r?.status||403}).${detail} Your saved College Board session token has been cleared. Click Reconnect College Board in the extension popup to capture a fresh session.`);
}

async function apiPostFromQuestionBankTab(url,body,auth){
  const tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/*']});
  const tab=tabs.find(t=>String(t.url||'').includes('/questionbank/'))||tabs[0];
  if(!tab?.id) throw new Error('No College Board My Practice tab found.');
  const [{result}]=await chrome.scripting.executeScript({
    target:{tabId:tab.id},
    world:'MAIN',
    func:async (u,b,a)=>{
      try{
        const rr=await fetch(u,{method:'POST',headers:{'accept':'application/json, text/plain, */*','content-type':'application/json','x-cb-catapult-authentication-token':a.authenticationToken,'x-cb-catapult-authorization-token':a.authorizationToken},body:JSON.stringify(b||{}),credentials:'include'});
        const text=await rr.text();
        let data=null; try{data=JSON.parse(text);}catch{}
        return {ok:rr.ok,status:rr.status,text:text.slice(0,500),data};
      }catch(e){return {ok:false,status:0,text:String(e?.message||e),data:null};}
    },
    args:[url,body||{},auth]
  });
  return result;
}

async function firstWorking(values,fn){
  let last;
  for(const v of values){ try{ const x=await fn(v); if(Array.isArray(x)&&x.length) return x; }catch(e){last=e;} }
  throw last||new Error('College Board API returned no data.');
}

function norm(s){return String(s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();}
function skillKey(q){
  const s=norm(q.skill_desc||q.skill||q.skill_cd);
  if(s.includes('words in context')) return 'wic';
  if(s.includes('text structure')||s.includes('structure and purpose')) return 'tsp';
  if(s.includes('cross text')||s.includes('cross-text')) return 'cross';
  if(s.includes('central ideas')||s.includes('central idea')||s.includes('details')) return 'central';
  if(s.includes('command of evidence')||s.includes('evidence')) return 'evidence';
  if(s.includes('inference')) return 'inference';
  if(s.includes('boundaries')) return 'boundaries';
  if(s.includes('form structure and sense')||s.includes('form structure')||s.includes('structure and sense')) return 'fss';
  if(s.includes('transition')) return 'transitions';
  if(s.includes('rhetorical synthesis')||s.includes('synthesis')) return 'synthesis';
  return s;
}

const BP1=[
 ['CAS','wic','E',1],['CAS','wic','M',2],['CAS','tsp','E',1],['CAS','tsp','M',1],['CAS','tsp','H',1],['CAS','cross','H',1],
 ['INI','central','E',1],['INI','central','M',1],['INI','evidence','M',2],['INI','evidence','H',1],['INI','inference','M',1],['INI','inference','H',1],
 ['SEC','boundaries','E',1],['SEC','boundaries','M',2],['SEC','boundaries','H',1],['SEC','fss','E',1],['SEC','fss','M',1],['SEC','fss','H',1],
 ['EOI','transitions','E',1],['EOI','transitions','M',1],['EOI','transitions','H',1],['EOI','synthesis','E',1],['EOI','synthesis','M',1],['EOI','synthesis','H',1]
];
const BP2=[
 ['CAS','wic','E',1],['CAS','wic','M',1],['CAS','wic','H',1],['CAS','tsp','M',1],['CAS','tsp','H',2],['CAS','cross','H',1],
 ['INI','central','M',1],['INI','central','H',1],['INI','evidence','M',1],['INI','evidence','H',2],['INI','inference','M',1],['INI','inference','H',1],
 ['SEC','boundaries','E',1],['SEC','boundaries','M',1],['SEC','boundaries','H',2],['SEC','fss','M',1],['SEC','fss','H',2],
 ['EOI','transitions','E',1],['EOI','transitions','M',1],['EOI','transitions','H',1],['EOI','synthesis','E',1],['EOI','synthesis','M',1],['EOI','synthesis','H',1]
];
const DOMAIN_ORDER={CAS:0,INI:1,SEC:2,EOI:3};
const DIFF_ORDER={E:0,M:1,H:2};

function seeded(seed){
  let h=2166136261>>>0; const str=seed||String(Date.now())+Math.random();
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i); h=Math.imul(h,16777619);}
  return ()=>{h+=0x6D2B79F5; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;};
}
function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function pickBlueprint(all,bp,used,rng,warnings){
  const out=[];
  for(const [domain,skill,diff,count] of bp){
    for(let k=0;k<count;k++){
      let pool=all.filter(q=>q.primary_class_cd===domain&&q.difficulty===diff&&skillKey(q)===skill&&!used.has(q.external_id));
      if(!pool.length){
        pool=all.filter(q=>q.primary_class_cd===domain&&q.difficulty===diff&&!used.has(q.external_id));
        if(pool.length) warnings.push(`Fallback used for ${domain}/${skill}/${diff}: same domain+difficulty, different skill.`);
      }
      if(!pool.length){
        pool=all.filter(q=>q.primary_class_cd===domain&&!used.has(q.external_id));
        if(pool.length) warnings.push(`Broader fallback used for ${domain}/${skill}/${diff}: same domain, nearest available difficulty.`);
        pool.sort((a,b)=>Math.abs(DIFF_ORDER[a.difficulty]-DIFF_ORDER[diff])-Math.abs(DIFF_ORDER[b.difficulty]-DIFF_ORDER[diff]));
      }
      if(!pool.length) throw new Error(`Not enough unused questions to fill ${domain}/${skill}/${diff}. Reset history or allow previously generated items.`);
      const q=shuffle(pool,rng)[0]; out.push(q); used.add(q.external_id);
    }
  }
  out.sort((a,b)=>DOMAIN_ORDER[a.primary_class_cd]-DOMAIN_ORDER[b.primary_class_cd] || DIFF_ORDER[a.difficulty]-DIFF_ORDER[b.difficulty] || skillKey(a).localeCompare(skillKey(b)));
  return out;
}

async function fetchDetails(ids,auth){
  const out=[];
  for(let i=0;i<ids.length;i+=25){
    const chunk=ids.slice(i,i+25);
    let rows;
    try{ rows=await apiPost('/pdf-download',{external_ids:chunk},auth); }
    catch(e){ rows=[]; for(const id of chunk) rows.push(await apiPost('/get-question',{external_id:id},auth)); }
    if(Array.isArray(rows)) out.push(...rows);
  }
  return out;
}

function correct(detail){
  let c=detail.correct_answer||detail.keys||[]; if(!Array.isArray(c)) c=[c];
  return c.map(x=>String(x).replace(/<[^>]*>/g,'').trim().toUpperCase()).filter(Boolean);
}
function qNorm(meta,detail){
  const opts=Array.isArray(detail.answerOptions)?detail.answerOptions:[];
  return {
    externalId:meta.external_id||detail.externalid||detail.external_id||'',
    domainCode:meta.primary_class_cd||'', domain:meta.primary_class_cd_desc||meta.primary_class_cd||'',
    skillCode:meta.skill_cd||'', skill:meta.skill_desc||meta.skill_cd||'',
    difficultyCode:meta.difficulty||'', difficulty:{E:'Easy',M:'Medium',H:'Hard'}[meta.difficulty]||meta.difficulty||'',
    stimulus:first(detail,['stimulus','passage','scenario']), prompt:first(detail,['stem','body','prompt']),
    answerOptions:opts.map((o,i)=>({letter:String.fromCharCode(65+i),content:String(o?.content||'')})),
    correctAnswers:correct(detail), rationale:String(detail.rationale||'')
  };
}
function first(o,keys){for(const k of keys){if(typeof o?.[k]==='string'&&o[k].trim())return o[k];}return '';}
function safeJson(x){return JSON.stringify(x).replace(/<\/script/gi,'<\\/script');}

function satTest(module,questions){return {format:'sat-test',formatVersion:1,assessmentId:99,source:{name:'SAT R&W 2-Module Builder'},exportedAt:new Date().toISOString(),sections:[{subject:'rw',label:'Reading and Writing',selectedCount:questions.length}],counts:{rw:questions.length},module,questions};}

function timedHtml(m1,m2){
const data=safeJson({m1,m2});
return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SAT R&W Timed Mock</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,system-ui,sans-serif;background:#f4f5f8;color:#131b2b}.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #ddd;padding:12px 18px;display:flex;justify-content:space-between;align-items:center}.timer{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}.wrap{max-width:1040px;margin:auto;padding:24px}.card{background:#fff;border:1px solid #d8dde8;border-radius:14px;padding:24px;min-height:420px}.meta{font-size:12px;color:#6a7489;margin-bottom:12px}.stimulus,.prompt{font-size:17px;line-height:1.55}.prompt{margin-top:15px}.answers{display:grid;gap:10px;margin-top:22px}.ans{display:flex;gap:11px;align-items:flex-start;border:1px solid #cfd5e1;border-radius:10px;padding:12px;cursor:pointer;background:#fff}.ans.sel{border:2px solid #2563eb;padding:11px;background:#eff6ff}.letter{font-weight:800}.nav{display:flex;justify-content:space-between;gap:12px;margin-top:16px}.nav button,.primary{padding:11px 18px;border-radius:9px;border:0;background:#1d4ed8;color:#fff;font-weight:700;cursor:pointer}.nav button.secondary{background:#e7eaf0;color:#25324b}.grid{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0}.grid button{width:34px;height:34px;border-radius:6px;border:1px solid #ccd2de;background:#fff;cursor:pointer}.grid button.done{background:#dbeafe;border-color:#60a5fa}.grid button.cur{outline:2px solid #1d4ed8}.intro{max-width:720px;margin:70px auto;background:white;padding:32px;border-radius:16px;border:1px solid #d8dde8}.hidden{display:none!important}.result{background:#fff;padding:20px;border-radius:12px;margin:14px 0}.breakdown{border-collapse:collapse;width:100%}.breakdown td,.breakdown th{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}.review{margin-top:18px;padding-top:12px;border-top:1px solid #ddd}.correct{color:#15803d;font-weight:700}.wrong{color:#b91c1c;font-weight:700}img{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse}td,th{padding:4px}
</style></head><body><script id="DATA" type="application/json">${data}</script>
<div id="intro" class="intro"><h1>SAT Reading & Writing — 2-Module Timing Mock</h1><p>This mock uses 27 questions in each module and 32 minutes per module. Module 2 is intentionally the harder route.</p><p>No answers are shown until both modules are finished.</p><button id="start" class="primary">Start Module 1</button></div>
<div id="test" class="hidden"><div class="top"><div><b id="modTitle"></b><div id="qLabel" class="meta"></div></div><div id="timer" class="timer">32:00</div></div><div class="wrap"><div id="grid" class="grid"></div><div class="card"><div id="content"></div><div id="answers" class="answers"></div></div><div class="nav"><button id="prev" class="secondary">Previous</button><button id="next">Next</button></div></div></div>
<div id="between" class="intro hidden"><h1>Module 1 complete</h1><p>Your answers are locked. Module 2 is the harder route and has 32 minutes.</p><button id="start2" class="primary">Start Module 2</button></div>
<div id="results" class="wrap hidden"></div>
<script>
const D=JSON.parse(document.getElementById('DATA').textContent);let mod=1,qs=[],idx=0,answers={},left=1920,tick=null;
const $=s=>document.querySelector(s); const key=()=> 'm'+mod+'q'+idx;
function begin(n){mod=n;qs=n===1?D.m1:D.m2;idx=0;left=1920;$('#intro').classList.add('hidden');$('#between').classList.add('hidden');$('#test').classList.remove('hidden');$('#modTitle').textContent='Module '+n+(n===2?' — Hard Route':'');render();clearInterval(tick);tick=setInterval(()=>{left--;timer();if(left<=0){clearInterval(tick);finishModule();}},1000);timer();}
function timer(){let m=Math.floor(left/60),s=left%60;$('#timer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function render(){const q=qs[idx];$('#qLabel').textContent='Question '+(idx+1)+' of '+qs.length;$('#content').innerHTML=(q.stimulus?'<div class="stimulus">'+q.stimulus+'</div>':'')+(q.prompt?'<div class="prompt">'+q.prompt+'</div>':'');const a=$('#answers');a.innerHTML='';q.answerOptions.forEach(o=>{const d=document.createElement('div');d.className='ans'+(answers[key()]===o.letter?' sel':'');d.innerHTML='<span class="letter">'+o.letter+'</span><span>'+o.content+'</span>';d.onclick=()=>{answers[key()]=o.letter;render();};a.appendChild(d)});$('#prev').disabled=idx===0;$('#next').textContent=idx===qs.length-1?'Finish Module':'Next';const g=$('#grid');g.innerHTML='';qs.forEach((_,i)=>{const b=document.createElement('button');b.textContent=i+1;b.className=(answers['m'+mod+'q'+i]?'done ':'')+(i===idx?'cur':'');b.onclick=()=>{idx=i;render()};g.appendChild(b)});}
$('#prev').onclick=()=>{if(idx>0){idx--;render()}};$('#next').onclick=()=>{if(idx<qs.length-1){idx++;render()}else finishModule()};
function finishModule(){clearInterval(tick);$('#test').classList.add('hidden');if(mod===1)$('#between').classList.remove('hidden');else showResults();}
function showResults(){const all=[...D.m1.map((q,i)=>[1,i,q]),...D.m2.map((q,i)=>[2,i,q])];let correct=0;const stats={};for(const [m,i,q] of all){const chosen=answers['m'+m+'q'+i];const ok=q.correctAnswers.includes(chosen);if(ok)correct++;const k=q.domain||q.domainCode;stats[k]??=[0,0];stats[k][1]++;if(ok)stats[k][0]++;}let h='<h1>Results</h1><div class="result"><h2>'+correct+' / '+all.length+' correct</h2><table class="breakdown"><tr><th>Domain</th><th>Correct</th></tr>';for(const [k,v] of Object.entries(stats))h+='<tr><td>'+k+'</td><td>'+v[0]+' / '+v[1]+'</td></tr>';h+='</table></div><h2>Review</h2>';all.forEach(([m,i,q])=>{const chosen=answers['m'+m+'q'+i]||'—',ok=q.correctAnswers.includes(chosen);h+='<div class="result"><b>Module '+m+', Q'+(i+1)+'</b> <span class="'+(ok?'correct':'wrong')+'">'+(ok?'Correct':'Incorrect')+'</span><div class="meta">'+q.domain+' · '+q.skill+' · '+q.difficulty+'</div><div>'+q.stimulus+'</div><div>'+q.prompt+'</div><p>Your answer: <b>'+chosen+'</b> · Correct: <b>'+q.correctAnswers.join(', ')+'</b></p>'+(q.rationale?'<div class="review">'+q.rationale+'</div>':'')+'</div>'});$('#results').innerHTML=h;$('#results').classList.remove('hidden');}
$('#start').onclick=()=>begin(1);$('#start2').onclick=()=>begin(2);
</script></body></html>`;
}

async function downloadText(filename,text,mime='text/plain'){
  const blob='data:'+mime+';base64,'+btoa(unescape(encodeURIComponent(text)));
  return chrome.downloads.download({url:blob,filename,saveAs:false,conflictAction:'uniquify'});
}

function localStamp(){
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function downloadCurrentMock(){
  const s=await chrome.storage.local.get(CURRENT_MOCK_KEY);
  const cur=s[CURRENT_MOCK_KEY];
  if(!cur?.m1?.length||!cur?.m2?.length) throw new Error('No generated mock is available yet. Build a mock first.');
  const filename=`SAT_RW_Mock_${localStamp()}.html`;
  await downloadText(filename,timedHtml(cur.m1,cur.m2),'text/html;charset=utf-8');
  return {ok:true,filename,module1:cur.m1.length,module2:cur.m2.length};
}

async function buildMock(options,action='open'){
  const s=await chrome.storage.local.get([AUTH_KEY,HISTORY_KEY]); const auth=s[AUTH_KEY];
  if(!auth?.authenticationToken||!auth?.authorizationToken) throw new Error('No College Board session captured. Click Reconnect College Board in the extension popup.');
  if(!auth.capturedAt || Date.now()-auth.capturedAt>2*60*60*1000){
    await chrome.storage.local.remove(AUTH_KEY);
    throw new Error('The captured College Board session is older than 2 hours. Click Reconnect College Board in the extension popup.');
  }
  const warnings=[];
  let metadata=await firstWorking(['reading','rw','reading-writing','reading_and_writing'],test=>apiPost('/get-questions',{asmtEventId:99,test,domain:'CAS,INI,SEC,EOI'},auth));
  const seen=new Set(); metadata=metadata.filter(q=>q?.external_id&&!seen.has(q.external_id)&&(seen.add(q.external_id),true));
  if(options.excludeActive!==false){
    const live=await firstWorking(['reading','rw','reading-writing','reading_and_writing'],section=>apiPost('/live-items',{section},auth));
    const ls=new Set(live.map(String)); metadata=metadata.filter(q=>!ls.has(String(q.external_id)));
  }
  const prior=new Set(options.avoidHistory===false?[]:(s[HISTORY_KEY]||[]));
  const used=new Set(prior); const rng=seeded(options.seed||'');
  const m1meta=pickBlueprint(metadata,BP1,used,rng,warnings); const m2meta=pickBlueprint(metadata,BP2,used,rng,warnings);
  const selected=[...m1meta,...m2meta]; const details=await fetchDetails(selected.map(q=>q.external_id),auth); const dm=new Map(details.map(d=>[String(d.externalid||d.external_id),d]));
  const normQ=arr=>arr.map(m=>qNorm(m,dm.get(String(m.external_id))||{}));
  const m1=normQ(m1meta),m2=normQ(m2meta);
  if(options.avoidHistory!==false){ const h=[...prior,...selected.map(x=>x.external_id)]; await chrome.storage.local.set({[HISTORY_KEY]:[...new Set(h)].slice(-1200)}); }
  const stamp=localStamp();
  await chrome.storage.local.set({[CURRENT_MOCK_KEY]:{createdAt:new Date().toISOString(),stamp,m1,m2}});
  let filename=null;
  if(action==='download'){
    filename=`SAT_RW_Mock_${stamp}.html`;
    await downloadText(filename,timedHtml(m1,m2),'text/html;charset=utf-8');
  } else {
    await chrome.tabs.create({url:chrome.runtime.getURL('mock.html')});
  }
  return {ok:true,action,filename,module1:m1.length,module2:m2.length,warnings:[...new Set(warnings)]};
}