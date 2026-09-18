const BUILD='7.9.4.11-notifications-popup-v29';
const CACHE=`oscar-accounting-${BUILD}`;
const RUNTIME_CACHE=`oscar-accounting-runtime-${BUILD}`;
const LOCAL=["./components__ai__OscarAI.js?v=7.9.4.11-notifications-popup","./components__purchases__PurchaseAIScanModal.js?v=7.9.4.11-notifications-popup","./services__ai.js?v=7.9.4.11-notifications-popup","./services__aiActions.js?v=7.9.4.11-notifications-popup","./utils__aiMatching.js?v=7.9.4.11-notifications-popup","./App.js?v=7.9.4.11-notifications-popup","./app-icon.png","./brand-logo.png","./app.css","./components__accounts__AccountsView.js?v=7.9.4.11-notifications-popup","./components__auth__LoginGate.js?v=7.9.4.11-notifications-popup","./components__barcodes__BarcodesView.js?v=7.9.4.11-notifications-popup","./components__categories__CategoriesView.js?v=7.9.4.11-notifications-popup","./components__common__BottomNav.js?v=7.9.4.11-notifications-popup","./components__common__Dropdown.js?v=7.9.4.11-notifications-popup","./components__common__Header.js?v=7.9.4.11-notifications-popup","./components__common__NotificationsModal.js?v=7.9.4.11-notifications-popup","./components__common__Pagination.js?v=7.9.4.11-notifications-popup","./components__common__PWAInstallButton.js?v=7.9.4.11-notifications-popup","./components__common__Sidebar.js?v=7.9.4.11-notifications-popup","./components__common__Toast.js?v=7.9.4.11-notifications-popup","./components__customers__CustomersView.js?v=7.9.4.11-notifications-popup","./components__dashboard__DashboardView.js?v=7.9.4.11-notifications-popup","./components__employees__EmployeesView.js?v=7.9.4.11-notifications-popup","./components__expenses__ExpensesView.js?v=7.9.4.11-notifications-popup","./components__inventory__InventoryView.js?v=7.9.4.11-notifications-popup","./components__inventory__TransferForm.js?v=7.9.4.11-notifications-popup","./components__pos__CameraScannerModal.js?v=7.9.4.11-notifications-popup","./components__pos__CartPanel.js?v=7.9.4.11-notifications-popup","./components__pos__FullCartView.js?v=7.9.4.11-notifications-popup","./components__pos__HoldInvoicesModal.js?v=7.9.4.11-notifications-popup","./components__pos__POSView.js?v=7.9.4.11-notifications-popup","./components__pos__PaymentModal.js?v=7.9.4.11-notifications-popup","./components__pos__ProductGrid.js?v=7.9.4.11-notifications-popup","./components__pos__ThermalReceiptModal.js?v=7.9.4.11-notifications-popup","./components__products__ProductsView.js?v=7.9.4.11-notifications-popup","./components__purchases__PurchasesView.js?v=7.9.4.11-notifications-popup","./components__reports__ReportsView.js?v=7.9.4.11-notifications-popup","./components__sales__SalesView.js?v=7.9.4.11-notifications-popup","./components__settings__SettingsView.js?v=7.9.4.11-notifications-popup","./components__suppliers__SuppliersView.js?v=7.9.4.11-notifications-popup","./components__sync__SyncModal.js?v=7.9.4.11-notifications-popup","./components__trash__TrashView.js?v=7.9.4.11-notifications-popup","./components__vouchers__VouchersView.js?v=7.9.4.11-notifications-popup","./context__AppContext.js?v=7.9.4.11-notifications-popup","./hooks__usePWAInstall.js?v=7.9.4.11-notifications-popup","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./index.html","./main.js?v=7.9.4.11-notifications-popup","./manifest.webmanifest","./services__audio.js?v=7.9.4.11-notifications-popup","./services__db.js?v=7.9.4.11-notifications-popup","./types__index.js?v=7.9.4.11-notifications-popup","./utils__export.js?v=7.9.4.11-notifications-popup","./utils__canvasRenderer.js?v=7.9.4.11-notifications-popup","./utils__imageExport.js?v=7.9.4.11-notifications-popup","./utils__pdfExport.js?v=7.9.4.11-notifications-popup","./utils__professionalExport.js?v=7.9.4.11-notifications-popup","./brand__logo.js?v=7.9.4.11-notifications-popup","./utils__unitTree.js?v=7.9.4.11-notifications-popup","./utils__code128.js?v=7.9.4.11-notifications-popup","./oscar-activation-runtime.js?v=7.9.4.11-notifications-popup","./oscar-cloud-sync.js?v=7.9.4.11-notifications-popup","./restaurant__context__AppContext.js?v=7.9.4.11-notifications-popup","./restaurant__context__RestaurantContext.js?v=7.9.4.11-notifications-popup","./restaurant__services__restaurantService.js?v=7.9.4.11-notifications-popup","./restaurant__services__db.js?v=7.9.4.11-notifications-popup","./restaurant__services__kitchenPrint.js?v=7.9.4.11-notifications-popup","./restaurant__components__RestaurantSettingsPanel.js?v=7.9.4.11-notifications-popup","./restaurant__components__RestaurantTablesView.js?v=7.9.4.11-notifications-popup","./restaurant__components__RestaurantWasteView.js?v=7.9.4.11-notifications-popup","./restaurant__components__RestaurantKDSView.js?v=7.9.4.11-notifications-popup","./restaurant__components__RestaurantWaiterView.js?v=7.9.4.11-notifications-popup","./restaurant__components__ItemModifierModal.js?v=7.9.4.11-notifications-popup","./restaurant__components__KitchenTicketModal.js?v=7.9.4.11-notifications-popup","./admin.html","./master-admin.js?v=7.9.4.11-notifications-popup"];
const REMOTE=[
  'https://esm.sh/react@19.3.0',
  'https://esm.sh/react-dom@19.3.0?external=react',
  'https://esm.sh/react-dom@19.3.0/client?external=react',
  'https://esm.sh/react@19.3.0/jsx-runtime',
  'https://esm.sh/lucide-react@0.546.0?external=react',
  'https://esm.sh/jsbarcode@3.12.3',
  'https://esm.sh/xlsx@0.18.5',
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
  const url=new URL(request.url);
  const isCode=request.mode==='navigate'||/\.(?:js|html)$/i.test(url.pathname);
  const cached=(await cache.match(request))||(await cache.match(request,{ignoreSearch:true}));
  // Code is network-first: a stale cached syntax error must never win while the app files are reachable.
  if(isCode){
    const fresh=await update(cache,request);if(fresh)return fresh;
    if(cached)return cached;
    if(request.mode==='navigate')return (await cache.match('./index.html',{ignoreSearch:true}))||Response.error();
    return new Response('',{status:503,statusText:'Offline'});
  }
  if(cached){event.waitUntil(update(cache,request));return cached}
  const fresh=await update(cache,request);if(fresh)return fresh;
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
