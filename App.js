import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context__AppContext.js';
import { Header } from './components__common__Header.js';
import { Sidebar } from './components__common__Sidebar.js';
import { BottomNav } from './components__common__BottomNav.js';
import { Toast } from './components__common__Toast.js';
import { SyncModal } from './components__sync__SyncModal.js';
import { POSView } from './components__pos__POSView.js';
import { DashboardView } from './components__dashboard__DashboardView.js';
import { SalesView } from './components__sales__SalesView.js';
import { PurchasesView } from './components__purchases__PurchasesView.js';
import { ProductsView } from './components__products__ProductsView.js';
import { CategoriesView } from './components__categories__CategoriesView.js';
import { InventoryView } from './components__inventory__InventoryView.js';
import { CustomersView } from './components__customers__CustomersView.js';
import { SuppliersView } from './components__suppliers__SuppliersView.js';
import { AccountsView } from './components__accounts__AccountsView.js';
import { ExpensesView } from './components__expenses__ExpensesView.js';
import { VouchersView } from './components__vouchers__VouchersView.js';
import { EmployeesView } from './components__employees__EmployeesView.js';
import { BarcodesView } from './components__barcodes__BarcodesView.js';
import { ReportsView } from './components__reports__ReportsView.js';
import { TrashView } from './components__trash__TrashView.js';
import { SettingsView } from './components__settings__SettingsView.js';
import { ThermalReceiptModal } from './components__pos__ThermalReceiptModal.js';
import { DEFAULT_LOGO_DATA_URL } from './brand__logo.js';
import { LoginGate } from './components__auth__LoginGate.js';
const ScrollScreen = ({ children }) => (_jsx("div", { className: "scroll-chain-page h-full min-h-0 overflow-y-auto custom-scrollbar mobile-safe-bottom lg:pb-0", children: children }));
const MainLayout = () => {
    const { activeTab, isLoaded, settings, saveSettings } = useApp();
    const [forceEnter, setForceEnter] = useState(false);
    const [showSkipButton, setShowSkipButton] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShowSkipButton(true), 1500);
        return () => clearTimeout(timer);
    }, []);
    // Continue vertical scrolling on the parent page when an inner table/modal reaches an edge.
    useEffect(() => {
        let touchY = 0;
        let inner = null;
        const canScrollY = (el) => el && el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 2 && ['auto','scroll'].includes(getComputedStyle(el).overflowY);
        const nearestScrollable = (node) => {
            let el = node instanceof HTMLElement ? node : node?.parentElement;
            while (el && el !== document.body) { if (canScrollY(el)) return el; el = el.parentElement; }
            return null;
        };
        const parentScrollable = (el) => {
            let p = el?.parentElement;
            while (p && p !== document.body) { if (canScrollY(p)) return p; p = p.parentElement; }
            return null;
        };
        const onWheel = (e) => {
            const el = nearestScrollable(e.target);
            if (!el) return;
            const atTop = el.scrollTop <= 1;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
                const p = parentScrollable(el); if (p) p.scrollTop += e.deltaY;
            }
        };
        const onTouchStart = (e) => { touchY = e.touches?.[0]?.clientY || 0; inner = nearestScrollable(e.target); };
        const onTouchMove = (e) => {
            if (!inner || !e.touches?.[0]) return;
            const y = e.touches[0].clientY; const delta = touchY - y;
            const atTop = inner.scrollTop <= 1;
            const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
            if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                const p = parentScrollable(inner); if (p) p.scrollTop += delta;
            }
            touchY = y;
        };
        document.addEventListener('wheel', onWheel, { passive:true });
        document.addEventListener('touchstart', onTouchStart, { passive:true });
        document.addEventListener('touchmove', onTouchMove, { passive:true });
        return () => { document.removeEventListener('wheel', onWheel); document.removeEventListener('touchstart', onTouchStart); document.removeEventListener('touchmove', onTouchMove); };
    }, []);
    // Keep the app height stable while the mobile keyboard is open, so the cart checkout dock does not jump over the cart.
    useEffect(() => {
        const root = document.documentElement;
        const setStableHeight = (force = false) => {
            const el = document.activeElement;
            const isTyping = !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
            if (!force && isTyping && window.innerWidth < 1024) return;
            root.style.setProperty('--oscar-app-height', `${window.innerHeight}px`);
        };
        setStableHeight(true);
        const onResize = () => setStableHeight(false);
        const onOrientation = () => setTimeout(() => setStableHeight(true), 250);
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onOrientation, { passive: true });
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onOrientation);
        };
    }, []);
    useEffect(() => {
        if (!isLoaded)
            return;
        document.title = 'أوسكار المحاسبي';
        const root = document.documentElement;
        const lightModeMigrationKey = 'almezan-market-light-default-v2.1';
        let migrated = false;
        try {
            migrated = localStorage.getItem(lightModeMigrationKey) === '1';
        }
        catch { }
        if (!migrated) {
            root.classList.remove('dark');
            try {
                localStorage.setItem(lightModeMigrationKey, '1');
            }
            catch { }
            if (settings.theme !== 'light') {
                saveSettings({ ...settings, theme: 'light' });
                return;
            }
        }
        const runtimeCompany = window.OscarActivation?.readRuntime?.();
        const brandMigrationKey = `oscar-accounting-brand-v8::${runtimeCompany?.companyId || 'local'}`;
        let brandMigrated = false;
        try { brandMigrated = localStorage.getItem(brandMigrationKey) === '1'; } catch { }
        if (!brandMigrated) {
            try { localStorage.setItem(brandMigrationKey, '1'); } catch { }
            const companyName = String(runtimeCompany?.companyName || '').trim();
            const oldDefaultNames = new Set(['أوسكار المحاسبي','الميزان ماركت','AlMezan Market POS']);
            const desiredName = companyName && oldDefaultNames.has(settings.storeName) ? companyName : settings.storeName;
            if (desiredName !== settings.storeName || settings.theme !== 'light') {
                saveSettings({ ...settings, storeName: desiredName, theme: 'light' });
                return;
            }
        }
        if (settings.theme === 'dark')
            root.classList.add('dark');
        else
            root.classList.remove('dark');
    }, [isLoaded, settings.theme, settings.storeName, settings.subtitle, saveSettings]);
    if (!isLoaded && !forceEnter) {
        return (_jsxs("div", { className: "min-h-[100dvh] w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-4", children: [_jsx("img", { src: DEFAULT_LOGO_DATA_URL, alt: "\u0623\u0648\u0633\u0643\u0627\u0631 \u0627\u0644\u0645\u062d\u0627\u0633\u0628\u064a", className: "w-20 h-20 rounded-2xl object-cover shadow-xl mb-4 bg-white" }), _jsx("h2", { className: "text-xl font-black tracking-tight", children: "\u0623\u0648\u0633\u0643\u0627\u0631 \u0627\u0644\u0645\u062d\u0627\u0633\u0628\u064a Oscar Accounting POS" }), _jsx("p", { className: "text-xs text-slate-500 mt-1 font-semibold", children: "\u062c\u0627\u0631\u064a \u062a\u0647\u064a\u0626\u0629 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062d\u0644\u064a\u0629..." }), showSkipButton && (_jsx("button", { id: "force-enter-btn", onClick: () => setForceEnter(true), className: "mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95", children: "\u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0641\u0648\u0631\u064a \u0644\u0644\u0646\u0638\u0627\u0645 \u26a1" }))] }));
    }
    return (_jsxs("div", { className: "flex w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden", style: { height: 'var(--oscar-app-height, 100dvh)', minHeight: 'var(--oscar-app-height, 100dvh)' }, children: [_jsx(Sidebar, {}), _jsxs("div", { className: "flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden", children: [_jsx(Header, {}), _jsxs("main", { className: "flex-1 min-h-0 overflow-hidden relative pb-16 lg:pb-0", children: [activeTab === 'pos' && _jsx(POSView, {}), activeTab === 'dashboard' && _jsx(ScrollScreen, { children: _jsx(DashboardView, {}) }), activeTab === 'sales' && _jsx(ScrollScreen, { children: _jsx(SalesView, {}) }), activeTab === 'purchases' && _jsx(ScrollScreen, { children: _jsx(PurchasesView, {}) }), activeTab === 'products' && _jsx(ScrollScreen, { children: _jsx(ProductsView, {}) }), activeTab === 'categories' && _jsx(ScrollScreen, { children: _jsx(CategoriesView, {}) }), activeTab === 'inventory' && _jsx(ScrollScreen, { children: _jsx(InventoryView, {}) }), activeTab === 'customers' && _jsx(ScrollScreen, { children: _jsx(CustomersView, {}) }), activeTab === 'suppliers' && _jsx(ScrollScreen, { children: _jsx(SuppliersView, {}) }), activeTab === 'accounts' && _jsx(ScrollScreen, { children: _jsx(AccountsView, {}) }), activeTab === 'expenses' && _jsx(ScrollScreen, { children: _jsx(ExpensesView, {}) }), activeTab === 'vouchers' && _jsx(ScrollScreen, { children: _jsx(VouchersView, {}) }), activeTab === 'employees' && _jsx(ScrollScreen, { children: _jsx(EmployeesView, {}) }), activeTab === 'barcodes' && _jsx(ScrollScreen, { children: _jsx(BarcodesView, {}) }), activeTab === 'reports' && _jsx(ScrollScreen, { children: _jsx(ReportsView, {}) }), activeTab === 'trash' && _jsx(ScrollScreen, { children: _jsx(TrashView, {}) }), activeTab === 'settings' && _jsx(ScrollScreen, { children: _jsx(SettingsView, {}) })] }), _jsx(BottomNav, {})] }), _jsx(ThermalReceiptModal, {}), _jsx(SyncModal, {}), _jsx(Toast, {})] }));
};
export default function App() {
    return (_jsx(LoginGate, { children: _jsx(AppProvider, { children: _jsx(MainLayout, {}) }) }));
}
