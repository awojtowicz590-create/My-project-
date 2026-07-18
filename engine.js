/* Shared budget engine — pure date/event logic used by BOTH the browser app
   (app.js) and the push server (server.js). No DOM, no storage. Single source
   of truth so the phone and the server always agree on when things are due.

   Date methods used are LOCAL (getDay/getDate/getMonth). In the browser that's
   the user's real local time. On the server, dates are pre-shifted by the
   device's tz offset and the process runs in UTC, so local == device wall clock. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BudgetEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DOWLONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const EPOCH = Date.UTC(2024, 0, 7); // a Sunday — fixed anchor for biweekly parity

  const money  = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
  const money2 = n => '$' + Math.abs(n).toLocaleString(undefined,
    { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

  function startOfWeek(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-x.getDay()); return x; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function midnight(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function fmt(d){ return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function daysUntil(d, now){ const t = now?new Date(now):new Date(); t.setHours(0,0,0,0);
    return Math.round((midnight(new Date(d)).getTime()-t.getTime())/864e5); }
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function evenWeek(d){ return Math.floor((midnight(d).getTime()-EPOCH)/(7*864e5)) % 2 === 0; }

  /* Is this recurring bill due on the given date? */
  function billDueOn(bill, d){
    if(bill.freq==='monthly'){ const dim=daysInMonth(d.getFullYear(),d.getMonth());
      return d.getDate() === Math.min(bill.day, dim); }
    if(bill.freq==='biweekly') return d.getDay()===bill.day && evenWeek(d);
    return d.getDay()===bill.day; // weekly
  }
  function payDueOn(state, d){ return !!state.pay && d.getDay()===state.payday; }

  /* Merged, sorted events between from..to (inclusive). */
  function eventsBetween(state, from, to){
    const ev=[]; const one=864e5;
    const start=midnight(from), end=midnight(to);
    for(let t=start.getTime(); t<=end.getTime(); t+=one){
      const d=new Date(t);
      if(payDueOn(state,d)) ev.push({type:'pay',name:'Payday',amount:state.pay,date:d,emoji:'💵'});
      (state.bills||[]).forEach(b=>{ if(billDueOn(b,d)) ev.push({type:'bill',name:b.name,amount:b.amount,date:d,emoji:b.emoji||'🧾',freq:b.freq}); });
    }
    (state.incomes||[]).forEach(i=>{ const d=new Date(i.date+'T00:00:00');
      if(d>=start && d<=end) ev.push({type:'income',name:i.name,amount:i.amount,date:d,emoji:'💰',id:i.id}); });
    ev.sort((a,b)=>a.date-b.date);
    return ev;
  }

  function payDates(state, from, to){
    return eventsBetween(state, from, to).filter(e=>e.type==='pay').map(e=>e.date);
  }

  function weeklySummaryText(state, now){
    const s=startOfWeek(now?new Date(now):new Date()), e=addDays(s,6);
    const ev=eventsBetween(state,s,e);
    const inn=ev.filter(x=>x.type!=='bill').reduce((a,b)=>a+b.amount,0);
    const out=ev.filter(x=>x.type==='bill').reduce((a,b)=>a+b.amount,0);
    const savw=payDates(state,s,e).length*(state.saveEach||0);
    const safe=(state.balance||0)+inn-out-savw;
    return `In: ${money2(inn)} · Bills: ${money2(out)} · Safe to spend: ${money2(safe)}`;
  }

  return { DAYS, DOWLONG, money, money2, startOfWeek, addDays, midnight, fmt,
           daysUntil, daysInMonth, billDueOn, payDueOn, eventsBetween, payDates, weeklySummaryText };
});
