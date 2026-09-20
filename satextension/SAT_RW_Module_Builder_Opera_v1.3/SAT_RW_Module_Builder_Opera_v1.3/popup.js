const $ = s => document.querySelector(s);
const statusEl = $('#status'), dot = $('#dot'), build = $('#build'), log = $('#log');

function setStatus(ok, text){ statusEl.textContent=text; dot.className='dot '+(ok?'ok':'bad'); build.disabled=!ok; }
function write(msg){ log.textContent += (log.textContent?'\n':'') + msg; log.scrollTop=log.scrollHeight; }
function setProgress(v){ $('#progress').hidden=false; $('#bar').style.width=Math.max(0,Math.min(100,v))+'%'; }

async function refresh(){
  const r = await chrome.runtime.sendMessage({type:'status'}).catch(()=>null);
  if(r?.hasAuth){
    const mins = r.authAgeMs==null ? null : Math.max(0,Math.round(r.authAgeMs/60000));
    setStatus(true,`College Board session captured${mins!=null?` (${mins} min old)`:''}${r.source?` via ${r.source}`:''} — ready.`);
  } else setStatus(false,'No fresh College Board session captured. Click Reconnect College Board.');
}
refresh();


$('#reconnect').addEventListener('click', async ()=>{
  const btn=$('#reconnect'); btn.disabled=true; build.disabled=true; log.textContent='';
  write('Hard-reloading Student Question Bank and capturing a fresh session…');
  try{
    const r=await chrome.runtime.sendMessage({type:'reconnect'});
    if(!r?.ok) throw new Error(r?.error||'Could not capture session');
    write(`Session captured via ${r.source||'browser'} — ready.`);
  }catch(e){ write('ERROR: '+e.message); }
  finally{ btn.disabled=false; await refresh(); }
});

build.addEventListener('click', async ()=>{
  build.disabled=true; log.textContent=''; setProgress(3); write('Starting…');
  const options={
    excludeActive: $('#excludeActive').checked,
    avoidHistory: $('#avoidHistory').checked,
    seed: $('#seed').value.trim()
  };
  try{
    const r = await chrome.runtime.sendMessage({type:'buildMock', options});
    if(!r?.ok) throw new Error(r?.error || 'Unknown error');
    setProgress(100);
    write(`Done. Module 1: ${r.module1} questions`);
    write(`Hard Module 2: ${r.module2} questions`);
    if(r.warnings?.length) r.warnings.forEach(x=>write('Warning: '+x));
    write('Opened the timed mock in a new tab. No JSON files are downloaded.');
  }catch(e){ write('ERROR: '+e.message); await refresh(); }
  finally{ await refresh(); }
});

$('#reset').addEventListener('click', async ()=>{
  await chrome.runtime.sendMessage({type:'resetHistory'});
  log.textContent='Question history reset.';
});