import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useApp } from './context__AppContext.js?v=7.9.4.11-notifications-popup';
import { exportToCSV } from './utils__export.js?v=7.9.4.11-notifications-popup';
import { Download, Package, } from 'lucide-react';
export const ReportsView = () => {
    const { invoices, expenses, products, customers, suppliers, settings, getProductStock, } = useApp();
    const [dateRange, setDateRange] = useState('month');
    // Filter invoices and expenses by dateRange
    const now = new Date();
    const filterDate = (dateStr) => {
        if (dateRange === 'all')
            return true;
        const d = new Date(dateStr);
        if (dateRange === 'today') {
            return d.toDateString() === now.toDateString();
        }
        if (dateRange === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= oneWeekAgo;
        }
        if (dateRange === 'month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
    };
    const periodInvoices = invoices.filter((i) => filterDate(i.date));
    const periodExpenses = expenses.filter((e) => !e.deletedAt && filterDate(e.date));
    // Sales totals
    const salesInvoices = periodInvoices.filter((i) => i.type === 'sale');
    const returnInvoices = periodInvoices.filter((i) => i.type === 'return');
    const grossSales = salesInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const returnsTotal = returnInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const netSales = grossSales - returnsTotal;
    // Profit Calculation using historical FIFO cost captured at sale time
    // For each sale item: profit uses the exact FIFO total cost captured at sale time.
    let totalCostOfGoodsSold = 0;
    salesInvoices.forEach((inv) => {
        inv.items.forEach((item) => {
            const prod = products.find((p) => p.id === item.productId);
            const exactCost = Number(item.fifoCostTotal ?? ((item.quantity || 0) * (item.costPriceAtSale ?? ((prod?.costPrice || 0) * (item.conversionFactor || 1)))));
            totalCostOfGoodsSold += exactCost;
        });
    });
    returnInvoices.forEach((inv) => {
        inv.items.forEach((item) => {
            const prod = products.find((p) => p.id === item.productId);
            const exactCost = Number(item.fifoCostTotal ?? ((item.quantity || 0) * (item.costPriceAtSale ?? ((prod?.costPrice || 0) * (item.conversionFactor || 1)))));
            totalCostOfGoodsSold -= exactCost;
        });
    });
    const grossProfit = netSales - totalCostOfGoodsSold;
    const totalExpenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
    const netOperatingProfit = grossProfit - totalExpenses;
    // Inventory valuation
    let totalInventoryCostValue = 0;
    let totalInventorySaleValue = 0;
    products.forEach((prod) => {
        if (prod.deletedAt)
            return;
        const stock = getProductStock(prod.id, settings.activeWarehouseId);
        totalInventoryCostValue += stock * (prod.costPrice || 0);
        totalInventorySaleValue += stock * (prod.sellingPrice || 0);
    });
    const handleExportSummaryCSV = () => {
        const headers = ['المؤشر المالي', 'القيمة'];
        const rows = [
            ['إجمالي المبيعات', grossSales.toFixed(2)],
            ['إجمالي المرتجعات', returnsTotal.toFixed(2)],
            ['صافي المبيعات', netSales.toFixed(2)],
            ['تكلفة البضاعة المباعة (FIFO)', totalCostOfGoodsSold.toFixed(2)],
            ['مجمل أرباح المبيعات', grossProfit.toFixed(2)],
            ['إجمالي المصروفات التشغيلية', totalExpenses.toFixed(2)],
            ['صافي الربح النهائي', netOperatingProfit.toFixed(2)],
            ['تقييم المخزون بسعر التكلفة', totalInventoryCostValue.toFixed(2)],
            ['تقييم المخزون بسعر البيع', totalInventorySaleValue.toFixed(2)],
        ];
        exportToCSV('التقرير_المالي_والأرباح', headers, rows);
    };
    return (_jsxs("div", { id: "reports-screen", className: "p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-right select-none", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white", children: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0648\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0648\u0627\u0644\u0645\u062e\u0632\u0648\u0646" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u062d\u0633\u0627\u0628 \u062f\u0642\u064a\u0642 \u0644\u0635\u0627\u0641\u064a \u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0627\u0633\u062a\u0646\u0627\u062f\u0627\u064b \u0644\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0631\u062c\u062d (WAC) \u0648\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold", children: [_jsx("button", { onClick: () => setDateRange('today'), className: `px-3 py-1.5 rounded-lg transition ${dateRange === 'today' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`, children: "\u0627\u0644\u064a\u0648\u0645" }), _jsx("button", { onClick: () => setDateRange('week'), className: `px-3 py-1.5 rounded-lg transition ${dateRange === 'week' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`, children: "\u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645" }), _jsx("button", { onClick: () => setDateRange('month'), className: `px-3 py-1.5 rounded-lg transition ${dateRange === 'month' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`, children: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631" }), _jsx("button", { onClick: () => setDateRange('all'), className: `px-3 py-1.5 rounded-lg transition ${dateRange === 'all' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`, children: "\u0643\u0627\u0641\u0629 \u0627\u0644\u0641\u062a\u0631\u0627\u062a" })] }), _jsxs("button", { onClick: handleExportSummaryCSV, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50", children: [_jsx(Download, { className: "w-4 h-4 text-emerald-600" }), _jsx("span", { children: "\u062a\u0635\u062f\u064a\u0631 Excel" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs", children: [_jsx("span", { className: "text-xs text-slate-500 font-semibold", children: "\u0635\u0627\u0641\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a (\u0628\u0639\u062f \u0627\u0644\u0645\u0631\u062a\u062c\u0639)" }), _jsxs("div", { className: "text-2xl font-black text-slate-900 dark:text-white font-mono mt-1", children: [netSales.toFixed(2), ' ', _jsx("span", { className: "text-xs font-normal text-slate-400", children: settings.currencySymbol })] }), _jsxs("span", { className: "text-[11px] text-slate-400 mt-1 block", children: [salesInvoices.length, " \u0641\u0648\u0627\u062a\u064a\u0631 \u0628\u064a\u0639 | ", returnInvoices.length, " \u0645\u0631\u062a\u062c\u0639"] })] }), _jsxs("div", { className: "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs", children: [_jsx("span", { className: "text-xs text-slate-500 font-semibold", children: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 (FIFO)" }), _jsxs("div", { className: "text-2xl font-black text-slate-700 dark:text-slate-300 font-mono mt-1", children: [totalCostOfGoodsSold.toFixed(2), ' ', _jsx("span", { className: "text-xs font-normal text-slate-400", children: settings.currencySymbol })] }), _jsx("span", { className: "text-[11px] text-slate-400 mt-1 block", children: "\u0645\u062d\u0633\u0648\u0628\u0629 \u0628\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0631\u062c\u062d" })] }), _jsxs("div", { className: "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs", children: [_jsx("span", { className: "text-xs text-slate-500 font-semibold", children: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0648\u0627\u0644\u0646\u062b\u0631\u064a\u0627\u062a" }), _jsxs("div", { className: "text-2xl font-black text-rose-600 font-mono mt-1", children: [totalExpenses.toFixed(2), ' ', _jsx("span", { className: "text-xs font-normal text-slate-400", children: settings.currencySymbol })] }), _jsxs("span", { className: "text-[11px] text-slate-400 mt-1 block", children: [periodExpenses.length, " \u0633\u0646\u062f\u0627\u062a \u0645\u0635\u0631\u0648\u0641\u0627\u062a"] })] }), _jsxs("div", { className: "p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs", children: [_jsx("span", { className: "text-xs text-emerald-900 dark:text-emerald-300 font-bold", children: "\u0635\u0627\u0641\u064a \u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0627\u0644\u0635\u0627\u0641\u064a\u0629 (Net Profit)" }), _jsxs("div", { className: "text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1", children: [netOperatingProfit.toFixed(2), ' ', _jsx("span", { className: "text-xs font-normal text-emerald-600", children: settings.currencySymbol })] }), _jsx("span", { className: "text-[11px] text-emerald-800 dark:text-emerald-300 mt-1 block font-semibold", children: "(\u0645\u062c\u0645\u0644 \u0627\u0644\u0631\u0628\u062d - \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a)" })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Package, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u062d\u0627\u0644\u064a (Inventory Valuation)" })] }), _jsxs("span", { className: "text-xs text-slate-400", children: ["\u0644\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u0646\u0634\u0637: ", settings.storeName] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border", children: [_jsx("span", { className: "text-xs text-slate-500", children: "\u0642\u064a\u0645\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u062e\u0632\u0646\u0629 \u0628\u0633\u0639\u0631 \u0627\u0644\u062a\u0643\u0644\u0641\u0629:" }), _jsxs("div", { className: "text-xl font-black font-mono text-slate-900 dark:text-white mt-1", children: [totalInventoryCostValue.toFixed(2), " ", settings.currencySymbol] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644 \u0627\u0644\u0645\u0633\u062a\u062b\u0645\u0631 \u0627\u0644\u0641\u0639\u0644\u064a \u0641\u064a \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0648\u062c\u0648\u062f\u0629 \u0628\u0627\u0644\u0645\u062e\u0632\u0646" })] }), _jsxs("div", { className: "p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border", children: [_jsx("span", { className: "text-xs text-slate-500", children: "\u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a\u0629 \u0644\u0644\u0628\u0636\u0627\u0639\u0629 \u0628\u0633\u0639\u0631 \u0627\u0644\u0628\u064a\u0639 \u0627\u0644\u0642\u0637\u0627\u0639\u064a:" }), _jsxs("div", { className: "text-xl font-black font-mono text-emerald-600 mt-1", children: [totalInventorySaleValue.toFixed(2), " ", settings.currencySymbol] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "\u0627\u0644\u0625\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u062a\u0648\u0642\u0639 \u0639\u0646\u062f \u0628\u064a\u0639 \u0643\u0627\u0645\u0644 \u0627\u0644\u0643\u0645\u064a\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629" })] })] })] })] }));
};
