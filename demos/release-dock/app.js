const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
let state;
const labels={planned:'Запланирован',building:'Сборка',healthy:'Проверен',promoted:'Активен',failed:'Ошибка',rolled_back:'Rollback'};
const railProgress={planned:-1,building:0,healthy:1,promoted:2,rolled_back:3,failed:0};

function render(){
  const report=state.verification,ready=Boolean(report?.ready);
  document.body.dataset.releaseStatus=state.release.status;
  document.body.dataset.ready=String(ready);
  $('#topState').textContent=ready?'VERIFIED LOCALLY':'REPORT INCOMPLETE';
  $('#proofCode').textContent=ready?'READY':'VERIFY';
  $('#proofTitle').textContent=ready?'Локальный выпуск проверен':'Отчёт выпуска неполный';
  $('#proofNote').textContent=ready?`Проверено ${new Date(report.verifiedAt).toLocaleString('ru-RU')}`:'Запустите backup и verify после старта контейнера.';
  $('#proofStamp').dataset.ready=String(ready);
  $('#proofStamp b').textContent=`${state.container.passed}/${state.container.total}`;
  $('#environment').textContent=state.release.environment;
  $('#version').textContent=state.release.version;
  $('#revision').textContent=state.stateFile.revision;
  $('#gates').innerHTML=state.container.gates.map((gate,index)=>`<article class="${gate.pass?'pass':'fail'}"><span>${String(index+1).padStart(2,'0')}</span><b>${gate.label}</b><i aria-label="${gate.pass?'Проверка пройдена':'Проверка не пройдена'}">${gate.pass?'PASS':'FAIL'}</i></article>`).join('');
  const evidence=[['HEALTH ENDPOINT',report?.health?.ok?'HTTP 200':'not verified',report?.health?.ok],['BACKUP COPY',report?.backup?.valid?'hash match':'not verified',report?.backup?.valid],['RELEASE CONFIG',report?.config?.valid?'valid':'not verified',report?.config?.valid],['FINAL DECISION',ready?'ready':'incomplete',ready]];
  $('#evidence').innerHTML=evidence.map(([label,value,pass])=>`<article class="${pass?'pass':'fail'}"><span>${label}</span><b>${value}</b><i aria-hidden="true"></i></article>`).join('');
  renderRunbook();renderBackup();
}

function renderRunbook(){
  $('#releaseStatus').textContent=`${state.release.status.toUpperCase()} · ${labels[state.release.status]}`;
  const allowed={planned:['build'],building:['health'],healthy:['promote'],promoted:['rollback'],rolled_back:['build'],failed:['build']}[state.release.status]??[];
  $$('.runbook-bar button').forEach(button=>button.disabled=!allowed.includes(button.dataset.action));
  const progress=railProgress[state.release.status]??-1;
  $$('[data-rail]').forEach((item,index)=>{
    item.classList.toggle('is-current',index===progress);
    item.classList.toggle('is-complete',index<progress||(state.release.status==='rolled_back'&&index===progress));
    item.setAttribute('aria-current',index===progress?'step':'false');
  });
  $('#releaseEvents').innerHTML=[...state.release.events].reverse().map(event=>`<article><i class="${event.status}" aria-hidden="true"></i><span>${event.status}</span><b>${event.note}</b><time>${new Date(event.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></article>`).join('');
}

function renderBackup(){
  $('#stateFile').textContent=`state.json · revision ${state.stateFile.revision}`;
  $('#stateNote').textContent=state.stateFile.note??'—';
  const report=state.backup.report;
  $('#backupName').textContent=report?.backupName??'Backup not run';
  $('#backupHash').textContent=report?.manifest?.sha256??'—';
  $('#backupBytes').textContent=report?.manifest?.bytes??'—';
  $('#backupVerification').textContent=state.backup.valid?'MATCH':state.backup.reason;
}

async function action(name,button){
  $$('button[data-action]').forEach(item=>item.disabled=true);
  try{
    const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:name})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error);
    state=data.state;render();notify(data.result.title);
  }catch(error){notify(error.message)}finally{render();button?.blur()}
}

function notify(message){
  const toast=$('#toast');toast.textContent=message;toast.classList.add('show');
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2000);
}

$$('button[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action,button)));
state=await(await fetch('/api/state')).json();
render();
