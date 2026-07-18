/* Weekly Budget PWA. Data lives in localStorage on this phone. When push is
   enabled and a server is present, the schedule is also synced to the server so
   it can deliver notifications while the app is closed. */
'use strict';

const E = BudgetEngine;
const { DAYS, DOWLONG, startOfWeek, addDays, fmt, money, money2 } = E;
const KEY = 'weeklyBudget.v1';

const DEFAULT = {
  balance: 0, goal: 0, saveEach: 0,
  pay: 0, payday: 5,            // Friday
  incomes: [],                  // {id,name,amount,date}   one-off money in
  bills: [],                    // {id,name,amount,day,freq,emoji}  freq: weekly|biweekly|monthly
  saved: 0,                     // total already put toward goal
  notif: { weekly:false, bills:false, pay:false },
  lastPayApplied: null
};

let state = load();

/* ---------- storage ---------- */
function load(){
  try{ const s = JSON.parse(localStorage.getItem(KEY)); if(s) return Object.assign({}, DEFAULT, s, {notif:Object.assign({},DEFAULT.notif,s.notif)}); }catch(e){}
  return structuredClone(DEFAULT);
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); pushSummaryToSW(); render(); }
const uid = () => Math.random().toString(36).slice(2,9);

/* ---------- engine wrappers (bound to current state) ---------- */
const daysUntil = d => E.daysUntil(d);
const payDates = (from,to) => E.payDates(state, from, to);
const eventsBetween = (from,to) => E.eventsBetween(state, from, to);
const weeklySummaryText = () => E.weeklySummaryText(state);

/* ---------- rendering ---------- */
function render(){
  const now=new Date();
  const wkStart=startOfWeek(now), wkEnd=addDays(wkStart,6);

  // balance
  document.getElementById('balanceBig').textContent = money2(state.balance);
  document.getElementById('balanceSub').textContent =
    state.pay? `Next payday ${nextPaydayLabel()}` : 'Tap Setup to add your paycheck';

  // week events
  const wk = eventsBetween(wkStart,wkEnd);
  const inSum = wk.filter(e=>e.type!=='bill').reduce((s,e)=>s+e.amount,0);
  const outSum = wk.filter(e=>e.type==='bill').reduce((s,e)=>s+e.amount,0);
  document.getElementById('wkIn').textContent = money2(inSum);
  document.getElementById('wkOut').textContent = money2(outSum);
  document.getElementById('weekRange').textContent = fmt(wkStart)+' – '+fmt(wkEnd);

  // safe to spend = balance + income this week - bills this week - savings set aside this week
  const savingsThisWeek = payDates(wkStart,wkEnd).length * state.saveEach;
  const safe = state.balance + inSum - outSum - savingsThisWeek;
  const se=document.getElementById('safeSpend');
  se.textContent = money2(safe); se.className='v '+(safe<0?'neg':'safe');

  document.getElementById('savedNow').textContent = money2(state.saved);

  // week list
  const wl=document.getElementById('weekList');
  if(!wk.length){ wl.innerHTML='<div class="empty">Nothing scheduled this week 🎉</div>'; }
  else wl.innerHTML = wk.map(e=>{
    const du=daysUntil(e.date);
    let pill = e.type==='bill'
      ? (du<=1?'<span class="pill due">'+(du<=0?'due today':'due tomorrow')+'</span>':(du<=3?'<span class="pill soon">in '+du+'d</span>':''))
      : (e.type==='pay'?'<span class="pill pay">payday</span>':'');
    const cls=e.type==='bill'?'out':'in', sign=e.type==='bill'?'-':'+';
    return `<div class="row"><div class="emoji">${e.emoji}</div>
      <div class="mid"><div class="nm">${esc(e.name)}</div>
        <div class="meta">${DAYS[e.date.getDay()]} ${fmt(e.date)} ${pill}</div></div>
      <div class="amt ${cls}">${sign}${money2(e.amount)}</div></div>`;
  }).join('');

  // goal
  const gc=document.getElementById('goalCard');
  if(state.goal>0){
    gc.style.display='block';
    const pct=Math.min(100, state.goal? state.saved/state.goal*100:0);
    document.getElementById('goalLine').textContent=money2(state.saved)+' / '+money2(state.goal);
    document.getElementById('goalPct').textContent=Math.round(pct)+'%';
    document.getElementById('goalBar').style.width=pct+'%';
    const remain=Math.max(0,state.goal-state.saved);
    const eta=state.saveEach>0? Math.ceil(remain/state.saveEach):0;
    document.getElementById('goalEta').textContent = remain<=0? '🎉 Goal reached!' :
      (state.saveEach>0? `≈ ${eta} more payday${eta>1?'s':''} to go (${money2(remain)} left)` : `${money2(remain)} to go — set a weekly amount in Setup`);
  } else gc.style.display='none';

  // outlook (4 weeks)
  const out=document.getElementById('outlook');
  let running=state.balance, rows='';
  for(let w=0;w<4;w++){
    const s=addDays(wkStart,w*7), e=addDays(s,6);
    const evs=eventsBetween(s,e);
    const income=evs.filter(x=>x.type!=='bill').reduce((a,b)=>a+b.amount,0);
    const bills=evs.filter(x=>x.type==='bill').reduce((a,b)=>a+b.amount,0);
    const savw=payDates(s,e).length*state.saveEach;
    running += income - bills - savw;
    const net=income-bills;
    rows+=`<div class="row"><div class="emoji">${w===0?'📍':'📅'}</div>
      <div class="mid"><div class="nm">${w===0?'This week':fmt(s)+' – '+fmt(e)}</div>
      <div class="meta">+${money2(income)} in · -${money2(bills)} bills${savw?` · ${money2(savw)} saved`:''}</div></div>
      <div class="amt ${running<0?'out':''}" style="${running>=0?'color:var(--muted)':''}">${money(running)}</div></div>`;
  }
  out.innerHTML=rows;

  // income page
  document.getElementById('payBig').textContent=money2(state.pay);
  document.getElementById('payDayLine').textContent = state.pay? `Every ${DOWLONG[state.payday]}` : 'Set your payday in Setup';
  const il=document.getElementById('incomeList');
  const upIncomes=[...state.incomes].sort((a,b)=>new Date(a.date)-new Date(b.date));
  il.innerHTML = upIncomes.length? upIncomes.map(i=>{
    const d=new Date(i.date+'T00:00:00'), du=daysUntil(d);
    return `<div class="row"><div class="emoji">💰</div>
      <div class="mid"><div class="nm">${esc(i.name)}</div><div class="meta">${fmt(d)} ${du>=0&&du<=7?'<span class="pill pay">soon</span>':''}</div></div>
      <div class="amt in">+${money2(i.amount)}</div>
      <button class="del" onclick="delItem('income','${i.id}')">🗑</button></div>`;
  }).join('') : '<div class="empty">No one-off payments added</div>';

  // bills page
  const billsMonthly = state.bills.reduce((s,b)=> s + (b.freq==='weekly'?b.amount*52/12 : b.freq==='biweekly'?b.amount*26/12 : b.amount),0);
  document.getElementById('billsBig').textContent=money2(billsMonthly);
  const bl=document.getElementById('billsList');
  bl.innerHTML = state.bills.length? state.bills.map(b=>{
    const when = b.freq==='monthly'? `Monthly · ${ordinal(b.day)}` : `${b.freq==='biweekly'?'Every 2 wks':'Weekly'} · ${DOWLONG[b.day]}`;
    return `<div class="row"><div class="emoji">${b.emoji||'🧾'}</div>
      <div class="mid"><div class="nm">${esc(b.name)}</div><div class="meta">${when}</div></div>
      <div class="amt out">-${money2(b.amount)}</div>
      <button class="del" onclick="delItem('bill','${b.id}')">🗑</button></div>`;
  }).join('') : '<div class="empty">No bills yet — tap + Add</div>';

  // setup fields
  setVal('s_balance',state.balance);setVal('s_goal',state.goal);setVal('s_saveEach',state.saveEach);
  setVal('s_pay',state.pay);document.getElementById('s_payday').value=state.payday;
  ['weekly','bills','pay'].forEach(k=> document.getElementById('tog_'+k).classList.toggle('on', !!state.notif[k]));
  updateNotifState();
}
function setVal(id,v){ const el=document.getElementById(id); if(el&&document.activeElement!==el) el.value=v||''; }
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ordinal = n => n+(['th','st','nd','rd'][(n%100>>3^1&&n%10)<4?n%10:0]||'th');

function nextPaydayLabel(){
  const pds=payDates(new Date(),addDays(new Date(),14));
  if(!pds.length) return '';
  const du=daysUntil(pds[0]);
  return du===0?'is today 🎉':du===1?'is tomorrow':fmt(pds[0])+` (${du}d)`;
}

/* ---------- tabs & sheet ---------- */
document.querySelectorAll('nav.tabs button').forEach(b=> b.onclick=()=>{
  document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.getElementById('page-'+b.dataset.tab).classList.add('on');
  window.scrollTo(0,0);
});

function openSheet(kind){
  const t=document.getElementById('sheetTitle'), body=document.getElementById('sheetBody');
  if(kind==='income'){
    t.textContent='Add money coming in';
    body.innerHTML=`
      <label>What's it for?</label><input id="f_name" placeholder="e.g. Tax refund, Venmo from Sam">
      <div class="field-row"><div><label>Amount</label><input id="f_amt" type="number" inputmode="decimal" placeholder="0.00"></div>
      <div><label>Date expected</label><input id="f_date" type="date" value="${todayISO()}"></div></div>
      <button class="btn primary" style="margin-top:18px" onclick="addIncome()">Add payment</button>`;
  } else {
    t.textContent='Add a bill';
    body.innerHTML=`
      <label>Bill name</label><input id="f_name" placeholder="e.g. Rent, Phone, Netflix">
      <label>Amount</label><input id="f_amt" type="number" inputmode="decimal" placeholder="0.00">
      <label>How often?</label>
      <div class="seg" id="f_freq">
        <button data-f="monthly" class="on">Monthly</button>
        <button data-f="weekly">Weekly</button>
        <button data-f="biweekly">Every 2 wks</button>
      </div>
      <div id="f_daywrap"></div>
      <label>Icon (optional)</label>
      <div class="seg" id="f_emoji">${['🧾','🏠','📱','⚡','🚗','🛒','📺','💳','🏥','🎓'].map((e,i)=>`<button data-e="${e}" class="${i==0?'on':''}">${e}</button>`).join('')}</div>
      <button class="btn primary" style="margin-top:18px" onclick="addBill()">Add bill</button>`;
    document.querySelectorAll('#f_freq button').forEach(b=> b.onclick=()=>{segPick('#f_freq',b); renderDayField(b.dataset.f);});
    document.querySelectorAll('#f_emoji button').forEach(b=> b.onclick=()=>segPick('#f_emoji',b));
    renderDayField('monthly');
  }
  document.getElementById('sheet').classList.add('on');
}
function renderDayField(freq){
  const w=document.getElementById('f_daywrap');
  if(freq==='monthly'){
    w.innerHTML='<label>Day of month it\'s due</label><select id="f_day">'+
      Array.from({length:31},(_,i)=>`<option value="${i+1}">${ordinal(i+1)}</option>`).join('')+'</select>';
  } else {
    w.innerHTML='<label>Day of week it\'s due</label><select id="f_day">'+
      DOWLONG.map((d,i)=>`<option value="${i}" ${i===5?'selected':''}>${d}</option>`).join('')+'</select>';
  }
}
function segPick(sel,btn){ document.querySelectorAll(sel+' button').forEach(x=>x.classList.remove('on')); btn.classList.add('on'); }
function closeSheet(){ document.getElementById('sheet').classList.remove('on'); }
document.getElementById('sheet').onclick=e=>{ if(e.target.id==='sheet') closeSheet(); };

function addIncome(){
  const name=val('f_name')||'Payment', amt=+val('f_amt'), date=val('f_date');
  if(!amt||amt<=0) return toast('Enter an amount');
  state.incomes.push({id:uid(),name,amount:amt,date}); save(); closeSheet(); toast('Payment added');
}
function addBill(){
  const name=val('f_name')||'Bill', amt=+val('f_amt');
  const freq=document.querySelector('#f_freq button.on').dataset.f;
  const day=+val('f_day');
  const emoji=document.querySelector('#f_emoji button.on').dataset.e;
  if(!amt||amt<=0) return toast('Enter an amount');
  state.bills.push({id:uid(),name,amount:amt,freq,day,emoji}); save(); closeSheet(); toast('Bill added');
}
function delItem(kind,id){
  if(kind==='income') state.incomes=state.incomes.filter(x=>x.id!==id);
  else state.bills=state.bills.filter(x=>x.id!==id);
  save(); toast('Removed');
}
const val = id => (document.getElementById(id)||{}).value?.trim?.() ?? '';
const todayISO = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

/* ---------- setup ---------- */
function saveSetup(){
  state.balance=+val('s_balance')||0;
  state.goal=+val('s_goal')||0;
  state.saveEach=+val('s_saveEach')||0;
  state.pay=+val('s_pay')||0;
  state.payday=+document.getElementById('s_payday').value;
  save(); toast('Saved ✓');
  scheduleReminders();
}

/* ---------- notifications ---------- */
function updateNotifState(){
  const el=document.getElementById('notifState'); if(!el) return;
  const p = ('Notification' in window)? Notification.permission : 'unsupported';
  const anyOn = state.notif.weekly||state.notif.bills||state.notif.pay;
  el.textContent = p==='denied'? '⚠ Notifications are blocked. Enable them in your browser/site settings.' :
    p==='unsupported'? 'This browser doesn\'t support notifications.' :
    p!=='granted'? 'Turn on a switch above and allow notifications when asked.' :
    (serverMode && anyOn)? '✓ Push is on — you\'ll get alerts even when the app is closed.' :
    serverMode? '✓ Connected to your push server. Turn on a switch to get closed-app alerts.' :
    (actionsMode && anyOn)? '📲 Almost there — tap “Register this phone” to get alerts when the app is closed.' :
    actionsMode? '✓ Ready for free scheduled alerts. Turn on a switch, then register this phone.' :
    '✓ Notifications on for this device (reminders show while the app is open).';
}
async function ensurePerm(){
  if(!('Notification' in window)){ toast('Notifications not supported'); return false; }
  if(Notification.permission==='granted') return true;
  if(Notification.permission==='denied'){ toast('Blocked — enable in browser settings'); return false; }
  const p=await Notification.requestPermission(); updateNotifState(); return p==='granted';
}
async function toggleNotif(kind){
  const turningOn=!state.notif[kind];
  if(turningOn){ if(!await ensurePerm()){ updateNotifState(); return; } }
  state.notif[kind]=turningOn; save();
  document.getElementById('tog_'+kind).classList.toggle('on',state.notif[kind]);
  if(turningOn){ toast('On ✓'); if(serverMode) await enablePush(); }
  scheduleReminders(); updateNotifState(); refreshPushUI();
}

/* Show the right push controls for the detected backend. */
function refreshPushUI(){
  const reg=document.getElementById('registerBtn');
  const hint=document.getElementById('registerHint');
  if(!reg) return;
  const anyOn = state.notif.weekly||state.notif.bills||state.notif.pay;
  const show = actionsMode && anyOn;
  reg.style.display = show ? 'block' : 'none';
  hint.style.display = show ? 'block' : 'none';
}
document.getElementById('bellBtn').onclick=async()=>{ if(await ensurePerm()){ toast('Notifications enabled'); document.querySelector('[data-tab=setup]').click(); } updateNotifState(); };

async function showNote(title,body,tag){
  try{
    const reg=await navigator.serviceWorker?.ready;
    if(reg&&reg.showNotification){ reg.showNotification(title,{body,tag,icon:'icon-192.png',badge:'icon-192.png'}); return; }
  }catch(e){}
  if('Notification' in window && Notification.permission==='granted') new Notification(title,{body});
}
function testNotif(){ ensurePerm().then(ok=>{ if(ok) showNote('Weekly Budget','This is what your reminders will look like 👍','test'); }); }

/* While the app is open, fire any reminders due today that we haven't shown yet.
   True background delivery (app closed) is handled by the service worker's periodic sync
   where the platform supports it. */
function scheduleReminders(){
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  const shown = JSON.parse(localStorage.getItem('wb.shown')||'{}');
  const today=todayISO(); const mark=k=>{shown[k]=today; localStorage.setItem('wb.shown',JSON.stringify(shown));};
  const now=new Date();

  // payday today
  if(state.notif.pay){
    const pds=payDates(now,now);
    if(pds.length && shown['pay-'+today]!==today){ showNote('Payday! 💵', `${money2(state.pay)} landing today. ${state.saveEach?`Set aside ${money2(state.saveEach)} for savings.`:''}`,'pay'); mark('pay-'+today); }
  }
  // bills due tomorrow
  if(state.notif.bills){
    const tm=addDays(now,1);
    const due=eventsBetween(tm,tm).filter(e=>e.type==='bill');
    due.forEach(e=>{ const k='bill-'+today+'-'+e.name; if(shown[k]!==today){ showNote('Bill due tomorrow 🧾',`${e.name} — ${money2(e.amount)}`,k); mark(k); } });
  }
  // weekly summary on payday
  if(state.notif.weekly){
    if(now.getDay()===state.payday && shown['weekly-'+today]!==today){ showNote('Your week ahead 📊', weeklySummaryText(),'weekly'); mark('weekly-'+today); }
  }
}
/* Store a compact summary the service worker can read, and (if push is on)
   sync the schedule to the server so it can notify while the app is closed. */
function pushSummaryToSW(){
  try{
    const payload={ summary:weeklySummaryText(), notif:state.notif, payday:state.payday, ts:Date.now() };
    localStorage.setItem('wb.swdata',JSON.stringify(payload));
    if(navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage({type:'summary',payload});
  }catch(e){}
  syncServer();
}

/* ---------- data import/export ---------- */
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='weekly-budget-backup.json'; a.click(); toast('Backup downloaded');
}
function importData(ev){
  const f=ev.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ state=Object.assign({},DEFAULT,JSON.parse(r.result)); save(); toast('Imported ✓'); }catch(e){ toast('Bad file'); } };
  r.readAsText(f); ev.target.value='';
}
function resetAll(){ if(confirm('Erase everything on this device (and on the server, if connected)? This cannot be undone.')){ deleteServerData(); localStorage.removeItem(KEY); localStorage.removeItem('wb.sub'); state=structuredClone(DEFAULT); save(); toast('All data erased'); } }

/* ---------- toast ---------- */
let toastT; function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),1900); }

/* =========================================================================
   SERVER PUSH — deliver notifications while the app is fully closed.
   Only active when the app is served by its own push server (which exposes
   /api/vapid). On GitHub Pages / file:// it silently no-ops and the app falls
   back to on-device reminders.
   ========================================================================= */
let serverMode = false;          // live push server (Fly.io) — auto-syncs
let actionsMode = false;         // GitHub Actions push — register once via issue
let pushConfig = null;           // notify/config.json (Actions mode)
let vapidPublicKey = null;
const deviceId = (()=>{ let d=localStorage.getItem('wb.device'); if(!d){ d='dev_'+uid()+uid(); localStorage.setItem('wb.device',d); } return d; })();
const pushMode = () => serverMode || actionsMode;

function b64ToUint8(base64){
  const pad='='.repeat((4-base64.length%4)%4);
  const s=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(s); return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

/* Figure out which push backend is available:
   - a live server exposes /api/vapid  → serverMode (auto-sync)
   - GitHub Pages ships notify/config.json → actionsMode (register once)
   - neither → on-device reminders only */
async function detectServer(){
  try{
    const r=await fetch('api/vapid',{cache:'no-store'});
    if(r.ok){ const j=await r.json(); if(j&&j.publicKey){ vapidPublicKey=j.publicKey; serverMode=true; return; } }
  }catch(e){}
  try{
    const r=await fetch('notify/config.json',{cache:'no-store'});
    if(r.ok){ const j=await r.json(); if(j&&j.vapidPublicKey){ vapidPublicKey=j.vapidPublicKey; pushConfig=j; actionsMode=true; } }
  }catch(e){ /* on-device only */ }
}

/* Subscribe this browser to push using the shared public key. */
async function subscribePush(){
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToUint8(vapidPublicKey)});
  localStorage.setItem('wb.sub', JSON.stringify(sub));
  return sub;
}

/* Build the minimal, timing-only registration for GitHub Actions.
   NOTE: no balances or amounts — only which weekday you're paid and which day
   bills fall, plus the push subscription. */
function deviceRegistration(sub){
  return {
    id: deviceId,
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
    payday: state.payday,
    notif: state.notif,
    bills: (state.bills||[]).map(b=>({ name:b.name, freq:b.freq, day:b.day })),
    subscription: sub || JSON.parse(localStorage.getItem('wb.sub')||'null')
  };
}

/* Open a pre-filled GitHub issue so the Action can file this phone. */
async function registerPhone(){
  if(!actionsMode) return;
  if(!await ensurePerm()){ updateNotifState(); return; }
  let sub;
  try{ sub=await subscribePush(); }
  catch(e){ toast('Couldn\'t subscribe — is this installed to your Home Screen?'); return; }
  const reg=deviceRegistration(sub);
  const body='This registers my phone for budget alerts. Just tap **Submit new issue** — a bot files it and closes this.\n\n```json\n'+JSON.stringify(reg,null,2)+'\n```';
  const url=`https://github.com/${pushConfig.repo}/issues/new?title=`+encodeURIComponent('device-registration')+'&body='+encodeURIComponent(body);
  window.open(url,'_blank');
  toast('Opening GitHub — tap Submit to finish');
}

async function enablePush(){
  if(!serverMode||!('serviceWorker' in navigator)||!('PushManager' in window)) return false;
  try{ const sub=await subscribePush(); await syncServer(sub); return true; }
  catch(e){ return false; }
}

let syncT;
function syncServer(sub){
  if(!serverMode) return;
  const anyNotif = state.notif.weekly||state.notif.bills||state.notif.pay;
  if(!anyNotif) return;
  clearTimeout(syncT);
  syncT=setTimeout(async()=>{
    try{
      const subscription = sub || JSON.parse(localStorage.getItem('wb.sub')||'null');
      if(!subscription) return;
      await fetch('api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ deviceId, subscription, tzOffset:new Date().getTimezoneOffset(),
          schedule:{ balance:state.balance, pay:state.pay, payday:state.payday, saveEach:state.saveEach,
                     goal:state.goal, saved:state.saved, bills:state.bills, incomes:state.incomes, notif:state.notif } })});
    }catch(e){}
  },600);
}

async function deleteServerData(){
  if(!serverMode) return;
  try{ await fetch('api/data',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId})}); }catch(e){}
}

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(async reg=>{
    try{ if('periodicSync' in reg){ const st=await navigator.permissions.query({name:'periodic-background-sync'}); if(st.state==='granted') await reg.periodicSync.register('weekly-summary',{minInterval:24*60*60*1000}); } }catch(e){}
  }).catch(()=>{});
}

/* ---------- boot ---------- */
render();
scheduleReminders();
detectServer().then(async()=>{
  updateNotifState(); refreshPushUI();
  const granted = 'Notification' in window && Notification.permission==='granted';
  const anyOn = state.notif.weekly||state.notif.bills||state.notif.pay;
  if(granted && anyOn){
    if(serverMode) await enablePush();
    else if(actionsMode){ try{ await subscribePush(); }catch(e){} }  // keep subscription fresh
  }
  pushSummaryToSW();
});
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ render(); scheduleReminders(); if(serverMode) syncServer(); } });
