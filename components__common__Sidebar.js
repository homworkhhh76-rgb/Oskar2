import React from 'react';
import { useApp } from './context__AppContext.js';
import { getBrandLogoDataUrl, DEFAULT_LOGO_DATA_URL } from './brand__logo.js';
import { LayoutDashboard, ShoppingCart, ReceiptText, Truck, Package, Boxes, Warehouse, Users, Building2, Wallet, Receipt, FileSpreadsheet, UserCheck, Barcode, BarChart3, Trash2, Settings } from 'lucide-react';

const h = React.createElement;

export const Sidebar = () => {
  const { activeTab, setActiveTab, cart, vouchers, employees, mobileSidebarOpen, setMobileSidebarOpen, settings } = useApp();
  const navItems = [
    { id:'pos', label:'الكاشير POS', icon:ShoppingCart, badge:cart.length || undefined },
    { id:'dashboard', label:'لوحة التحكم', icon:LayoutDashboard },
    { id:'sales', label:'المبيعات والفواتير', icon:ReceiptText },
    { id:'purchases', label:'المشتريات والتوريد', icon:Truck },
    { id:'vouchers', label:'سندات القبض والصرف', icon:FileSpreadsheet, badge:vouchers.length || undefined },
    { id:'employees', label:'الموظفون والصلاحيات', icon:UserCheck, badge:employees.length || undefined },
    { id:'products', label:'إدارة الأصناف', icon:Package },
    { id:'categories', label:'التصنيفات', icon:Boxes },
    { id:'inventory', label:'المخزون والتحويلات', icon:Warehouse },
    { id:'customers', label:'العملاء والديون', icon:Users },
    { id:'suppliers', label:'الموردون والحسابات', icon:Building2 },
    { id:'accounts', label:'الصندوق والورديات', icon:Wallet },
    { id:'expenses', label:'المصروفات اليومية', icon:Receipt },
    { id:'barcodes', label:'طباعة الباركود', icon:Barcode },
    { id:'reports', label:'التقارير والأرباح', icon:BarChart3 },
    { id:'trash', label:'سلة المحذوفات', icon:Trash2 },
    { id:'settings', label:'إعدادات النظام', icon:Settings },
  ];
  const go = (id) => { setActiveTab(id); setMobileSidebarOpen(false); };
  const brand = (compact=false) => h('div', { className:`${compact?'p-3 pl-12':'p-3.5'} border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0` },
    h('button', { type:'button', onClick:()=>go('pos'), className:'w-full flex items-center gap-2.5 text-right min-w-0' },
      h('img', { src:getBrandLogoDataUrl(settings), onError:e=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_LOGO_DATA_URL;}, className:'w-10 h-10 object-contain rounded-xl border border-emerald-100 bg-white shrink-0', alt:settings.storeName || 'أوسكار المحاسبي' }),
      h('div', { className:'min-w-0 flex-1' },
        h('div', { className:'text-[13px] font-black text-slate-900 dark:text-white truncate' }, settings.storeName || 'أوسكار المحاسبي'),
        h('div', { className:'text-[10px] font-bold text-emerald-600 truncate' }, settings.subtitle || 'إدارة ذكية')
      )
    )
  );
  const nav = (mobile=false) => h('nav', { className:`${mobile?'p-2':'p-2'} space-y-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar` },
    ...navItems.map(item => {
      const active = activeTab === item.id;
      return h('button', { key:item.id, id:mobile?undefined:`nav-${item.id}`, onClick:()=>go(item.id), className:`w-full flex items-center justify-between px-3 ${mobile?'py-2.5':'py-2'} rounded-xl text-[11px] font-semibold transition-all ${active?'bg-emerald-600 text-white shadow-sm':'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}` },
        h('span', { className:'flex items-center gap-2 min-w-0' }, h(item.icon, { className:`w-4 h-4 shrink-0 ${active?'text-white':'text-slate-400'}` }), h('span', { className:'truncate' }, item.label)),
        item.badge !== undefined ? h('span', { className:`px-1.5 py-0.5 text-[9px] rounded-full font-black shrink-0 ${active?'bg-white text-emerald-700':'bg-emerald-100 text-emerald-700'}` }, item.badge) : null
      );
    })
  );
  return h(React.Fragment, null,
    h('aside', { id:'desktop-sidebar', className:'hidden lg:flex flex-col w-48 xl:w-48 shrink-0 h-full min-h-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 select-none text-right overflow-hidden' },
      brand(), nav(false),
      h('div', { className:'p-2.5 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-400 text-center shrink-0' }, 'Oscar Accounting POS')
    ),
    mobileSidebarOpen ? h('div', { className:'fixed inset-0 z-50 lg:hidden flex justify-start' },
      h('div', { className:'fixed inset-0 bg-black/60 backdrop-blur-[1px]', onClick:()=>setMobileSidebarOpen(false) }),
      h('aside', { dir:'rtl', className:'mobile-sidebar-panel relative w-72 max-w-[85vw] h-full min-h-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 text-right overflow-hidden' },
        h('div', { className:'relative' }, brand(true), h('button', { type:'button', onClick:()=>setMobileSidebarOpen(false), className:'absolute top-3 left-3 z-20 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm border border-slate-200' }, '×')),
        nav(true),
        h('div', { className:'p-2.5 border-t border-slate-100 text-[9px] text-slate-400 text-center shrink-0' }, 'Oscar Accounting POS')
      )
    ) : null
  );
};
