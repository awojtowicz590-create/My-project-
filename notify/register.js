/* Parses a "device-registration" GitHub issue body and upserts the device into
   devices.json. Run by .github/workflows/register-device.yml on issue open.
   The issue body contains a ```json ... ``` block produced by the app. */
'use strict';
const fs = require('fs');
const path = require('path');

const DEVICES = path.join(__dirname, 'devices.json');
const body = process.env.ISSUE_BODY || '';

function extractJSON(text){
  // Prefer a fenced ```json block; fall back to the first {...} object.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}/) || [])[0];
  if(!raw) return null;
  try{ return JSON.parse(raw.trim()); }catch(e){ return null; }
}

function clean(dev){
  // Keep only the fields we need — timing + subscription. Never amounts.
  if(!dev || typeof dev !== 'object') return null;
  if(!dev.id || !dev.subscription || !dev.subscription.endpoint) return null;
  return {
    id: String(dev.id).slice(0, 64),
    tz: typeof dev.tz === 'string' ? dev.tz.slice(0, 64) : 'UTC',
    payday: Number.isInteger(dev.payday) ? dev.payday : 5,
    notif: {
      weekly: !!(dev.notif && dev.notif.weekly),
      bills:  !!(dev.notif && dev.notif.bills),
      pay:    !!(dev.notif && dev.notif.pay)
    },
    bills: Array.isArray(dev.bills) ? dev.bills.slice(0, 100).map(b => ({
      name: String(b.name || 'Bill').slice(0, 60),
      freq: ['weekly','biweekly','monthly'].includes(b.freq) ? b.freq : 'monthly',
      day: Number(b.day) || 1
    })) : [],
    subscription: dev.subscription
  };
}

function main(){
  const parsed = extractJSON(body);
  const dev = clean(parsed);
  if(!dev){ console.error('No valid device registration found in issue body.'); process.exit(2); }

  let devices = [];
  try{ devices = JSON.parse(fs.readFileSync(DEVICES, 'utf8') || '[]'); }catch(e){ devices = []; }
  const i = devices.findIndex(d => d.id === dev.id);
  if(i >= 0) devices[i] = dev; else devices.push(dev);

  fs.writeFileSync(DEVICES, JSON.stringify(devices, null, 2) + '\n');
  console.log(`Registered device ${dev.id}. Total devices: ${devices.length}.`);
}

if(require.main === module) main();
module.exports = { extractJSON, clean };
