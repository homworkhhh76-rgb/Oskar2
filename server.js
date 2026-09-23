/**
 * Oscar Accounting POS + Oscar AI secure server (Node 18+)
 * Run:
 *   OPENROUTER_API_KEY="..." node server.js
 * Optional:
 *   OPENROUTER_MODEL="google/gemini-2.5-flash:free" PORT=8787 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const OPENROUTER_API_KEY = String(process.env.OPENROUTER_API_KEY || '').trim();
const OPENROUTER_MODEL = String(process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash:free').trim();
const ALLOWED_ORIGIN = String(process.env.OSCAR_ALLOWED_ORIGIN || '').trim();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '8893463288:AAHn77qegDsR3Yu1LYGicM0Dfh1Fznw4agg').trim();

const MIME = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon',
};

const sendJson = (res, status, data, origin='') => {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
};

const readBody = (req, max=28*1024*1024) => new Promise((resolve,reject)=>{
  let size=0, chunks=[];
  req.on('data',chunk=>{ size+=chunk.length; if(size>max){ reject(new Error('الطلب كبير جداً')); req.destroy(); return; } chunks.push(chunk); });
  req.on('end',()=>{ try{ resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')); }catch{ reject(new Error('JSON غير صالح')); } });
  req.on('error',reject);
});

const stripFence = (text='') => String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
const parseJsonLoose = (text='') => {
  const clean=stripFence(text);
  try { return JSON.parse(clean); } catch {}
  const first=clean.indexOf('{'), last=clean.lastIndexOf('}');
  if(first>=0 && last>first){ try{return JSON.parse(clean.slice(first,last+1));}catch{} }
  return null;
};

async function callOpenRouter(messages, {temperature=0.15, max_tokens=2200}={}) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY غير مضبوط على الخادم');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST',
    headers:{
      'Authorization':`Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type':'application/json',
      'X-Title':'Oscar Accounting POS AI',
    },
    body:JSON.stringify({ model:OPENROUTER_MODEL, messages, temperature, max_tokens }),
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message || data?.message || `OpenRouter HTTP ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if(Array.isArray(content)) return content.map(x=>x?.text||'').join('\n');
  return String(content || '');
}

const assistantSystem = `أنت "مساعد أوسكار AI" داخل نظام محاسبة ونقاط بيع عربي RTL.
تجيب فقط بناءً على بيانات النظام المرسلة في context، ولا تخترع أرقاماً غير موجودة.
افهم العربية العامية والفصحى. العملة موجودة في context.currency.
يمكنك: تحليل المبيعات، المشتريات، المخزون، الأصناف الناقصة، الديون، الموردين، المصروفات، أداء المطعم، كشف المؤشرات غير المعتادة، واقتراح كميات شراء بشكل تقريبي مع توضيح أنها اقتراحات.
إذا طلب المستخدم تسجيل مصروف بصيغة طبيعية، استخرج المبلغ والبند والملاحظات فقط ولا تحفظه مباشرة. أرجع action من نوع expense_draft حتى يراجع المستخدم قبل الحفظ.
إذا طلب فتح شاشة، استخدم action من نوع navigate. الشاشات المسموحة: pos,sales,purchases,products,inventory,customers,suppliers,accounts,expenses,reports,restaurant_tables,restaurant_waiter,restaurant_kitchen.
إذا طلب تعبئة فاتورة مشتريات من صورة، وجّهه إلى شاشة المشتريات واستخدم action type purchase.
لا تدّعي أن تقرير PDF/Excel تم تنزيله إذا لم يحدث. يمكنك تلخيص البيانات أو توجيهه إلى شاشة التقارير.
أرجع JSON فقط بالشكل:
{"answer":"نص عربي واضح ومختصر","action":null}
أو action:
{"answer":"...","action":{"type":"navigate","tab":"reports","label":"فتح التقارير"}}
أو:
{"answer":"راجعت المصروف...","action":{"type":"expense_draft","label":"مراجعة المصروف قبل الحفظ","data":{"amount":250,"category":"أجور ورواتب عمال","notes":"أجرة عمال"}}}
بنود المصروف المفضلة: نثريات وضيافة، كهرباء ومياه، إيجار المحل، أجور ورواتب عمال، صيانة ونظافة، بضائع تالفة ومنتهية، أكياس وتغليف وطباعة، نقل وشحن، أخرى.`;

const scanSystem = `أنت محرك قراءة فواتير مشتريات عربي/إنجليزي دقيق داخل نظام محاسبة.
اقرأ الصور كما هي. لا تخترع صنفاً أو رقماً غير واضح. إذا كان الرقم غير مؤكد ضع confidence منخفضاً أو null للقيمة.
استخرج المورد ورقم الفاتورة والتاريخ والعملة والخصم والمدفوع إن ظهر، وكل بنود الفاتورة.
افهم الوحدات المتكافئة لغوياً: حبة/قطعة/pcs، كرتونة/كرتون/carton/box، باكيت/pack، مشطاح/طبلية/pallet، كيلو/kg، غرام/g، لتر/l، مل/ml، دزينة/dozen، كيس/bag.
سعر الوحدة هو السعر المقابل لوحدة السطر في الصورة، والكمية هي عدد تلك الوحدة.
قد تكون الفاتورة عدة صور؛ اجمعها معاً وتجنب تكرار البنود إذا كانت الصور متداخلة.
أرجع JSON فقط، بلا Markdown، بالشكل التالي:
{
 "supplier":{"name":"","phone":"","taxNumber":""},
 "invoiceNumber":"", "date":"YYYY-MM-DD أو null", "currency":"", "subtotal":0, "discount":0, "grandTotal":0, "paidAmount":null,
 "items":[{"name":"","barcode":"","unit":"","quantity":1,"unitPrice":0,"total":0,"confidence":0.0}],
 "confidence":0.0,
 "warnings":["..."]
}
إذا لم يظهر حقل اتركه فارغاً أو null. لا تستنتج أسعاراً غير ظاهرة إلا إذا كان total وquantity واضحين ويمكن حساب unitPrice رياضياً؛ والعكس صحيح.`;

async function handleAI(req,res,origin){
  if(!OPENROUTER_API_KEY) return sendJson(res,503,{error:'خادم Oscar AI جاهز لكن مفتاح OpenRouter غير مضبوط. اضبط OPENROUTER_API_KEY ثم أعد تشغيل الخادم.'},origin);
  let body;
  try { body=await readBody(req); } catch(e){ return sendJson(res,400,{error:e.message},origin); }
  try {
    if(body.task==='health') return sendJson(res,200,{ok:true,model:OPENROUTER_MODEL},origin);
    if(body.task==='purchase_invoice_scan'){
      const images=Array.isArray(body.images)?body.images.filter(x=>typeof x==='string'&&x.startsWith('data:image/')).slice(0,6):[];
      if(!images.length) return sendJson(res,400,{error:'لم تصل صورة فاتورة صالحة'},origin);
      const catalog=body.catalog||{};
      const supplierNames=(catalog.suppliers||[]).slice(0,250).map(x=>x?.name).filter(Boolean);
      const productList=(catalog.products||[]).slice(0,600).map(p=>({name:p?.name,sku:p?.sku,units:(p?.units||[]).map(u=>u?.name).filter(Boolean)}));
      const text=`اقرأ فاتورة المشتريات من الصور. هذه أسماء من النظام للمساعدة على التعرف والمطابقة فقط، ولا تجبر التطابق إذا الصورة مختلفة.\nالموردون الموجودون: ${JSON.stringify(supplierNames)}\nالأصناف والوحدات الموجودة: ${JSON.stringify(productList)}`;
      const content=[{type:'text',text},...images.map(url=>({type:'image_url',image_url:{url}}))];
      const raw=await callOpenRouter([{role:'system',content:scanSystem},{role:'user',content}],{temperature:0.05,max_tokens:4000});
      const parsed=parseJsonLoose(raw);
      if(!parsed) throw new Error('تعذر تفسير نتيجة قراءة الفاتورة. حاول بصورة أوضح.');
      return sendJson(res,200,{result:parsed,model:OPENROUTER_MODEL},origin);
    }
    if(body.task==='assistant_chat'){
      const context=body.context||{};
      const history=(Array.isArray(body.history)?body.history:[]).slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,3000)}));
      const message=String(body.message||'').slice(0,4000);
      const contextText=JSON.stringify(context).slice(0,180000);
      const messages=[{role:'system',content:assistantSystem},{role:'system',content:`بيانات النظام الحالية (JSON):\n${contextText}`},...history,{role:'user',content:message}];
      const raw=await callOpenRouter(messages,{temperature:0.18,max_tokens:1800});
      const parsed=parseJsonLoose(raw);
      if(parsed?.answer) return sendJson(res,200,{answer:String(parsed.answer),action:parsed.action||null,model:OPENROUTER_MODEL},origin);
      return sendJson(res,200,{answer:raw||'لم يصل رد.',action:null,model:OPENROUTER_MODEL},origin);
    }
    return sendJson(res,400,{error:'مهمة AI غير معروفة'},origin);
  } catch(e){
    console.error('Oscar AI error:',e);
    return sendJson(res,502,{error:String(e?.message||e)},origin);
  }
}

const TELEGRAM_STATE_FILE = path.join(ROOT, '.oscar-telegram-state.json');
const TELEGRAM_USERS_FILE = path.join(ROOT, '.oscar-telegram-users.json');
let telegramUsersSyncBusy = false;

const normalizeTelegramUsername = (value) => String(value || '').trim().replace(/^@+/, '').toLowerCase();
const readTelegramUsersState = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(TELEGRAM_USERS_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { offset: 0, users: {} };
  } catch { return { offset: 0, users: {} }; }
};
const writeTelegramUsersState = (state) => {
  try { fs.writeFileSync(TELEGRAM_USERS_FILE, JSON.stringify(state, null, 2), 'utf8'); return true; }
  catch (e) { console.error('Telegram users state write error:', e); return false; }
};

function rememberTelegramUser(state, update) {
  const msg = update?.message || update?.edited_message || update?.callback_query?.message;
  const chat = msg?.chat || {};
  const from = update?.callback_query?.from || msg?.from || {};
  const username = String(chat?.username || from?.username || '').trim();
  const usernameKey = normalizeTelegramUsername(username);
  const chatId = chat?.id || (chat?.type === 'private' ? from?.id : null);
  if (!usernameKey || !chatId) return false;
  const previous = state.users?.[usernameKey] || {};
  state.users = state.users || {};
  state.users[usernameKey] = {
    ...previous,
    chatId: String(chatId),
    username: `@${username}`,
    firstName: String(chat?.first_name || from?.first_name || previous.firstName || '').trim(),
    lastName: String(chat?.last_name || from?.last_name || previous.lastName || '').trim(),
    type: String(chat?.type || previous.type || 'private'),
    lastSeenAt: new Date().toISOString(),
  };
  return true;
}

async function refreshTelegramUsers({ maxBatches = 5 } = {}) {
  if (telegramUsersSyncBusy || !TELEGRAM_BOT_TOKEN) return readTelegramUsersState();
  telegramUsersSyncBusy = true;
  try {
    const state = readTelegramUsersState();
    state.users = state.users || {};
    let offset = Number(state.offset || 0);
    let changed = false;
    for (let batch = 0; batch < Math.max(1, maxBatches); batch++) {
      const data = await telegramCall('getUpdates', {
        offset,
        limit: 100,
        timeout: 0,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      });
      const updates = Array.isArray(data?.result) ? data.result : [];
      if (!updates.length) break;
      for (const update of updates) {
        if (rememberTelegramUser(state, update)) changed = true;
        const id = Number(update?.update_id);
        if (Number.isFinite(id)) offset = Math.max(offset, id + 1);
      }
      if (updates.length < 100) break;
    }
    if (offset !== Number(state.offset || 0)) { state.offset = offset; changed = true; }
    state.updatedAt = new Date().toISOString();
    if (changed || !fs.existsSync(TELEGRAM_USERS_FILE)) writeTelegramUsersState(state);
    return state;
  } finally {
    telegramUsersSyncBusy = false;
  }
}

async function handleTelegramResolve(req, res, origin) {
  let body;
  try { body = await readBody(req, 256 * 1024); }
  catch (e) { return sendJson(res, 400, { ok:false, error:e.message }, origin); }
  const usernameKey = normalizeTelegramUsername(body?.username);
  if (!/^[a-z0-9_]{5,32}$/i.test(usernameKey)) {
    return sendJson(res, 400, { ok:false, error:'اكتب يوزر Telegram صحيح مثل @username' }, origin);
  }
  try { await refreshTelegramUsers({ maxBatches: 5 }); } catch (e) { console.error('Telegram user sync error:', e); }
  const state = readTelegramUsersState();
  const row = state.users?.[usernameKey];
  if (!row?.chatId) {
    return sendJson(res, 404, { ok:false, error:`لم يتم العثور على @${usernameKey}. يجب أن يكون المستخدم قد ضغط Start في البوت مرة واحدة على الأقل.` }, origin);
  }
  return sendJson(res, 200, {
    ok:true,
    result:{ chatId:row.chatId, username:row.username || `@${usernameKey}`, name:[row.firstName,row.lastName].filter(Boolean).join(' ').trim() },
  }, origin);
}

async function handleTelegramUsers(req, res, origin) {
  try { await refreshTelegramUsers({ maxBatches: 5 }); } catch (e) { console.error('Telegram user sync error:', e); }
  const state = readTelegramUsersState();
  const users = Object.values(state.users || {}).map(row => ({
    username: row.username || '',
    name: [row.firstName,row.lastName].filter(Boolean).join(' ').trim(),
    type: row.type || 'private',
    lastSeenAt: row.lastSeenAt || null,
  })).sort((a,b)=>String(b.lastSeenAt||'').localeCompare(String(a.lastSeenAt||'')));
  return sendJson(res, 200, { ok:true, users, updatedAt:state.updatedAt || null }, origin);
}


const readTelegramState = () => {
  try {
    const parsed=JSON.parse(fs.readFileSync(TELEGRAM_STATE_FILE,'utf8'));
    return parsed && typeof parsed==='object' ? parsed : {};
  } catch { return {}; }
};
const writeTelegramState = (state) => {
  try { fs.writeFileSync(TELEGRAM_STATE_FILE, JSON.stringify(state,null,2), 'utf8'); return true; }
  catch(e){ console.error('Telegram state write error:',e); return false; }
};
const splitTelegramText = (text, max=3900) => {
  const lines=String(text||'').split('\n'); const parts=[]; let current='';
  for(const raw of lines){
    const line=String(raw||'');
    if(line.length>max){
      if(current){parts.push(current);current='';}
      for(let i=0;i<line.length;i+=max) parts.push(line.slice(i,i+max));
      continue;
    }
    const next=current?`${current}\n${line}`:line;
    if(next.length>max){if(current)parts.push(current);current=line;}else current=next;
  }
  if(current)parts.push(current);
  return parts.filter(Boolean);
};
async function telegramCall(method,payload){
  if(!TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured');
  const response=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.ok===false) throw new Error(data?.description||`Telegram HTTP ${response.status}`);
  return data;
}
async function sendTelegramLong(chatId,text){
  const results=[];
  for(const part of splitTelegramText(text)) results.push(await telegramCall('sendMessage',{chat_id:String(chatId),text:part,disable_web_page_preview:true}));
  return results;
}

async function handleTelegram(req,res,origin){
  if(!TELEGRAM_BOT_TOKEN) return sendJson(res,503,{ok:false,error:'Telegram bot token is not configured'},origin);
  let body;
  try { body=await readBody(req,8*1024*1024); } catch(e){ return sendJson(res,400,{ok:false,error:e.message},origin); }
  const method=String(body?.method||'').trim();
  const allowed=new Set(['sendMessage','sendPhoto','getMe']);
  if(!allowed.has(method)) return sendJson(res,400,{ok:false,error:'Telegram method is not allowed'},origin);
  try{
    if(method==='sendPhoto'){
      const payload=body?.payload||{};
      const raw=String(payload.photoDataUrl||'');
      const match=raw.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if(!match) return sendJson(res,400,{ok:false,error:'صورة Telegram غير صالحة'},origin);
      const mime=match[1]||'image/png';
      const bodyData=match[3]||'';
      const buffer=match[2]?Buffer.from(bodyData,'base64'):Buffer.from(decodeURIComponent(bodyData),'utf8');
      const form=new FormData();
      form.append('chat_id', String(payload.chat_id||''));
      if(payload.caption) form.append('caption', String(payload.caption).slice(0,1024));
      if(payload.disable_notification) form.append('disable_notification', 'true');
      form.append('photo', new Blob([buffer],{type:mime}), String(payload.filename||'oskar.png'));
      const response=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,{ method:'POST', body:form });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok===false) throw new Error(data?.description||`Telegram HTTP ${response.status}`);
      return sendJson(res,200,data,origin);
    }
    const data=await telegramCall(method,body?.payload||{});
    return sendJson(res,200,data,origin);
  }catch(e){
    console.error('Telegram proxy error:',e);
    return sendJson(res,502,{ok:false,error:String(e?.message||e)},origin);
  }
}

async function handleTelegramState(req,res,origin){
  let body;
  try { body=await readBody(req,2*1024*1024); } catch(e){ return sendJson(res,400,{ok:false,error:e.message},origin); }
  const tenantId=String(body?.tenantId||'local').replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,160)||'local';
  const recipients=[...new Set((Array.isArray(body?.recipients)?body.recipients:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,100);
  const text=String(body?.text||'').slice(0,250000);
  const requestedEnabled=body?.enabled!==false;
  const state=readTelegramState();
  const previous=state[tenantId]||{};
  const now=Date.now();
  if(!requestedEnabled){
    state[tenantId]={...previous,tenantId,enabled:false,recipients:[],updatedAt:new Date(now).toISOString()};
    writeTelegramState(state);
    return sendJson(res,200,{ok:true,managed:true,enabled:false,lastSentAt:state[tenantId].lastSentAt||null},origin);
  }
  if(!recipients.length) return sendJson(res,400,{ok:false,error:'No Telegram recipients'},origin);
  if(!text) return sendJson(res,400,{ok:false,error:'No report text'},origin);
  const intervalHours=Math.max(1,Math.min(168,Number(body?.intervalHours)||24));
  state[tenantId]={
    ...previous,
    tenantId,
    storeName:String(body?.storeName||previous.storeName||'أوسكار المحاسبي').slice(0,200),
    recipients,
    text,
    enabled:requestedEnabled,
    intervalHours,
    updatedAt:new Date(now).toISOString(),
    lastSentAt:previous.lastSentAt||new Date(now).toISOString(),
    lastError:previous.lastError||'',
  };
  writeTelegramState(state);
  return sendJson(res,200,{ok:true,managed:true,lastSentAt:state[tenantId].lastSentAt,nextDueAt:new Date(new Date(state[tenantId].lastSentAt).getTime()+intervalHours*3600000).toISOString()},origin);
}

let telegramScheduleBusy=false;
async function runTelegramSchedules(){
  if(telegramScheduleBusy||!TELEGRAM_BOT_TOKEN)return;
  telegramScheduleBusy=true;
  try{
    const state=readTelegramState(); let changed=false; const now=Date.now();
    for(const [tenantId,row] of Object.entries(state)){
      if(!row||row.enabled===false||!Array.isArray(row.recipients)||!row.recipients.length||!row.text)continue;
      const intervalMs=Math.max(1,Number(row.intervalHours)||24)*3600000;
      const last=new Date(row.lastSentAt||0).getTime();
      if(Number.isFinite(last)&&now-last<intervalMs)continue;
      try{
        for(const chatId of row.recipients) await sendTelegramLong(chatId,row.text);
        row.lastSentAt=new Date().toISOString(); row.lastSuccessAt=row.lastSentAt; row.lastError=''; changed=true;
        console.log(`Telegram 24h report sent for ${tenantId} to ${row.recipients.length} recipient(s)`);
      }catch(e){
        row.lastError=String(e?.message||e); row.lastAttemptAt=new Date().toISOString(); changed=true;
        console.error(`Telegram scheduled report failed for ${tenantId}:`,e);
      }
    }
    if(changed)writeTelegramState(state);
  }finally{telegramScheduleBusy=false;}
}
setInterval(()=>runTelegramSchedules().catch(()=>{}),60*1000);
setTimeout(()=>runTelegramSchedules().catch(()=>{}),5000);

// اكتشاف مستخدمي البوت في الخلفية: لا يحتاج أوسكار لعرض أو إدخال Chat ID.
setInterval(()=>refreshTelegramUsers({ maxBatches: 3 }).catch(e=>console.error('Telegram users background sync failed:', e?.message || e)), 15 * 1000);
setTimeout(()=>refreshTelegramUsers({ maxBatches: 5 }).catch(()=>{}), 1500);

const server=http.createServer(async(req,res)=>{
  const origin=String(req.headers.origin||'');
  if(req.method==='OPTIONS' && (req.url.startsWith('/api/oscar-ai') || req.url.startsWith('/api/telegram'))){
    const headers={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'};
    if(ALLOWED_ORIGIN && origin===ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin']=origin;
    res.writeHead(204,headers); return res.end();
  }
  if(req.url.startsWith('/api/oscar-ai')){
    if(req.method!=='POST') return sendJson(res,405,{error:'POST فقط'},origin);
    return handleAI(req,res,origin);
  }
  if(req.url.startsWith('/api/telegram/resolve')){
    if(req.method!=='POST') return sendJson(res,405,{ok:false,error:'POST فقط'},origin);
    return handleTelegramResolve(req,res,origin);
  }
  if(req.url.startsWith('/api/telegram/users')){
    if(req.method!=='POST') return sendJson(res,405,{ok:false,error:'POST فقط'},origin);
    return handleTelegramUsers(req,res,origin);
  }
  if(req.url.startsWith('/api/telegram/state')){
    if(req.method!=='POST') return sendJson(res,405,{ok:false,error:'POST فقط'},origin);
    return handleTelegramState(req,res,origin);
  }
  if(req.url.startsWith('/api/telegram')){
    if(req.method!=='POST') return sendJson(res,405,{ok:false,error:'POST فقط'},origin);
    return handleTelegram(req,res,origin);
  }
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { pathname='/'; }
  if(pathname==='/') pathname='/index.html';
  if(pathname.split('/').some(seg => seg.startsWith('.') && seg.length > 1)){res.writeHead(403);return res.end('Forbidden');}
  const filePath=path.resolve(ROOT,'.'+pathname);
  if(!filePath.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(filePath,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
    const ext=path.extname(filePath).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control': ext==='.html'?'no-cache':'public, max-age=300'});
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});
server.listen(PORT,()=>console.log(`Oscar Accounting + AI: http://localhost:${PORT}`));
