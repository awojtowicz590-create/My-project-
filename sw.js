/* Weekly Budget service worker — offline cache + best-effort background notifications */
const CACHE = 'weekly-budget-v1';
const ASSETS = ['./','./index.html','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}); return res;
    }).catch(()=>hit))
  );
});

/* The app posts its latest weekly summary here so we can show it in the background. */
let latest = null;
self.addEventListener('message', e=>{ if(e.data?.type==='summary') latest=e.data.payload; });

async function readSummary(){
  if(latest) return latest;
  // fall back to whatever a client last stored (clients share nothing directly, so ask one)
  const cs = await self.clients.matchAll({includeUncontrolled:true});
  return latest;
}

/* Periodic background sync (Chromium/Android, installed PWA only). */
self.addEventListener('periodicsync', e=>{
  if(e.tag==='weekly-summary') e.waitUntil(maybeWeekly());
});
async function maybeWeekly(){
  const data = await readSummary();
  if(!data || !data.notif?.weekly) return;
  const today = new Date().getDay();
  if(today !== data.payday) return;
  await self.registration.showNotification('Your week ahead 📊', {
    body: data.summary || 'Open Weekly Budget for your rundown.',
    tag:'weekly', icon:'icon-192.png', badge:'icon-192.png'
  });
}

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>{
    for(const c of cs){ if('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
