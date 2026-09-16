import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useRef } from 'react';
import { useApp } from './context__AppContext.js';
import { SearchableDropdown } from './components__common__Dropdown.js';
import { exportToCSV } from './utils__export.js';
import { downloadElementAsPDF } from './utils__pdfExport.js';
import { downloadElementAsImage } from './utils__imageExport.js';
import { Plus, Search, Download, Trash2, Image as ImageIcon, FileSpreadsheet, Edit2, } from 'lucide-react';
export const ExpensesView = () => {
    const { expenses, accounts, settings, recordExpense, updateExpense, softDeleteExpense, showToast, } = useApp();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const tableContainerRef = useRef(null);
    // Add Expense Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [amount, setAmount] = useState(0);
    const [category, setCategory] = useState('نثريات وضيافة');
    const [accountId, setAccountId] = useState(accounts.find(a=>a.isDefault)?.id || accounts[0]?.id || '');
    const [notes, setNotes] = useState('');
    const expenseCategories = [
        'نثريات وضيافة',
        'كهرباء ومياه',
        'إيجار المحل',
        'أجور ورواتب عمال',
        'صيانة ونظافة',
        'بضائع تالفة ومنتهية',
        'أكياس وتغليف وطباعة',
        'نقل وشحن',
        'أخرى',
    ];
    const activeExpenses = expenses.filter((e) => !e.deletedAt);
    const filteredExpenses = activeExpenses.filter((e) => {
        if (selectedCategory !== 'all' && e.category !== selectedCategory)
            return false;
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            return e.category.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q));
        }
        return true;
    });
    const totalExpenseAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        if (amount <= 0) {
            showToast('يرجى إدخال مبلغ مصروف صحيح', 'warning');
            return;
        }
        if (editingExpense) {
            const account = accounts.find((a) => a.id === accountId);
            if (!account) {
                showToast('يرجى اختيار حساب مالي صالح', 'error');
                return;
            }
            await updateExpense({
                ...editingExpense,
                amount,
                category,
                accountId,
                accountName: account.name,
                notes,
            });
        }
        else {
            await recordExpense({
                amount,
                category,
                accountId,
                notes,
            });
        }
        setShowAddModal(false);
        setEditingExpense(null);
        setAmount(0);
        setNotes('');
    };
    const handleExportCSV = () => {
        const headers = ['التاريخ', 'بند المصروف', 'المبلغ', 'الحساب المسدد منه', 'ملاحظات'];
        const rows = filteredExpenses.map((e) => [
            new Date(e.date).toLocaleDateString('ar-EG'),
            e.category,
            e.amount,
            e.accountName,
            e.notes || '',
        ]);
        exportToCSV('سجل_المصروفات_اليومية', headers, rows);
    };
    const handleExportPDF = async () => {
        if (!tableContainerRef.current)
            return;
        await downloadElementAsPDF('expenses-table-card', `سجل_المصروفات_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('تم تصدير كشف المصروفات كـ PDF بنجاح', 'success');
    };
    const handleExportImage = async () => {
        if (!tableContainerRef.current)
            return;
        await downloadElementAsImage('expenses-table-card', `سجل_المصروفات_${new Date().toISOString().slice(0, 10)}.png`);
        showToast('تم تصدير كشف المصروفات كصورة بنجاح', 'success');
    };
    return (_jsxs("div", { id: "expenses-screen", className: "p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-right select-none", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white", children: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0648\u0627\u0644\u0646\u062b\u0631\u064a\u0627\u062a" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: ["\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629:", ' ', _jsxs("strong", { className: "text-rose-600 font-mono text-sm", children: [totalExpenseAmount.toFixed(2), " ", settings.currencySymbol] })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap self-start sm:self-auto", children: [_jsxs("button", { onClick: () => { setEditingExpense(null); setAmount(0); setNotes(''); setShowAddModal(true); }, className: "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "\u062a\u0633\u062c\u064a\u0644 \u0645\u0635\u0631\u0648\u0641 \u062c\u062f\u064a\u062f" })] }), _jsxs("button", { onClick: handleExportPDF, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", title: "\u062a\u0646\u0632\u064a\u0644 \u0643\u0640 PDF", children: [_jsx(Download, { className: "w-4 h-4 text-rose-600" }), _jsx("span", { children: "PDF" })] }), _jsxs("button", { onClick: handleExportImage, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", title: "\u062a\u0646\u0632\u064a\u0644 \u0643\u0635\u0648\u0631\u0629", children: [_jsx(ImageIcon, { className: "w-4 h-4 text-blue-600" }), _jsx("span", { children: "\u0635\u0648\u0631\u0629" })] }), _jsxs("button", { onClick: handleExportCSV, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", children: [_jsx(FileSpreadsheet, { className: "w-4 h-4 text-emerald-600" }), _jsx("span", { children: "Excel" })] })] })] }), _jsxs("div", { className: "p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex-1 max-w-md relative", children: [_jsx(Search, { className: "absolute right-3 top-2.5 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0648\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a...", className: "w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" })] }), _jsx("div", { className: "min-w-[180px]", children: _jsx(SearchableDropdown, { id: "expense-filter-category", options: [{id:"all",label:"\u0643\u0627\u0641\u0629 \u0627\u0644\u0628\u0646\u0648\u062f"}, ...expenseCategories.map((c) => ({ id:c, label:c }))], selectedId: selectedCategory, onSelect: setSelectedCategory, placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0628\u0646\u062f..." }) })] }), _jsx("div", { id: "expenses-table-card", ref: tableContainerRef, className: "rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden", children: _jsx("div", { className: "overflow-x-auto max-w-full slim-scrollbar", children: filteredExpenses.length === 0 ? (_jsx("div", { className: "p-12 text-center text-xs text-slate-400", children: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0633\u062c\u0644\u0629" })) : (_jsxs("table", { className: "w-full text-xs text-right whitespace-nowrap min-w-[720px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold", children: [_jsx("th", { className: "p-3", children: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u0648\u0642\u062a" }), _jsx("th", { className: "p-3", children: "\u0628\u0646\u062f \u0627\u0644\u0645\u0635\u0631\u0648\u0641" }), _jsx("th", { className: "p-3", children: "\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0633\u062f\u062f \u0645\u0646\u0647" }), _jsx("th", { className: "p-3", children: "\u0627\u0644\u0628\u064a\u0627\u0646 \u0648\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a" }), _jsx("th", { className: "p-3 text-left", children: "\u0627\u0644\u0645\u0628\u0644\u063a" }), _jsx("th", { className: "p-3 text-center", children: "\u0625\u062c\u0631\u0627\u0621\u0627\u062a" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 dark:divide-slate-800", children: filteredExpenses.map((exp) => (_jsxs("tr", { className: "hover:bg-slate-50/50", children: [_jsxs("td", { className: "p-3 text-slate-500", children: [new Date(exp.date).toLocaleDateString('ar-EG'), " - ", new Date(exp.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })] }), _jsx("td", { className: "p-3 font-bold text-slate-800 dark:text-slate-200", children: exp.category }), _jsx("td", { className: "p-3 text-slate-500", children: exp.accountName }), _jsx("td", { className: "p-3 text-slate-400", children: exp.notes || '-' }), _jsxs("td", { className: "p-3 text-left font-mono font-bold text-rose-600", children: [exp.amount.toFixed(2), " ", settings.currencySymbol] }), _jsx("td", { className: "p-3 text-center", children: _jsxs("div", { className: "inline-flex items-center gap-1", children: [_jsx("button", { onClick: () => {
                                                            setEditingExpense(exp);
                                                            setAmount(exp.amount);
                                                            setCategory(exp.category);
                                                            setAccountId(exp.accountId);
                                                            setNotes(exp.notes || '');
                                                            setShowAddModal(true);
                                                        }, className: "p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded", title: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => softDeleteExpense(exp.id), className: "p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded", title: "\u0646\u0642\u0644 \u0644\u0633\u0644\u0629 \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0627\u062a \u0648\u0625\u0644\u063a\u0627\u0621 \u0623\u062b\u0631\u0647 \u0627\u0644\u0645\u0627\u0644\u064a", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }) })] }, exp.id))) })] })) }) }), showAddModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in", children: _jsxs("form", { onSubmit: handleSaveExpense, className: "w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 border text-right", children: [_jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: editingExpense ? 'تعديل المصروف' : 'تسجيل مصروف جديد' }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0635\u0631\u0648\u0641 *" }), _jsx("input", { type: "number", step: "any", min: "0.01", required: true, value: amount || '', onChange: (e) => setAmount(parseFloat(e.target.value) || 0), placeholder: "0.00", className: "w-full px-3 py-2 text-sm font-mono font-bold border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0628\u0646\u062f \u0627\u0644\u0645\u0635\u0631\u0648\u0641:" }), _jsx(SearchableDropdown, { id: "expense-category", options: expenseCategories.map((c) => ({ id: c, label: c })), selectedId: category, onSelect: setCategory, placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0628\u0646\u062f \u0627\u0644\u0645\u0635\u0631\u0648\u0641..." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0635\u0631\u0641 \u0645\u0646 \u0627\u0644\u062d\u0633\u0627\u0628:" }), _jsx(SearchableDropdown, { id: "expense-account", options: accounts.map((a) => ({ id: a.id, label: a.name, subLabel: `\u0627\u0644\u0631\u0635\u064a\u062f: ${a.balance} ${settings.currencySymbol}` })), selectedId: accountId, onSelect: setAccountId, placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u062d\u0633\u0627\u0628..." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0628\u064a\u0627\u0646 \u062a\u0641\u0635\u064a\u0644\u064a / \u0645\u0644\u0627\u062d\u0638\u0627\u062a:" }), _jsx("input", { type: "text", placeholder: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0623\u0648 \u0633\u0628\u0628 \u0627\u0644\u0635\u0631\u0641...", value: notes, onChange: (e) => setNotes(e.target.value), className: "w-full px-3 py-1.5 text-xs border rounded-lg" })] }), _jsxs("div", { className: "flex justify-between pt-2 border-t", children: [_jsx("button", { type: "button", onClick: () => { setShowAddModal(false); setEditingExpense(null); }, className: "px-3 py-1.5 text-xs text-slate-500", children: "\u0625\u0644\u063a\u0627\u0621" }), _jsx("button", { type: "submit", className: "px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md", children: editingExpense ? 'حفظ التعديل' : 'تأكيد تسجيل المصروف' })] })] }) }))] }));
};
