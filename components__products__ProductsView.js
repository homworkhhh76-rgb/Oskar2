import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useRef } from 'react';
import { useApp } from './context__AppContext.js?v=7.9.4.46-profit-report';
import { Pagination, usePagination } from './components__common__Pagination.js?v=7.9.4.46-profit-report';
import { SearchableDropdown } from './components__common__Dropdown.js?v=7.9.4.46-profit-report';
import { BarcodeCameraModal } from './components__pos__CameraScannerModal.js?v=7.9.4.46-profit-report';
import { calculateUnitConversions, formatStockBreakdown } from './utils__unitTree.js?v=7.9.4.46-profit-report';
import { exportToCSV } from './utils__export.js?v=7.9.4.46-profit-report';
import { downloadElementAsPDF } from './utils__pdfExport.js?v=7.9.4.46-profit-report';
import { downloadElementAsImage } from './utils__imageExport.js?v=7.9.4.46-profit-report';
import { downloadProfessionalTablePDF, downloadProfessionalTableImage } from './utils__professionalExport.js?v=7.9.4.46-profit-report';
import { Plus, Search, Trash2, Edit, Layers, FolderTree, X, Download, Image as ImageIcon, FileSpreadsheet, Camera, } from 'lucide-react';
const h = React.createElement;
const normalizeArabicDigits = (value) => String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٫،]/g, '.')
    .replace(/٬/g, '');
const cleanDecimalInput = (value) => {
    let v = normalizeArabicDigits(value).replace(/[^0-9.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
    return v;
};
const toNumber = (value, fallback = 0) => {
    const n = Number(normalizeArabicDigits(value));
    return Number.isFinite(n) ? n : fallback;
};
const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
export const ProductsView = () => {
    const { products, categories, settings, saveProduct, softDeleteProduct, getProductStock, showToast, } = useApp();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const tableContainerRef = useRef(null);
    // Modal State for Product Editor
    const [editingProduct, setEditingProduct] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [barcodeScanUnitId, setBarcodeScanUnitId] = useState(null);
    // Filter products
    const activeProducts = products.filter((p) => !p.deletedAt);
    const filteredProducts = activeProducts.filter((p) => {
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory)
            return false;
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            const matchName = p.name.toLowerCase().includes(q) || (p.shortName && p.shortName.toLowerCase().includes(q));
            const matchSku = p.sku?.toLowerCase().includes(q) || p.internalCode?.includes(q);
            const matchBarcode = p.units.some((u) => u.barcodes.some((b) => b.includes(q)));
            return matchName || matchSku || matchBarcode;
        }
        return true;
    });
    const productsPager = usePagination(filteredProducts, 50, `${search}|${selectedCategory}`);
    const handleOpenNew = () => {
        const defaultBaseUnitId = 'u-' + Date.now();
        const newProd = {
            id: 'prod-' + Date.now(),
            name: '',
            shortName: '',
            sku: '',
            internalCode: (products.length + 1001).toString(),
            categoryId: categories[0]?.id || '',
            brand: '',
            costPrice: 0,
            sellingPrice: 0,
            reorderPoint: 10,
            expiryDate: '',
            taxRate: 0,
            status: 'active',
            salesChannel: 'both',
            baseUnitId: defaultBaseUnitId,
            baseUnitName: 'حبة',
            units: [
                {
                    id: defaultBaseUnitId,
                    name: 'حبة',
                    childUnitId: null,
                    multiplier: 1,
                    conversionToBase: 1,
                    barcodes: [],
                    salePrice: '',
                    openingQuantity: '',
                    wholesalePrice: '',
                    costPrice: '',
                    isDefaultSale: true,
                },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setEditingProduct(newProd);
        setIsNew(true);
    };
    const handleOpenEdit = (prod) => {
        // Clone deeply to allow cancelation. Opening quantities are only for first-time stock setup.
        const clone = JSON.parse(JSON.stringify(prod));
        clone.salesChannel = clone.salesChannel || 'both';
        clone.units = (clone.units || []).map((u) => ({ ...u, openingQuantity: '' }));
        setEditingProduct(clone);
        setIsNew(false);
    };
    const handleSaveModal = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;
        if (!editingProduct.name.trim()) {
            showToast('يرجى إدخال اسم الصنف', 'warning');
            return;
        }
        if (editingProduct.units.length === 0) {
            showToast('يجب أن يحتوي الصنف على وحدة واحدة على الأقل', 'warning');
            return;
        }
        const numericUnits = editingProduct.units.map((u) => ({
            ...u,
            multiplier: u.id === editingProduct.baseUnitId ? 1 : Math.max(1, toNumber(u.multiplier, 1)),
            salePrice: Math.max(0, toNumber(u.salePrice, 0)),
            wholesalePrice: Math.max(0, toNumber(u.wholesalePrice, 0)),
            openingQuantity: Math.max(0, toNumber(u.openingQuantity, 0)),
            costPrice: Math.max(0, toNumber(u.costPrice, 0)),
            barcodes: Array.isArray(u.barcodes) ? u.barcodes.map((b) => String(b).trim()).filter(Boolean) : [],
        }));
        let updatedUnits = calculateUnitConversions(numericUnits, editingProduct.baseUnitId);
        const baseIndex = updatedUnits.findIndex((u) => u.id === editingProduct.baseUnitId);
        const baseCost = baseIndex >= 0 ? toNumber(updatedUnits[baseIndex].costPrice, 0) : 0;
        // إذا تُرك سعر شراء الوحدة الأساسية فارغاً وكتب المستخدم السعر في وحدة أكبر،
        // نحسب تكلفة الوحدة الأساسية تلقائياً ثم نوزعها بدقة على كامل شجرة الوحدات.
        if (baseCost <= 0) {
            const source = [...updatedUnits]
                .sort((a, b) => (toNumber(b.conversionToBase, 1) - toNumber(a.conversionToBase, 1)))
                .find((u) => toNumber(u.costPrice, 0) > 0);
            if (source) {
                const sourceFactor = Math.max(1, toNumber(source.conversionToBase, 1));
                const calculatedBaseCost = toNumber(source.costPrice, 0) / sourceFactor;
                updatedUnits = updatedUnits.map((u) => ({
                    ...u,
                    costPrice: round4(calculatedBaseCost * Math.max(1, toNumber(u.conversionToBase, 1))),
                }));
            }
        }
        const openingUnitBreakdown = isNew
            ? updatedUnits.filter((u) => Math.max(0, toNumber(u.openingQuantity, 0)) > 0).map((u) => ({
                unitId: u.id, unitName: u.name, quantity: Math.max(0, toNumber(u.openingQuantity, 0)),
                conversionToBase: Math.max(1, toNumber(u.conversionToBase, 1)),
                baseQuantity: Math.max(0, toNumber(u.openingQuantity, 0)) * Math.max(1, toNumber(u.conversionToBase, 1)),
            }))
            : [];
        const openingBaseQuantity = openingUnitBreakdown.reduce((sum, row) => sum + row.baseQuantity, 0);
        const defaultUnit = updatedUnits.find((u) => u.isDefaultSale) || updatedUnits[0];
        const finalBaseUnit = updatedUnits.find((u) => u.id === editingProduct.baseUnitId) || updatedUnits[0];
        const finalProd = {
            ...editingProduct,
            reorderPoint: Math.max(0, toNumber(editingProduct.reorderPoint, 0)),
            units: updatedUnits,
            baseUnitName: finalBaseUnit?.name || 'حبة',
            sellingPrice: toNumber(defaultUnit?.salePrice, 0),
            costPrice: toNumber(finalBaseUnit?.costPrice, 0),
            openingBaseQuantity,
            openingUnitBreakdown,
            updatedAt: new Date().toISOString(),
        };
        await saveProduct(finalProd);
        setEditingProduct(null);
    };
    // Tree Unit Helper: Add Parent Unit
    const handleAddParentUnit = () => {
        if (!editingProduct)
            return;
        const currentUnits = [...editingProduct.units];
        const topUnit = currentUnits[currentUnits.length - 1];
        const newUnitId = 'u-' + Date.now();
        const newUnit = {
            id: newUnitId,
            name: currentUnits.length === 1 ? 'كرتونة' : currentUnits.length === 2 ? 'مشطاح' : 'طرد',
            childUnitId: topUnit.id,
            multiplier: 12,
            conversionToBase: (topUnit.conversionToBase || 1) * 12,
            barcodes: [],
            salePrice: (topUnit.salePrice || 0) * 11, // discount for bulk
            openingQuantity: '',
            wholesalePrice: '',
            costPrice: (topUnit.costPrice || 0) * 12,
            isDefaultSale: false,
        };
        setEditingProduct({
            ...editingProduct,
            units: [...currentUnits, newUnit],
        });
    };
    const handleRemoveUnit = (unitId) => {
        if (!editingProduct || editingProduct.units.length <= 1) {
            showToast('لا يمكن حذف الوحدة الأساسية الوحيدة للصنف', 'warning');
            return;
        }
        if (unitId === editingProduct.baseUnitId) {
            showToast('لا يمكن حذف الوحدة الأساسية، قم بتعيين وحدة أساسية أخرى أولاً', 'error');
            return;
        }
        const filtered = editingProduct.units.filter((u) => u.id !== unitId);
        setEditingProduct({
            ...editingProduct,
            units: calculateUnitConversions(filtered, editingProduct.baseUnitId),
        });
    };
    const handleDetectedUnitBarcode = (code) => {
        if (!barcodeScanUnitId || !code) return;
        const clean = normalizeArabicDigits(code).trim();
        if (!clean) return;
        setEditingProduct((prev) => prev ? ({
            ...prev,
            units: prev.units.map((u) => u.id === barcodeScanUnitId
                ? ({ ...u, barcodes: [clean, ...(u.barcodes || []).filter((x) => x !== clean)] })
                : u),
        }) : prev);
        showToast(`تم التقاط الباركود: ${clean} — يمكنك مسح باركود آخر أو إغلاق الكاميرا`, 'success');
    };
    const updateUnitField = (unitId, field, value, recalculate = false) => {
        setEditingProduct((prev) => {
            if (!prev) return prev;
            const updated = prev.units.map((u) => u.id === unitId ? { ...u, [field]: value } : u);
            return { ...prev, units: recalculate ? calculateUnitConversions(updated, prev.baseUnitId) : updated };
        });
    };
    const recalculateCostsFromUnit = (sourceUnitId) => {
        setEditingProduct((prev) => {
            if (!prev) return prev;
            const normalized = calculateUnitConversions(prev.units.map((u) => ({
                ...u,
                multiplier: u.id === prev.baseUnitId ? 1 : Math.max(1, toNumber(u.multiplier, 1)),
            })), prev.baseUnitId);
            const source = normalized.find((u) => u.id === sourceUnitId);
            const sourceCost = toNumber(source?.costPrice, 0);
            if (!source || sourceCost <= 0) return { ...prev, units: normalized };
            const sourceFactor = Math.max(1, toNumber(source.conversionToBase, 1));
            const baseCost = sourceCost / sourceFactor;
            return {
                ...prev,
                units: normalized.map((u) => ({
                    ...u,
                    costPrice: String(round4(baseCost * Math.max(1, toNumber(u.conversionToBase, 1)))),
                })),
            };
        });
    };
    const renderUnitCard = (unit, idx, isBase, childUnit) => {
        const numberInput = (label, field, extraClass = '') => h('div', { className: 'min-w-0' },
            h('label', { className: 'text-[10px] text-slate-400 block mb-1' }, label),
            h('input', {
                type: 'text', inputMode: 'decimal', dir: 'ltr',
                value: unit[field] === null || unit[field] === undefined ? '' : String(unit[field]),
                onChange: (e) => updateUnitField(unit.id, field, cleanDecimalInput(e.target.value)),
                onFocus: (e) => e.currentTarget.select(),
                onBlur: field === 'costPrice' ? () => recalculateCostsFromUnit(unit.id) : undefined,
                autoComplete: 'off', spellCheck: false,
                placeholder: '0',
                className: `product-number-input w-full px-2.5 py-2 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 ${extraClass}`
            })
        );
        return h('div', { key: unit.id, className: `unit-editor-card p-3 rounded-xl border bg-white dark:bg-slate-900 space-y-3 min-w-0 overflow-hidden ${unit.isDefaultSale ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700'}` },
            h('div', { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0' },
                h('div', { className: 'flex items-center gap-2 min-w-0 flex-1' },
                    h('span', { className: 'w-6 h-6 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold' }, idx + 1),
                    h('input', {
                        type: 'text', value: unit.name || '',
                        onChange: (e) => updateUnitField(unit.id, 'name', e.target.value),
                        placeholder: 'اسم الوحدة (حبة، كرتونة...)',
                        className: 'min-w-0 flex-1 sm:max-w-56 px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500'
                    }),
                    isBase && h('span', { className: 'shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' }, 'وحدة أساسية')
                ),
                h('div', { className: 'flex items-center gap-2 shrink-0' },
                    h('label', { className: 'flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer' },
                        h('input', { type: 'radio', name: 'defaultSaleUnit', checked: !!unit.isDefaultSale, onChange: () => {
                            setEditingProduct((prev) => prev ? ({ ...prev, units: prev.units.map((u) => ({ ...u, isDefaultSale: u.id === unit.id })) }) : prev);
                        }}),
                        h('span', null, 'افتراضية للبيع')
                    ),
                    !isBase && h('button', { type: 'button', onClick: () => handleRemoveUnit(unit.id), className: 'p-1.5 text-slate-400 hover:text-rose-500 rounded-lg', title: 'حذف هذه الوحدة' }, h(Trash2, { className: 'w-4 h-4' }))
                )
            ),
            !isBase && h('div', { className: 'unit-conversion-strip block w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden slim-scrollbar rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700' },
                h('div', { className: 'w-max min-w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 whitespace-nowrap' },
                    h('span', { className: 'font-bold text-slate-600 dark:text-slate-300' }, 'تحتوي على'),
                    h('input', {
                        type: 'text', inputMode: 'decimal', dir: 'ltr',
                        value: unit.multiplier === null || unit.multiplier === undefined ? '' : String(unit.multiplier),
                        onChange: (e) => updateUnitField(unit.id, 'multiplier', cleanDecimalInput(e.target.value), false),
                        onFocus: (e) => e.currentTarget.select(),
                        onBlur: () => updateUnitField(unit.id, 'multiplier', String(Math.max(1, toNumber(unit.multiplier, 1))), true),
                        className: 'w-16 px-2 py-1.5 text-center font-bold font-mono border border-amber-300 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500'
                    }),
                    h('span', null, `من (${childUnit?.name || 'الوحدة السابقة'})`),
                    h('span', { className: 'text-[11px] font-mono font-bold text-emerald-600 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40' }, `= ${unit.conversionToBase || 1} وحدة أساسية`)
                )
            ),
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 min-w-0' },
                numberInput('سعر بيع مفرق:', 'salePrice'),
                numberInput('الكمية الافتتاحية:', 'openingQuantity'),
                numberInput('سعر الشراء / التكلفة:', 'costPrice'),
                h('div', { className: 'min-w-0' },
                    h('label', { className: 'text-[10px] text-slate-400 block mb-1' }, 'باركود الوحدة:'),
                    h('div', { className: 'flex items-center gap-1 min-w-0' },
                        h('input', {
                            type: 'text', inputMode: 'numeric', dir: 'ltr',
                            value: (unit.barcodes || []).join(', '),
                            onFocus: (e) => e.currentTarget.select(),
                            onChange: (e) => updateUnitField(unit.id, 'barcodes', e.target.value.split(',').map((c) => normalizeArabicDigits(c).trim()).filter(Boolean)),
                            placeholder: '6251001, 6251002',
                            className: 'min-w-0 flex-1 px-2.5 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500'
                        }),
                        h('button', { type: 'button', onClick: () => setBarcodeScanUnitId(unit.id), className: 'barcode-camera-button shrink-0 w-10 h-9 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer active:scale-95 transition hover:bg-emerald-100', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0 }, title: 'فتح كاميرا سريعة لالتقاط الباركود' },
                            h(Camera, { className: 'w-5 h-5 block shrink-0' })
                        )
                    )
                )
            )
        );
    };
    const getProductsExportData = () => ({
        headers:['الصنف','الكود','التصنيف','الوحدات','سعر البيع','التكلفة','المخزون'],
        rows: filteredProducts.map(p => { const cat=categories.find(c=>c.id===p.categoryId); const stock=getProductStock(p.id, settings.activeWarehouseId); const units=(p.units||[]).map(u=>`${u.name} ×${u.factorToBase || 1}`).join(' / '); const sale=(p.units||[]).find(u=>u.isDefaultSale)?.salePrice ?? p.salePrice ?? 0; return [p.name,p.sku||p.internalCode||'',cat?.name||'عام',units,Number(sale||0),Number(p.costPrice||0),Number(stock||0)]; })
    });
    const handleProductsPDF = async () => { const {headers,rows}=getProductsExportData(); await downloadProfessionalTablePDF({title:'دليل الأصناف',headers,rows,settings,orientation:'landscape',filename:`دليل_الأصناف_${new Date().toISOString().slice(0,10)}.pdf`}); showToast('تم تصدير دليل الأصناف كاملاً كـ PDF','success'); };
    const handleProductsImage = async () => { const {headers,rows}=getProductsExportData(); await downloadProfessionalTableImage({title:'دليل الأصناف',headers,rows,settings,orientation:'landscape',filename:`دليل_الأصناف_${new Date().toISOString().slice(0,10)}.png`}); showToast('تم تصدير دليل الأصناف كاملاً كصورة','success'); };
    return (_jsxs("div", { id: "products-screen", className: "p-4 sm:p-6 space-y-4 max-w-7xl mx-auto text-right select-none", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white", children: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0634\u062c\u0631\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u062a\u0639\u062f\u062f \u0648\u062d\u062f\u0627\u062a \u062d\u0642\u064a\u0642\u064a (\u0645\u0634\u0637\u0627\u062d\u060c \u0643\u0631\u062a\u0648\u0646\u0629\u060c \u0628\u0627\u0643\u064a\u062a\u060c \u062d\u0628\u0629)\u060c \u0628\u0627\u0631\u0643\u0648\u062f \u0645\u062a\u0639\u062f\u062f \u0644\u0643\u0644 \u0648\u062d\u062f\u0629\u060c \u0648\u062a\u062a\u0628\u0639 \u0627\u0644\u0645\u062e\u0632\u0648\u0646" })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { onClick: handleProductsPDF, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", title: "\u062a\u0646\u0632\u064a\u0644 \u0643\u0640 PDF", children: [_jsx(Download, { className: "w-4 h-4 text-rose-600" }), _jsx("span", { children: "PDF" })] }), _jsxs("button", { onClick: handleProductsImage, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", title: "\u062a\u0646\u0632\u064a\u0644 \u0643\u0635\u0648\u0631\u0629", children: [_jsx(ImageIcon, { className: "w-4 h-4 text-blue-600" }), _jsx("span", { children: "\u0635\u0648\u0631\u0629" })] }), _jsxs("button", { onClick: () => {
                                    const headers = ['اسم الصنف', 'التصنيف', 'الباركود', 'سعر البيع', 'التكلفة'];
                                    const rows = filteredProducts.map((p) => {
                                        const cat = categories.find((c) => c.id === p.categoryId)?.name || 'عام';
                                        const defaultUnit = p.units.find((u) => u.isDefaultSale) || p.units[0];
                                        return [
                                            p.name,
                                            cat,
                                            defaultUnit?.barcodes?.join(' - ') || '',
                                            defaultUnit?.salePrice?.toString() || '',
                                            p.costPrice?.toString() || '',
                                        ];
                                    });
                                    exportToCSV(`دليل_الأصناف_${new Date().toISOString().slice(0, 10)}`, headers, rows);
                                    showToast('تم تصدير ملف Excel بنجاح', 'success');
                                }, className: "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition shadow-xs", children: [_jsx(FileSpreadsheet, { className: "w-4 h-4 text-emerald-600" }), _jsx("span", { children: "Excel" })] }), _jsxs("button", { id: "btn-add-product", onClick: handleOpenNew, className: "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 self-start sm:self-auto", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u062c\u062f\u064a\u062f + \u0634\u062c\u0631\u0629 \u0648\u062d\u062f\u0627\u062a" })] })] })] }), _jsxs("div", { className: "p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex-1 min-w-[220px] relative", children: [_jsx(Search, { className: "absolute right-3 top-2.5 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645\u060c \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f\u060c \u0627\u0644\u0643\u0648\u062f\u060c \u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629...", className: "w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500" })] }), _jsx("div", { className: "min-w-[190px]", children: _jsx(SearchableDropdown, { id: "products-filter-category", options: [{id:"all",label:`\u0643\u0627\u0641\u0629 \u0627\u0644\u062a\u0635\u0646\u064a\u0641\u0627\u062a (${activeProducts.length})`}, ...categories.map((c) => ({ id:c.id, label:c.name }))], selectedId: selectedCategory, onSelect: setSelectedCategory, placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u062a\u0635\u0646\u064a\u0641..." }) })] }), _jsx("div", { id: "products-table-container", ref: tableContainerRef, className: "rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden", children: _jsx("div", { className: "overflow-x-auto max-w-full slim-scrollbar", children: filteredProducts.length === 0 ? (_jsx("div", { className: "p-12 text-center text-xs text-slate-400", children: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0635\u0646\u0627\u0641 \u062a\u0637\u0627\u0628\u0642 \u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u0628\u062d\u062b" })) : (_jsxs("table", { className: "w-full text-xs text-right whitespace-nowrap min-w-[800px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold", children: [_jsx("th", { className: "p-3", children: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { className: "p-3", children: "\u0627\u0644\u062a\u0635\u0646\u064a\u0641" }), _jsx("th", { className: "p-3", children: "\u0634\u062c\u0631\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0648\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f" }), _jsx("th", { className: "p-3 text-left", children: "\u0633\u0639\u0631 \u0627\u0644\u0628\u064a\u0639 (\u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a)" }), _jsx("th", { className: "p-3 text-left", children: "\u0627\u0644\u062a\u0643\u0644\u0641\u0629 (\u0627\u0644\u0648\u062d\u062f\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629)" }), _jsx("th", { className: "p-3 text-center", children: "\u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0645\u062a\u0648\u0641\u0631" }), _jsx("th", { className: "p-3 text-center", children: "\u0625\u062c\u0631\u0627\u0621\u0627\u062a" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 dark:divide-slate-800", children: productsPager.pageItems.map((prod) => {
                                    const baseStock = getProductStock(prod.id, settings.activeWarehouseId);
                                    const cat = categories.find((c) => c.id === prod.categoryId);
                                    return (_jsxs("tr", { className: "hover:bg-slate-50/60 dark:hover:bg-slate-800/30", children: [_jsxs("td", { className: "p-3", children: [_jsx("div", { className: "font-bold text-slate-900 dark:text-white", children: prod.name }), _jsxs("div", { className: "text-[10px] text-slate-400 font-mono", children: [prod.sku || prod.internalCode || 'صنف', " ", prod.brand && `• ${prod.brand}`] })] }), _jsx("td", { className: "p-3", children: _jsx("span", { className: "px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300", children: cat?.name || 'عام' }) }), _jsx("td", { className: "p-3", children: _jsx("div", { className: "flex flex-wrap items-center gap-1", children: prod.units.map((u, i) => (_jsxs("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex items-center gap-1 ${u.isDefaultSale
                                                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`, title: `سعر البيع: ${u.salePrice} | الباركود: ${u.barcodes.join(', ')}`, children: [_jsx("span", { children: u.name }), _jsx("span", { className: "text-[9px] opacity-70", children: u.conversionToBase > 1 && `(×${u.conversionToBase})` }), i < prod.units.length - 1 && _jsx("span", { className: "opacity-40", children: "\u2190" })] }, u.id))) }) }), _jsxs("td", { className: "p-3 text-left font-mono font-bold text-slate-900 dark:text-white", children: [prod.sellingPrice.toFixed(2), " ", settings.currencySymbol] }), _jsxs("td", { className: "p-3 text-left font-mono text-slate-500", children: [prod.costPrice.toFixed(2), " ", settings.currencySymbol] }), _jsxs("td", { className: "p-3 text-center", children: [_jsxs("span", { className: `px-2 py-0.5 rounded font-mono font-bold text-xs ${baseStock <= (prod.reorderPoint || 0)
                                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`, title: formatStockBreakdown(baseStock, prod.units), children: formatStockBreakdown(baseStock, prod.units, prod.baseUnitName) }), _jsx("div", { className: "text-[9px] text-slate-400 mt-0.5 truncate max-w-[140px]", children: formatStockBreakdown(baseStock, prod.units) })] }), _jsx("td", { className: "p-3 text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-1.5", children: [_jsx("button", { onClick: () => handleOpenEdit(prod), className: "p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50", title: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0635\u0646\u0641 \u0648\u0634\u062c\u0631\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a", children: _jsx(Edit, { className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => softDeleteProduct(prod.id), className: "p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50", title: "\u0646\u0642\u0644 \u0644\u0633\u0644\u0629 \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0627\u062a", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }) })] }, prod.id));
                                }) })] })) }) }), _jsx(Pagination, { pager: productsPager }), editingProduct && (_jsx("div", { className: "product-editor-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto animate-in fade-in", children: _jsxs("form", { onSubmit: handleSaveModal, className: "product-editor-modal-panel w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right my-6", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FolderTree, { className: "w-5 h-5 text-emerald-600" }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-black text-slate-900 dark:text-white", children: isNew ? 'إضافة صنف جديد مع شجرة وحدات' : `تعديل صنف: ${editingProduct.name}` }), _jsx("p", { className: "text-xs text-slate-500", children: "\u062d\u062f\u062f \u0627\u0644\u0648\u062d\u062f\u0629 \u0627\u0644\u0635\u063a\u0631\u0649 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 \u062b\u0645 \u0623\u0636\u0641 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0623\u0643\u0628\u0631 (\u0628\u0627\u0643\u064a\u062a\u060c \u0643\u0631\u062a\u0648\u0646\u0629\u060c \u0645\u0634\u0637\u0627\u062d)" })] })] }), _jsx("button", { type: "button", onClick: () => setEditingProduct(null), className: "p-1 rounded-lg text-slate-400 hover:text-slate-600", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "product-editor-body p-4 sm:p-5 space-y-5 max-h-[75vh] overflow-y-auto overflow-x-hidden custom-scrollbar", children: [_jsxs("div", { className: "oscar-mobile-form-grid grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u0643\u0627\u0645\u0644 *" }), _jsx("input", { type: "text", required: true, value: editingProduct.name, onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, name: e.target.value }) : prev), placeholder: "\u0645\u062b\u0627\u0644: \u0645\u064a\u0627\u0647 \u0645\u0639\u062f\u0646\u064a\u0629 \u0623\u0631\u0648\u0649 500 \u0645\u0644", className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u0627\u0644\u062a\u0635\u0646\u064a\u0641:" }), _jsx(SearchableDropdown, { id: "product-category", options: categories.map((c) => ({ id: c.id, label: c.name })), selectedId: editingProduct.categoryId, onSelect: (id) => setEditingProduct((prev) => prev ? ({ ...prev, categoryId: id }) : prev), placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u062a\u0635\u0646\u064a\u0641..." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "مكان ظهور الصنف / الاستخدام:" }), _jsxs("select", { id: "product-sales-channel", value: editingProduct.salesChannel || 'both', onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, salesChannel: e.target.value }) : prev), className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold", children: [_jsx("option", { value: "shop", children: "المحل / الكاشير فقط" }), _jsx("option", { value: "restaurant", children: "المطعم والجرسون فقط" }), _jsx("option", { value: "both", children: "المحل والمطعم معاً" }), _jsx("option", { value: "raw_material", children: "مادة خام فقط - للوصفات والتصنيع" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629 (\u0627\u0644\u0645\u0627\u0631\u0643\u0629):" }), _jsx("input", { type: "text", value: editingProduct.brand || '', onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, brand: e.target.value }) : prev), placeholder: "\u0645\u062b\u0627\u0644: \u0623\u0631\u0648\u0649\u060c \u0643\u0648\u0643\u0627\u0643\u0648\u0644\u0627\u060c \u0627\u0644\u062c\u0646\u064a\u062f\u064a", className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u0643\u0648\u062f \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u062f\u0627\u062e\u0644\u064a (SKU):" }), _jsx("input", { type: "text", value: editingProduct.internalCode || '', onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, internalCode: e.target.value }) : prev), className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u062d\u062f \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628 (\u062a\u0646\u0628\u064a\u0647 \u0627\u0644\u0646\u0648\u0627\u0642\u0635):" }), _jsx("input", { type: "text", inputMode: "decimal", dir: "ltr", value: editingProduct.reorderPoint ?? '', onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, reorderPoint: cleanDecimalInput(e.target.value) }) : prev), className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "\u062a\u0627\u0631\u064a\u062e \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629:" }), _jsx("input", { type: "date", value: editingProduct.expiryDate || '', onChange: (e) => setEditingProduct((prev) => prev ? ({ ...prev, expiryDate: e.target.value }) : prev), className: "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" })] })] }), _jsxs("div", { className: "p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 min-w-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Layers, { className: "w-4 h-4 text-emerald-600" }), _jsx("h4", { className: "text-xs font-bold text-slate-900 dark:text-white", children: "\u0634\u062c\u0631\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0647\u0631\u0645\u064a\u0629 \u0648\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f\u0627\u062a:" })] }), _jsxs("button", { type: "button", onClick: handleAddParentUnit, className: "flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u0625\u0636\u0627\u0641\u0629 \u0648\u062d\u062f\u0629 \u0623\u0643\u0628\u0631 (\u0643\u0631\u062a\u0648\u0646\u0629 / \u0645\u0634\u0637\u0627\u062d)" })] })] }), _jsx("div", { className: "space-y-3", children: editingProduct.units.map((unit, idx) => {
                                                const isBase = unit.id === editingProduct.baseUnitId;
                                                const childUnit = editingProduct.units.find((u) => u.id === unit.childUnitId);
                                                return renderUnitCard(unit, idx, isBase, childUnit);
                                            }) })] })] }), _jsxs("div", { className: "p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between", children: [_jsx("button", { type: "button", onClick: () => setEditingProduct(null), className: "px-4 py-2 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-200", children: "\u0625\u0644\u063a\u0627\u0621" }), _jsx("button", { type: "submit", id: "btn-save-product-modal", className: "px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20", children: "\u062d\u0641\u0638 \u0627\u0644\u0635\u0646\u0641 \u0648\u062a\u062d\u062f\u064a\u062b \u0634\u062c\u0631\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a" })] })] }) })), _jsx(BarcodeCameraModal, { open: !!barcodeScanUnitId, onClose: () => setBarcodeScanUnitId(null), onDetected: handleDetectedUnitBarcode, title: "التقاط باركود الوحدة" })] }));
};
