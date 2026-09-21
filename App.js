import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context__AppContext.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { Header } from './components__common__Header.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { Sidebar } from './components__common__Sidebar.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { BottomNav } from './components__common__BottomNav.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { Toast } from './components__common__Toast.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { SyncModal } from './components__sync__SyncModal.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { POSView } from './components__pos__POSView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { DashboardView } from './components__dashboard__DashboardView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { SalesView } from './components__sales__SalesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { PurchasesView } from './components__purchases__PurchasesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { ProductsView } from './components__products__ProductsView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { CategoriesView } from './components__categories__CategoriesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { InventoryView } from './components__inventory__InventoryView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { CustomersView } from './components__customers__CustomersView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { SuppliersView } from './components__suppliers__SuppliersView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { AccountsView } from './components__accounts__AccountsView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { ExpensesView } from './components__expenses__ExpensesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { VouchersView } from './components__vouchers__VouchersView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { EmployeesView } from './components__employees__EmployeesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { BarcodesView } from './components__barcodes__BarcodesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { ReportsView } from './components__reports__ReportsView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { TrashView } from './components__trash__TrashView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { SettingsView } from './components__settings__SettingsView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { ThermalReceiptModal } from './components__pos__ThermalReceiptModal.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { DEFAULT_LOGO_DATA_URL } from './brand__logo.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { LoginGate } from './components__auth__LoginGate.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantProvider } from './restaurant__context__RestaurantContext.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantTablesView } from './restaurant__components__RestaurantTablesView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantWaiterView } from './restaurant__components__RestaurantWaiterView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantKDSView } from './restaurant__components__RestaurantKDSView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantWasteView } from './restaurant__components__RestaurantWasteView.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { RestaurantSettingsPanel } from './restaurant__components__RestaurantSettingsPanel.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { OscarAI } from './components__ai__OscarAI.js?v=7.9.4.36-github-shift-fix-2-qr-green';
import { canAccessTab, firstAllowedTab } from './utils__permissions.js?v=7.9.4.36-github-shift-fix-2-qr-green';

const h = React.createElement;
const ScrollScreen = ({ children }) => h('div', { className:'scroll-chain-page h-full min-h-0 overflow-y-auto custom-scrollbar mobile-safe-bottom lg:pb-0' }, children);

const RESTAURANT_TAB_PERMISSIONS = {
  restaurant_tables: 'canAccessRestaurantTables',
  restaurant_waiter: 'canAccessRestaurantWaiter',
  restaurant_kitchen: 'canAccessRestaurantKitchen',
  restaurant_waste: 'canAccessRestaurantWaste',
};

const MainLayout = () => {
  const { activeTab, setActiveTab, isLoaded, settings, saveSettings, currentUser, activeEmployee, cart } = useApp();
  const [forceEnter, setForceEnter] = useState(false);
  const [showSkipButton, setShowSkipButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkipButton(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const isVisible = (el) => {
      if (!el || el.disabled) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
    };
    const clickFirstVisible = (selectors) => {
      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        const button = nodes.find(isVisible);
        if (button) { button.click(); return true; }
      }
      return false;
    };
    const onEnterExecute = (e) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.repeat || e.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target;
      if (target?.id === 'pos-barcode-input') return; // Enter here remains barcode submit.
      if (target?.tagName === 'TEXTAREA') return; // Textareas own Enter/Shift+Enter behavior.

      const form = target?.closest?.('form');
      if (form) {
        const submit = Array.from(form.querySelectorAll('button[type="submit"],input[type="submit"]')).find(isVisible);
        if (submit) { e.preventDefault(); submit.click(); return; }
      }

      const executed = clickFirstVisible([
        '#btn-confirm-payment:not([disabled])',
        '#waiter-send-kitchen:not([disabled])',
        '#oscar-ai-send:not([disabled])',
        '#btn-full-cart-payment:not([disabled])',
        '#btn-checkout:not([disabled])',
        '[data-enter-primary="true"]:not([disabled])'
      ]);
      if (executed) e.preventDefault();
    };
    window.addEventListener('keydown', onEnterExecute);
    return () => window.removeEventListener('keydown', onEnterExecute);
  }, [activeTab, cart?.length]);

  useEffect(() => {
    const root = document.documentElement;
    const setStableHeight = (force=false) => {
      const el = document.activeElement;
      const isTyping = !!el && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
      if (!force && isTyping && window.innerWidth < 1024) return;
      root.style.setProperty('--oscar-app-height', `${window.innerHeight}px`);
    };
    setStableHeight(true);
    const onResize = () => setStableHeight(false);
    const onOrientation = () => setTimeout(() => setStableHeight(true), 250);
    window.addEventListener('resize', onResize, { passive:true });
    window.addEventListener('orientationchange', onOrientation, { passive:true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    document.title = 'أوسكار المحاسبي';
    document.documentElement.classList.remove('dark');
    if (settings.theme !== 'light') {
      saveSettings({ ...settings, theme:'light' });
      return;
    }
    const runtimeCompany = window.OscarActivation?.readRuntime?.();
    const brandMigrationKey = `oscar-accounting-brand-v9::${runtimeCompany?.companyId || 'local'}`;
    let migrated = false;
    try { migrated = localStorage.getItem(brandMigrationKey) === '1'; } catch {}
    if (!migrated) {
      try { localStorage.setItem(brandMigrationKey, '1'); } catch {}
      const companyName = String(runtimeCompany?.companyName || '').trim();
      const oldDefaultNames = new Set(['أوسكار المحاسبي','الميزان ماركت','AlMezan Market POS']);
      if (companyName && oldDefaultNames.has(settings.storeName)) {
        saveSettings({ ...settings, storeName:companyName, theme:'light' });
      }
    }
  }, [isLoaded, settings, saveSettings]);

  const accessArgs = {
    runtime: window.OscarActivation?.readRuntime?.() || null,
    currentUser,
    activeEmployee,
    restaurantEnabled: !!settings.isRestaurantModeEnabled,
  };
  const canOpenRestaurantTab = tab => canAccessTab(tab, accessArgs);

  useEffect(() => {
    if (!isLoaded) return;
    if (activeTab !== 'no_access' && !canAccessTab(activeTab, accessArgs)) {
      setActiveTab(firstAllowedTab(accessArgs) || 'no_access');
    }
  }, [activeTab, settings.isRestaurantModeEnabled, currentUser, activeEmployee, isLoaded]);

  if (!isLoaded && !forceEnter) {
    return h('div', { className:'min-h-[100dvh] w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4' },
      h('img', { src:DEFAULT_LOGO_DATA_URL, alt:'أوسكار المحاسبي', className:'w-20 h-20 rounded-2xl object-cover shadow-xl mb-4 bg-white' }),
      h('h2', { className:'text-xl font-black tracking-tight' }, 'أوسكار المحاسبي Oscar Accounting POS'),
      h('p', { className:'text-xs text-slate-500 mt-1 font-semibold' }, 'جاري تهيئة قاعدة البيانات المحلية...'),
      showSkipButton && h('button', { id:'force-enter-btn', onClick:()=>setForceEnter(true), className:'mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md active:scale-95' }, 'الدخول الفوري للنظام ⚡')
    );
  }

  const screen = (() => {
    if (activeTab === 'no_access' || !canAccessTab(activeTab, accessArgs)) {
      return h('div', { className:'h-full flex items-center justify-center p-6 bg-slate-100' },
        h('div', { className:'max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm' },
          h('div', { className:'text-lg font-black text-slate-900' }, 'لا توجد صفحة مسموحة لهذا الحساب'),
          h('div', { className:'text-xs text-slate-500 mt-2 leading-6' }, 'يجب على المدير تحديد صفحة واحدة على الأقل من صلاحيات الموظف ثم حفظها. بعد المزامنة سيُفتح الحساب على أول صفحة مسموحة تلقائياً.')
        )
      );
    }
    if (activeTab === 'pos') return h(POSView);
    if (activeTab === 'dashboard') return h(ScrollScreen, null, h(DashboardView));
    if (activeTab === 'sales') return h(ScrollScreen, null, h(SalesView));
    if (activeTab === 'purchases') return h(ScrollScreen, null, h(PurchasesView));
    if (activeTab === 'products') return h(ScrollScreen, null, h(ProductsView));
    if (activeTab === 'categories') return h(ScrollScreen, null, h(CategoriesView));
    if (activeTab === 'inventory') return h(ScrollScreen, null, h(InventoryView));
    if (activeTab === 'customers') return h(ScrollScreen, null, h(CustomersView));
    if (activeTab === 'suppliers') return h(ScrollScreen, null, h(SuppliersView));
    if (activeTab === 'accounts') return h(ScrollScreen, null, h(AccountsView));
    if (activeTab === 'expenses') return h(ScrollScreen, null, h(ExpensesView));
    if (activeTab === 'vouchers') return h(ScrollScreen, null, h(VouchersView));
    if (activeTab === 'employees') return h(ScrollScreen, null, h(EmployeesView));
    if (activeTab === 'barcodes') return h(ScrollScreen, null, h(BarcodesView));
    if (activeTab === 'reports') return h(ScrollScreen, null, h(ReportsView));
    if (activeTab === 'trash') return h(ScrollScreen, null, h(TrashView));
    if (activeTab === 'settings') return h(ScrollScreen, null, h(React.Fragment, null, h(SettingsView), h('div', { className:'px-4 sm:px-6 pb-6 max-w-4xl mx-auto' }, h(RestaurantSettingsPanel))));
    if (activeTab === 'restaurant_tables' && canOpenRestaurantTab(activeTab)) return h(ScrollScreen, null, h(RestaurantTablesView));
    if (activeTab === 'restaurant_waiter' && canOpenRestaurantTab(activeTab)) return h(RestaurantWaiterView);
    if (activeTab === 'restaurant_kitchen' && canOpenRestaurantTab(activeTab)) return h(RestaurantKDSView);
    if (activeTab === 'restaurant_waste' && canOpenRestaurantTab(activeTab)) return h(ScrollScreen, null, h(RestaurantWasteView));
    return h(POSView);
  })();

  return h('div', {
    className:'flex w-screen bg-slate-100 text-slate-900 overflow-hidden',
    style:{ height:'var(--oscar-app-height, 100dvh)', minHeight:'var(--oscar-app-height, 100dvh)' }
  },
    h(Sidebar),
    h('div', { className:'flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden' },
      h(Header),
      h('main', { className:'flex-1 min-h-0 overflow-hidden relative pb-16 lg:pb-0' },
        h('div', { key:activeTab, className:'oscar-page-stage h-full min-h-0 w-full overflow-hidden' }, screen)
      ),
      h(BottomNav)
    ),
    h(ThermalReceiptModal),
    h(SyncModal),
    h(OscarAI),
    h(Toast)
  );
};

export default function App() {
  return h(LoginGate, null, h(AppProvider, null, h(RestaurantProvider, null, h(MainLayout))));
}
