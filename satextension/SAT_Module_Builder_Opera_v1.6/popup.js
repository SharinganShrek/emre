const $ = s => document.querySelector(s);
const statusEl=$('#status'), dot=$('#dot'), build=$('#build'), buildDownload=$('#buildDownload'), downloadCurrent=$('#downloadCurrent'), importBluebook=$('#importBluebook'), log=$('#log');
const APP_KEY='satBuilder.app';

function setStatus(ok,text,hasCurrent=false){statusEl.textContent=text;dot.className='dot '+(ok?'ok':'bad');build.disabled=!ok;buildDownload.disabled=!ok;downloadCurrent.disabled=!hasCurrent;}
function write(msg){ log.textContent += (log.textContent?'\n':'') + msg; log.scrollTop=log.scrollHeight; }
function setProgress(v){ $('#progress').hidden=false; $('#bar').style.width=Math.max(0,Math.min(100,v))+'%'; }
function section(){ return document.querySelector('input[name="section"]:checked')?.value || 'rw'; }

async function loadApp(){
  const s=await chrome.storage.local.get(APP_KEY);
  const app=s[APP_KEY]||{};
  $('#appOrigin').value=app.origin||'https://emre-xi.vercel.app';
  $('#appToken').value=app.token||'';
  $('#appStatus').textContent=app.token?'Connect token saved.':'No connect token yet — generate one on the SAT Practice page.';
}

async function refresh(){
  const r = await chrome.runtime.sendMessage({type:'status'}).catch(()=>null);
  if(r?.hasAuth){
    const mins = r.authAgeMs==null ? null : Math.max(0,Math.round(r.authAgeMs/60000));
    setStatus(true,`College Board session captured${mins!=null?` (${mins} min old)`:''}${r.source?` via ${r.source}`:''} — ready.`,!!r.hasCurrentMock);
  } else setStatus(false,'No fresh College Board session captured. Click Reconnect College Board.',!!r?.hasCurrentMock);
}
loadApp();
refresh();

$('#saveApp').addEventListener('click', async ()=>{
  const origin=$('#appOrigin').value.trim().replace(/\/$/,'');
  const token=$('#appToken').value.trim();
  await chrome.storage.local.set({[APP_KEY]:{origin,token}});
  const r=await chrome.runtime.sendMessage({type:'testApp'}).catch(e=>({ok:false,error:e.message}));
  $('#appStatus').textContent=r?.ok?`Connected. ${r.external_ids||0} used IDs, ${r.content_hashes||0} content hashes.`:(r?.error||'Could not reach Emre OS');
});

$('#reconnect').addEventListener('click', async ()=>{
  const btn=$('#reconnect'); btn.disabled=true; build.disabled=true; buildDownload.disabled=true; log.textContent='';
  write('Hard-reloading Student Question Bank and capturing a fresh session…');
  try{
    const r=await chrome.runtime.sendMessage({type:'reconnect'});
    if(!r?.ok) throw new Error(r?.error||'Could not capture session');
    write(`Session captured via ${r.source||'browser'} — ready.`);
  }catch(e){ write('ERROR: '+e.message); }
  finally{ btn.disabled=false; await refresh(); }
});

async function buildAction(action){
  build.disabled=true; buildDownload.disabled=true; log.textContent=''; setProgress(3); write('Starting…');
  const options={
    section: section(),
    excludeActive: $('#excludeActive').checked,
    avoidHistory: $('#avoidHistory').checked,
    seed: $('#seed').value.trim()
  };
  try{
    const r=await chrome.runtime.sendMessage({type:'buildMock',options,action});
    if(!r?.ok) throw new Error(r?.error||'Unknown error');
    setProgress(100);
    write(`Done. Module 1: ${r.module1} questions`);
    write(`Hard Module 2: ${r.module2} questions`);
    if(r.title) write(`Saved to Emre OS as ${r.title}`);
    if(r.warnings?.length) r.warnings.forEach(x=>write('Warning: '+x));
    if(action==='download') write(`Downloaded standalone HTML: ${r.filename}`);
    else write('Opened the timed mock in a new tab.');
  }catch(e){write('ERROR: '+e.message);}
  finally{await refresh();}
}

build.addEventListener('click',()=>buildAction('open'));
buildDownload.addEventListener('click',()=>buildAction('download'));

downloadCurrent.addEventListener('click',async()=>{
  downloadCurrent.disabled=true; log.textContent='';
  try{
    const r=await chrome.runtime.sendMessage({type:'downloadCurrentMock'});
    if(!r?.ok) throw new Error(r?.error||'Unknown error');
    write(`Downloaded exact current mock: ${r.filename}`);
  }catch(e){write('ERROR: '+e.message);}
  finally{await refresh();}
});

importBluebook.addEventListener('click',async()=>{
  importBluebook.disabled=true; build.disabled=true; buildDownload.disabled=true; log.textContent='';
  write('Importing official Bluebook tests from My Practice…');
  try{
    const r=await chrome.runtime.sendMessage({type:'importBluebook'});
    if(!r?.ok) throw new Error(r?.error||'Unknown error');
    if(r.imported?.length) r.imported.forEach(x=>write('Imported: '+x));
    else write('No new SAT practice tests imported.');
    if(r.skipped?.length) r.skipped.forEach(x=>write('Skipped: '+x));
    if(r.warnings?.length) r.warnings.forEach(x=>write('Warning: '+x));
    write('Open Emre OS → SAT Practice to review official scores.');
  }catch(e){write('ERROR: '+e.message);}
  finally{importBluebook.disabled=false; await refresh();}
});

$('#reset').addEventListener('click', async ()=>{
  await chrome.runtime.sendMessage({type:'resetHistory'});
  log.textContent='Local question history reset. Emre OS used-question list is unchanged.';
});
