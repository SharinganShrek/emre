const EXPORT_KEY='satSafari.exportHtml';
const $ = s => document.querySelector(s);

function saveFile(filename, html){
  const blob=new Blob([html],{type:'application/octet-stream'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

chrome.storage.local.get(EXPORT_KEY).then(bag=>{
  const file=bag[EXPORT_KEY];
  if(!file?.html || !file.filename){
    $('#lead').textContent='Kaydedilecek dosya yok. Denemeyi yeniden oluştur.';
    return;
  }
  $('#lead').textContent='Deneme bittiyse bu dosyayı tekrar açınca sonuç ekranı gelir. İlk indirdiğin dosya denemeyi baştan başlatır.';
  $('#name').textContent=file.filename;
  $('#save').disabled=false;
  $('#save').onclick=()=>{
    saveFile(file.filename, file.html);
    $('#msg').textContent='İndirildi: '+file.filename;
  };
});
