import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from './context__AppContext.js?v=7.9.4.12-motion-120hz';
import { X, Bell, CreditCard, PackageX, History, CalendarClock, Truck, AlertTriangle } from 'lucide-react';

const h = React.createElement;
const DAY = 86400000;
const daysAgo = value => {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) && t > 0 ? Math.max(0, Math.floor((Date.now() - t) / DAY)) : null;
};
const expiryDays = value => {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) && t > 0 ? Math.ceil((t - Date.now()) / DAY) : null;
};

export function buildSystemNotifications(app) {
  const { customers=[], suppliers=[], products=[], invoices=[], settings={}, getProductStock } = app || {};
  const alerts = [];
  const warehouseId = settings.activeWarehouseId;
  const now = Date.now();
  const outstandingOldest = new Map();
  const lastSaleByProduct = new Map();

  // دورة واحدة فقط على الفواتير حتى تظل الإشعارات خفيفة حتى مع آلاف السجلات.
  for (const inv of invoices) {
    if (inv?.deletedAt) continue;
    const t = new Date(inv.date || 0).getTime();
    if (inv?.type === 'sale' && Number(inv?.remainingAmount) > 0 && inv?.customerId && Number.isFinite(t)) {
      const prev = outstandingOldest.get(inv.customerId);
      if (!prev || t < prev) outstandingOldest.set(inv.customerId, t);
    }
    if (inv?.type === 'sale' && Number.isFinite(t)) {
      for (const item of (inv.items || [])) {
        if (!item?.productId) continue;
        if (t > (lastSaleByProduct.get(item.productId) || 0)) lastSaleByProduct.set(item.productId, t);
      }
    }
  }

  for (const customer of customers) {
    if (customer?.deletedAt || Number(customer?.balance) <= 0) continue;
    const oldestTs = outstandingOldest.get(customer.id);
    const fallbackTs = new Date(customer?.updatedAt || customer?.createdAt || 0).getTime();
    const baseTs = oldestTs || (Number.isFinite(fallbackTs) ? fallbackTs : 0);
    const age = baseTs > 0 ? Math.max(0, Math.floor((now - baseTs) / DAY)) : null;
    if (age === null || age >= 7) alerts.push({
      id:`debt-${customer.id}`, type:'debt', tab:'customers', Icon:CreditCard, tone:'rose',
      title:`دين متأخر: ${customer.name}`,
      text:`المتبقي ${Number(customer.balance).toFixed(2)} ${settings.currencySymbol || ''}${age!==null?` • منذ ${age} يوم`:''}`
    });
  }

  for (const product of products) {
    if (product?.deletedAt || product?.status === 'archived') continue;
    const qty = Number(getProductStock?.(product.id, warehouseId) || 0);
    const reorder = Number(product.reorderPoint ?? 0);
    if (qty < 0) alerts.push({
      id:`negative-${product.id}`, type:'negative', tab:'inventory', Icon:AlertTriangle, tone:'rose',
      title:`رصيد سالب: ${product.name}`, text:`الرصيد الحالي ${qty} ${product.baseUnitName || ''}`
    });
    if (qty <= reorder) alerts.push({
      id:`low-${product.id}`, type:'low', tab:'inventory', Icon:PackageX, tone:'amber',
      title:`مخزون ناقص: ${product.name}`,
      text:`المتوفر ${qty} ${product.baseUnitName || ''} • حد إعادة الطلب ${reorder}`
    });
    if (qty > 0) {
      const lastSale = lastSaleByProduct.get(product.id);
      const idleDays = lastSale ? Math.floor((now-lastSale)/DAY) : null;
      if (!lastSale || idleDays >= 30) alerts.push({
        id:`stale-${product.id}`, type:'stale', tab:'products', Icon:History, tone:'slate',
        title:`صنف راكد: ${product.name}`,
        text:lastSale ? `لم يُبع منذ ${idleDays} يوم • الرصيد ${qty}` : `لا توجد له مبيعات مسجلة • الرصيد ${qty}`
      });
    }
    const dates = [product.expiryDate, ...(Array.isArray(product.fifoBatches)?product.fifoBatches.filter(b=>Number(b?.remainingBaseQty)>0).map(b=>b.expiryDate):[])].filter(Boolean);
    let nearest = null;
    for (const d of dates) {
      const t = new Date(d).getTime();
      if (Number.isFinite(t) && (!nearest || t < nearest)) nearest = t;
    }
    if (nearest) {
      const left = Math.ceil((nearest - now) / DAY);
      if (left <= 30) alerts.push({
        id:`expiry-${product.id}`, type:'expiry', tab:'inventory', Icon:CalendarClock, tone:left < 0?'rose':'amber',
        title:`${left < 0 ? 'صلاحية منتهية' : 'صلاحية قريبة'}: ${product.name}`,
        text:left < 0 ? `منتهي منذ ${Math.abs(left)} يوم` : `متبقي ${left} يوم حتى الانتهاء`
      });
    }
  }

  for (const supplier of suppliers) if (!supplier?.deletedAt && Number(supplier?.balance) > 0) alerts.push({
    id:`supplier-${supplier.id}`, type:'supplier', tab:'suppliers', Icon:Truck, tone:'blue',
    title:`مستحق لمورد: ${supplier.name}`,
    text:`المبلغ المستحق ${Number(supplier.balance).toFixed(2)} ${settings.currencySymbol || ''}`
  });

  const order = {negative:0,debt:1,expiry:2,low:3,stale:4,supplier:5};
  return alerts.sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)).slice(0,300);
}

export const NotificationsModal = ({ open, onClose }) => {
  const app = useApp();
  const alerts = useMemo(() => buildSystemNotifications(app), [app.customers, app.suppliers, app.products, app.invoices, app.stock, app.settings.activeWarehouseId]);
  if (!open) return null;
  const tone = t => ({rose:'border-rose-200 bg-rose-50 text-rose-700',amber:'border-amber-200 bg-amber-50 text-amber-700',blue:'border-blue-200 bg-blue-50 text-blue-700',slate:'border-slate-200 bg-slate-50 text-slate-700'}[t] || 'border-slate-200 bg-white text-slate-700');

  const modal = h('div',{
      className:'fixed inset-x-0 oscar-bounded-modal flex items-center justify-center overflow-hidden',
      style:{zIndex:2147483000,background:'rgba(15,23,42,.52)',padding:'12px',backdropFilter:'blur(2px)',WebkitBackdropFilter:'blur(2px)'},
      onClick:onClose
    },
    h('section',{
        className:'bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col',
        style:{width:'min(430px, calc(100vw - 24px))',maxHeight:'min(72vh, calc(100% - 24px))',borderRadius:'18px'},
        onClick:e=>e.stopPropagation()
      },
      h('header',{className:'shrink-0 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2'},
        h('div',{className:'flex items-center gap-2 min-w-0'},
          h('div',{className:'w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0'},h(Bell,{className:'w-4 h-4'})),
          h('div',{className:'min-w-0'},
            h('div',{className:'text-sm font-black text-slate-900 dark:text-white truncate'},'الإشعارات والتنبيهات'),
            h('div',{className:'text-[10px] font-bold text-slate-500 dark:text-slate-400'},`${alerts.length} تنبيه يحتاج المراجعة`)
          )
        ),
        h('button',{type:'button',onClick:onClose,className:'w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0',title:'إغلاق'},h(X,{className:'w-4 h-4'}))
      ),
      h('div',{className:'flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 custom-scrollbar',style:{overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}},
        alerts.length===0
          ? h('div',{className:'min-h-44 flex flex-col items-center justify-center text-center text-slate-400'},h(Bell,{className:'w-10 h-10 opacity-20'}),h('div',{className:'mt-2 text-sm font-black'},'لا توجد تنبيهات حالياً'))
          : alerts.map(a=>h('button',{
              key:a.id,type:'button',
              onClick:()=>{app.setActiveTab?.(a.tab);onClose?.();},
              className:`w-full text-right rounded-xl border px-2.5 py-2.5 flex items-start gap-2.5 ${tone(a.tone)}`
            },
            h('div',{className:'w-7 h-7 rounded-lg bg-white/80 flex items-center justify-center shrink-0'},h(a.Icon,{className:'w-3.5 h-3.5'})),
            h('div',{className:'min-w-0 flex-1'},
              h('div',{className:'text-[12px] font-black leading-5'},a.title),
              h('div',{className:'text-[10.5px] font-semibold opacity-80 leading-4 mt-0.5'},a.text)
            )
          ))
      )
    )
  );
  return createPortal(modal, document.body);
};
