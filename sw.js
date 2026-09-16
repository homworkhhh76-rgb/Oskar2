const BUILD='7.9-localfirst-v8-cash-customer-warehouse';
const CACHE=`oscar-accounting-${BUILD}`;
const RUNTIME_CACHE=`oscar-accounting-runtime-${BUILD}`;
const LOCAL=["./App.js","./app-icon.png","./brand-logo.png","./app.css","./components__accounts__AccountsView.js","./components__auth__LoginGate.js","./components__barcodes__BarcodesView.js","./components__categories__CategoriesView.js","./components__common__BottomNav.js","./components__common__Dropdown.js","./components__common__Header.js","./components__common__PWAInstallButton.js","./components__common__Sidebar.js","./components__common__Toast.js","./components__customers__CustomersView.js","./components__dashboard__DashboardView.js","./components__employees__EmployeesView.js","./components__expenses__ExpensesView.js","./components__inventory__InventoryView.js","./components__inventory__TransferForm.js","./components__pos__CameraScannerModal.js","./components__pos__CartPanel.js","./components__pos__FullCartView.js","./components__pos__HoldInvoicesModal.js","./components__pos__POSView.js","./components__pos__PaymentModal.js","./components__pos__ProductGrid.js","./components__pos__ThermalReceiptModal.js","./components__products__ProductsView.js","./components__purchases__PurchasesView.js","./components__reports__ReportsView.js","./components__sales__SalesView.js","./components__settings__SettingsView.js","./components__suppliers__SuppliersView.js","./components__sync__SyncModal.js","./components__trash__TrashView.js","./components__vouchers__VouchersView.js","./context__AppContext.js","./hooks__usePWAInstall.js","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./index.html","./main.js","./manifest.webmanifest","./services__audio.js","./services__db.js","./types__index.js","./utils__export.js","./utils__canvasRenderer.js","./utils__imageExport.js","./utils__pdfExport.js","./utils__professionalExport.js","./brand__logo.js","./utils__unitTree.js","./utils__code128.js","./oscar-activation-runtime.js","./oscar-cloud-sync.js","./admin.html","./master-admin.js"];
const REMOTE=[
  'https://esm.sh/react@19.3.0',
  'https://esm.sh/react-dom@19.3.0?external=react',
  'https://esm.sh/react-dom@19.3.0/client?external=react',
  'https://esm.sh/react@19.3.0/jsx-runtime',
  'https://esm.sh/lucide-react@0.546.0?external=react',
  'https://esm.sh/jsbarcode@3.12.3',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@200;300;400;500;600;700;800;900&display=swap'
];
const cacheable=r=>!!r&&(r.ok||r.type==='opaque');
async function putFresh(cache,url){try{const req=new Request(url,{cache:'no-cache',mode:url.startsWith('http')?'cors':'same-origin'});const r=await fetch(req);if(cacheable(r))await cache.put(url,r.clone())}catch(_){} }

async function cacheRemoteTree(cache,url,seen=new Set(),depth=0){
  if(depth>5||seen.has(url))return;seen.add(url);
  try{
    const r=await fetch(new Request(url,{cache:'no-cache',mode:'cors'}));
    if(!cacheable(r))return;
    await cache.put(url,r.clone());
    const type=(r.headers.get('content-type')||'').toLowerCase();
    if(!(type.includes('javascript')||type.includes('ecmascript')||type.includes('css')))return;
    const text=await r.clone().text();
    const deps=new Set();
    if(type.includes('css')){
      for(const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)){const spec=m[1];if(spec&& !spec.startsWith('data:'))deps.add(new URL(spec,url).href)}
    }else{
      for(const m of text.matchAll(/(?:from\s*|import\s*\(?)['"]([^'"]+)['"]/g)){const spec=m[1];if(spec&&(spec.startsWith('/')||spec.startsWith('./')||spec.startsWith('../')||/^https?:/.test(spec)))deps.add(new URL(spec,url).href)}
    }
    await Promise.allSettled([...deps].map(dep=>cacheRemoteTree(cache,dep,seen,depth+1)));
  }catch(_){}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(LOCAL.map(u=>putFresh(cache,u)));
  const runtime=await caches.open(RUNTIME_CACHE);
  await Promise.allSettled(REMOTE.map(u=>cacheRemoteTree(runtime,u)));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('oscar-accounting-')&&!([CACHE,RUNTIME_CACHE].includes(k))).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
async function update(cache,request){try{const fresh=await fetch(new Request(request,{cache:'no-cache'}));if(cacheable(fresh))await cache.put(request,fresh.clone());return fresh}catch(_){return null}}
async function sameOriginResponse(request,event){
  const cache=await caches.open(CACHE);
  const cached=(await cache.match(request))||(await cache.match(request,{ignoreSearch:true}));
  if(cached){event.waitUntil(update(cache,request));return cached}
  const fresh=await update(cache,request);if(fresh)return fresh;
  if(request.mode==='navigate')return (await cache.match('./index.html',{ignoreSearch:true}))||Response.error();
  return new Response('',{status:503,statusText:'Offline'});
}
async function externalResponse(request,event){
  const cache=await caches.open(RUNTIME_CACHE);
  const cached=await cache.match(request);
  if(cached){event.waitUntil(update(cache,request));return cached}
  const fresh=await update(cache,request);if(fresh)return fresh;
  return new Response('',{status:503,statusText:'Offline'});
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  event.respondWith(url.origin===self.location.origin?sameOriginResponse(request,event):externalResponse(request,event));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
