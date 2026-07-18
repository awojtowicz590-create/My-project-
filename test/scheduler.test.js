/* Unit tests for the push scheduler's decision logic and the shared engine.
   Run: npm test   (no external test framework). */
'use strict';
const assert = require('assert');
const engine = require('../engine.js');
const { dueNotifications } = require('../server.js');

let pass=0, fail=0;
function t(name, fn){ try{ fn(); pass++; console.log('  ✓', name); }catch(e){ fail++; console.log('  ✗', name, '\n     ', e.message); } }

// Helper: a UTC instant for a given local wall-clock, tzOffset=0 (UTC device)
const at = (y,m,d,h) => Date.UTC(y,m-1,d,h,0,0);

const baseSchedule = {
  balance:1000, pay:800, payday:5 /*Fri*/, saveEach:100, goal:3000, saved:0,
  bills:[
    {name:'Rent', amount:950, freq:'monthly', day:1},
    {name:'Groceries', amount:120, freq:'weekly', day:6 /*Sat*/}
  ],
  incomes:[],
  notif:{ weekly:true, bills:true, pay:true }
};
const device = { subscription:{}, tzOffset:0, schedule:baseSchedule, sent:{} };

console.log('engine:');

t('weekly bill due on its weekday', ()=>{
  assert.strictEqual(engine.billDueOn({freq:'weekly',day:6}, new Date(Date.UTC(2026,6,18))), true); // 2026-07-18 is Sat
  assert.strictEqual(engine.billDueOn({freq:'weekly',day:6}, new Date(Date.UTC(2026,6,17))), false);
});
t('monthly bill clamps to short months', ()=>{
  assert.strictEqual(engine.billDueOn({freq:'monthly',day:31}, new Date(Date.UTC(2026,1,28))), true); // Feb 28
  assert.strictEqual(engine.billDueOn({freq:'monthly',day:15}, new Date(Date.UTC(2026,1,15))), true);
});
t('biweekly parity is deterministic & 14 days apart', ()=>{
  const b={freq:'biweekly',day:5};
  const hits=[];
  for(let d=0; d<28; d++){ const dt=new Date(Date.UTC(2026,6,1)+d*864e5); if(engine.billDueOn(b,dt)) hits.push(dt.getUTCDate()); }
  assert.strictEqual(hits.length, 2, 'exactly two Fridays fire in 4 weeks');
  assert.strictEqual(hits[1]-hits[0], 14, 'they are 14 days apart');
});
t('weeklySummaryText computes safe-to-spend', ()=>{
  // Week containing Fri 2026-07-17 payday + Sat groceries; balance 1000
  const txt = engine.weeklySummaryText(baseSchedule, Date.UTC(2026,6,15));
  assert.ok(/Safe to spend/.test(txt), txt);
});

console.log('scheduler:');

t('payday alert fires on Friday at/after send hour', ()=>{
  const out = dueNotifications(device, at(2026,7,17,9)); // Fri 9am
  const keys = out.map(n=>n.key);
  assert.ok(keys.some(k=>k.startsWith('pay-2026-07-17')), 'payday alert present');
  assert.ok(keys.some(k=>k.startsWith('weekly-2026-07-17')), 'weekly summary present');
});
t('nothing before send hour', ()=>{
  const out = dueNotifications(device, at(2026,7,17,6)); // 6am < 8am
  assert.strictEqual(out.length, 0);
});
t('bill reminder fires the day BEFORE a weekly bill (Fri -> Sat groceries)', ()=>{
  const out = dueNotifications(device, at(2026,7,17,9)); // Fri; groceries due Sat
  assert.ok(out.some(n=>/Groceries/.test(n.body)), 'groceries reminder present');
});
t('no payday alert on a non-payday', ()=>{
  const out = dueNotifications(device, at(2026,7,15,9)); // Wed
  assert.ok(!out.some(n=>n.key.startsWith('pay-')), 'no payday alert');
});
t('monthly bill reminder fires on the last day of prev month (Rent 1st)', ()=>{
  const out = dueNotifications(device, at(2026,7,31,9)); // Jul 31 -> Aug 1 rent
  assert.ok(out.some(n=>/Rent/.test(n.body)), 'rent reminder present');
});
t('respects notif toggles (all off => nothing)', ()=>{
  const d2 = { ...device, schedule:{ ...baseSchedule, notif:{weekly:false,bills:false,pay:false} } };
  assert.strictEqual(dueNotifications(d2, at(2026,7,17,9)).length, 0);
});
t('tz offset shifts the local day', ()=>{
  // Device in UTC+13 (offset -780). At 2026-07-16 20:00 UTC it's already Fri 09:00 local.
  const d3 = { ...device, tzOffset:-780 };
  const out = dueNotifications(d3, Date.UTC(2026,6,16,20));
  assert.ok(out.some(n=>n.key.startsWith('pay-2026-07-17')), 'payday recognised across tz');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
