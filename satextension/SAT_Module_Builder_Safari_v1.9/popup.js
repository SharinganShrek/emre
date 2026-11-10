const $ = s => document.querySelector(s);
const statusEl=$('#status'), dot=$('#dot'), build=$('#build'), buildDownload=$('#buildDownload'), downloadCurrent=$('#downloadCurrent'), log=$('#log');
const EXPORT_KEY='satSafari.exportHtml';

function setStatus(ok,text,hasCurrent=false){statusEl.textContent=text;dot.className='dot '+(ok?'ok':'bad');build.disabled=!ok;buildDownload.disabled=!ok;downloadCurrent.disabled=!hasCurrent;}
function write(msg){ log.textContent += (log.textContent?'\n':'') + msg; log.scrollTop=log.scrollHeight; }
function setProgress(v){ $('#progress').hidden=false; $('#bar').style.width=Math.max(0,Math.min(100,v))+'%'; }
function section(){ return document.querySelector('input[name="section"]:checked')?.value || 'rw'; }
function difficulty(){ return document.querySelector('input[name="difficulty"]:checked')?.value || 'next'; }
function syncDifficulty(){ $('#rwDifficulty').hidden = section()==='math'; }
document.querySelectorAll('input[name="section"]').forEach(el=>el.addEventListener('change', syncDifficulty));
syncDifficulty();

function saveFile(filename, html){
  const blob=new Blob([html],{type:'application/octet-stream'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

async function takeStagedDownload(){
  const bag=await chrome.storage.local.get(EXPORT_KEY);
  const file=bag[EXPORT_KEY];
  if(!file?.html || !file.filename) throw new Error('HTML dosyası hazırlanamadı.');
  saveFile(file.filename, file.html);
  await chrome.storage.local.remove(EXPORT_KEY);
  return file.filename;
}

async function refresh(){
  const r = await chrome.runtime.sendMessage({type:'status'}).catch(()=>null);
  if(r?.hasAuth){
    const mins = r.authAgeMs==null ? null : Math.max(0,Math.round(r.authAgeMs/60000));
    setStatus(true,`College Board oturumu hazır${mins!=null?` (${mins} dk)`:''}${r.source?` · ${r.source}`:''}.`,!!r.hasCurrentMock);
  } else setStatus(false,'Oturum yok. College Board’a yeniden bağlan.',!!r?.hasCurrentMock);
}
refresh();

$('#reconnect').addEventListener('click', async ()=>{
  const btn=$('#reconnect'); btn.disabled=true; build.disabled=true; buildDownload.disabled=true; log.textContent='';
  write('Soru bankası yenileniyor, oturum aranıyor…');
  try{
    const r=await chrome.runtime.sendMessage({type:'reconnect'});
    if(!r?.ok) throw new Error(r?.error||'Oturum yakalanamadı');
    write(`Oturum hazır (${r.source||'tarayıcı'}).`);
  }catch(e){ write('HATA: '+e.message); }
  finally{ btn.disabled=false; await refresh(); }
});

async function buildAction(action){
  build.disabled=true; buildDownload.disabled=true; log.textContent=''; setProgress(3); write('Başlatılıyor…');
  const options={
    section: section(),
    excludeActive: $('#excludeActive').checked,
    avoidHistory: $('#avoidHistory').checked,
    seed: $('#seed').value.trim(),
    difficulty: difficulty(),
    studentName: $('#studentName').value.trim()
  };
  try{
    const r=await chrome.runtime.sendMessage({type:'buildMock',options,action});
    if(!r?.ok) throw new Error(r?.error||'Bilinmeyen hata');
    setProgress(100);
    write(`Modül 1: ${r.module1} soru`);
    write(`Zor Modül 2: ${r.module2} soru`);
    if(r.mix1) write(`Modül 1 dağılımı: ${r.mix1}`);
    if(r.mix2) write(`Modül 2 dağılımı: ${r.mix2}`);
    if(r.warnings?.length) r.warnings.forEach(x=>write('Uyarı: '+x));
    if(action==='download'){
      const filename=await takeStagedDownload();
      write('HTML indirildi: '+filename);
      write('Bu dosyayı Safari’de aç. Bitince inen yeni kopyayı sakla; onu açınca sonuç ekranı gelir.');
    } else {
      write('Deneme yeni sekmede açıldı. Bitince kayıt sekmesinden HTML’i indir.');
    }
  }catch(e){write('HATA: '+e.message);}
  finally{await refresh();}
}

build.addEventListener('click',()=>buildAction('open'));
buildDownload.addEventListener('click',()=>buildAction('download'));

downloadCurrent.addEventListener('click',async()=>{
  downloadCurrent.disabled=true; log.textContent='';
  try{
    const r=await chrome.runtime.sendMessage({type:'downloadCurrentMock'});
    if(!r?.ok) throw new Error(r?.error||'Bilinmeyen hata');
    const filename=await takeStagedDownload();
    write('Son deneme indirildi: '+filename);
  }catch(e){write('HATA: '+e.message);}
  finally{await refresh();}
});

$('#reset').addEventListener('click', async ()=>{
  await chrome.runtime.sendMessage({type:'resetHistory'});
  log.textContent='Bu eklentideki soru geçmişi silindi.';
});
