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

const server=http.createServer(async(req,res)=>{
  const origin=String(req.headers.origin||'');
  if(req.method==='OPTIONS' && req.url.startsWith('/api/oscar-ai')){
    const headers={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'};
    if(ALLOWED_ORIGIN && origin===ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin']=origin;
    res.writeHead(204,headers); return res.end();
  }
  if(req.url.startsWith('/api/oscar-ai')){
    if(req.method!=='POST') return sendJson(res,405,{error:'POST فقط'},origin);
    return handleAI(req,res,origin);
  }
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { pathname='/'; }
  if(pathname==='/') pathname='/index.html';
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
