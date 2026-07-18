/* Sends push notifications for registered phones. Run once a day by GitHub
   Actions (.github/workflows/notify.yml). Stateless: because it runs once per
   day, each alert fires at most once — no server, no database.

   It only ever sees TIMING (which weekday you're paid, which day bills fall) —
   never your balances or amounts. Those stay on your phone. */
'use strict';
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const engine = require('../engine.js');

const DEVICES = path.join(__dirname, 'devices.json');
const CONFIG = path.join(__dirname, 'config.json');
const CONTACT = process.env.CONTACT_EMAIL || 'mailto:budget@example.com';

function configureVapid(){
  const cfg = (() => { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { return {}; } })();
  const PUBLIC = process.env.VAPID_PUBLIC_KEY || cfg.vapidPublicKey;   // public key lives in config.json
  const PRIVATE = process.env.VAPID_PRIVATE_KEY;                        // private key is a GitHub secret
  if(!PUBLIC || !PRIVATE){ console.error('Missing VAPID keys. Set the VAPID_PRIVATE_KEY secret (public key is read from notify/config.json).'); process.exit(1); }
  webpush.setVapidDetails(CONTACT, PUBLIC, PRIVATE);
}

/* Local calendar fields for a device's timezone (handles DST correctly). */
function localParts(tz){
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC',
    year:'numeric', month:'numeric', day:'numeric', weekday:'short' });
  const o = {}; for(const p of fmt.formatToParts(new Date())) o[p.type] = p.value;
  const dow = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday];
  return { y:+o.year, mo:+o.month-1, d:+o.day, dow };
}

/* What should this device receive today? (pure + testable) */
function dueFor(device){
  const notes = [];
  const n = device.notif || {};
  const { y, mo, d } = localParts(device.tz);
  const today = new Date(Date.UTC(y, mo, d));         // process runs in UTC → engine local getters read these
  const tomorrow = new Date(today.getTime() + 864e5);

  if((n.weekly || n.pay) && today.getUTCDay() === device.payday){
    notes.push({ title:'Payday! 💵', body:'Tap to see your week ahead in Weekly Budget.', tag:'payday' });
  }
  if(n.bills){
    for(const b of device.bills || []){
      if(engine.billDueOn(b, tomorrow))
        notes.push({ title:'Bill due tomorrow 🧾', body:`${b.name || 'A bill'} is due tomorrow.`, tag:'bill-'+(b.name||'x') });
    }
  }
  return notes;
}

async function main(){
  configureVapid();
  let devices;
  try{ devices = JSON.parse(fs.readFileSync(DEVICES, 'utf8') || '[]'); }
  catch(e){ console.error('Cannot read devices.json:', e.message); process.exit(1); }

  const testMode = process.env.SEND_TEST === 'true';
  const keep = [];
  let sent = 0;
  for(const device of devices){
    if(!device || !device.subscription){ continue; }
    let alive = true;
    const notes = testMode
      ? [{ title:'Weekly Budget ✅', body:'Test push — notifications are working!', tag:'test' }]
      : dueFor(device);
    for(const note of notes){
      try{
        await webpush.sendNotification(device.subscription, JSON.stringify(note));
        sent++;
      }catch(err){
        const code = err.statusCode;
        if(code === 404 || code === 410){ alive = false; console.log('Dropping expired subscription', device.id); break; }
        console.error('Push failed', code || err.message);
      }
    }
    if(alive) keep.push(device);
  }

  // Rewrite file only if we removed dead subscriptions (workflow commits the change).
  if(keep.length !== devices.length) fs.writeFileSync(DEVICES, JSON.stringify(keep, null, 2) + '\n');
  console.log(`Done. ${sent} notification(s) sent, ${keep.length} device(s) active.`);
}

if(require.main === module) main();
module.exports = { dueFor, localParts };
