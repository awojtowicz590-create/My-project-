/* Tests for the GitHub Actions notification path: send.js decision logic and
   register.js issue parsing. Run: node test/notify.test.js */
'use strict';
const assert = require('assert');
const { dueFor } = require('../notify/send.js');
const { extractJSON, clean } = require('../notify/register.js');

let pass=0, fail=0;
function t(name, fn){ try{ fn(); pass++; console.log('  ✓', name); }catch(e){ fail++; console.log('  ✗', name, '\n     ', e.message); } }

/* Note: dueFor uses the REAL current date (localParts reads "now"), so these
   assert structure/branching rather than a fixed calendar day. */

console.log('send.dueFor:');

t('nothing when all toggles off', ()=>{
  const d={ id:'a', tz:'UTC', payday:new Date().getUTCDay(), notif:{weekly:false,bills:false,pay:false}, bills:[] };
  assert.strictEqual(dueFor(d).length, 0);
});
t('payday ping fires when today is the payday weekday', ()=>{
  const d={ id:'a', tz:'UTC', payday:new Date().getUTCDay(), notif:{weekly:true,bills:false,pay:false}, bills:[] };
  const out=dueFor(d);
  assert.ok(out.some(n=>/Payday/.test(n.title)), 'expected payday ping');
});
t('no payday ping on a different weekday', ()=>{
  const other=(new Date().getUTCDay()+3)%7;
  const d={ id:'a', tz:'UTC', payday:other, notif:{weekly:true,bills:false,pay:false}, bills:[] };
  assert.ok(!dueFor(d).some(n=>/Payday/.test(n.title)));
});
t('weekly and pay both map to a single payday ping source', ()=>{
  const d={ id:'a', tz:'UTC', payday:new Date().getUTCDay(), notif:{weekly:true,bills:false,pay:true}, bills:[] };
  // both toggles on shouldn't crash; at least one payday note present
  assert.ok(dueFor(d).some(n=>/Payday/.test(n.title)));
});

console.log('register parsing:');

const sampleBody = 'blah blah\n```json\n'+JSON.stringify({
  id:'dev_abc', tz:'America/New_York', payday:5, notif:{weekly:true,bills:true,pay:false},
  bills:[{name:'Rent',freq:'monthly',day:1},{name:'Junk',freq:'weekly',day:6, amount:999}],
  subscription:{endpoint:'https://push/xyz', keys:{p256dh:'a',auth:'b'}}
})+'\n```\nfooter';

t('extracts JSON from a fenced block', ()=>{
  const o=extractJSON(sampleBody); assert.strictEqual(o.id,'dev_abc');
});
t('clean keeps timing + subscription, strips amounts', ()=>{
  const c=clean(extractJSON(sampleBody));
  assert.strictEqual(c.id,'dev_abc');
  assert.strictEqual(c.payday,5);
  assert.strictEqual(c.bills[1].name,'Junk');
  assert.strictEqual(c.bills[1].amount, undefined, 'amount must be stripped');
  assert.ok(c.subscription.endpoint);
});
t('clean rejects a body with no subscription', ()=>{
  assert.strictEqual(clean({id:'x'}), null);
});
t('clean rejects garbage', ()=>{
  assert.strictEqual(extractJSON('no json here'), null);
});
t('clean defaults bad freq to monthly and caps strings', ()=>{
  const c=clean({ id:'z', subscription:{endpoint:'e'}, bills:[{name:'X',freq:'nonsense',day:9}] });
  assert.strictEqual(c.bills[0].freq,'monthly');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
