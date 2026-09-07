
// Web Share Target: agent texts shared into the app
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method === 'POST' && u.pathname.endsWith('/share-target')){
    e.respondWith((async () => {
      try{
        const fd = await e.request.formData();
        const item = { t: Date.now(), title: fd.get('title')||'', text: fd.get('text')||'', url: fd.get('url')||'' };
        await new Promise((res)=>{
          const rq = indexedDB.open('homecheck-kv', 2);
          rq.onupgradeneeded = ()=>{ const db=rq.result;
            if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
            if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos'); };
          rq.onsuccess = ()=>{
            const db = rq.result, tx = db.transaction('kv','readwrite'), st = tx.objectStore('kv');
            const g = st.get('shareInbox');
            g.onsuccess = ()=>{ const arr = g.result || []; arr.push(item); st.put(arr, 'shareInbox'); };
            tx.oncomplete = ()=>{ db.close(); res(); };
          };
          rq.onerror = ()=>res();
        });
      }catch(err){}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
});
const CACHE = 'homecheck-v76';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API calls and cross-origin: straight to network, never cached
  if (url.origin !== location.origin) return;
  // Page itself: network-first so updates land, cache fallback for offline
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Static assets: cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  })));
});
