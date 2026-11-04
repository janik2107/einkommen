const VERSION='ek-v2';
const SHELL=['./','./index.html','./styles.css','./calc.js','./app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
e.respondWith(caches.open(VERSION).then(async c=>{const hit=await c.match(r,{ignoreSearch:true});const net=fetch(r).then(x=>{if(x.ok&&!new URL(r.url).hash)c.put(r,x.clone());return x}).catch(()=>hit);return hit||net}))});
