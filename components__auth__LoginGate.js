import React, { useEffect, useRef, useState } from 'react';
import { Upload, ShieldCheck, Building2, Wifi, WifiOff, Database, LogIn } from 'lucide-react';
import { DEFAULT_LOGO_DATA_URL } from './brand__logo.js?v=7.9.4.12-motion-120hz';
const h=React.createElement;
export const LoginGate=({children})=>{
 const A=()=>window.OscarActivation;
 const [runtime,setRuntime]=useState(()=>A()?.readRuntime?.()||null);
 const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inputRef=useRef(null);
 useEffect(()=>{if(!runtime)return; if(navigator.onLine!==false){const fake={...runtime,app:A()?.constants?.APP_TAG,database:A()?.readDatabaseAccess?.(runtime.companyId)||runtime.database};A()?.verifyPayload?.(fake,{allowOffline:true}).catch(e=>{const msg=String(e?.message||e);if(/تم إيقاف|انتهت مدة|لا يطابق|غير مسجل|ملف مدير أحدث/.test(msg)){A()?.clearRuntime?.();setRuntime(null);setError(msg)}})}},[]);
 const open=async()=>{if(!file){setError('اختر ملف الدخول .mzauth أولاً.');return}setBusy(true);setError('');try{const payload=await A().parseActivationFile(file);await A().verifyPayload(payload,{allowOffline:true});const rt=A().activatePayload(payload);window.OscarCloudSync?.resetForTenant?.();setRuntime(rt)}catch(e){setError(String(e?.message||e||'تعذر فتح ملف الدخول.'))}finally{setBusy(false)}};
 if(runtime)return children;
 return h('div',{className:'min-h-[100dvh] bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 font-[Cairo]'},
  h('div',{className:'w-full max-w-5xl grid lg:grid-cols-2 bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800'},
   h('section',{className:'hidden lg:flex bg-gradient-to-br from-emerald-700 to-emerald-950 text-white p-10 flex-col justify-between'},
    h('div',null,h('img',{src:DEFAULT_LOGO_DATA_URL,className:'w-20 h-20 rounded-2xl bg-white object-contain p-1 mb-6'}),h('h1',{className:'text-3xl font-black'},'أوسكار المحاسبي'),h('p',{className:'mt-2 text-emerald-100 text-sm leading-7'},'نظام متعدد الشركات — كل شركة ببياناتها وقاعدتها ومزامنتها المستقلة.')),
    h('div',{className:'grid gap-3 text-sm'},
      h('div',{className:'flex gap-3 items-center'},h(ShieldCheck,{className:'w-5 h-5'}),h('span',null,'دخول مشفر بملف .mzauth')),
      h('div',{className:'flex gap-3 items-center'},h(Database,{className:'w-5 h-5'}),h('span',null,'عزل كامل لكل شركة وقاعدة بيانات')),
      h('div',{className:'flex gap-3 items-center'},h(Wifi,{className:'w-5 h-5'}),h('span',null,'مزامنة مباشرة بين الأجهزة وتحديث الشاشة المفتوحة'))
    )),
   h('section',{className:'p-6 sm:p-10 flex flex-col justify-center'},
    h('div',{className:'flex items-center gap-3 mb-7'},h('img',{src:DEFAULT_LOGO_DATA_URL,className:'w-14 h-14 rounded-2xl object-contain border bg-white'}),h('div',null,h('div',{className:'text-[11px] font-bold text-emerald-600'},'دخول آمن'),h('h2',{className:'text-xl font-black text-slate-900 dark:text-white'},'فتح ملف الشركة'))),
    h('button',{type:'button',onClick:()=>inputRef.current?.click(),className:`w-full min-h-44 rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center gap-3 transition ${file?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20':'border-slate-300 dark:border-slate-700 hover:border-emerald-400'}`},h(Upload,{className:'w-9 h-9 text-emerald-600'}),h('b',{className:'text-sm text-slate-800 dark:text-white'},file?'تم اختيار ملف الدخول':'اضغط لاختيار ملف الدخول'),h('span',{className:'text-xs text-slate-500 break-all'},file?.name||'ملفات أوسكار المشفرة .mzauth')),
    h('input',{ref:inputRef,type:'file',accept:'.mzauth',className:'hidden',onChange:async e=>{const f=e.target.files?.[0]||null;setFile(f);setError('');if(f)try{await A().primeActivationFile(f)}catch(err){setError(String(err?.message||err))}}}),
    error?h('div',{className:'mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold'},error):null,
    h('button',{type:'button',disabled:busy,onClick:open,className:'mt-4 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black flex items-center justify-center gap-2'},busy?h('span',{className:'w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin'}):h(LogIn,{className:'w-5 h-5'}),h('span',null,busy?'جاري التحقق وفتح الشركة...':'فتح النظام')),
    h('div',{className:'mt-4 flex items-start gap-2 text-[11px] text-slate-500'},navigator.onLine!==false?h(Wifi,{className:'w-4 h-4 text-emerald-500 shrink-0'}):h(WifiOff,{className:'w-4 h-4 text-amber-500 shrink-0'}),h('span',null,'يعمل النظام محلياً بالكامل حتى بدون إنترنت. تحفظ العمليات على الجهاز وتتم مزامنتها تلقائياً عند عودة الاتصال.'))
   )
  )
 )
};