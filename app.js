const DB_KEY = "presenca-gpe-db-v1";
const authKey = "presenca-gpe-auth";

const areas = [
  "Professor de Matemática","Professor de Português","Professor de História",
  "Professor de Geografia","Professor de Biologia","Professor de Física",
  "Professor de Química","Professor de Redação","Marketing e Comunicação",
  "Organização","Recepção","Apoio em sala","Coordenação","Fotografia","Outros"
];

const seed = {
  participants: [
    {id: crypto.randomUUID(), name:"Ana Souza", category:"Professor", area:"Professor de Matemática", phone:"", email:"", entryDate:"2026-02-01", status:"Ativo", notes:""},
    {id: crypto.randomUUID(), name:"Carlos Lima", category:"Voluntário", area:"Marketing e Comunicação", phone:"", email:"", entryDate:"2026-02-01", status:"Ativo", notes:""},
    {id: crypto.randomUUID(), name:"Mariana Alves", category:"Professor", area:"Professor de Redação", phone:"", email:"", entryDate:"2026-02-01", status:"Ativo", notes:""}
  ],
  meetings: [],
  attendance: {},
  audit: []
};

let db = loadDB();
let deferredPrompt = null;

function loadDB(){ try { return JSON.parse(localStorage.getItem(DB_KEY)) || structuredClone(seed); } catch { return structuredClone(seed); } }
function saveDB(){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function toast(msg){ const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200); }
function formatDate(date){ if(!date) return "-"; return new Date(date+"T12:00:00").toLocaleDateString("pt-BR"); }
function monthKey(date=new Date()){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function selectedMonth(id){ return document.getElementById(id).value || monthKey(); }
function getMonthMeetings(key){ return db.meetings.filter(m=>m.date.startsWith(key)); }
function activeParticipants(){ return db.participants.filter(p=>p.status==="Ativo"); }
function meetingAttendance(id){ return db.attendance[id] || {}; }

function setup(){
  document.getElementById("participantArea").innerHTML=areas.map(a=>`<option>${a}</option>`).join("");
  document.getElementById("todayText").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  document.getElementById("calendarMonth").value=monthKey();
  document.getElementById("reportMonth").value=monthKey();

  document.getElementById("loginForm").addEventListener("submit", e=>{
    e.preventDefault();
    const email=document.getElementById("loginEmail").value;
    const pwd=document.getElementById("loginPassword").value;
    if(email==="admin@gpe.org.br" && pwd==="123456"){
      localStorage.setItem(authKey,"1"); showApp(); toast("Login realizado com sucesso.");
    } else toast("E-mail ou senha inválidos.");
  });
  document.getElementById("logoutBtn").onclick=()=>{localStorage.removeItem(authKey);location.reload();};
  document.querySelectorAll(".nav-btn[data-page]").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
  document.querySelectorAll(".shortcut").forEach(b=>b.onclick=()=>navigate(b.dataset.target));
  document.getElementById("openParticipantModal").onclick=()=>openParticipant();
  document.getElementById("openMeetingModal").onclick=()=>openMeeting();
  document.querySelectorAll(".close-dialog").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  document.getElementById("participantForm").onsubmit=saveParticipant;
  document.getElementById("meetingForm").onsubmit=saveMeeting;
  ["participantSearch","participantCategoryFilter","participantStatusFilter"].forEach(id=>document.getElementById(id).oninput=renderParticipants);
  document.getElementById("suggestSaturdaysBtn").onclick=suggestSaturdays;
  document.getElementById("attendanceMeetingSelect").onchange=renderAttendance;
  document.getElementById("attendanceSearch").oninput=renderAttendance;
  document.getElementById("attendanceCategoryFilter").onchange=renderAttendance;
  document.getElementById("markAllPresentBtn").onclick=()=>bulkAttendance("Presente");
  document.getElementById("clearAttendanceBtn").onclick=()=>bulkAttendance("");
  document.getElementById("saveAttendanceBtn").onclick=saveAttendance;
  document.getElementById("calendarMonth").onchange=renderCalendar;
  document.getElementById("reportMonth").onchange=renderReports;
  document.getElementById("exportCsvBtn").onclick=exportCSV;
  document.getElementById("printBtn").onclick=()=>window.print();

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").classList.remove("hidden");});
  document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}};
  if("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
  if(localStorage.getItem(authKey)) showApp();
}
function showApp(){document.getElementById("loginView").classList.add("hidden");document.getElementById("appView").classList.remove("hidden");renderAll();}
function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===page));
  document.querySelectorAll(".nav-btn[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Painel",participants:"Participantes",meetings:"Encontros",attendance:"Registro de presença",calendar:"Calendário",reports:"Relatórios"};
  document.getElementById("pageTitle").textContent=titles[page];
  if(page==="attendance") renderAttendance();
  if(page==="calendar") renderCalendar();
  if(page==="reports") renderReports();
}
function renderAll(){renderDashboard();renderParticipants();renderMeetings();renderAttendanceOptions();renderAttendance();renderCalendar();renderReports();}

function renderDashboard(){
  const key=monthKey(), meetings=getMonthMeetings(key), realized=meetings.filter(m=>m.status==="Realizado");
  const prof=db.participants.filter(p=>p.category==="Professor"&&p.status==="Ativo").length;
  const vol=db.participants.filter(p=>p.category==="Voluntário"&&p.status==="Ativo").length;
  let pres=0, abs=0, counts={};
  realized.forEach(m=>Object.values(meetingAttendance(m.id)).forEach(r=>{
    if(r.status==="Presente"||r.status==="Atrasado"||r.status==="Saiu mais cedo"){pres++;counts[r.participantId]=(counts[r.participantId]||0)+1;}
    if(r.status==="Ausente") abs++;
  }));
  const topId=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const top=db.participants.find(p=>p.id===topId)?.name||"—";
  const stats=[
    ["Encontros realizados",realized.length],["Professores ativos",prof],["Voluntários ativos",vol],
    ["Presenças registradas",pres],["Média por sábado",realized.length?(pres/realized.length).toFixed(1):"0"],
    ["Maior participação",top],["Faltas no mês",abs]
  ];
  document.getElementById("statsGrid").innerHTML=stats.map(([l,v])=>`<div class="stat-card"><span>${l}</span><strong>${v}</strong></div>`).join("");
  const upcoming=[...db.meetings].filter(m=>new Date(m.date+"T23:59")>=new Date()&&m.status!=="Cancelado").sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  document.getElementById("upcomingMeetings").innerHTML=upcoming.length?upcoming.map(m=>`<div class="list-item"><div><strong>${m.theme}</strong><div class="muted">${formatDate(m.date)} • ${m.start||""}</div></div><span class="badge neutral">${m.status}</span></div>`).join(""):`<p class="muted">Nenhum encontro futuro cadastrado.</p>`;
  const alerts=[];
  meetings.filter(m=>m.status==="Realizado"&&!db.attendance[m.id]).forEach(m=>alerts.push(`Encontro de ${formatDate(m.date)} sem presença registrada.`));
  if(!activeParticipants().length) alerts.push("Nenhum participante ativo cadastrado.");
  document.getElementById("alertsList").innerHTML=alerts.length?alerts.map(a=>`<div class="list-item"><span>⚠️ ${a}</span></div>`).join(""):`<p class="muted">Nenhum alerta no momento.</p>`;
}

function renderParticipants(){
  const q=document.getElementById("participantSearch").value.toLowerCase(), cat=document.getElementById("participantCategoryFilter").value, st=document.getElementById("participantStatusFilter").value;
  const list=db.participants.filter(p=>(p.name.toLowerCase().includes(q)||p.area.toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!st||p.status===st));
  document.getElementById("participantsTable").innerHTML=`<table><thead><tr><th>Nome</th><th>Categoria</th><th>Área</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${p.name}</strong><div class="muted">${p.email||""}</div></td><td>${p.category}</td><td>${p.area}</td><td><span class="badge ${p.status==="Ativo"?"success":"neutral"}">${p.status}</span></td><td><div class="action-row"><button class="icon-btn" onclick="openParticipant('${p.id}')">✏️</button><button class="icon-btn" onclick="toggleParticipant('${p.id}')">${p.status==="Ativo"?"⏸️":"▶️"}</button><button class="icon-btn" onclick="deleteParticipant('${p.id}')">🗑️</button></div></td></tr>`).join("")||`<tr><td colspan="5">Nenhum participante encontrado.</td></tr>`}</tbody></table>`;
}
function openParticipant(id=""){
  const p=db.participants.find(x=>x.id===id);
  document.getElementById("participantModalTitle").textContent=p?"Editar participante":"Novo participante";
  document.getElementById("participantId").value=p?.id||"";
  document.getElementById("participantName").value=p?.name||"";
  document.getElementById("participantCategory").value=p?.category||"Professor";
  document.getElementById("participantArea").value=p?.area||areas[0];
  document.getElementById("participantPhone").value=p?.phone||"";
  document.getElementById("participantEmail").value=p?.email||"";
  document.getElementById("participantEntryDate").value=p?.entryDate||new Date().toISOString().slice(0,10);
  document.getElementById("participantStatus").value=p?.status||"Ativo";
  document.getElementById("participantNotes").value=p?.notes||"";
  document.getElementById("participantModal").showModal();
}
function saveParticipant(e){
  e.preventDefault(); const id=document.getElementById("participantId").value;
  const item={id:id||crypto.randomUUID(),name:participantName.value.trim(),category:participantCategory.value,area:participantArea.value,phone:participantPhone.value,email:participantEmail.value,entryDate:participantEntryDate.value,status:participantStatus.value,notes:participantNotes.value};
  if(db.participants.some(p=>p.name.toLowerCase()===item.name.toLowerCase()&&p.id!==item.id)) return toast("Já existe uma pessoa com esse nome.");
  if(id) db.participants=db.participants.map(p=>p.id===id?item:p); else db.participants.push(item);
  saveDB(); participantModal.close(); renderAll(); toast("Participante salvo.");
}
function toggleParticipant(id){const p=db.participants.find(p=>p.id===id);p.status=p.status==="Ativo"?"Inativo":"Ativo";saveDB();renderAll();}
function deleteParticipant(id){if(confirm("Deseja realmente excluir este participante? O histórico de presença será mantido.")){db.participants=db.participants.filter(p=>p.id!==id);saveDB();renderAll();toast("Participante excluído.");}}

function renderMeetings(){
  const list=[...db.meetings].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById("meetingsTable").innerHTML=`<table><thead><tr><th>Data</th><th>Tema</th><th>Horário</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(m=>`<tr><td>${formatDate(m.date)}</td><td><strong>${m.theme}</strong></td><td>${m.start}–${m.end}</td><td>${m.responsible||"—"}</td><td><span class="badge ${m.status==="Realizado"?"success":m.status==="Cancelado"?"danger":"neutral"}">${m.status}</span></td><td><div class="action-row"><button class="icon-btn" onclick="openMeeting('${m.id}')">✏️</button><button class="icon-btn" onclick="deleteMeeting('${m.id}')">🗑️</button></div></td></tr>`).join("")||`<tr><td colspan="6">Nenhum encontro cadastrado.</td></tr>`}</tbody></table>`;
}
function openMeeting(id=""){
  const m=db.meetings.find(x=>x.id===id);
  meetingModalTitle.textContent=m?"Editar encontro":"Novo encontro";
  meetingId.value=m?.id||"";meetingDate.value=m?.date||new Date().toISOString().slice(0,10);meetingStatus.value=m?.status||"Agendado";meetingStart.value=m?.start||"08:00";meetingEnd.value=m?.end||"12:00";meetingTheme.value=m?.theme||"Cursinho GPE";meetingResponsible.value=m?.responsible||"";meetingNotes.value=m?.notes||"";
  meetingModal.showModal();
}
function saveMeeting(e){
  e.preventDefault(); const id=meetingId.value;
  const item={id:id||crypto.randomUUID(),date:meetingDate.value,status:meetingStatus.value,start:meetingStart.value,end:meetingEnd.value,theme:meetingTheme.value.trim(),responsible:meetingResponsible.value,notes:meetingNotes.value};
  if(db.meetings.some(m=>m.date===item.date&&m.id!==item.id)) return toast("Já existe um encontro nessa data.");
  if(id) db.meetings=db.meetings.map(m=>m.id===id?item:m); else db.meetings.push(item);
  saveDB();meetingModal.close();renderAll();toast("Encontro salvo.");
}
function deleteMeeting(id){if(confirm("Excluir este encontro e suas presenças?")){db.meetings=db.meetings.filter(m=>m.id!==id);delete db.attendance[id];saveDB();renderAll();}}
function suggestSaturdays(){
  const key=monthKey(); const [y,m]=key.split("-").map(Number); let count=0;
  for(let d=1;d<=31;d++){const dt=new Date(y,m-1,d);if(dt.getMonth()!==m-1)break;if(dt.getDay()===6){const date=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;if(!db.meetings.some(x=>x.date===date)){db.meetings.push({id:crypto.randomUUID(),date,status:"Agendado",start:"08:00",end:"12:00",theme:"Cursinho GPE",responsible:"",notes:""});count++;}}}
  saveDB();renderAll();toast(`${count} sábado(s) adicionado(s).`);
}

function renderAttendanceOptions(){
  const select=document.getElementById("attendanceMeetingSelect"), current=select.value;
  const opts=[...db.meetings].filter(m=>m.status!=="Cancelado").sort((a,b)=>b.date.localeCompare(a.date));
  select.innerHTML=opts.map(m=>`<option value="${m.id}">${formatDate(m.date)} — ${m.theme}</option>`).join("");
  if(opts.some(m=>m.id===current)) select.value=current;
}
function renderAttendance(){
  renderAttendanceOptions(); const mid=attendanceMeetingSelect.value;
  if(!mid){attendanceList.innerHTML=`<div class="card">Cadastre um encontro para registrar presença.</div>`;return;}
  const q=attendanceSearch.value.toLowerCase(),cat=attendanceCategoryFilter.value, records=meetingAttendance(mid);
  const list=activeParticipants().filter(p=>p.name.toLowerCase().includes(q)&&(!cat||p.category===cat));
  attendanceList.innerHTML=list.map(p=>{
    const r=records[p.id]||{};
    return `<div class="attendance-item" data-id="${p.id}">
      <div class="person-name"><strong>${p.name}</strong><span class="muted">${p.category} • ${p.area}</span></div>
      <div class="status-buttons">
        ${["Presente","Ausente","Justificado","Atrasado","Saiu mais cedo"].map(s=>`<button class="status-btn ${r.status===s?"selected":""}" data-status="${s}" onclick="selectStatus(this)">${s}</button>`).join("")}
      </div>
      <input class="arrival" type="time" value="${r.arrival||""}" title="Chegada">
      <input class="departure" type="time" value="${r.departure||""}" title="Saída">
      <input class="attendance-note" placeholder="Observação" value="${r.notes||""}">
    </div>`;
  }).join("")||`<div class="card">Nenhum participante encontrado.</div>`;
}
function selectStatus(btn){btn.parentElement.querySelectorAll(".status-btn").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");}
function bulkAttendance(status){document.querySelectorAll(".attendance-item").forEach(row=>{row.querySelectorAll(".status-btn").forEach(b=>b.classList.toggle("selected",b.dataset.status===status));});}
function saveAttendance(){
  const mid=attendanceMeetingSelect.value;if(!mid)return;
  const rec=db.attendance[mid]||{};
  document.querySelectorAll(".attendance-item").forEach(row=>{
    const status=row.querySelector(".status-btn.selected")?.dataset.status||"";
    if(status) rec[row.dataset.id]={participantId:row.dataset.id,status,arrival:row.querySelector(".arrival").value,departure:row.querySelector(".departure").value,notes:row.querySelector(".attendance-note").value,updatedAt:new Date().toISOString()};
    else delete rec[row.dataset.id];
  });
  db.attendance[mid]=rec;saveDB();renderAll();toast("Presenças salvas com sucesso.");
}

function renderCalendar(){
  const key=selectedMonth("calendarMonth"),[y,m]=key.split("-").map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate();
  const names=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];let html=names.map(n=>`<div class="calendar-cell header">${n}</div>`).join("");
  for(let i=0;i<first.getDay();i++)html+=`<div class="calendar-cell empty"></div>`;
  for(let d=1;d<=days;d++){
    const date=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, meeting=db.meetings.find(x=>x.date===date);
    html+=`<div class="calendar-cell"><div class="calendar-day">${d}</div>${meeting?`<div class="meeting-pill ${meeting.status}">${meeting.theme}<br>${meeting.status}${db.attendance[meeting.id]?" • Presença registrada":""}</div>`:""}</div>`;
  }
  calendarGrid.innerHTML=html;
}

function reportData(){
  const key=selectedMonth("reportMonth"), meetings=getMonthMeetings(key).filter(m=>m.status==="Realizado");
  const rows={};db.participants.forEach(p=>rows[p.id]={...p,present:0,absent:0,justified:0,late:0});
  const perMeeting=[];let totalP=0,totalA=0,totalJ=0,totalLate=0,prof=0,vol=0;
  meetings.forEach(m=>{let present=0;Object.values(meetingAttendance(m.id)).forEach(r=>{const x=rows[r.participantId];if(!x)return;if(["Presente","Atrasado","Saiu mais cedo"].includes(r.status)){x.present++;present++;totalP++;x.category==="Professor"?prof++:vol++;}if(r.status==="Ausente"){x.absent++;totalA++;}if(r.status==="Justificado"){x.justified++;totalJ++;}if(r.status==="Atrasado"){x.late++;totalLate++;}});perMeeting.push({label:formatDate(m.date),value:present});});
  return {key,meetings,rows:Object.values(rows),perMeeting,totalP,totalA,totalJ,totalLate,prof,vol};
}
function renderReports(){
  const d=reportData(), stats=[["Encontros realizados",d.meetings.length],["Presenças",d.totalP],["Faltas",d.totalA],["Justificadas",d.totalJ],["Atrasos",d.totalLate],["Média por encontro",d.meetings.length?(d.totalP/d.meetings.length).toFixed(1):0]];
  reportStats.innerHTML=stats.map(([l,v])=>`<div class="stat-card"><span>${l}</span><strong>${v}</strong></div>`).join("");
  const max=Math.max(1,...d.perMeeting.map(x=>x.value));
  meetingBars.innerHTML=d.perMeeting.length?d.perMeeting.map(x=>`<div class="bar-row"><span>${x.label}</span><div class="bar-track"><div class="bar-fill" style="width:${x.value/max*100}%"></div></div><strong>${x.value}</strong></div>`).join(""):`<p class="muted">Sem encontros realizados no mês.</p>`;
  const cmax=Math.max(1,d.prof,d.vol);categoryBars.innerHTML=[["Professores",d.prof],["Voluntários",d.vol]].map(x=>`<div class="bar-row"><span>${x[0]}</span><div class="bar-track"><div class="bar-fill" style="width:${x[1]/cmax*100}%"></div></div><strong>${x[1]}</strong></div>`).join("");
  const rank=d.rows.sort((a,b)=>b.present-a.present);
  rankingTable.innerHTML=`<table><thead><tr><th>#</th><th>Nome</th><th>Categoria</th><th>Presenças</th><th>Faltas</th><th>Frequência</th></tr></thead><tbody>${rank.map((r,i)=>{const pct=d.meetings.length?Math.round(r.present/d.meetings.length*100):0;return `<tr><td>${i+1}</td><td>${r.name}</td><td>${r.category}</td><td>${r.present}</td><td>${r.absent}</td><td>${pct}%</td></tr>`}).join("")}</tbody></table>`;
}
function exportCSV(){
  const d=reportData();let csv="Nome;Categoria;Presencas;Faltas;Justificadas;Atrasos;Frequencia\n";
  d.rows.forEach(r=>{const pct=d.meetings.length?Math.round(r.present/d.meetings.length*100):0;csv+=`${r.name};${r.category};${r.present};${r.absent};${r.justified};${r.late};${pct}%\n`;});
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`relatorio-gpe-${d.key}.csv`;a.click();URL.revokeObjectURL(url);
}
setup();
