importScripts('mathml.js');

const HOST='https://digitalpractice-api.collegeboard.org';
const API=HOST+'/mspractice-studentquestionbank-prod';
const AUTH_KEY='satRwBuilder.auth';
const HISTORY_KEY='satRwBuilder.history';
const CURRENT_MOCK_KEY='satRwBuilder.currentMock';
const LAST_SEEN_KEY='satRwBuilder.lastSeen';
const EXPORT_KEY='satSafari.exportHtml';

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

function watchHeaders(details){
  const h=details.requestHeaders||[];
  const get=n=>h.find(x=>String(x.name).toLowerCase()===n)?.value;
  const authenticationToken=get('x-cb-catapult-authentication-token');
  const authorizationToken=get('x-cb-catapult-authorization-token');
  if(authenticationToken&&authorizationToken){
    storeAuth(authenticationToken,authorizationToken,details.url,'webRequest').catch(()=>{});
  }
  chrome.storage.local.set({[LAST_SEEN_KEY]:{url:details.url,at:Date.now(),type:details.type}}).catch(()=>{});
}
// Safari rejects Chrome's extraHeaders flag. Header capture still works through page-hook.js.
try{
  chrome.webRequest.onBeforeSendHeaders.addListener(watchHeaders,{urls:[API+'/*'],types:['xmlhttprequest']},['requestHeaders']);
}catch(e){
  try{ chrome.webRequest.onBeforeSendHeaders.addListener(watchHeaders,{urls:[API+'/*'],types:['xmlhttprequest']}); }catch(e2){}
}

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
  if(msg?.type==='downloadFinishedHtml'){
    downloadFinishedHtml(msg.state||{}).then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message})); return true;
  }
});

async function reconnectSession(){
  await chrome.storage.local.remove(AUTH_KEY);
  let tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/questionbank/*']});
  let tab=tabs.find(t=>String(t.url||'').includes('/questionbank/'));
  if(!tab?.id){
    tab=await chrome.tabs.create({url:'https://mypractice.collegeboard.org/questionbank/results',active:true});
  }
  if(!tab?.id) throw new Error('Soru bankası açılamadı.');
  try{ await chrome.tabs.reload(tab.id,{bypassCache:true}); }catch{ await chrome.tabs.update(tab.id,{url:'https://mypractice.collegeboard.org/questionbank/results'}); }
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,350));
    const s=await chrome.storage.local.get(AUTH_KEY); const a=s[AUTH_KEY];
    if(a?.authenticationToken&&a?.authorizationToken){
      return {ok:true,capturedAt:a.capturedAt,source:a.source||'unknown'};
    }
  }
  return {ok:false,error:'College Board oturumu yakalanamadı. Soru bankasında oturumun açık olduğunu ve soruların göründüğünü kontrol et, sonra yeniden bağlan.'};
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
  const detail=pageResult?.status ? ` Sayfa denemesi de HTTP ${pageResult.status} döndü${pageResult.text?`: ${pageResult.text.slice(0,160)}`:''}.` : '';
  throw new Error(`${path} reddedildi (HTTP ${r?.status||403}).${detail} Kayıtlı oturum silindi. Eklentiden yeniden bağlan.`);
}

async function apiPostFromPage(url,body,auth,preferIncludes){
  const tabs=await chrome.tabs.query({url:['https://mypractice.collegeboard.org/*']});
  const tab=(preferIncludes&&tabs.find(t=>String(t.url||'').includes(preferIncludes)))
    ||tabs.find(t=>String(t.url||'').includes('/questionbank/'))
    ||tabs.find(t=>String(t.url||'').includes('/dashboard'))
    ||tabs[0];
  if(!tab?.id) throw new Error('College Board sekmesi bulunamadı.');
  const args=JSON.parse(JSON.stringify([url,body||{},{authenticationToken:auth.authenticationToken,authorizationToken:auth.authorizationToken}]));
  const func=async (u,b,a)=>{
    try{
      const rr=await fetch(u,{method:'POST',headers:{'accept':'application/json, text/plain, */*','content-type':'application/json','x-cb-catapult-authentication-token':a.authenticationToken,'x-cb-catapult-authorization-token':a.authorizationToken},body:JSON.stringify(b||{}),credentials:'include'});
      const text=await rr.text();
      let data=null; try{data=JSON.parse(text);}catch{}
      return {ok:rr.ok,status:rr.status,text:text.slice(0,500),data};
    }catch(e){return {ok:false,status:0,text:String(e?.message||e),data:null};}
  };
  try{
    const [hit]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func,args});
    return hit?.result;
  }catch(e){
    const [hit]=await chrome.scripting.executeScript({target:{tabId:tab.id},func,args});
    return hit?.result;
  }
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

const RW_RANGES={
  m1:{wic:[4,6],tsp:[0,3],cross:[0,1],central:[1,3],evidence:[2,4],inference:[2,2],boundaries:[3,4],fss:[2,3],transitions:[1,4],synthesis:[2,6]},
  m2:{wic:[4,5],tsp:[2,4],cross:[0,1],central:[0,3],evidence:[4,5],inference:[1,2],boundaries:[3,5],fss:[2,3],transitions:[3,4],synthesis:[1,3]}
};
const RW_BUDGETS={
  old:{m1:{E:7,M:12,H:8},m2:{E:4,M:9,H:14}},
  next:{m1:{E:5,M:18,H:4},m2:{E:2,M:5,H:20}}
};
function rwBudget(choice){ return RW_BUDGETS[choice==='old'?'old':'next']; }
const SKILL_DOMAIN={wic:'CAS',tsp:'CAS',cross:'CAS',central:'INI',evidence:'INI',inference:'INI',boundaries:'SEC',fss:'SEC',transitions:'EOI',synthesis:'EOI'};
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

function sampleCounts(ranges,total,rng){
  const skills=Object.keys(ranges);
  for(let attempt=0;attempt<400;attempt++){
    const counts={};
    let sum=0;
    for(const skill of skills){
      const [lo,hi]=ranges[skill];
      counts[skill]=lo+Math.floor(rng()*Math.max(0,hi-lo+1));
      sum+=counts[skill];
    }
    let guard=0;
    while(sum!==total && guard++<80){
      const room=sum<total
        ?skills.filter(skill=>counts[skill]<ranges[skill][1])
        :skills.filter(skill=>counts[skill]>ranges[skill][0]);
      if(!room.length) break;
      const skill=room[Math.floor(rng()*room.length)];
      counts[skill]+=sum<total?1:-1;
      sum+=sum<total?1:-1;
    }
    if(sum===total) return counts;
  }
  return null;
}
function rangedSkills(ranges,stock,lock){
  const out={};
  for(const [skill,[lo,hi]] of Object.entries(ranges)){
    if(lock&&lock[skill]!=null){ out[skill]=[lock[skill],lock[skill]]; continue; }
    const have=stock[skill]?stock[skill].E+stock[skill].M+stock[skill].H:0;
    out[skill]=[Math.min(lo,have),Math.min(hi,have)];
  }
  return out;
}
function relaxedSkills(ranges,stock,lock){
  const out={};
  for(const [skill,[,hi]] of Object.entries(ranges)){
    if(lock&&lock[skill]!=null){ out[skill]=[lock[skill],lock[skill]]; continue; }
    const have=stock[skill]?stock[skill].E+stock[skill].M+stock[skill].H:0;
    out[skill]=[0,Math.min(hi,have)];
  }
  return out;
}
function stockOf(pools){
  const stock={};
  for(const [skill,diffs] of Object.entries(pools)){
    stock[skill]={E:diffs.E.length,M:diffs.M.length,H:diffs.H.length};
  }
  return stock;
}
function openPools(all,used){
  const pools={};
  for(const skill of Object.keys(SKILL_DOMAIN)) pools[skill]={E:[],M:[],H:[]};
  for(const q of all){
    if(!q?.external_id||used.has(q.external_id)) continue;
    const skill=skillKey(q);
    if(!pools[skill]||!pools[skill][q.difficulty]) continue;
    pools[skill][q.difficulty].push(q);
  }
  return pools;
}
function compositions(count,stock,allowEasy){
  const out=[];
  const easyCap=allowEasy?Math.min(count,stock.E||0):0;
  for(let easy=0;easy<=easyCap;easy++){
    const mediumCap=Math.min(count-easy,stock.M||0);
    for(let medium=0;medium<=mediumCap;medium++){
      const hard=count-easy-medium;
      if(hard<=(stock.H||0)) out.push({E:easy,M:medium,H:hard});
    }
  }
  return out;
}
function planExact(counts,budget,stock,moduleKey,rng){
  const skills=shuffle(Object.keys(counts).filter(skill=>counts[skill]>0),rng);
  if(moduleKey==='m2') skills.sort((a,b)=>Number(b==='wic'||b==='evidence')-Number(a==='wic'||a==='evidence'));
  const options={};
  for(const skill of skills){
    let choices=compositions(counts[skill],stock[skill]||{},true);
    if(moduleKey==='m2' && (skill==='wic'||skill==='evidence')){
      const mostly=choices.filter(choice=>choice.E+choice.M<=1);
      if(mostly.length) choices=mostly;
      choices.sort((a,b)=>b.H-a.H);
    }else{
      choices=shuffle(choices,rng);
    }
    options[skill]=choices;
    if(!options[skill].length) return null;
  }
  const plan={};
  let nodes=0;
  function search(index,need){
    if(need.E<0||need.M<0||need.H<0) return false;
    if(index===skills.length) return need.E===0&&need.M===0&&need.H===0;
    if(++nodes>100000) return false;
    const skill=skills[index];
    for(const choice of options[skill]){
      if(choice.E>need.E||choice.M>need.M||choice.H>need.H) continue;
      plan[skill]=choice;
      if(search(index+1,{E:need.E-choice.E,M:need.M-choice.M,H:need.H-choice.H})) return true;
    }
    return false;
  }
  return search(0,{...budget})?plan:null;
}
function planDifficulties(counts,budget,stock,moduleKey,rng){
  const plan={};
  for(const skill of Object.keys(counts)) plan[skill]={E:0,M:0,H:0};
  const need={...budget};
  function place(skill,diff,n){
    const filled=plan[skill].E+plan[skill].M+plan[skill].H;
    const room=Math.min(n,counts[skill]-filled,(stock[skill]?.[diff]||0)-plan[skill][diff],need[diff]);
    if(room<=0) return 0;
    plan[skill][diff]+=room;
    need[diff]-=room;
    return room;
  }
  if(moduleKey==='m2'){
    for(const skill of ['wic','evidence']) place(skill,'H',counts[skill]||0);
  }
  const diffs=['H','M','E'];
  for(const diff of diffs){
    let guard=0;
    while(need[diff]>0 && guard++<200){
      const options=Object.keys(counts).filter(skill=>{
        const filled=plan[skill].E+plan[skill].M+plan[skill].H;
        if(filled>=counts[skill]) return false;
        if(plan[skill][diff]>=(stock[skill]?.[diff]||0)) return false;
        if(moduleKey==='m2' && (skill==='wic'||skill==='evidence') && diff!=='H' && plan[skill].E+plan[skill].M>=1) return false;
        return true;
      });
      if(!options.length) break;
      place(options[Math.floor(rng()*options.length)],diff,1);
    }
  }
  for(const skill of Object.keys(counts)){
    let filled=plan[skill].E+plan[skill].M+plan[skill].H;
    while(filled<counts[skill]){
      const diff=['M','H','E'].find(d=>(stock[skill]?.[d]||0)>plan[skill][d]);
      if(!diff) break;
      plan[skill][diff]++;
      filled++;
    }
  }
  return plan;
}
function nearestDiffs(target){
  if(target==='E') return ['E','M','H'];
  if(target==='H') return ['H','M','E'];
  return ['M','E','H'];
}
function takeQuestion(pool,used,rng){
  const open=(pool||[]).filter(q=>q?.external_id&&!used.has(q.external_id));
  if(!open.length) return null;
  const q=open[Math.floor(rng()*open.length)];
  used.add(q.external_id);
  return q;
}
function pickQuestion(pools,all,skill,diff,used,rng,warnings){
  const domain=SKILL_DOMAIN[skill];
  for(const candidate of nearestDiffs(diff)){
    const q=takeQuestion(pools[skill]?.[candidate],used,rng);
    if(!q) continue;
    if(candidate!==diff) warnings.push(`Same skill, nearest difficulty for ${skill}/${diff}: used ${candidate}.`);
    return q;
  }
  for(const candidate of nearestDiffs(diff)){
    const pool=all.filter(q=>q.primary_class_cd===domain&&q.difficulty===candidate&&skillKey(q)!==skill);
    const q=takeQuestion(pool,used,rng);
    if(!q) continue;
    warnings.push(`Fallback for ${skill}/${diff}: same domain ${domain}, ${q.difficulty}, skill ${skillKey(q)}.`);
    return q;
  }
  return null;
}
function rebalance(selected,pools,budget,used,rng,warnings,moduleKey){
  const order=['E','M','H'];
  for(let guard=0;guard<40;guard++){
    const have={E:0,M:0,H:0};
    selected.forEach(q=>{ if(have[q.difficulty]!=null) have[q.difficulty]++; });
    const extra=order.filter(diff=>have[diff]>budget[diff]);
    const short=order.filter(diff=>have[diff]<budget[diff]);
    if(!extra.length||!short.length) return have.E===budget.E&&have.M===budget.M&&have.H===budget.H;
    const candidates=shuffle(selected.map((q,index)=>({q,index})).filter(row=>extra.includes(row.q.difficulty)),rng);
    if(moduleKey==='m2') candidates.sort((a,b)=>Number(skillKey(a.q)==='wic'||skillKey(a.q)==='evidence')-Number(skillKey(b.q)==='wic'||skillKey(b.q)==='evidence'));
    let swapped=false;
    for(const row of candidates){
      for(const want of short){
        const next=takeQuestion(pools[skillKey(row.q)]?.[want],used,rng);
        if(!next) continue;
        used.delete(row.q.external_id);
        selected[row.index]=next;
        warnings.push(`Rebalanced ${skillKey(row.q)} from ${row.q.difficulty} to ${want}.`);
        swapped=true;
        break;
      }
      if(swapped) break;
    }
    if(!swapped) return false;
  }
  return false;
}
function orderRwModule(questions,rng){
  const of=skill=>shuffle(questions.filter(q=>skillKey(q)===skill),rng);
  const known=new Set(Object.keys(SKILL_DOMAIN));
  return [
    ...of('wic'),
    ...of('tsp'),
    ...of('cross'),
    ...shuffle(questions.filter(q=>skillKey(q)==='central'||skillKey(q)==='evidence'),rng),
    ...of('inference'),
    ...shuffle(questions.filter(q=>skillKey(q)==='boundaries'||skillKey(q)==='fss'),rng),
    ...of('transitions'),
    ...of('synthesis'),
    ...shuffle(questions.filter(q=>!known.has(skillKey(q))),rng)
  ];
}
function diffCode(q){
  const d=q.difficultyCode||q.difficulty||'';
  if(d==='Easy'||d==='E') return 'E';
  if(d==='Medium'||d==='M') return 'M';
  if(d==='Hard'||d==='H') return 'H';
  return '';
}
function describeMix(list){
  const names={wic:'WIC',tsp:'TSP',cross:'CTC',central:'CID',evidence:'COE',inference:'INF',boundaries:'BOU',fss:'FSS',transitions:'TRA',synthesis:'SYN'};
  const counts={}, diff={E:0,M:0,H:0};
  for(const q of list){
    const skill=skillKey(q);
    counts[skill]=(counts[skill]||0)+1;
    const code=diffCode(q);
    if(diff[code]!=null) diff[code]++;
  }
  const parts=Object.keys(names).filter(skill=>counts[skill]).map(skill=>`${names[skill]} ${counts[skill]}`);
  return `${parts.join(', ')} · ${diff.E} easy, ${diff.M} medium, ${diff.H} hard`;
}
function chooseRwPlan(ranges,stock,moduleKey,budget,rng){
  for(let attempt=0;attempt<40;attempt++){
    const counts=sampleCounts(ranges,27,rng);
    if(!counts) continue;
    const plan=planExact(counts,budget,stock,moduleKey,rng);
    if(plan) return {counts,plan};
  }
  return null;
}
function drawRwModule(all,moduleKey,lock,used,rng,warnings,budget){
  const pools=openPools(all,used);
  const stock=stockOf(pools);
  const label=moduleKey==='m1'?'module 1':'module 2';
  const moduleBudget=budget[moduleKey];
  let ranges=rangedSkills(RW_RANGES[moduleKey],stock,lock);
  let chosen=chooseRwPlan(ranges,stock,moduleKey,moduleBudget,rng);
  if(!chosen){
    ranges=relaxedSkills(RW_RANGES[moduleKey],stock,lock);
    chosen=chooseRwPlan(ranges,stock,moduleKey,moduleBudget,rng);
    if(chosen) warnings.push(`Relaxed ${label} skill minimums to fit the remaining bank.`);
  }
  let counts, plan;
  if(chosen){
    counts=chosen.counts;
    plan=chosen.plan;
  }else{
    counts=sampleCounts(ranges,27,rng);
    if(!counts) throw new Error(`Not enough unused Reading and Writing questions to fill ${label}.`);
    plan=planDifficulties(counts,moduleBudget,stock,moduleKey,rng);
    warnings.push(`Could not match the ${label} difficulty budget exactly. Used the nearest available mix.`);
  }
  const selected=[];
  for(const skill of Object.keys(counts)){
    const diffs=[];
    for(const diff of ['E','M','H']) for(let i=0;i<(plan[skill]?.[diff]||0);i++) diffs.push(diff);
    while(diffs.length<counts[skill]) diffs.push(moduleKey==='m2'?'H':'M');
    for(const diff of shuffle(diffs,rng)){
      const q=pickQuestion(pools,all,skill,diff,used,rng,warnings);
      if(!q) throw new Error(`Not enough unused questions to fill ${skill}/${diff}. Reset history or allow previously generated items.`);
      selected.push(q);
    }
  }
  rebalance(selected,openPools(all,used),moduleBudget,used,rng,warnings,moduleKey);
  return orderRwModule(selected,rng);
}
function pickRwModules(all,used,rng,warnings,budget){
  const pools=openPools(all,used);
  const crossLeft=(pools.cross?.E.length||0)+(pools.cross?.M.length||0)+(pools.cross?.H.length||0);
  const crossModule=crossLeft>0?(rng()<0.5?'m1':'m2'):null;
  if(!crossModule) warnings.push('No unused cross-text question. This mock has none.');
  const chosen=budget||rwBudget('next');
  const m1=drawRwModule(all,'m1',{cross:crossModule==='m1'?1:0},used,rng,warnings,chosen);
  const m2=drawRwModule(all,'m2',{cross:crossModule==='m2'?1:0},used,rng,warnings,chosen);
  return {m1,m2};
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
    stimulus:fixMathHtml(first(detail,['stimulus','passage','scenario'])), prompt:fixMathHtml(first(detail,['stem','body','prompt'])),
    answerOptions:opts.map((o,i)=>({letter:String.fromCharCode(65+i),content:fixMathHtml(String(o?.content||''))})),
    correctAnswers:correct(detail), rationale:fixMathHtml(String(detail.rationale||''))
  };
}
function first(o,keys){for(const k of keys){if(typeof o?.[k]==='string'&&o[k].trim())return o[k];}return '';}
function safeJson(x){return JSON.stringify(x).replace(/<\/script/gi,'<\\/script');}

async function timedHtml(payload){
  const [html,css,math,js]=await Promise.all([
    fetch(chrome.runtime.getURL('mock.html')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('mock.css')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('mathml.js')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('mock.js')).then(r=>r.text())
  ]);
  const data=safeJson(fixMockMath(payload));
  const state=payload?.savedState ? safeJson(payload.savedState) : 'null';
  let out=html.replace(/<link rel="stylesheet" href="mock\.css">\s*/,'<style>\n'+css+'\n</style>\n');
  const scripts=(math+'\n'+js).replace(/<\/script/gi,'<\\/script');
  const marker=/<script id="STATE" type="application\/json">null<\/script>\s*<script src="mathml\.js"><\/script>\s*<script src="mock\.js"><\/script>/;
  if(!marker.test(out)) throw new Error('Mock şablonu eşleşmedi.');
  out=out.replace(marker,'<script id="DATA" type="application/json">'+data+'</script>\n<script id="STATE" type="application/json">'+state+'</script>\n<script>\n'+scripts+'\n</script>');
  return out;
}

async function stageHtml(filename, html){
  try{
    await chrome.storage.local.set({[EXPORT_KEY]:{filename, html, at:Date.now()}});
  }catch(e){
    throw new Error('HTML dosyası hazırlanamadı. '+(e.message||e));
  }
  return {ok:true, filename, staged:true};
}

function localStamp(){
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function downloadCurrentMock(){
  const s=await chrome.storage.local.get(CURRENT_MOCK_KEY);
  const cur=s[CURRENT_MOCK_KEY];
  if(!cur?.m1?.length||!cur?.m2?.length) throw new Error('Henüz deneme yok. Önce bir deneme oluştur.');
  const filename=cur.filename||`SAT_${(cur.section||'rw').toUpperCase()}_Mock_${cur.stamp||localStamp()}.html`;
  await stageHtml(filename,await timedHtml(cur));
  return {ok:true,filename,staged:true,module1:cur.m1.length,module2:cur.m2.length};
}

async function downloadFinishedHtml(state){
  const s=await chrome.storage.local.get(CURRENT_MOCK_KEY);
  const cur=s[CURRENT_MOCK_KEY];
  if(!cur?.m1?.length||!cur?.m2?.length) throw new Error('Açık deneme bulunamadı.');
  const savedState={
    phase:'results',
    finishedAt:state.finishedAt||new Date().toISOString(),
    answers:state.answers||{},
    flagged:state.flagged||{},
    times:state.times||{}
  };
  const payload={...cur, savedState};
  await chrome.storage.local.set({[CURRENT_MOCK_KEY]:payload});
  const filename=payload.filename||`SAT_${(payload.section||'rw').toUpperCase()}_Mock_${payload.stamp||localStamp()}.html`;
  await stageHtml(filename, await timedHtml(payload));
  await chrome.tabs.create({url:chrome.runtime.getURL('export.html')});
  return {ok:true, filename};
}

async function buildMock(options,action='open'){
  const sectionKey=options.section==='math'?'math':'rw';
  const spec=SECTION[sectionKey];
  const s=await chrome.storage.local.get([AUTH_KEY,HISTORY_KEY]); const auth=s[AUTH_KEY];
  if(!auth?.authenticationToken||!auth?.authorizationToken) throw new Error('College Board oturumu yok. Eklenti penceresinden yeniden bağlan.');
  if(!auth.capturedAt || Date.now()-auth.capturedAt>2*60*60*1000){
    await chrome.storage.local.remove(AUTH_KEY);
    throw new Error('Oturum 2 saatten eski. Eklenti penceresinden yeniden bağlan.');
  }
  const warnings=[];
  let metadata=await firstWorking(spec.tests,test=>apiPost('/get-questions',{asmtEventId:99,test,domain:spec.domains},auth));
  const seen=new Set(); metadata=metadata.filter(q=>q?.external_id&&!seen.has(q.external_id)&&(seen.add(q.external_id),true));
  if(options.excludeActive!==false){
    const live=await firstWorking(spec.live,section=>apiPost('/live-items',{section},auth));
    const ls=new Set(live.map(String)); metadata=metadata.filter(q=>!ls.has(String(q.external_id)));
  }

  const usedIds=new Set(options.avoidHistory===false?[]:(s[HISTORY_KEY]||[]));
  const rng=seeded(options.seed||'');
  const used=new Set(usedIds);
  let m1meta, m2meta;
  if(sectionKey==='math'){
    m1meta=pickDomainDiff(metadata,MATH_BP1,used,rng,warnings,spec.domainOrder);
    m2meta=pickDomainDiff(metadata,MATH_BP2,used,rng,warnings,spec.domainOrder);
  }else{
    const rw=pickRwModules(metadata,used,rng,warnings,rwBudget(options.difficulty));
    m1meta=rw.m1;
    m2meta=rw.m2;
  }
  const selected=[...m1meta,...m2meta];
  const details=await fetchDetails(selected.map(q=>q.external_id),auth);
  const dm=new Map(details.map(d=>[String(d.externalid||d.external_id),d]));
  const normQ=arr=>arr.map(m=>qNorm(m,dm.get(String(m.external_id))||{}));
  const m1=normQ(m1meta), m2=normQ(m2meta);

  if(options.avoidHistory!==false){
    const h=[...usedIds,...m1.concat(m2).map(x=>x.externalId).filter(Boolean)];
    await chrome.storage.local.set({[HISTORY_KEY]:[...new Set(h)].slice(-1200)});
  }
  const stamp=localStamp();
  const filename=`SAT_${sectionKey.toUpperCase()}_Mock_${stamp}.html`;
  const payload={
    section:sectionKey,
    createdAt:new Date().toISOString(),
    stamp,
    filename,
    studentName:String(options.studentName||'').trim(),
    m1,m2,
    seconds:spec.seconds
  };
  await chrome.storage.local.set({[CURRENT_MOCK_KEY]:payload});
  if(action==='download') await stageHtml(filename, await timedHtml(payload));
  else await chrome.tabs.create({url:chrome.runtime.getURL('mock.html')});
  return {ok:true,action,filename,staged:action==='download',module1:m1.length,module2:m2.length,mix1:sectionKey==='rw'?describeMix(m1):'',mix2:sectionKey==='rw'?describeMix(m2):'',warnings:[...new Set(warnings)]};
}

