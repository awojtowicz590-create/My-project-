/* Weekly Budget push server.
   - Serves the PWA (static files in this directory).
   - Stores each device's push subscription + schedule.
   - Runs a scheduler that sends web-push notifications so reminders arrive
     even when the app is fully closed.
   Storage is a single JSON file under DATA_DIR (mount a volume there in prod).
   VAPID keys are generated once and persisted — no manual key setup needed. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const engine = require('./engine.js');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '.data');
const STORE = path.join(DATA_DIR, 'store.json');
const ROOT = __dirname;
const SEND_HOUR = Number(process.env.SEND_HOUR || 8);   // local hour to send daily alerts
const CONTACT = process.env.CONTACT_EMAIL || 'mailto:budget@example.com';

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- storage ---------- */
function loadStore(){
  try{ return JSON.parse(fs.readFileSync(STORE,'utf8')); }catch(_){ return { vapid:null, devices:{} }; }
}
let store = loadStore();
let saveTimer=null;
function saveStore(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
  try{ fs.writeFileSync(STORE, JSON.stringify(store)); }catch(e){ console.error('save failed', e.message); }
},200); }

/* ---------- VAPID (generated once, then reused) ---------- */
if(!store.vapid){ store.vapid = webpush.generateVAPIDKeys(); saveStore(); console.log('Generated new VAPID keys'); }
webpush.setVapidDetails(CONTACT, store.vapid.publicKey, store.vapid.privateKey);

/* ---------- scheduler decision logic (pure + testable) ---------- */
/* Returns the notifications a device should receive at time `nowMs`, given its
   stored schedule and tz offset. Each has a stable `key` for de-duplication. */
function dueNotifications(device, nowMs){
  const s = device.schedule; if(!s || !s.notif) return [];
  const offset = device.tzOffset || 0;                     // Date#getTimezoneOffset() value (minutes)
  const local = new Date(nowMs - offset*60000);            // wall-clock; read with getUTC* (process is UTC)
  const y=local.getUTCFullYear(), mo=local.getUTCMonth(), da=local.getUTCDate();
  const dow=local.getUTCDay(), hour=local.getUTCHours();
  const dateKey = `${y}-${String(mo+1).padStart(2,'0')}-${String(da).padStart(2,'0')}`;
  const out=[];
  if(hour < SEND_HOUR) return out;   // hold morning alerts until the send hour

  // Build local-calendar Date objects the engine can read via its LOCAL getters
  // (process runs in UTC, so a Date built from UTC parts reads back the same).
  const today = new Date(Date.UTC(y,mo,da));
  const tomorrow = new Date(Date.UTC(y,mo,da)+864e5);

  if(s.notif.pay && engine.payDueOn(s, today)){
    out.push({ key:`pay-${dateKey}`, title:'Payday! 💵',
      body:`${engine.money2(s.pay)} landing today.${s.saveEach?` Set aside ${engine.money2(s.saveEach)} for savings.`:''}`, tag:'pay' });
  }
  if(s.notif.weekly && dow===s.payday){
    out.push({ key:`weekly-${dateKey}`, title:'Your week ahead 📊',
      body: engine.weeklySummaryText(s, today.getTime()), tag:'weekly' });
  }
  if(s.notif.bills){
    (s.bills||[]).forEach(b=>{ if(engine.billDueOn(b, tomorrow))
      out.push({ key:`bill-${dateKey}-${b.name}`, title:'Bill due tomorrow 🧾', body:`${b.name} — ${engine.money2(b.amount)}`, tag:'bill-'+b.name }); });
  }
  return out;
}

/* ---------- send loop ---------- */
async function tick(){
  const now = Date.now();
  for(const [id, device] of Object.entries(store.devices)){
    if(!device.subscription) continue;
    const due = dueNotifications(device, now);
    if(!due.length) continue;
    device.sent = device.sent || {};
    for(const n of due){
      if(device.sent[n.key]) continue;                     // already delivered
      try{
        await webpush.sendNotification(device.subscription, JSON.stringify({title:n.title, body:n.body, tag:n.tag}));
        device.sent[n.key]=now;
      }catch(err){
        if(err.statusCode===404 || err.statusCode===410){   // subscription gone
          delete store.devices[id]; console.log('dropped dead subscription', id); break;
        } else console.error('push error', err.statusCode||err.message);
      }
    }
    // prune old sent keys (>45 days) to keep the store small
    const cutoff = now - 45*864e5;
    for(const k of Object.keys(device.sent)) if(device.sent[k] < cutoff) delete device.sent[k];
  }
  saveStore();
}
setInterval(tick, 5*60*1000);      // every 5 minutes
setTimeout(tick, 4000);            // and shortly after boot

/* ---------- tiny HTTP layer (no framework) ---------- */
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};

function sendJSON(res, code, obj){ const b=JSON.stringify(obj); res.writeHead(code,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}); res.end(b); }
function readBody(req){ return new Promise((resolve)=>{ let d=''; req.on('data',c=>{ d+=c; if(d.length>1e6) req.destroy(); }); req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); }catch(_){ resolve(null); } }); }); }

function serveStatic(req, res){
  let p = decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(p==='/') p='/index.html';
  if(p.includes('..') || p.startsWith('/.data') || p.startsWith('/data')){ res.writeHead(404); return res.end('Not found'); }
  // Only serve known web assets; never expose server.js / package files / store.
  const allow = new Set(['/index.html','/engine.js','/app.js','/sw.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/favicon.ico']);
  if(!allow.has(p)){ res.writeHead(404); return res.end('Not found'); }
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)]||'application/octet-stream',
      'Cache-Control': p==='/sw.js' ? 'no-cache' : 'public, max-age=3600'});
    res.end(data);
  });
}

const server = http.createServer(async (req, res)=>{
  const url = new URL(req.url, 'http://x');
  // CORS (harmless; same-origin in normal use)
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }

  if(url.pathname==='/api/vapid' && req.method==='GET') return sendJSON(res,200,{publicKey: store.vapid.publicKey});

  if(url.pathname==='/api/health' && req.method==='GET') return sendJSON(res,200,{ok:true, devices:Object.keys(store.devices).length});

  if(url.pathname==='/api/schedule' && req.method==='POST'){
    const body = await readBody(req);
    if(!body || !body.deviceId || !body.subscription || !body.schedule) return sendJSON(res,400,{error:'bad request'});
    store.devices[body.deviceId] = Object.assign(store.devices[body.deviceId]||{}, {
      subscription: body.subscription, schedule: body.schedule, tzOffset: body.tzOffset||0, updated: Date.now()
    });
    store.devices[body.deviceId].sent = store.devices[body.deviceId].sent || {};
    saveStore();
    return sendJSON(res,200,{ok:true});
  }

  if(url.pathname==='/api/data' && req.method==='DELETE'){
    const body = await readBody(req);
    if(body && body.deviceId){ delete store.devices[body.deviceId]; saveStore(); }
    return sendJSON(res,200,{ok:true});
  }

  if(url.pathname.startsWith('/api/')) return sendJSON(res,404,{error:'not found'});

  return serveStatic(req, res);
});

if(require.main === module){
  server.listen(PORT, ()=> console.log(`Weekly Budget server on :${PORT}  (data: ${DATA_DIR})`));
}

module.exports = { dueNotifications, server };
