const HOST='https://digitalpractice-api.collegeboard.org';
const API=HOST+'/mspractice-studentquestionbank-prod';
const RESULTS_API=HOST+'/mspractice-testresults-prod';
const AUTH_KEY='satRwBuilder.auth';
const HISTORY_KEY='satRwBuilder.history';
const CURRENT_MOCK_KEY='satRwBuilder.currentMock';
const LAST_SEEN_KEY='satRwBuilder.lastSeen';
const APP_KEY='satBuilder.app';

const SECTION={
  rw:{
    label:'Reading and Writing',
    tests:['reading','rw','reading-writing','reading_and_writing'],
    live:['reading','rw','reading-writing','reading_and_writing'],
    domains:'CAS,INI,SEC,EOI',
    domainOrder:{CAS:0,INI:1,SEC:2,EOI:3},
    seconds:1920,
    perModule:27,
    subject:'rw'
  },
  math:{
    label:'Math',
    tests:['math'],
    live:['math'],
    domains:'H,P,Q,S',
    domainOrder:{H:0,P:1,Q:2,S:3},
    seconds:2100,
    perModule:22,
    subject:'math'
  }
};

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
},{urls:[API+'/*',RESULTS_API+'/*'],types:['xmlhttprequest']},['requestHeaders','extraHeaders']);

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
  if(msg?.type==='testApp'){
    testApp().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
  }
  if(msg?.type==='moduleComplete'){
    postModule(msg).then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
  }
  if(msg?.type==='importBluebook'){
    importBluebook().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
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

  let r;
  try {
    r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body||{}),credentials:'include'});
    if(r.ok) return r.json();
    const text=await r.text().catch(()=>"");
    if(r.status!==401 && r.status!==403) throw new Error(`${path} failed (HTTP ${r.status})${text?`: ${text.slice(0,180)}`:''}`);
  } catch(e) {
    if(!/HTTP 40[13]/.test(String(e?.message||'')) && r?.status!==401 && r?.status!==403) throw e;
  }

  const pageResult=await apiPostFromPage(url,body,auth,'/questionbank/').catch(()=>null);
  if(pageResult?.ok) return pageResult.data;

  await chrome.storage.local.remove(AUTH_KEY);
  const detail=pageResult?.status ? ` Page-context retry also returned HTTP ${pageResult.status}${pageResult.text?`: ${pageResult.text.slice(0,160)}`:''}.` : '';
  throw new Error(`${path} was rejected (HTTP ${r?.status||403}).${detail} Your saved College Board session token has been cleared. Click Reconnect College Board in the extension popup to capture a fresh session.`);
}

async function apiPostFromPage(url,body,auth,preferIncludes){
  const tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/*']});
  const tab=(preferIncludes&&tabs.find(t=>String(t.url||'').includes(preferIncludes)))
    ||tabs.find(t=>String(t.url||'').includes('/questionbank/'))
    ||tabs.find(t=>String(t.url||'').includes('/dashboard'))
    ||tabs[0];
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

async function resultsApiPost(path,body,auth){
  const url=RESULTS_API+path;
  const headers={'accept':'application/json, text/plain, */*','content-type':'application/json','x-cb-catapult-authentication-token':auth.authenticationToken,'x-cb-catapult-authorization-token':auth.authorizationToken};
  let r;
  try{
    r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body||{}),credentials:'include'});
    if(r.ok) return r.json();
    const text=await r.text().catch(()=>'');
    if(r.status!==401 && r.status!==403) throw new Error(`${path} failed (HTTP ${r.status})${text?`: ${text.slice(0,180)}`:''}`);
  }catch(e){
    if(!/HTTP 40[13]/.test(String(e?.message||'')) && r?.status!==401 && r?.status!==403) throw e;
  }
  const pageResult=await apiPostFromPage(url,body,auth,'/dashboard').catch(()=>null);
  if(pageResult?.ok) return pageResult.data;
  const detail=pageResult?.status ? ` Page-context retry also returned HTTP ${pageResult.status}${pageResult.text?`: ${pageResult.text.slice(0,160)}`:''}.` : '';
  throw new Error(`Bluebook results ${path} was rejected (HTTP ${r?.status||403}).${detail} Open My Practice dashboard while signed in, then click Import again.`);
}

async function firstWorking(values,fn){
  let last;
  for(const v of values){ try{ const x=await fn(v); if(Array.isArray(x)&&x.length) return x; }catch(e){last=e;} }
  throw last||new Error('College Board API returned no data.');
}

function stripHtml(value){
  return String(value||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}
function contentHash(q){
  const text=stripHtml(`${q.stimulus||''}\n${q.prompt||''}`).toLowerCase();
  let h=2166136261;
  for(let i=0;i<text.length;i++){ h^=text.charCodeAt(i); h=Math.imul(h,16777619); }
  return `${(h>>>0).toString(16).padStart(8,'0')}:${text.length}`;
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
const MATH_BP1=[
 ['H','E',2],['H','M',3],['H','H',2],
 ['P','E',2],['P','M',3],['P','H',2],
 ['Q','E',2],['Q','M',1],['Q','H',1],
 ['S','E',1],['S','M',2],['S','H',1]
];
const MATH_BP2=[
 ['H','E',1],['H','M',2],['H','H',4],
 ['P','E',1],['P','M',2],['P','H',4],
 ['Q','E',1],['Q','M',1],['Q','H',2],
 ['S','M',2],['S','H',2]
];
const DIFF_ORDER={E:0,M:1,H:2};

function seeded(seed){
  let h=2166136261>>>0; const str=seed||String(Date.now())+Math.random();
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i); h=Math.imul(h,16777619);}
  return ()=>{h+=0x6D2B79F5; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;};
}
function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function pickBlueprint(all,bp,used,rng,warnings,domainOrder){
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
  out.sort((a,b)=>(domainOrder[a.primary_class_cd]??9)-(domainOrder[b.primary_class_cd]??9) || DIFF_ORDER[a.difficulty]-DIFF_ORDER[b.difficulty] || skillKey(a).localeCompare(skillKey(b)));
  return out;
}

function pickDomainDiff(all,bp,used,rng,warnings,domainOrder){
  const out=[];
  for(const [domain,diff,count] of bp){
    for(let k=0;k<count;k++){
      let pool=all.filter(q=>q.primary_class_cd===domain&&q.difficulty===diff&&!used.has(q.external_id));
      if(!pool.length){
        pool=all.filter(q=>q.primary_class_cd===domain&&!used.has(q.external_id));
        if(pool.length) warnings.push(`Fallback used for ${domain}/${diff}: nearest available difficulty.`);
        pool.sort((a,b)=>Math.abs(DIFF_ORDER[a.difficulty]-DIFF_ORDER[diff])-Math.abs(DIFF_ORDER[b.difficulty]-DIFF_ORDER[diff]));
      }
      if(!pool.length) throw new Error(`Not enough unused Math questions to fill ${domain}/${diff}.`);
      const q=shuffle(pool,rng)[0]; out.push(q); used.add(q.external_id);
    }
  }
  out.sort((a,b)=>(domainOrder[a.primary_class_cd]??9)-(domainOrder[b.primary_class_cd]??9) || DIFF_ORDER[a.difficulty]-DIFF_ORDER[b.difficulty]);
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

async function timedHtml(payload){
  const [html,css,js]=await Promise.all([
    fetch(chrome.runtime.getURL('mock.html')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('mock.css')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('mock.js')).then(r=>r.text())
  ]);
  const data=safeJson(payload);
  let out=html.replace(/<link rel="stylesheet" href="mock\.css">\s*/,'<style>\n'+css+'\n</style>\n');
  out=out.replace(/<script src="mock\.js"><\/script>/,'<script id="DATA" type="application/json">'+data+'</script>\n<script>\n'+js.replace(/<\/script/gi,'<\\/script')+'\n</script>');
  return out;
}

async function downloadText(filename,text,mime='text/html;charset=utf-8'){
  const blob='data:'+mime+';base64,'+btoa(unescape(encodeURIComponent(text)));
  return chrome.downloads.download({url:blob,filename,saveAs:false,conflictAction:'uniquify'});
}

function localStamp(){
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function getApp(){
  const s=await chrome.storage.local.get(APP_KEY);
  const app=s[APP_KEY]||{};
  return {origin:String(app.origin||'https://emre-xi.vercel.app').replace(/\/$/,''), token:String(app.token||'')};
}

async function appFetch(path, opts={}){
  const app=await getApp();
  if(!app.origin) throw new Error('Set the Emre OS URL in the extension popup.');
  const headers={'content-type':'application/json', ...(opts.headers||{})};
  if(app.token) headers['x-sat-ingest-token']=app.token;
  const r=await fetch(app.origin+path,{...opts,headers});
  const text=await r.text();
  let data=null; try{data=JSON.parse(text);}catch{}
  if(!r.ok) throw new Error(data?.error||`Emre OS HTTP ${r.status}`);
  return data;
}

async function testApp(){
  const data=await appFetch('/api/sat-practice/ingest');
  return {ok:true,external_ids:(data.external_ids||[]).length,content_hashes:(data.content_hashes||[]).length};
}

async function postModule(msg){
  const app=await getApp();
  const body={
    op:'module',
    attempt_id:msg.attempt_id,
    module_token:msg.module_token,
    module:msg.module,
    answers:msg.answers||{},
    flagged:msg.flagged||{},
    seconds_spent:msg.seconds_spent||{},
    seconds_left:msg.seconds_left
  };
  const r=await fetch(app.origin+'/api/sat-practice/ingest',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok || data.ok===false) throw new Error(data.error||'Module sync failed');
  return {ok:true,attempt:data.attempt};
}

async function downloadCurrentMock(){
  const s=await chrome.storage.local.get(CURRENT_MOCK_KEY);
  const cur=s[CURRENT_MOCK_KEY];
  if(!cur?.m1?.length||!cur?.m2?.length) throw new Error('No generated mock is available yet. Build a mock first.');
  const filename=`SAT_${(cur.section||'rw').toUpperCase()}_Mock_${cur.stamp||localStamp()}.html`;
  await downloadText(filename,await timedHtml(cur));
  return {ok:true,filename,module1:cur.m1.length,module2:cur.m2.length};
}

async function buildMock(options,action='open'){
  const sectionKey=options.section==='math'?'math':'rw';
  const spec=SECTION[sectionKey];
  const s=await chrome.storage.local.get([AUTH_KEY,HISTORY_KEY]); const auth=s[AUTH_KEY];
  if(!auth?.authenticationToken||!auth?.authorizationToken) throw new Error('No College Board session captured. Click Reconnect College Board in the extension popup.');
  if(!auth.capturedAt || Date.now()-auth.capturedAt>2*60*60*1000){
    await chrome.storage.local.remove(AUTH_KEY);
    throw new Error('The captured College Board session is older than 2 hours. Click Reconnect College Board in the extension popup.');
  }
  const warnings=[];
  let metadata=await firstWorking(spec.tests,test=>apiPost('/get-questions',{asmtEventId:99,test,domain:spec.domains},auth));
  const seen=new Set(); metadata=metadata.filter(q=>q?.external_id&&!seen.has(q.external_id)&&(seen.add(q.external_id),true));
  if(options.excludeActive!==false){
    const live=await firstWorking(spec.live,section=>apiPost('/live-items',{section},auth));
    const ls=new Set(live.map(String)); metadata=metadata.filter(q=>!ls.has(String(q.external_id)));
  }

  let usedIds=new Set(options.avoidHistory===false?[]:(s[HISTORY_KEY]||[]));
  let usedHashes=new Set();
  if(options.avoidHistory!==false){
    try{
      const hist=await appFetch('/api/sat-practice/ingest');
      for(const id of hist.external_ids||[]) usedIds.add(id);
      for(const h of hist.content_hashes||[]) usedHashes.add(h);
    }catch(e){
      warnings.push('Could not load used-question list from Emre OS: '+(e.message||e)+'. Using local history only.');
    }
  }
  const rng=seeded(options.seed||'');
  const used=new Set(usedIds);
  const m1meta=sectionKey==='math'?pickDomainDiff(metadata,MATH_BP1,used,rng,warnings,spec.domainOrder):pickBlueprint(metadata,BP1,used,rng,warnings,spec.domainOrder);
  const m2meta=sectionKey==='math'?pickDomainDiff(metadata,MATH_BP2,used,rng,warnings,spec.domainOrder):pickBlueprint(metadata,BP2,used,rng,warnings,spec.domainOrder);
  const selected=[...m1meta,...m2meta];
  const details=await fetchDetails(selected.map(q=>q.external_id),auth);
  const dm=new Map(details.map(d=>[String(d.externalid||d.external_id),d]));
  const normQ=arr=>arr.map(m=>qNorm(m,dm.get(String(m.external_id))||{}));
  let m1=normQ(m1meta), m2=normQ(m2meta);

  if(usedHashes.size){
    const leftover=metadata.filter(q=>!used.has(q.external_id));
    async function replaceHashed(list){
      const out=[];
      for(const q of list){
        if(!usedHashes.has(contentHash(q))){ out.push(q); continue; }
        warnings.push(`Skipped a previously solved question (content match) ${q.externalId||''}`);
        let replaced=null;
        for(const cand of shuffle(leftover,rng)){
          if(used.has(cand.external_id)) continue;
          if(cand.primary_class_cd!==q.domainCode) continue;
          const [detail]=await fetchDetails([cand.external_id],auth);
          const nq=qNorm(cand,detail||{});
          if(usedHashes.has(contentHash(nq))) continue;
          used.add(cand.external_id);
          replaced=nq;
          break;
        }
        if(replaced) out.push(replaced);
        else out.push(q);
      }
      return out;
    }
    m1=await replaceHashed(m1);
    m2=await replaceHashed(m2);
  }

  if(options.avoidHistory!==false){
    const h=[...usedIds,...m1.concat(m2).map(x=>x.externalId).filter(Boolean)];
    await chrome.storage.local.set({[HISTORY_KEY]:[...new Set(h)].slice(-1200)});
  }
  const stamp=localStamp();
  let attemptId=null, moduleToken=null, title=null, appOrigin=(await getApp()).origin;
  try{
    const saved=await appFetch('/api/sat-practice/ingest',{
      method:'POST',
      body:JSON.stringify({op:'start',section:sectionKey,m1,m2,stamp})
    });
    attemptId=saved.attempt_id;
    moduleToken=saved.module_token;
    title=saved.title;
  }catch(e){
    warnings.push('Mock was built but not saved to Emre OS: '+(e.message||e));
  }
  const payload={section:sectionKey,createdAt:new Date().toISOString(),stamp,m1,m2,seconds:spec.seconds,attemptId,moduleToken,appOrigin};
  await chrome.storage.local.set({[CURRENT_MOCK_KEY]:payload});
  const htmlFinal=await timedHtml(payload);
  if(attemptId){
    try{
      await appFetch('/api/sat-practice/ingest',{
        method:'POST',
        body:JSON.stringify({op:'html',attempt_id:attemptId,html:htmlFinal})
      });
    }catch(e){
      warnings.push('Questions saved, but HTML archive failed: '+(e.message||e));
    }
  }
  let filename=null;
  if(action==='download'){
    filename=`SAT_${sectionKey.toUpperCase()}_Mock_${stamp}.html`;
    await downloadText(filename,htmlFinal);
  } else {
    await chrome.tabs.create({url:chrome.runtime.getURL('mock.html')});
  }
  return {ok:true,action,filename,title,module1:m1.length,module2:m2.length,warnings:[...new Set(warnings)]};
}

const DOMAIN_LABEL={
  CAS:'Craft and Structure',INI:'Information and Ideas',SEC:'Standard English Conventions',EOI:'Expression of Ideas',
  H:'Algebra',P:'Advanced Math',Q:'Problem-Solving and Data Analysis',S:'Geometry and Trigonometry'
};

function bySeq(a,b){
  return Number(a.sequence??a.displayNumber??0)-Number(b.sequence??b.displayNumber??0);
}

function sectionKind(id, items){
  const n=String(id||'').toLowerCase();
  if(n.includes('math') || n==='m' || n==='2') return 'math';
  if(n.includes('read') || n.includes('writ') || n==='rw' || n==='1') return 'rw';
  const sample=(items||[]).slice(0,10);
  const mathish=sample.filter(it=>/^(H|P|Q|S)$/i.test(String(it?.metadata?.PRIMARY_CLASS_CD||it?.domainCode||''))).length;
  if(sample.length && mathish>=Math.ceil(sample.length/2)) return 'math';
  return 'rw';
}

function listItems(sec){
  if(Array.isArray(sec?.items)) return sec.items;
  if(Array.isArray(sec?.questions)) return sec.questions;
  if(Array.isArray(sec?.questionList)) return sec.questionList;
  if(Array.isArray(sec)) return sec;
  return [];
}

function sectionsFromQuestions(res){
  if(Array.isArray(res)){
    if(!res.length) return [];
    const first=res[0]||{};
    if(first.items || first.questions || first.sectionName || first.id || first.name) return res;
    return [{id:'rw',items:res}];
  }
  if(!res || typeof res!=='object') return [];
  if(Array.isArray(res.sections)) return res.sections;
  if(Array.isArray(res.scoreQuestionSections)) return res.scoreQuestionSections;
  const out=[];
  const rw=res.readingWriting||res.reading_and_writing||res.rw||res.verbal;
  const math=res.math;
  if(rw) out.push({id:'rw',items:listItems(rw)});
  if(math) out.push({id:'math',items:listItems(math)});
  if(out.length) return out;
  if(Array.isArray(res.items)) return [{id:'rw',items:res.items}];
  if(Array.isArray(res.questions)) return [{id:'rw',items:res.questions}];
  return [];
}

function itemModule(item){
  return Number(item.module??item.moduleNumber??item.metadata?.MODULE??item.metadata?.MODULE_NUMBER);
}

function choiceOptions(choices){
  if(!choices) return [];
  if(Array.isArray(choices)){
    return choices.map((o,i)=>{
      const row=o&&typeof o==='object'?o:{};
      return {letter:String(row.letter||String.fromCharCode(65+i)),content:String(row.content||row.body||o||'')};
    });
  }
  return Object.entries(choices).map(([letter,val])=>({
    letter:String(letter),
    content:typeof val==='string'?val:String(val?.body||val?.content||'')
  })).sort((a,b)=>a.letter.localeCompare(b.letter));
}

function itemToQuestion(item){
  const meta=item.metadata||{};
  const diff=meta.DIFFICULTY||item.difficulty||'';
  const domainCode=meta.PRIMARY_CLASS_CD||'';
  const correct=item.answer?.correctChoice;
  const correctAnswers=Array.isArray(correct)?correct.map(String):correct?[String(correct)]:[];
  return {
    externalId:String(item.externalId||item.external_id||item.questionId||''),
    domainCode,
    domain:meta.PRIMARY_CLASS_CD_DESC||DOMAIN_LABEL[String(domainCode).toUpperCase()]||domainCode,
    skillCode:meta.SKILL_CD||'',
    skill:meta.SKILL_DESC||meta.SKILL_CD||'',
    difficultyCode:diff,
    difficulty:{E:'Easy',M:'Medium',H:'Hard'}[diff]||diff||'',
    stimulus:item.passage?.body||item.stimulus||'',
    prompt:item.prompt||item.stem||'',
    answerOptions:choiceOptions(item.answer?.choices),
    correctAnswers,
    rationale:String(item.answer?.rationale||'')
  };
}

function splitSectionItems(items,perModule){
  const list=[...(items||[])];
  const m1=[], m2=[], a1={}, a2={};
  function push(mod,item){
    const q=itemToQuestion(item);
    const bucket=mod===1?m1:m2;
    const ans=mod===1?a1:a2;
    const idx=bucket.length;
    bucket.push(q);
    const resp=item.answer?.response;
    if(resp!=null && String(resp).trim()!=='') ans[idx]=String(resp).trim();
  }
  const hasMod=list.some(it=>{ const m=itemModule(it); return m===1||m===2; });
  if(hasMod){
    list.filter(it=>itemModule(it)===1).sort(bySeq).forEach(it=>push(1,it));
    list.filter(it=>itemModule(it)===2).sort(bySeq).forEach(it=>push(2,it));
  }else{
    list.sort(bySeq).forEach((it,i)=>push(i<perModule?1:2,it));
  }
  return {m1,m2,a1,a2};
}

function numScore(v){
  if(v==null) return null;
  if(typeof v==='number' && Number.isFinite(v)) return v;
  if(typeof v==='object' && v.score!=null){
    const n=Number(v.score);
    return Number.isFinite(n)?n:null;
  }
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function startedIso(value){
  if(value==null||value==='') return new Date().toISOString();
  if(typeof value==='number'){
    const ms=value>1e12?value:value*1000;
    const d=new Date(ms);
    return Number.isNaN(d.getTime())?new Date().toISOString():d.toISOString();
  }
  const d=new Date(value);
  return Number.isNaN(d.getTime())?new Date().toISOString():d.toISOString();
}

function normalizeBluebookAttempt(obj,questionsRes){
  const answers={};
  let rw={m1:[],m2:[]};
  let math={m1:[],m2:[]};
  for(const sec of sectionsFromQuestions(questionsRes)){
    const items=listItems(sec);
    const kind=sectionKind(sec.id||sec.sectionName||sec.name||sec.tierName, items);
    const split=splitSectionItems(items, kind==='math'?22:27);
    if(kind==='math') math={m1:split.m1,m2:split.m2};
    else rw={m1:split.m1,m2:split.m2};
    split.m1.forEach((_,i)=>{ if(split.a1[i]) answers[`${kind}:m1q${i}`]=split.a1[i]; });
    split.m2.forEach((_,i)=>{ if(split.a2[i]) answers[`${kind}:m2q${i}`]=split.a2[i]; });
  }
  const rwScore=(obj.sectionScores||[]).find(s=>/reading/i.test(s.tierName||'')||s.sortOrder===1)||{};
  const mathScore=(obj.sectionScores||[]).find(s=>/^math$/i.test(String(s.tierName||''))||s.sortOrder===2)||{};
  const questionCount=rw.m1.length+rw.m2.length+math.m1.length+math.m2.length;
  return {
    roster_id:String(obj.rosterEntryId||''),
    title:String(obj.displayTitle||obj.title||'Practice'),
    started_at:startedIso(obj.asmtSubmissionStartTime),
    official_total:numScore(obj.totalScore),
    official_rw:numScore(rwScore.score),
    official_math:numScore(mathScore.score),
    modules:{rw,math},
    answers,
    questionCount
  };
}

async function ensureDashboardAuth(){
  let tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/*']});
  let tab=tabs.find(t=>String(t.url||'').includes('/dashboard'))||tabs[0];
  if(!tab?.id){
    tab=await chrome.tabs.create({url:'https://mypractice.collegeboard.org/dashboard',active:true});
  }else{
    try{ await chrome.tabs.reload(tab.id,{bypassCache:true}); }
    catch{ await chrome.tabs.update(tab.id,{url:'https://mypractice.collegeboard.org/dashboard'}); }
  }
  if(!tab?.id) throw new Error('Could not open My Practice dashboard.');
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,350));
    const s=await chrome.storage.local.get(AUTH_KEY); const a=s[AUTH_KEY];
    if(a?.authenticationToken&&a?.authorizationToken) return a;
  }
  const s=await chrome.storage.local.get(AUTH_KEY);
  if(s[AUTH_KEY]?.authenticationToken) return s[AUTH_KEY];
  throw new Error('No College Board session captured from My Practice dashboard. Sign in, leave the dashboard open, then click Import again.');
}

async function saveBluebook(payload){
  const stale='Emre OS on this App URL is an older build without Bluebook ingest. Deploy the latest app (or set App URL to http://localhost:3000 while npm run dev is running), then Import again.';
  try{
    return await appFetch('/api/sat-practice/ingest/bluebook',{
      method:'POST',
      body:JSON.stringify(payload)
    });
  }catch(e){
    const msg=String(e.message||e);
    if(!/404|not found|Both modules are required/i.test(msg)) throw e;
    try{
      return await appFetch('/api/sat-practice/ingest?op=bluebook',{
        method:'POST',
        body:JSON.stringify({op:'bluebook',...payload})
      });
    }catch(e2){
      const msg2=String(e2.message||e2);
      if(/Both modules are required|404|not found/i.test(msg2)) throw new Error(stale);
      throw e2;
    }
  }
}

async function importBluebook(){
  const app=await getApp();
  if(!app.token) throw new Error('Save a connect token from SAT Practice first.');
  let auth=(await chrome.storage.local.get(AUTH_KEY))[AUTH_KEY];
  let scoresRes=null;
  try{
    if(!auth?.authenticationToken||!auth?.authorizationToken) throw new Error('no auth');
    scoresRes=await resultsApiPost('/scores',{},auth);
  }catch{
    auth=await ensureDashboardAuth();
    scoresRes=await resultsApiPost('/scores',{},auth);
  }
  const objects=Array.isArray(scoresRes?.scoreObjects)?scoresRes.scoreObjects:[];
  if(!objects.length) throw new Error('No Bluebook practice tests found. Open My Practice dashboard while signed in.');
  const imported=[];
  const skipped=[];
  const warnings=[];
  for(const obj of objects){
    const title=String(obj.displayTitle||obj.title||'Practice');
    if(/psat/i.test(title)){ skipped.push(title); continue; }
    const rosterId=String(obj.rosterEntryId||'');
    if(!rosterId){ skipped.push(title+' (no roster id)'); continue; }
    const family=obj.asmtFamilyCd??obj.asmtFamilyCD??1;
    let questionsRes;
    try{
      questionsRes=await resultsApiPost('/questions',{rosterEntryId:rosterId,asmtFamilyCd:family},auth);
    }catch(e){
      warnings.push(`${title}: ${e.message||e}`);
      continue;
    }
    const payload=normalizeBluebookAttempt(obj,questionsRes);
    if(!payload.questionCount){
      warnings.push(`${title}: no questions returned`);
      continue;
    }
    try{
      const saved=await saveBluebook(payload);
      imported.push(`${saved.title||title}${payload.official_total!=null?` (${payload.official_total})`:''}`);
    }catch(e){
      warnings.push(`${title} save failed: ${e.message||e}`);
    }
  }
  if(!imported.length && warnings.length) throw new Error(warnings[0]);
  return {ok:true,imported,skipped,warnings:[...new Set(warnings)]};
}
