const $ = s => document.querySelector(s);
const statusEl=$('#status'), dot=$('#dot'), build=$('#build'), buildDownload=$('#buildDownload'), downloadCurrent=$('#downloadCurrent'), log=$('#log');

function setStatus(ok,text,hasCurrent=false){statusEl.textContent=text;dot.className='dot '+(ok?'ok':'bad');build.disabled=!ok;buildDownload.disabled=!ok;downloadCurrent.disabled=!hasCurrent;}
function write(msg){ log.textContent += (log.textContent?'\n':'') + msg; log.scrollTop=log.scrollHeight; }
function setProgress(v){ $('#progress').hidden=false; $('#bar').style.width=Math.max(0,Math.min(100,v))+'%'; }

async function refresh(){
  const r = await chrome.runtime.sendMessage({type:'status'}).catch(()=>null);
  if(r?.hasAuth){
    const mins = r.authAgeMs==null ? null : Math.max(0,Math.round(r.authAgeMs/60000));
    setStatus(true,`College Board session captured${mins!=null?` (${mins} min old)`:''}${r.source?` via ${r.source}`:''} — ready.`,!!r.hasCurrentMock);
  } else setStatus(false,'No fresh College Board session captured. Click Reconnect College Board.',!!r?.hasCurrentMock);
}
refresh();


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
    if(r.warnings?.length) r.warnings.forEach(x=>write('Warning: '+x));
    if(action==='download') write(`Downloaded standalone HTML: ${r.filename}`);
    else write('Opened the timed mock in a new tab. Use “Download Current Mock HTML” to save this exact set.');
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

$('#reset').addEventListener('click', async ()=>{
  await chrome.runtime.sendMessage({type:'resetHistory'});
  log.textContent='Question history reset.';
});