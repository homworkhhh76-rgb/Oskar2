import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useApp } from './context__AppContext.js';
import { ShoppingCart, ReceiptText, Package, Warehouse, Menu, X, LayoutDashboard, Truck, Boxes, Users, Building2, Wallet, Receipt, Barcode, BarChart3, Trash2, Settings, } from 'lucide-react';
export const BottomNav = () => {
    const { activeTab, setActiveTab, cart } = useApp();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const mainTabs = [
        { id: 'pos', label: 'الكاشير', icon: _jsx(ShoppingCart, { className: "w-5 h-5" }), badge: cart.length || undefined },
        { id: 'sales', label: 'المبيعات', icon: _jsx(ReceiptText, { className: "w-5 h-5" }) },
        { id: 'products', label: 'الأصناف', icon: _jsx(Package, { className: "w-5 h-5" }) },
        { id: 'inventory', label: 'المخزون', icon: _jsx(Warehouse, { className: "w-5 h-5" }) },
    ];
    const moreTabs = [
        { id: 'dashboard', label: 'لوحة التحكم', icon: _jsx(LayoutDashboard, { className: "w-4 h-4" }) },
        { id: 'purchases', label: 'المشتريات', icon: _jsx(Truck, { className: "w-4 h-4" }) },
        { id: 'categories', label: 'التصنيفات', icon: _jsx(Boxes, { className: "w-4 h-4" }) },
        { id: 'customers', label: 'العملاء والديون', icon: _jsx(Users, { className: "w-4 h-4" }) },
        { id: 'suppliers', label: 'الموردون', icon: _jsx(Building2, { className: "w-4 h-4" }) },
        { id: 'accounts', label: 'الصندوق والورديات', icon: _jsx(Wallet, { className: "w-4 h-4" }) },
        { id: 'expenses', label: 'المصروفات', icon: _jsx(Receipt, { className: "w-4 h-4" }) },
        { id: 'barcodes', label: 'طباعة الباركود', icon: _jsx(Barcode, { className: "w-4 h-4" }) },
        { id: 'reports', label: 'التقارير والأرباح', icon: _jsx(BarChart3, { className: "w-4 h-4" }) },
        { id: 'trash', label: 'سلة المحذوفات', icon: _jsx(Trash2, { className: "w-4 h-4" }) },
        { id: 'settings', label: 'الإعدادات', icon: _jsx(Settings, { className: "w-4 h-4" }) },
    ];
    return (_jsxs(_Fragment, { children: [showMoreMenu && (_jsx("div", { id: "mobile-more-backdrop", onClick: () => setShowMoreMenu(false), className: "lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in", children: _jsxs("div", { id: "mobile-more-sheet", onClick: (e) => e.stopPropagation(), className: "bg-white dark:bg-slate-900 rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto border-t border-slate-200 dark:border-slate-800 text-right space-y-1 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800", children: [_jsx("h3", { className: "font-bold text-sm text-slate-900 dark:text-white", children: "\u0628\u0627\u0642\u064a \u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0646\u0638\u0627\u0645" }), _jsx("button", { onClick: () => setShowMoreMenu(false), className: "p-1 rounded-md text-slate-400 hover:text-slate-600", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: moreTabs.map((item) => (_jsxs("button", { onClick: () => {
                                    setActiveTab(item.id);
                                    setShowMoreMenu(false);
                                }, className: `flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition ${activeTab === item.id
                                    ? 'bg-emerald-600 text-white font-bold'
                                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`, children: [item.icon, _jsx("span", { children: item.label })] }, item.id))) })] }) })), _jsxs("nav", { id: "mobile-bottom-nav", className: "lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 shadow-lg select-none", children: [mainTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `relative flex flex-col items-center justify-center flex-1 py-1 transition-colors ${isActive
                                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`, children: [_jsxs("div", { className: "relative", children: [tab.icon, tab.badge !== undefined && (_jsx("span", { className: "absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white", children: tab.badge }))] }), _jsx("span", { className: "text-[11px] mt-0.5", children: tab.label })] }, tab.id));
                    }), _jsxs("button", { onClick: () => setShowMoreMenu(true), className: `flex flex-col items-center justify-center flex-1 py-1 ${showMoreMenu ? 'text-emerald-600 font-bold' : 'text-slate-500 dark:text-slate-400'}`, children: [_jsx(Menu, { className: "w-5 h-5" }), _jsx("span", { className: "text-[11px] mt-0.5", children: "\u0627\u0644\u0645\u0632\u064a\u062f" })] })] })] }));
};
