const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash:free';

const safe = (v) => String(v ?? '').trim();

export const getAIConfig = () => {
  try {
    const rt = window.OscarActivation?.readRuntime?.() || null;
    const ai = rt?.ai || {};
    return {
      provider: safe(ai.provider || 'openrouter') || 'openrouter',
      apiKey: safe(ai.apiKey),
      model: safe(ai.model || DEFAULT_MODEL) || DEFAULT_MODEL,
      source: ai.apiKey ? 'activation-file' : 'missing',
    };
  } catch {
    return { provider:'openrouter', apiKey:'', model:DEFAULT_MODEL, source:'missing' };
  }
};

export const getAIEndpoint = () => 'ملف دخول الشركة (.mzauth)';
export const setAIEndpoint = () => getAIEndpoint();

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الملف'));
  reader.readAsDataURL(file);
});

const stripFence = (text='') => String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
const parseJsonLoose = (text='') => {
  const clean = stripFence(text);
  try { return JSON.parse(clean); } catch {}
  const first = clean.indexOf('{'), last = clean.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(clean.slice(first, last + 1)); } catch {}
  }
  return null;
};

const actionTypes = [
  'create_product','create_purchase','create_customer','create_voucher','create_sales_return','export_data'
];

const assistantSystem = `أنت "أوسكار AI" داخل نظام أوسكار المحاسبي. هذه المحادثة مخصصة فقط لست فئات: إضافة صنف أو مجموعة أصناف، إضافة فاتورة مشتريات، إضافة عميل، سند قبض أو سند صرف، التقارير والتحليل، والمرتجعات. لا تنفذ أي نوع آخر من المهام ولا تقدم دعماً فنياً أو شرحاً لاستخدام البرنامج.

افهم العربية واللهجات والأرقام العربية والإنجليزية. استخدم أقل كلمات ممكنة ولا تخترع بيانات. يمكن أن تستقبل نصاً مكتوباً أو صوراً أو PDF أو ملف Excel تم تحويل محتواه إلى نص منظم.

قواعد التنفيذ:
1) التنفيذ مباشر من أول رسالة بدون نعم/تأكيد/تابع. لا يوجد تراجع من المحادثة.
2) لا تسأل عن أي حقل اختياري. استخدم "-" للنص الاختياري غير المذكور و0 للأرقام الاختيارية عند الحاجة. اسأل فقط عن معلومة إجبارية لا يمكن تنفيذ العملية بدونها.
3) إضافة الصنف: الاسم فقط إلزامي. إذا لم توجد وحدات استخدم وحدة حبة بعامل 1. افهم شجرة الوحدات مثل: "الكرتونة فيها 24 حبة" => units=[{name:"حبة",factor:1},{name:"كرتونة",factor:24}]. افهم المخزون الافتتاحي بأي وحدة مثل "10 كراتين و12 حبة" => openingStock=[{unitName:"كرتونة",quantity:10},{unitName:"حبة",quantity:12}]. الأسعار والباركود والتصنيف والحد الأدنى اختيارية ولا تسأل عنها. إذا كان المرفق Excel وفيه جدول أصناف، أنشئ create_product لكل صف صالح يحمل اسم صنف، وتجاهل الصفوف الفارغة والعناوين. لا تعد إنشاء صنف موجود في catalog بنفس الاسم أو SKU. إذا أُرفق Excel بدون نص وكان واضحاً أنه قائمة أصناف فاعتبر المطلوب إضافة الأصناف. لا تضع الحقول الاختيارية غير الموجودة في الملف لتقليل حجم JSON.
4) إضافة العميل: الاسم فقط إلزامي، واحفظ الاسم كاملاً كما كتبه المستخدم. مثال "ضيف عميل انور الندا" => name="انور الندا". الهاتف والعنوان والملاحظات غير إلزامية ولا تسأل عنها.
5) فاتورة المشتريات: المورد والبنود ضروريان. المخزن غير المذكور = الافتراضي. paidAmount غير المذكور = 0 (دين). رقم فاتورة المورد والتاريخ والملاحظات اختيارية. افهم الصورة أو PDF أو Excel أو النص المرفق، وطابق الأصناف والوحدات الموجودة. إذا كان الصنف غير موجود لا تنشئه ضمن فاتورة المشتريات تلقائياً؛ أبلغ أن الصنف يحتاج إضافته كصنف مستقل.
6) سند القبض/الصرف: المبلغ ضروري. إذا الحساب غير مذكور استخدم الحساب الافتراضي، وإن لم يوجد افتراضي ويوجد حساب واحد استخدمه. الطرف اختياري ويمكن أن يكون customer/supplier/other. النوع receipt للقبض وpayment للصرف.
7) المرتجع: المقصود مرتجع مبيعات. طابق فاتورة البيع الأصلية والأصناف والكميات ولا تتجاوز الكمية المباعة. إذا العميل مسجل ولم يذكر طريقة الرد استخدم customer_balance، وإذا نقدي استخدم account والحساب الافتراضي.
8) التقارير: لا تنشئ action لمجرد سؤال المستخدم عن رقم أو تحليل. أجب من بيانات النظام الحالية. "الربح" يعني reportMetrics.*.netProfit من نفس منطق تقرير الأرباح، وليس المبيعات. استخدم analytics للأكثر مبيعاً والناقص والراكد وforecast للتوقعات. إذا طلب المستخدم تصدير بيانات/تقرير، استخدم export_data فقط.
9) إذا طلب أي شيء خارج الفئات الست، أجب فقط: "المحادثة مخصصة للأصناف والمشتريات والعملاء والسندات والتقارير والمرتجعات."
10) أسماء الوحدات المتكافئة: حبة/قطعة/pcs/piece؛ كرتونة/كرتون/carton/box؛ باكيت/pack؛ مشطاح/طبلية/pallet؛ كيلو/kg؛ غرام/g؛ لتر/l؛ مل/ml؛ دزينة/dozen؛ كيس/bag.

أنواع action المسموحة فقط:
${actionTypes.join(', ')}

أشكال data:
create_product: {name,shortName,sku,internalCode,categoryName,brand,costPrice,sellingPrice,reorderPoint,expiryDate,taxRate,salesChannel,units:[{name,factor,salePrice,costPrice,barcodes:[]}],openingStock:[{unitName,quantity}]}
create_purchase: {supplierId,supplierName,supplierPhone,supplierInvoiceNumber,date,warehouseId,warehouseName,paidAmount,accountId,accountName,discountType,discountValue,notes,items:[{productId,productName,unitId,unitName,quantity,unitPrice,expiryDate}]}
create_customer: {name,phone,address,notes}
create_voucher: {type:"receipt"|"payment",partyType:"customer"|"supplier"|"other",partyId,partyName,amount,sourceType:"account"|"none",accountId,accountName,date,notes}
create_sales_return: {originalInvoiceId,invoiceNumber,refundMode,refundAccountId,refundAccountName,notes,items:[{productId,productName,unitId,unitName,quantity,unitPrice}]}
export_data: {dataset:"sales"|"purchases"|"products"|"inventory"|"customers"|"suppliers"|"expenses"|"accounts"|"vouchers",format:"csv"|"json",fileName}

أرجع JSON فقط بلا Markdown:
{"answer":"رد عربي قصير جداً أو السؤال الضروري فقط","needs_confirmation":false,"missing_fields":[],"action":null,"actions":[]}
إذا كانت عملية واحدة ضعها في action. إذا كان ملف Excel يحتوي عدة أصناف ضع كل صنف في actions. للتقارير التحليلية action=null والجواب في answer.`;

const scanSystem = `أنت محرك قراءة فاتورة مشتريات داخل أوسكار المحاسبي. قد تستقبل صوراً أو PDF أو Excel محولاً إلى نص منظم أو نصاً مكتوباً أو أكثر من نوع معاً.
استخرج المورد ورقم الفاتورة والتاريخ والعملة والخصم والمدفوع وكل البنود. لا تخترع رقماً غير ظاهر/مذكور.
افهم الوحدات المتكافئة لغوياً: حبة/قطعة/pcs، كرتونة/carton/box، باكيت/pack، مشطاح/طبلية/pallet، كيلو/kg، غرام/g، لتر/l، مل/ml، دزينة/dozen، كيس/bag.
قد تكون عدة صور أو صفحات PDF أو أوراق Excel؛ اجمعها وتجنب تكرار البنود المتداخلة. إذا النص يضيف المورد أو المدفوع فادمجه مع المرفقات.
أرجع JSON فقط:
{"supplier":{"name":"","phone":"","taxNumber":""},"invoiceNumber":"","date":null,"currency":"","subtotal":0,"discount":0,"grandTotal":0,"paidAmount":null,"items":[{"name":"","barcode":"","unit":"","quantity":1,"unitPrice":0,"total":0,"confidence":0}],"confidence":0,"warnings":[]}`;

const normText = (v='') => String(v).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const extractFullEntityName = (text, entityWord) => {
  const raw=String(text||'').trim();
  const startRe=new RegExp(`(?:ضيف|اضف|أضف|انشئ|أنشئ|سجل|اعمل)\\s+(?:لي\\s+)?${entityWord}(?:\\s+باسم)?\\s+(.+)$`,'i');
  const m=raw.match(startRe); if(!m)return '';
  let name=m[1].trim();
  name=name.split(/\s+(?:رقمه|رقم|هاتف|الهاتف|جوال|تلفون|العنوان|عنوان|ملاحظات|ملاحظة|ملاحظه|رصيده|رصيد|برصيد|phone|address)\s*[:：-]?\s*/i)[0].trim();
  return name.replace(/[،,;.]+$/,'').trim();
};
const simpleActionFromText=(q)=>{
  const customer=extractFullEntityName(q,'عميل');
  if(customer)return {type:'create_customer',label:`إضافة العميل ${customer}`,data:{name:customer,phone:'-',address:'-',notes:'-'}};
  return null;
};
const applyInputCorrections=(action,q)=>{
  if(!action||typeof action!=='object')return action;
  const a={...action,data:{...(action.data||{})}};
  if(a.type==='create_product'){
    a.data.name=safe(a.data.name);
    if(!Array.isArray(a.data.units)||!a.data.units.length)a.data.units=[{name:'حبة',factor:1}];
    if(!Array.isArray(a.data.openingStock))a.data.openingStock=[];
  }
  if(a.type==='create_customer'){
    const full=extractFullEntityName(q,'عميل'); if(full)a.data.name=full;
    a.data.phone=safe(a.data.phone)||'-'; a.data.address=safe(a.data.address)||'-'; a.data.notes=safe(a.data.notes)||'-';
  }
  if(a.type==='create_purchase'){
    if(a.data.paidAmount==null||a.data.paidAmount==='')a.data.paidAmount=0;
    a.data.notes=safe(a.data.notes)||'-';
  }
  if(a.type==='create_voucher') a.data.notes=safe(a.data.notes)||'-';
  return a;
};
const requiredMissing=(a)=>{
  const d=a?.data||{};
  switch(a?.type){
    case 'create_product': return safe(d.name)?[]:['اسم الصنف'];
    case 'create_customer': return safe(d.name)?[]:['الاسم'];
    case 'create_purchase': return [...(!safe(d.supplierName)&&!safe(d.supplierId)?['المورد']:[]),...(!Array.isArray(d.items)||!d.items.length?['أصناف الفاتورة']:[])];
    case 'create_voucher': return Number(d.amount)>0?[]:['المبلغ'];
    case 'create_sales_return': return [...(!safe(d.originalInvoiceId)&&!safe(d.invoiceNumber)?['رقم فاتورة البيع']:[]),...(!Array.isArray(d.items)||!d.items.length?['أصناف المرتجع وكمياتها']:[])];
    case 'export_data': return safe(d.dataset)?[]:['نوع التقرير'];
    default:return [];
  }
};

const compactContextForQuery = (context={}, query='', hasFiles=false) => {
  const q=normText(query);
  const base={generatedAt:context.generatedAt,currency:context.currency,storeName:context.storeName,activeTab:context.activeTab,kpis:context.kpis,accounts:context.accounts,warehouses:context.warehouses,reportMetrics:context.reportMetrics};
  const wants=(re)=>re.test(q);
  const needsAnalytics=wants(/ربح|ارباح|أرباح|مصروف|دخل|ايراد|إيراد|اكثر|أكثر|مبيع|مطلوب|طلب|اقترح|اقتراح|ناقص|نقص|راكده|راكدة|راكد|متوقع|توقع|تحليل|اقتصاد|نمو|اوردر|أوردر/);
  const needsProducts=hasFiles||needsAnalytics||wants(/بيع|مبيع|شراء|مشتريات|صنف|منتج|مخزون|جرد|تحويل|مرتجع|باركود|وحد|وحدة|وحدات/);
  const needsCustomers=wants(/عميل|دين|ديون|مبيع|بيع|مرتجع|قبض/);
  const needsSuppliers=wants(/مورد|مشتريات|شراء|دفع/);
  const needsSales=hasFiles||needsAnalytics||wants(/فاتور|مبيع|بيع|مرتجع/);
  const needsPurchases=hasFiles||wants(/فاتور|شراء|مشتريات|مورد|اوردر|أوردر/);
  const needsExpenses=needsAnalytics||wants(/مصروف|نثري|عامل|كهرب/);
  if(needsAnalytics){base.analytics=context.analytics;base.forecast=context.forecast;}
  if(needsProducts){
    const tokens=q.split(' ').filter(x=>x.length>=2);
    const all=context.catalog||[];
    const matched=all.filter(p=>{const z=normText(`${p.name||''} ${p.sku||''} ${p.internalCode||''}`);return tokens.some(tok=>z.includes(tok));});
    base.catalog=[...matched,...all.filter(x=>!matched.includes(x)).slice(0,100)].slice(0,150);
    base.categories=(context.categories||[]).slice(0,100); base.lowStock=(context.lowStock||[]).slice(0,50);
  }
  if(needsCustomers)base.customers=(context.customers||[]).slice(0,220);
  if(needsSuppliers)base.suppliers=(context.suppliers||[]).slice(0,220);
  if(needsSales)base.recentSales=(context.recentSales||[]).slice(0,120);
  if(needsPurchases)base.recentPurchases=(context.recentPurchases||[]).slice(0,100);
  if(needsExpenses)base.recentExpenses=(context.recentExpenses||[]).slice(0,120);
  if(wants(/اعداد|إعداد|اسم المحل|اسم المتجر|شعار|لوجو|عمله|عملة|ثيم|طباعه|طباعة|ضريبه|ضريبة/))base.settings=context.settings;
  if(wants(/موظف|صلاحيات|كاشير|مدير|جرسون|محاسب/))base.employees=context.employees;
  if(wants(/مطعم|طاول|مطبخ|جرسون|حجز|حجوزات|هالك|وصفه|وصفة|طلبات المطعم/))base.restaurant=context.restaurant;
  return base;
};

const openRouterCall = async (messages, { temperature=0.15, max_tokens=2600, signal } = {}) => {
  const cfg = getAIConfig();
  if (!cfg.apiKey) throw new Error('ملف دخول الشركة لا يحتوي على مفتاح Oscar AI. نزّل ملف دخول جديد من لوحة الأدمن.');
  if (cfg.provider !== 'openrouter') throw new Error(`مزود AI غير مدعوم: ${cfg.provider}`);
  const headers = {'Authorization':`Bearer ${cfg.apiKey}`,'Content-Type':'application/json','X-Title':'Oscar Accounting POS AI'};
  try { if (/^https?:$/i.test(location.protocol) && location.origin) headers['HTTP-Referer'] = location.origin; } catch {}
  const requestModel = async (model) => {
    const res = await fetch(OPENROUTER_URL,{method:'POST',headers,credentials:'omit',cache:'no-store',signal,body:JSON.stringify({model,messages,temperature,max_tokens})});
    const data = await res.json().catch(() => ({}));
    return {res,data,model};
  };
  let attempt=await requestModel(cfg.model);
  if(!attempt.res.ok&&cfg.model==='google/gemini-2.5-flash:free'&&![401,403,429].includes(attempt.res.status))attempt=await requestModel('openrouter/free');
  const {res,data,model}=attempt;
  if(!res.ok){
    const msg=data?.error?.message||data?.message||`OpenRouter HTTP ${res.status}`;
    if(res.status===401||res.status===403)throw new Error('مفتاح Oscar AI الموجود في ملف الدخول غير صالح أو لا يملك صلاحية. نزّل ملف دخول محدث من الأدمن.');
    throw new Error(msg);
  }
  const content=data?.choices?.[0]?.message?.content;
  const text=Array.isArray(content)?content.map(x=>x?.text||x?.content||'').join('\n'):String(content||'');
  return {text,model:data?.model||model};
};

const withTimeout = async (ms, fn) => {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fn(controller.signal);}catch(err){if(err?.name==='AbortError')throw new Error('انتهت مهلة اتصال الذكاء الاصطناعي. حاول مرة أخرى.');throw err;}finally{clearTimeout(timer);}
};
const isExcelFile = (file) => {
  const type=String(file?.type||'').toLowerCase();
  const name=String(file?.name||'').toLowerCase();
  return type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || type==='application/vnd.ms-excel' || /\.(xlsx|xls)$/i.test(name);
};

const excelFileToText = async (file) => {
  let XLSX;
  try { XLSX = await import('xlsx'); }
  catch { throw new Error('تعذر تحميل قارئ Excel. تأكد من اتصال الإنترنت ثم حاول مرة أخرى.'); }
  const buffer=await file.arrayBuffer();
  let workbook;
  try { workbook=XLSX.read(buffer,{type:'array',cellDates:true,raw:false}); }
  catch { throw new Error(`تعذر قراءة ملف Excel: ${String(file?.name||'الملف')}`); }
  const chunks=[`[ملف Excel: ${String(file?.name||'Excel')}]`];
  let chars=chunks[0].length, totalRows=0;
  for(const sheetName of (workbook.SheetNames||[]).slice(0,8)){
    const sheet=workbook.Sheets?.[sheetName]; if(!sheet)continue;
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
    if(!rows.length)continue;
    chunks.push(`\n[ورقة: ${sheetName}]`); chars+=sheetName.length+12;
    for(const row of rows.slice(0,250)){
      const values=(Array.isArray(row)?row:[]).map(v=>String(v??'').replace(/[\t\r\n]+/g,' ').trim());
      if(!values.some(Boolean))continue;
      const line=values.join('\t').slice(0,2500);
      if(chars+line.length>70000 || totalRows>=600){chunks.push('[تم اختصار بقية الصفوف لتقليل حجم الطلب]');return chunks.join('\n');}
      chunks.push(line); chars+=line.length+1; totalRows++;
    }
  }
  return chunks.join('\n');
};

const fileParts = async (files=[]) => {
  const usable=(Array.isArray(files)?files:[]).slice(0,6).filter(f=>{
    const type=String(f?.type||'').toLowerCase(); const name=String(f?.name||'').toLowerCase();
    return !!f && (type.startsWith('image/') || type==='application/pdf' || name.endsWith('.pdf') || isExcelFile(f));
  });
  const parts=[];
  for(const f of usable){
    if(isExcelFile(f)){
      const text=await excelFileToText(f);
      parts.push({type:'text',text});
      continue;
    }
    const url=await fileToDataUrl(f);
    const isPdf=String(f?.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(String(f?.name||''));
    if(isPdf)parts.push({type:'file',file:{filename:String(f.name||'document.pdf'),file_data:url}});
    else parts.push({type:'image_url',image_url:{url}});
  }
  return parts;
};

export const askOscar = async ({ message, history=[], context={}, files=[] }={}) => withTimeout(120000, async signal => {
  const cleanHistory=(Array.isArray(history)?history:[]).slice(-5).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,900)}));
  const q=String(message||'').slice(0,4000);
  const media=await fileParts(files);
  const compactContext=compactContextForQuery(context||{},q,media.length>0);
  const contextText=JSON.stringify(compactContext).slice(0,110000);
  const userContent=media.length?[{type:'text',text:q||'نفذ المطلوب من الملف المرفق حسب بيانات النظام.'},...media]:q;
  const messages=[{role:'system',content:assistantSystem},{role:'system',content:`بيانات النظام الحالية (JSON):\n${contextText}`},...cleanHistory,{role:'user',content:userContent}];
  const hasExcel=(Array.isArray(files)?files:[]).some(isExcelFile);
  const out=await openRouterCall(messages,{temperature:0.05,max_tokens:hasExcel?6500:2200,signal});
  const parsed=parseJsonLoose(out.text);
  if(parsed){
    let actions=Array.isArray(parsed.actions)?parsed.actions.filter(Boolean):[];
    let action=parsed.action||(actions.length===1?actions[0]:null);
    if(action&&!actions.length)actions=[action];
    if(!actions.length){const simple=simpleActionFromText(q);if(simple)actions=[simple];}
    actions=actions.filter(a=>actionTypes.includes(a?.type)).map(a=>applyInputCorrections(a,q));
    action=actions.length===1?actions[0]:null;
    const mandatory=[...new Set(actions.flatMap(requiredMissing))];
    const uniqueMandatory=[...new Set(mandatory)];
    const optionalOnly=(Array.isArray(parsed.missing_fields)?parsed.missing_fields:[]).filter(x=>uniqueMandatory.includes(x));
    const missing=uniqueMandatory.length?uniqueMandatory:optionalOnly;
    return {answer:String(parsed.answer|| (missing.length?'اذكر البيانات الضرورية فقط.':'تم.')),action,actions,needs_confirmation:false,missing_fields:missing,model:out.model};
  }
  const simple=simpleActionFromText(q);
  if(simple)return {answer:'تم.',action:simple,actions:[simple],needs_confirmation:false,missing_fields:[],model:out.model};
  return {answer:out.text||'لم يصل رد.',action:null,actions:[],needs_confirmation:false,missing_fields:[],model:out.model};
});

export const scanPurchaseInvoice = async ({ files=[], text='', catalog={} }={}) => {
  if(!files.length&&!String(text||'').trim())throw new Error('أرفق صورة أو PDF أو Excel للفاتورة أو اكتب بيانات الفاتورة');
  const attachments=await fileParts(files);
  return withTimeout(120000, async signal => {
    const supplierNames=(catalog.suppliers||[]).slice(0,250).map(x=>x?.name).filter(Boolean);
    const productList=(catalog.products||[]).slice(0,700).map(p=>({name:p?.name,sku:p?.sku,units:(p?.units||[]).map(u=>u?.name).filter(Boolean)}));
    const prompt=`اقرأ/حلل فاتورة المشتريات.\nنص المستخدم الإضافي: ${String(text||'').slice(0,6000)||'(لا يوجد)'}\nالموردون الموجودون للمساعدة في المطابقة: ${JSON.stringify(supplierNames)}\nالأصناف والوحدات الموجودة للمساعدة فقط: ${JSON.stringify(productList)}`;
    const content=attachments.length?[{type:'text',text:prompt},...attachments]:prompt;
    const out=await openRouterCall([{role:'system',content:scanSystem},{role:'user',content}],{temperature:0.03,max_tokens:3000,signal});
    const parsed=parseJsonLoose(out.text); if(!parsed)throw new Error('تعذر تفسير نتيجة قراءة الفاتورة. حاول بملف أو نص أوضح.');
    return {result:parsed,model:out.model};
  });
};

export const aiHealthCheck = async () => withTimeout(30000, async signal => {
  const out=await openRouterCall([{role:'system',content:'Reply with only OK.'},{role:'user',content:'OK?'}],{temperature:0,max_tokens:3,signal});
  return {ok:true,model:out.model};
});
