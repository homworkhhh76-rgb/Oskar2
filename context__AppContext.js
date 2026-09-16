import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { getAllFromStore, getFromStore, putInStore, deleteFromStore, clearStore, bulkPut, initializeDatabase, seedDatabaseDefaults, migrateLegacyDatabaseIfNeeded, ensurePrimaryShowroomWarehouse, resetDatabase, exportDatabaseBackup, importDatabaseBackup, syncChannel, DEFAULT_SETTINGS, DEFAULT_CUSTOMERS, DEFAULT_CATEGORIES, DEFAULT_WAREHOUSES, DEFAULT_ACCOUNTS, DEFAULT_SUPPLIERS, getDemoProducts, getDemoStock, DEFAULT_EMPLOYEES, } from './services__db.js';
import { calculateUnitConversions, findUnitByBarcode, toBaseQuantity } from './utils__unitTree.js';
import { playBeepSound, playSuccessSound, playErrorSound } from './services__audio.js';
const AppContext = createContext(null);
const recordTime = (item = {}) => {
    const fields = ['createdAt', 'date', 'timestamp', 'startTime', 'updatedAt'];
    for (const field of fields) {
        const value = item?.[field];
        if (!value) continue;
        const t = new Date(value).getTime();
        if (Number.isFinite(t)) return t;
    }
    const idMatch = String(item?.id || '').match(/(\d{10,})/);
    return idMatch ? Number(idMatch[1]) : 0;
};
const newestFirst = (items = []) => [...(items || [])].sort((a, b) => recordTime(b) - recordTime(a));
export const AppProvider = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    // Database state
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [stock, setStock] = useState([]);
    const [stockMovements, setStockMovements] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [heldInvoices, setHeldInvoices] = useState([]);
    const [syncQueue, setSyncQueue] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [partnerStatements, setPartnerStatements] = useState([]);
    const [vouchers, setVouchers] = useState([]);
    const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
    const [activeEmployee, setActiveEmployee] = useState(DEFAULT_EMPLOYEES[0]);
    // UI state
    const [activeTab, setActiveTab] = useState('pos');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [posCartLayout, setPosCartLayout] = useState('split');
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Modals state
    const [showThermalModal, setShowThermalModal] = useState(null);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showHoldInvoicesModal, setShowHoldInvoicesModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    // Active cashier user linked to selected activeEmployee
    const currentUser = useMemo(() => {
        const rt = window.OscarActivation?.readRuntime?.();
        const account = rt?.account;
        return {
            id: account?.id || activeEmployee?.id || 'emp-admin',
            name: account?.name || account?.displayName || activeEmployee?.name || 'مدير النظام',
            role: account?.roleName || account?.role || activeEmployee?.roleName || 'مدير عام',
            permissions: account?.permissions || activeEmployee?.permissions || {},
            isCompanyManager: rt?.type === 'company-manager',
            companyId: rt?.companyId || '',
            companyName: rt?.companyName || settings.storeName,
        };
    }, [activeEmployee, settings.storeName]);
    // Cart state
    const [cart, setCart] = useState([]);
    const [invoiceDiscountType, setInvoiceDiscountType] = useState('fixed');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState(0);
    const [selectedCustomer, setSelectedCustomer] = useState(DEFAULT_CUSTOMERS[0]);
    // Toast helper
    const showToast = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2600);
    }, []);
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    // Reload all stores from IndexedDB
    const reloadData = useCallback(async () => {
        try {
            const [prods, cats, whs, stk, stkMovs, invs, purchs, custs, supps, accs, trans, exps, shfts, audits, helds, syncs, sett, stmts, vouchs, emps,] = await Promise.all([
                getAllFromStore('products'),
                getAllFromStore('categories'),
                getAllFromStore('warehouses'),
                getAllFromStore('stock'),
                getAllFromStore('stock_movements'),
                getAllFromStore('invoices'),
                getAllFromStore('purchases'),
                getAllFromStore('customers'),
                getAllFromStore('suppliers'),
                getAllFromStore('accounts'),
                getAllFromStore('transfers'),
                getAllFromStore('expenses'),
                getAllFromStore('shifts'),
                getAllFromStore('audit_logs'),
                getAllFromStore('held_invoices'),
                getAllFromStore('sync_queue'),
                getFromStore('settings', 'store_config'),
                getAllFromStore('partner_statements'),
                getAllFromStore('vouchers'),
                getAllFromStore('employees'),
            ]);
            setProducts(newestFirst(prods));
            setCategories((cats || []).sort((a, b) => a.displayOrder - b.displayOrder));
            setWarehouses(whs || []);
            setStock(stk || []);
            setStockMovements((stkMovs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setInvoices((invs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setPurchases((purchs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setCustomers(newestFirst(custs));
            setSuppliers(newestFirst(supps));
            const orderedAccounts = newestFirst(accs);
            orderedAccounts.sort((a, b) => Number(Boolean(b?.isDefault)) - Number(Boolean(a?.isDefault)));
            setAccounts(orderedAccounts);
            setTransfers((trans || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setExpenses((exps || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setShifts((shfts || []).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
            setAuditLogs((audits || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            setHeldInvoices(newestFirst(helds));
            setSyncQueue(window.OscarCloudSync?.pendingItems?.() || syncs || []);
            setPartnerStatements(newestFirst(stmts));
            setVouchers((vouchs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            if (emps && emps.length > 0) {
                setEmployees(newestFirst(emps));
                const loginAccountId = window.OscarActivation?.readRuntime?.()?.account?.id;
                setActiveEmployee((prev) => emps.find((e) => e.id === loginAccountId) || emps.find((e) => e.id === prev.id) || emps[0]);
            }
            if (sett)
                setSettings(sett);
            // Default customer fallback
            if (custs && custs.length > 0) {
                setSelectedCustomer((prev) => prev ? custs.find((c) => c.id === prev.id) || custs[0] : custs[0]);
            }
        }
        catch (err) {
            console.error('Error reloading database:', err);
        }
        finally {
            setIsLoaded(true);
        }
    }, []);
    // Reload only the local IndexedDB datasets that actually changed. This keeps live sync fast
    // and avoids re-reading the whole local database after every remote delta.
    const reloadStores = useCallback(async (storeNames = []) => {
        const wanted = new Set(Array.isArray(storeNames) ? storeNames : [storeNames]);
        if (!wanted.size) return;
        const jobs = [];
        if (wanted.has('products')) jobs.push(getAllFromStore('products').then(v => setProducts(newestFirst(v))));
        if (wanted.has('categories')) jobs.push(getAllFromStore('categories').then(v => setCategories((v || []).sort((a,b)=>(a.displayOrder||0)-(b.displayOrder||0)))));
        if (wanted.has('warehouses')) jobs.push(getAllFromStore('warehouses').then(v => setWarehouses(v || [])));
        if (wanted.has('stock')) jobs.push(getAllFromStore('stock').then(v => setStock(v || [])));
        if (wanted.has('stock_movements')) jobs.push(getAllFromStore('stock_movements').then(v => setStockMovements((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('invoices')) jobs.push(getAllFromStore('invoices').then(v => setInvoices((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('purchases')) jobs.push(getAllFromStore('purchases').then(v => setPurchases((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('customers')) jobs.push(getAllFromStore('customers').then(v => { setCustomers(newestFirst(v)); setSelectedCustomer(prev => prev ? (v || []).find(c=>c.id===prev.id)||v?.[0]||prev : v?.[0]||prev); }));
        if (wanted.has('suppliers')) jobs.push(getAllFromStore('suppliers').then(v => setSuppliers(newestFirst(v))));
        if (wanted.has('accounts')) jobs.push(getAllFromStore('accounts').then(v => { const x=newestFirst(v); x.sort((a,b)=>Number(Boolean(b?.isDefault))-Number(Boolean(a?.isDefault))); setAccounts(x); }));
        if (wanted.has('transfers')) jobs.push(getAllFromStore('transfers').then(v => setTransfers((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('expenses')) jobs.push(getAllFromStore('expenses').then(v => setExpenses((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('shifts')) jobs.push(getAllFromStore('shifts').then(v => setShifts((v || []).sort((a,b)=>new Date(b.startTime).getTime()-new Date(a.startTime).getTime()))));
        if (wanted.has('audit_logs')) jobs.push(getAllFromStore('audit_logs').then(v => setAuditLogs((v || []).sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()))));
        if (wanted.has('held_invoices')) jobs.push(getAllFromStore('held_invoices').then(v => setHeldInvoices(newestFirst(v))));
        if (wanted.has('partner_statements')) jobs.push(getAllFromStore('partner_statements').then(v => setPartnerStatements(newestFirst(v))));
        if (wanted.has('vouchers')) jobs.push(getAllFromStore('vouchers').then(v => setVouchers((v || []).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))));
        if (wanted.has('employees')) jobs.push(getAllFromStore('employees').then(v => { if(v?.length){ setEmployees(newestFirst(v)); const loginId=window.OscarActivation?.readRuntime?.()?.account?.id; setActiveEmployee(prev => v.find(e=>e.id===loginId)||v.find(e=>e.id===prev?.id)||v[0]); } }));
        if (wanted.has('settings')) jobs.push(getFromStore('settings','store_config').then(v => { if(v) setSettings(v); }));
        if (wanted.has('sync_queue')) jobs.push(Promise.resolve().then(()=>setSyncQueue(window.OscarCloudSync?.pendingItems?.() || [])));
        await Promise.allSettled(jobs);
    }, []);
    // Initial load with guaranteed fallback
    useEffect(() => {
        let isMounted = true;
        // Safety timeout: Never let the app hang on the loading screen
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                setIsLoaded(true);
            }
        }, 1200);
        initializeDatabase({ deferSeed: true })
            .then(async () => {
            if (!isMounted) return;
            let existingSettings = await getFromStore('settings', 'store_config');
            // Existing installations open immediately from IndexedDB. Cloud work happens after the UI is usable.
            if (existingSettings) await reloadData();
            let syncResult = null;
            try {
                syncResult = await window.OscarCloudSync?.initialize?.({
                    bridge: {
                        putInStore, deleteFromStore, getAllFromStore,
                        onApplied: async (stores) => { if (isMounted) await reloadStores(stores || []); }
                    }
                });
            } catch (syncError) { console.warn('Cloud sync bootstrap warning:', syncError); }
            // Keep the primary warehouse normalized locally even when old/cloud data still uses the previous name.
            const showroomNormalized = await ensurePrimaryShowroomWarehouse().catch(() => false);
            if (showroomNormalized && existingSettings) await reloadStores(['warehouses', 'settings']);
            if (!existingSettings) {
                existingSettings = await getFromStore('settings', 'store_config');
                // Upgrade an existing single-company installation only when this company has no cloud/local data yet.
                if (!existingSettings && Number(syncResult?.remoteRows || 0) === 0) {
                    const migrated = await migrateLegacyDatabaseIfNeeded();
                    if (migrated) existingSettings = await getFromStore('settings', 'store_config');
                }
                if (!existingSettings) await seedDatabaseDefaults();
                await reloadData();
            }
            if (window.OscarCloudSync?.pendingCount?.()) window.OscarCloudSync.requestSync?.(80);
        })
            .catch((err) => {
            console.warn('Database initialization warning:', err);
            if (isMounted) setIsLoaded(true);
        })
            .finally(() => {
            clearTimeout(safetyTimer);
            if (isMounted) setIsLoaded(true);
        });
        // Cross-tab real-time listener
        if (syncChannel) {
            const handleMessage = (event) => {
                const msg = event?.data || {};
                const tenantId = window.OscarActivation?.readRuntime?.()?.companyId || '';
                if (msg.tenantId && msg.tenantId !== tenantId) return;
                msg.storeName ? reloadStores([msg.storeName]) : reloadData();
            };
            syncChannel.addEventListener('message', handleMessage);
            return () => {
                isMounted = false;
                clearTimeout(safetyTimer);
                syncChannel.removeEventListener('message', handleMessage);
            };
        }
        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
        };
    }, [reloadData, reloadStores]);
    useEffect(() => {
        const onStatus = (event) => {
            const d = event.detail || {};
            setIsSyncing(!!d.busy || d.state === 'syncing');
            setSyncQueue(window.OscarCloudSync?.pendingItems?.() || []);
        };
        const onApplied = (event) => reloadStores(event?.detail?.stores || []);
        window.addEventListener('oscar:sync-status', onStatus);
        window.addEventListener('oscar:sync-applied', onApplied);
        onStatus({ detail: {} });
        return () => { window.removeEventListener('oscar:sync-status', onStatus); window.removeEventListener('oscar:sync-applied', onApplied); };
    }, [reloadStores]);
    // Online / Offline monitor
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showToast('تمت استعادة الاتصال بالإنترنت - جاهز للمزامنة', 'success');
            window.OscarCloudSync?.syncNow?.({ force: true });
        };
        const handleOffline = () => {
            setIsOnline(false);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    // Active shift
    const activeShift = useMemo(() => {
        return shifts.find((s) => s.status === 'open') || null;
    }, [shifts]);
    // Get current stock for a product in a warehouse (or all warehouses)
    const getProductStock = useCallback((productId, warehouseId) => {
        const targetWh = warehouseId || settings.activeWarehouseId;
        if (warehouseId) {
            const item = stock.find((s) => s.productId === productId && s.warehouseId === targetWh);
            return item ? item.baseQuantity : 0;
        }
        return stock
            .filter((s) => s.productId === productId)
            .reduce((sum, s) => sum + s.baseQuantity, 0);
    }, [stock, settings.activeWarehouseId]);
    // Cart operations
    const addToCart = useCallback((product, unit, quantity = 1) => {
        const targetUnit = unit || product.units.find((u) => u.isDefaultSale) || product.units[0];
        if (!targetUnit)
            return;
        const baseStock = getProductStock(product.id, settings.activeWarehouseId);
        setCart((prev) => {
            const existingIndex = prev.findIndex((item) => item.productId === product.id && item.unitId === targetUnit.id);
            if (existingIndex >= 0) {
                const updatedItem = {
                    ...prev[existingIndex],
                    quantity: prev[existingIndex].quantity + quantity,
                    lastAddedAt: Date.now(),
                };
                // آخر صنف تمت إضافته/زيادته يظهر أولاً في السلة.
                return [updatedItem, ...prev.filter((_, index) => index !== existingIndex)];
            }
            return [
                {
                    productId: product.id,
                    productName: product.name,
                    unitId: targetUnit.id,
                    unitName: targetUnit.name,
                    availableUnits: product.units,
                    quantity: quantity,
                    conversionFactor: targetUnit.conversionToBase || 1,
                    unitPrice: targetUnit.salePrice || product.sellingPrice,
                    catalogUnitPrice: Number(targetUnit.salePrice || product.sellingPrice || 0),
                    discount: 0,
                    taxRate: product.taxRate || 0,
                    costPriceAtSale: (product.costPrice || 0) * (targetUnit.conversionToBase || 1),
                    baseStockAvailable: baseStock,
                    lastAddedAt: Date.now(),
                },
                ...prev,
            ];
        });
        playBeepSound(settings.scannerBeepEnabled);
    }, [getProductStock, settings.activeWarehouseId, settings.scannerBeepEnabled]);
    const updateCartItemUnit = useCallback((productId, oldUnitId, newUnitId) => {
        setCart((prev) => {
            const index = prev.findIndex((item) => item.productId === productId && item.unitId === oldUnitId);
            if (index === -1)
                return prev;
            const currentItem = prev[index];
            const newUnit = currentItem.availableUnits.find((u) => u.id === newUnitId);
            if (!newUnit)
                return prev;
            const updated = [...prev];
            updated[index] = {
                ...currentItem,
                unitId: newUnit.id,
                unitName: newUnit.name,
                conversionFactor: newUnit.conversionToBase || 1,
                unitPrice: newUnit.salePrice,
                catalogUnitPrice: Number(newUnit.salePrice || 0),
                costPriceAtSale: (currentItem.costPriceAtSale / currentItem.conversionFactor) * (newUnit.conversionToBase || 1),
            };
            return updated;
        });
    }, []);
    const updateCartItemQuantity = useCallback((productId, unitId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId, unitId);
            return;
        }
        setCart((prev) => prev.map((item) => item.productId === productId && item.unitId === unitId ? { ...item, quantity } : item));
    }, []);
    const updateCartItemPrice = useCallback((productId, unitId, unitPrice) => {
        const nextPrice = Number(unitPrice);
        if (!Number.isFinite(nextPrice) || nextPrice < 0) return;
        setCart((prev) => prev.map((item) => item.productId === productId && item.unitId === unitId ? { ...item, unitPrice: nextPrice } : item));
    }, []);
    const updateCartItemScaleAmount = useCallback((productId, unitId, enteredAmount) => {
        const amount = Number(enteredAmount);
        if (!Number.isFinite(amount) || amount < 0) return;
        setCart((prev) => prev.map((item) => {
            if (item.productId !== productId || item.unitId !== unitId) return item;
            const unit = (item.availableUnits || []).find((u) => u.id === item.unitId);
            const referencePrice = Number(item.catalogUnitPrice ?? unit?.salePrice ?? item.unitPrice ?? 0);
            if (!Number.isFinite(referencePrice) || referencePrice <= 0) return item;
            const quantity = amount <= 0 ? 0.001 : amount / referencePrice;
            return { ...item, unitPrice: referencePrice, catalogUnitPrice: referencePrice, quantity: Math.max(0.001, Number(quantity.toFixed(4))) };
        }));
    }, []);
    const updateCartItemDiscount = useCallback((productId, unitId, discount) => {
        setCart((prev) => prev.map((item) => item.productId === productId && item.unitId === unitId ? { ...item, discount: Math.max(0, discount) } : item));
    }, []);
    const removeFromCart = useCallback((productId, unitId) => {
        setCart((prev) => prev.filter((item) => !(item.productId === productId && item.unitId === unitId)));
    }, []);
    const clearCart = useCallback(() => {
        setCart([]);
        setInvoiceDiscountType('fixed');
        setInvoiceDiscountValue(0);
    }, []);
    // Hold current invoice
    const holdCurrentInvoice = useCallback(async (notes) => {
        if (cart.length === 0) {
            showToast('السلة فارغة، لا يمكن تعليق فاتورة فارغة', 'warning');
            return;
        }
        const held = {
            id: 'held-' + Date.now(),
            date: new Date().toISOString(),
            customerName: selectedCustomer?.name,
            items: [...cart],
            subtotal: cart.reduce((s, i) => s + (i.quantity * i.unitPrice), 0),
            notes,
        };
        await putInStore('held_invoices', held);
        setHeldInvoices((prev) => [held, ...prev]);
        clearCart();
        showToast('تم تعليق الفاتورة بنجاح ويمكن استرجاعها في أي وقت', 'success');
    }, [cart, selectedCustomer, clearCart, showToast]);
    const restoreHeldInvoice = useCallback(async (heldId) => {
        const held = heldInvoices.find((h) => h.id === heldId);
        if (!held)
            return;
        if (cart.length > 0) {
            await holdCurrentInvoice('فاتورة مستبدلة تلقائياً');
        }
        setCart(held.items);
        await deleteFromStore('held_invoices', heldId);
        setHeldInvoices((prev) => prev.filter((h) => h.id !== heldId));
        setShowHoldInvoicesModal(false);
        showToast('تم استعادة الفاتورة المعلقة إلى السلة', 'info');
    }, [heldInvoices, cart.length, holdCurrentInvoice, showToast]);
    const deleteHeldInvoice = useCallback(async (heldId) => {
        await deleteFromStore('held_invoices', heldId);
        setHeldInvoices((prev) => prev.filter((h) => h.id !== heldId));
    }, []);
    // Handle scanned barcode (hardware scanner or camera)
    const handleScannedBarcode = useCallback((barcode) => {
        if (!barcode || barcode.trim() === '')
            return false;
        const clean = barcode.trim();
        for (const prod of products) {
            if (prod.status === 'archived' || prod.deletedAt)
                continue;
            const matchedUnit = findUnitByBarcode(prod, clean);
            if (matchedUnit) {
                addToCart(prod, matchedUnit, 1);
                showToast(`تمت إضافة: ${prod.name} (${matchedUnit.name})`, 'success');
                return true;
            }
        }
        playErrorSound(settings.scannerBeepEnabled);
        showToast(`لم يتم العثور على صنف بالباركود: ${clean}`, 'warning');
        return false;
    }, [products, addToCart, showToast, settings.scannerBeepEnabled]);
    // Create Sale Invoice (invoice discount + FIFO cost consumption)
    const createSaleInvoice = useCallback(async (payload) => {
        if (cart.length === 0) { showToast('السلة فارغة!', 'error'); return null; }
        const warehouseId = settings.activeWarehouseId;
        const warehouse = warehouses.find((w) => w.id === warehouseId) || warehouses[0];
        const now = new Date().toISOString();
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
        const syncId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        let subtotal = 0, lineDiscountTotal = 0, taxTotal = 0;
        const productCopies = products.map(p => ({...p, fifoBatches: Array.isArray(p.fifoBatches) ? p.fifoBatches.map(b=>({...b})) : []}));
        const consumeFifo = (productId, baseQty, fallbackBaseCost) => {
            const p = productCopies.find(x=>x.id===productId);
            if (!p) return baseQty * fallbackBaseCost;
            let left = Math.max(0, baseQty), totalCost = 0;
            const candidates = p.fifoBatches.filter(b => (b.warehouseId === warehouseId || !b.warehouseId) && Number(b.remainingBaseQty)>0)
              .sort((a,b)=>new Date(a.receivedAt||0)-new Date(b.receivedAt||0));
            for (const batch of candidates) {
                if (left <= 0) break;
                const take = Math.min(left, Number(batch.remainingBaseQty)||0);
                totalCost += take * (Number(batch.unitCost)||fallbackBaseCost);
                batch.remainingBaseQty = Math.max(0,(Number(batch.remainingBaseQty)||0)-take);
                left -= take;
            }
            if (left > 0) totalCost += left * fallbackBaseCost;
            return totalCost;
        };
        const invoiceItems = cart.map((item) => {
            const lineSubtotal = item.quantity * item.unitPrice;
            const lineDiscount = 0;
            const lineTax = lineSubtotal * (item.taxRate / 100);
            const lineTotal = lineSubtotal + lineTax;
            subtotal += lineSubtotal; lineDiscountTotal += 0; taxTotal += lineTax;
            const baseQuantity = item.quantity * item.conversionFactor;
            const fallbackBaseCost = item.conversionFactor ? (item.costPriceAtSale / item.conversionFactor) : item.costPriceAtSale;
            const fifoLineCost = consumeFifo(item.productId, baseQuantity, fallbackBaseCost || 0);
            return { id:'item-'+Math.random().toString(36).substring(2,9), productId:item.productId, productName:item.productName, unitId:item.unitId, unitName:item.unitName, quantity:item.quantity, conversionFactor:item.conversionFactor, baseQuantity, unitPrice:item.unitPrice, discount:0, taxRate:item.taxRate, total:lineTotal, fifoCostTotal:fifoLineCost, costPriceAtSale:item.quantity>0?fifoLineCost/item.quantity:0 };
        });
        const beforeInvoiceDiscount = Math.max(0, subtotal - lineDiscountTotal + taxTotal);
        const rawDiscount = Number(invoiceDiscountValue)||0;
        const invoiceDiscountAmount = invoiceDiscountType === 'percent' ? Math.min(beforeInvoiceDiscount, beforeInvoiceDiscount*Math.max(0,Math.min(100,rawDiscount))/100) : Math.min(beforeInvoiceDiscount,Math.max(0,rawDiscount));
        const discountTotal = lineDiscountTotal + invoiceDiscountAmount;
        const rawGrandTotal = Math.max(0, beforeInvoiceDiscount - invoiceDiscountAmount);
        const grandTotal = settings.scaleModeEnabled ? Math.round(rawGrandTotal) : rawGrandTotal;
        const roundingAdjustment = grandTotal - rawGrandTotal;
        const payments = Array.isArray(payload.payments) ? payload.payments.filter(p => p && Number(p.amount) > 0 && p.accountId) : [];
        let paid = Number(payload.paidAmount)||0;
        const remaining = Math.max(0, grandTotal - paid);
        const change = Math.max(0, paid - grandTotal);
        if ((payload.paymentType === 'debt' || payload.paymentType === 'partial') && (!selectedCustomer || selectedCustomer.id === 'cust-walkin')) { showToast('يجب اختيار عميل مسجل للبيع الآجل أو الدفع الجزئي!', 'error'); return null; }
        const invoice = { id:'inv-'+Date.now(), invoiceNumber, type:'sale', date:now, customerId:selectedCustomer?.id, customerName:selectedCustomer?.name, cashierId:currentUser.id, cashierName:currentUser.name, shiftId:activeShift?.id, branchId:settings.activeBranchName, warehouseId, items:invoiceItems, subtotal, lineDiscountTotal, invoiceDiscountType, invoiceDiscountValue:rawDiscount, invoiceDiscountAmount, discountTotal, taxTotal, roundingAdjustment, grandTotal, paidAmount:Math.min(paid,grandTotal), remainingAmount:remaining, changeAmount:change, paymentType:payload.paymentType, payments, status:'completed', notes:payload.notes, syncId, isSynced:false, createdAt:now };
        await putInStore('invoices', invoice);
        const updatedStockList=[...stock], newMovements=[];
        for (const item of invoiceItems) {
            const stockIndex=updatedStockList.findIndex(s=>s.productId===item.productId&&s.warehouseId===warehouseId);
            const currentQty=stockIndex>=0?updatedStockList[stockIndex].baseQuantity:0;
            const newQty=currentQty-item.baseQuantity;
            if(stockIndex>=0) updatedStockList[stockIndex]={...updatedStockList[stockIndex],baseQuantity:newQty}; else updatedStockList.push({productId:item.productId,warehouseId,baseQuantity:newQty});
            newMovements.push({id:'mov-'+Math.random().toString(36).substring(2,9),date:now,productId:item.productId,productName:item.productName,warehouseId,warehouseName:warehouse?.name||'صالة العرض',type:'sale',unitName:item.unitName,quantityInUnit:item.quantity,conversionFactor:item.conversionFactor,baseQuantityChange:-item.baseQuantity,newBaseBalance:newQty,referenceId:invoice.id,referenceType:'INVOICE',userId:currentUser.id,userName:currentUser.name});
        }
        await bulkPut('stock',updatedStockList); await bulkPut('stock_movements',newMovements); await bulkPut('products',productCopies);
        const updatedAccounts=[...accounts];
        for(const p of payments){const i=updatedAccounts.findIndex(a=>a.id===p.accountId);if(i>=0)updatedAccounts[i]={...updatedAccounts[i],balance:(Number(updatedAccounts[i].balance)||0)+(Number(p.amount)||0)};}
        await bulkPut('accounts',updatedAccounts);
        let updatedCustomer = null, customerStatement = null, updatedShift = null;
        if(remaining>0&&selectedCustomer&&selectedCustomer.id!=='cust-walkin'){const newBalance=(Number(selectedCustomer.balance)||0)+remaining;updatedCustomer={...selectedCustomer,balance:newBalance};customerStatement={id:'stmt-'+Date.now(),date:now,type:'sale',referenceNumber:invoiceNumber,description:`فاتورة مبيعات آجل رقم ${invoiceNumber}`,debit:remaining,credit:0,runningBalance:newBalance};await putInStore('customers',updatedCustomer);await putInStore('partner_statements',customerStatement);}
        if(activeShift){const cashPaid=payments.filter(p=>p.method==='cash').reduce((x,p)=>x+(Number(p.amount)||0),0)-change;const otherPaid=payments.filter(p=>p.method!=='cash').reduce((x,p)=>x+(Number(p.amount)||0),0);updatedShift={...activeShift,totalCashSales:(Number(activeShift.totalCashSales)||0)+Math.max(0,cashPaid),totalOtherSales:(Number(activeShift.totalOtherSales)||0)+otherPaid,expectedCash:(Number(activeShift.expectedCash)||0)+Math.max(0,cashPaid)};await putInStore('shifts',updatedShift);}
        // Update the open screen from the already-saved local data; no full database reload and no cloud wait.
        setInvoices(prev => [invoice, ...prev.filter(x => x.id !== invoice.id)]);
        setStock(updatedStockList);
        setStockMovements(prev => [...newMovements, ...prev]);
        setProducts(productCopies);
        setAccounts(updatedAccounts);
        if(updatedCustomer)setCustomers(prev => prev.map(c => c.id===updatedCustomer.id?updatedCustomer:c));
        if(customerStatement)setPartnerStatements(prev => [customerStatement, ...prev]);
        if(updatedShift)setShifts(prev => prev.map(x => x.id===updatedShift.id?updatedShift:x));
        setSyncQueue(window.OscarCloudSync?.pendingItems?.() || []);
        playSuccessSound(settings.scannerBeepEnabled); clearCart(); showToast(`تم حفظ الفاتورة بنجاح [${invoiceNumber}]`,'success'); return invoice;
    }, [cart, invoiceDiscountType, invoiceDiscountValue, settings, warehouses, products, selectedCustomer, currentUser, activeShift, stock, accounts, clearCart, showToast]);
    // Create Return Invoice
    const createReturnInvoice = useCallback(async (payload) => {
        const original = invoices.find((inv) => inv.id === payload.originalInvoiceId);
        if (!original) {
            showToast('لم يتم العثور على الفاتورة الأصلية', 'error');
            return null;
        }
        const now = new Date().toISOString();
        const returnNumber = `RET-${Date.now().toString().slice(-6)}`;
        const syncId = `ret-${Date.now()}`;
        let refundTotal = 0;
        const returnItems = [];
        for (const reqItem of payload.items) {
            const prod = products.find((p) => p.id === reqItem.productId);
            const unit = prod?.units.find((u) => u.id === reqItem.unitId);
            const factor = unit?.conversionToBase || 1;
            const originalItem = original.items?.find((x) => x.productId === reqItem.productId && x.unitId === reqItem.unitId);
            const costPerSoldUnit = originalItem?.costPriceAtSale ?? ((prod?.costPrice || 0) * factor);
            const returnFifoCost = reqItem.quantity * costPerSoldUnit;
            const total = reqItem.quantity * reqItem.unitPrice;
            refundTotal += total;
            returnItems.push({
                id: 'ret-item-' + Math.random().toString(36).substring(2, 9),
                productId: reqItem.productId,
                productName: prod?.name || 'صنف مرتجع',
                unitId: reqItem.unitId,
                unitName: unit?.name || 'حبة',
                quantity: reqItem.quantity,
                conversionFactor: factor,
                baseQuantity: reqItem.quantity * factor,
                unitPrice: reqItem.unitPrice,
                discount: 0,
                taxRate: 0,
                total,
                fifoCostTotal: returnFifoCost,
                costPriceAtSale: costPerSoldUnit,
            });
        }
        const returnInvoice = {
            id: 'ret-' + Date.now(),
            invoiceNumber: returnNumber,
            type: 'return',
            date: now,
            customerId: original.customerId,
            customerName: original.customerName,
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            shiftId: activeShift?.id,
            branchId: original.branchId,
            warehouseId: original.warehouseId,
            items: returnItems,
            subtotal: refundTotal,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: refundTotal,
            paidAmount: refundTotal,
            remainingAmount: 0,
            changeAmount: 0,
            paymentType: 'cash',
            payments: [
                {
                    method: 'cash',
                    amount: refundTotal,
                    accountId: payload.refundAccountId,
                    accountName: accounts.find((a) => a.id === payload.refundAccountId)?.name || 'الصندوق',
                },
            ],
            status: 'completed',
            originalInvoiceId: original.id,
            notes: payload.notes,
            syncId,
            isSynced: false,
            createdAt: now,
        };
        await putInStore('invoices', returnInvoice);
        // Re-credit stock
        const updatedStockList = [...stock];
        const newMovements = [];
        for (const item of returnItems) {
            const stockIndex = updatedStockList.findIndex((s) => s.productId === item.productId && s.warehouseId === original.warehouseId);
            const currentQty = stockIndex >= 0 ? updatedStockList[stockIndex].baseQuantity : 0;
            const newQty = currentQty + item.baseQuantity;
            if (stockIndex >= 0) {
                updatedStockList[stockIndex] = {
                    ...updatedStockList[stockIndex],
                    baseQuantity: newQty,
                };
            }
            newMovements.push({
                id: 'mov-' + Math.random().toString(36).substring(2, 9),
                date: now,
                productId: item.productId,
                productName: item.productName,
                warehouseId: original.warehouseId,
                warehouseName: warehouses.find((w) => w.id === original.warehouseId)?.name || 'المخزن',
                type: 'return',
                unitName: item.unitName,
                quantityInUnit: item.quantity,
                conversionFactor: item.conversionFactor,
                baseQuantityChange: item.baseQuantity,
                newBaseBalance: newQty,
                referenceId: returnInvoice.id,
                referenceType: 'RETURN',
                userId: currentUser.id,
                userName: currentUser.name,
            });
        }
        await bulkPut('stock', updatedStockList);
        await bulkPut('stock_movements', newMovements);
        // Deduct from refund account
        const acc = accounts.find((a) => a.id === payload.refundAccountId);
        if (acc) {
            await putInStore('accounts', {
                ...acc,
                balance: acc.balance - refundTotal,
            });
        }
        // Update shift if cash refund
        if (activeShift) {
            await putInStore('shifts', {
                ...activeShift,
                totalCashReturns: activeShift.totalCashReturns + refundTotal,
                expectedCash: activeShift.expectedCash - refundTotal,
            });
        }
        await reloadData();
        showToast(`تم تسجيل المرتجع بنجاح [${returnNumber}]`, 'info');
        return returnInvoice;
    }, [invoices, products, currentUser, activeShift, accounts, stock, warehouses, reloadData, showToast]);
    // Create Purchase Invoice (local-first: durable local save first, cloud sync later)
    const createPurchaseInvoice = useCallback(async (payload) => {
        const now=new Date().toISOString(); const invoiceNumber=`PUR-${Date.now().toString().slice(-6)}`; const syncId=`pur-${Date.now()}`;
        const targetWarehouse = warehouses.find(w=>w.id===payload?.warehouseId) || warehouses.find(w=>w.id===settings.activeWarehouseId) || warehouses.find(w=>w.isDefault) || warehouses.find(w=>/صالة\s*العرض/.test(String(w.name||''))) || warehouses[0];
        if(!targetWarehouse) throw new Error('لا يوجد مخزن رئيسي. أضف صالة العرض من المخازن أولاً.');
        const warehouseId=targetWarehouse.id;
        const items=Array.isArray(payload?.items)?payload.items.filter(i=>i?.productId&&Number(i.quantity)>0):[];
        if(!items.length) throw new Error('أضف صنفاً واحداً على الأقل إلى فاتورة المشتريات.');
        const payments=Array.isArray(payload?.payments)?payload.payments.filter(p=>p&&p.accountId&&Number(p.amount)>0):[];
        const subtotal=items.reduce((x,i)=>x+(Number(i.total)||0),0);
        const discountTotal=Math.max(0,Math.min(subtotal,Number(payload.discountAmount)||0));
        const grandTotal=Math.max(0,subtotal-discountTotal); const paidAmount=Math.min(grandTotal,Math.max(0,Number(payload.paidAmount)||0)); const remaining=Math.max(0,grandTotal-paidAmount); const ratio=subtotal>0?grandTotal/subtotal:1;
        const purchaseInvoice={id:'pur-'+Date.now(),invoiceNumber,date:now,supplierId:payload.supplierId,supplierName:payload.supplierName,warehouseId,warehouseName:targetWarehouse.name||'صالة العرض',items:items.map((it,idx)=>({id:`pur-it-${Date.now()}-${idx}`,...it})),subtotal,discountType:payload.discountType||'fixed',discountValue:Number(payload.discountValue)||0,discountTotal,taxTotal:0,grandTotal,paidAmount,remainingAmount:remaining,paymentType:payload.paymentType,payments,notes:payload.notes||'',syncId,isSynced:false,createdAt:now};
        await putInStore('purchases',purchaseInvoice);
        const updatedProducts=products.map(p=>({...p,fifoBatches:Array.isArray(p.fifoBatches)?p.fifoBatches.map(b=>({...b})):[]})); const updatedStockList=[...stock],newMovements=[];
        for(const item of items){const pi=updatedProducts.findIndex(p=>p.id===item.productId);const si=updatedStockList.findIndex(x=>x.productId===item.productId&&x.warehouseId===warehouseId);const currentBaseStock=si>=0?Number(updatedStockList[si].baseQuantity)||0:0;const baseQty=Math.max(0,Number(item.baseQuantity)||0);const newBaseStock=currentBaseStock+baseQty;
          if(pi>=0){const currentCost=Number(updatedProducts[pi].costPrice)||0;const unitCost=((Number(item.unitPrice)||0)*ratio)/Math.max(0.00000001,(Number(item.conversionFactor)||1));let batches=updatedProducts[pi].fifoBatches||[];if(currentBaseStock>0&&!batches.some(b=>(b.warehouseId===warehouseId||!b.warehouseId)&&Number(b.remainingBaseQty)>0)){batches.push({id:`legacy-${item.productId}-${warehouseId}`,purchaseId:'legacy',warehouseId,receivedAt:'2000-01-01T00:00:00.000Z',expiryDate:updatedProducts[pi].expiryDate||'',unitCost:currentCost,remainingBaseQty:currentBaseStock});}batches.push({id:`batch-${purchaseInvoice.id}-${item.productId}-${Math.random().toString(36).slice(2,6)}`,purchaseId:purchaseInvoice.id,warehouseId,receivedAt:now,expiryDate:item.expiryDate||updatedProducts[pi].expiryDate||'',unitCost,remainingBaseQty:baseQty});const oldVal=Math.max(0,currentBaseStock)*currentCost,newVal=baseQty*unitCost,totalUnits=Math.max(0,currentBaseStock)+baseQty,newWAC=totalUnits>0?(oldVal+newVal)/totalUnits:unitCost;updatedProducts[pi]={...updatedProducts[pi],costPrice:parseFloat(newWAC.toFixed(4)),fifoBatches:batches,updatedAt:now};}
          if(si>=0)updatedStockList[si]={...updatedStockList[si],baseQuantity:newBaseStock};else updatedStockList.push({productId:item.productId,warehouseId,baseQuantity:newBaseStock});
          newMovements.push({id:'mov-'+Math.random().toString(36).substring(2,9),date:now,productId:item.productId,productName:item.productName,warehouseId,warehouseName:targetWarehouse.name||'صالة العرض',type:'purchase',unitName:item.unitName,quantityInUnit:item.quantity,conversionFactor:item.conversionFactor,baseQuantityChange:baseQty,newBaseBalance:newBaseStock,referenceId:purchaseInvoice.id,referenceType:'PURCHASE',userId:currentUser.id,userName:currentUser.name});}
        await bulkPut('products',updatedProducts);await bulkPut('stock',updatedStockList);await bulkPut('stock_movements',newMovements);
        const updatedAccounts=[...accounts];for(const pay of payments){const ai=updatedAccounts.findIndex(a=>a.id===pay.accountId);if(ai>=0)updatedAccounts[ai]={...updatedAccounts[ai],balance:(Number(updatedAccounts[ai].balance)||0)-(Number(pay.amount)||0)};}await bulkPut('accounts',updatedAccounts);
        let updatedSupplier=null,supplierStatement=null;
        if(remaining>0){const supp=suppliers.find(s=>s.id===payload.supplierId);if(supp){const nb=(Number(supp.balance)||0)+remaining;updatedSupplier={...supp,balance:nb};supplierStatement={id:'stmt-'+Date.now(),date:now,type:'purchase',partyType:'supplier',partyId:supp.id,referenceNumber:invoiceNumber,description:`فاتورة مشتريات رقم ${invoiceNumber}`,debit:0,credit:remaining,runningBalance:nb};await putInStore('suppliers',updatedSupplier);await putInStore('partner_statements',supplierStatement);}}
        setPurchases(prev => [purchaseInvoice, ...prev.filter(x=>x.id!==purchaseInvoice.id)]);
        setProducts(updatedProducts);setStock(updatedStockList);setStockMovements(prev=>[...newMovements,...prev]);setAccounts(updatedAccounts);
        if(updatedSupplier)setSuppliers(prev=>prev.map(x=>x.id===updatedSupplier.id?updatedSupplier:x));if(supplierStatement)setPartnerStatements(prev=>[supplierStatement,...prev]);
        setSyncQueue(window.OscarCloudSync?.pendingItems?.() || []);
        playSuccessSound(settings.scannerBeepEnabled);showToast(`تم تسجيل فاتورة الشراء بنجاح [${invoiceNumber}]`,'success');return purchaseInvoice;
    }, [warehouses,products,stock,accounts,suppliers,currentUser,showToast,settings.activeWarehouseId,settings.scannerBeepEnabled]);

    // Damaged/expired stock: deduct quantity and exact FIFO cost as a loss expense.
    const recordDamagedStock = useCallback(async (productId, warehouseId, baseQuantity, reason='تالف / منتهي الصلاحية') => {
        const prod=products.find(p=>p.id===productId); const qty=Math.max(0,Number(baseQuantity)||0); if(!prod||qty<=0)return false;
        const current=getProductStock(productId,warehouseId); if(current<=0){showToast('لا يوجد رصيد متاح لهذا الصنف','warning');return false;} const actual=Math.min(current,qty); const now=new Date().toISOString();
        const pcopy={...prod,fifoBatches:Array.isArray(prod.fifoBatches)?prod.fifoBatches.map(b=>({...b})):[]}; let left=actual,cost=0;const batches=pcopy.fifoBatches.filter(b=>(b.warehouseId===warehouseId||!b.warehouseId)&&Number(b.remainingBaseQty)>0).sort((a,b)=>new Date(a.receivedAt||0)-new Date(b.receivedAt||0));for(const b of batches){if(left<=0)break;const take=Math.min(left,Number(b.remainingBaseQty)||0);cost+=take*(Number(b.unitCost)||prod.costPrice||0);b.remainingBaseQty-=take;left-=take;}if(left>0)cost+=left*(Number(prod.costPrice)||0);
        const updatedStock=[...stock];const si=updatedStock.findIndex(x=>x.productId===productId&&x.warehouseId===warehouseId);const newBalance=current-actual;if(si>=0)updatedStock[si]={...updatedStock[si],baseQuantity:newBalance};else updatedStock.push({productId,warehouseId,baseQuantity:newBalance});
        await putInStore('products',{...pcopy,updatedAt:now});await bulkPut('stock',updatedStock);await putInStore('stock_movements',{id:'mov-damage-'+Date.now(),date:now,productId,productName:prod.name,warehouseId,warehouseName:warehouses.find(w=>w.id===warehouseId)?.name||'المخزن',type:'damage',unitName:prod.baseUnitName,quantityInUnit:actual,conversionFactor:1,baseQuantityChange:-actual,newBaseBalance,referenceType:'DAMAGE',userId:currentUser.id,userName:currentUser.name,notes:reason});await putInStore('expenses',{id:'exp-damage-'+Date.now(),date:now,category:'تالف ومخزون منتهي',amount:parseFloat(cost.toFixed(4)),accountId:null,accountName:'خسارة مخزون',notes:`${reason}: ${prod.name} × ${actual} ${prod.baseUnitName}`,userId:currentUser.id,userName:currentUser.name,createdAt:now,inventoryLoss:true,deletedAt:null});
        await reloadData();showToast(`تم خصم التالف من المخزون وتسجيل خسارة ${cost.toFixed(2)} ${settings.currencySymbol}`,'success');return true;
    },[products,stock,warehouses,currentUser,getProductStock,reloadData,showToast,settings.currencySymbol]);
    // Stock operations
    const adjustStock = useCallback(async (productId, warehouseId, newBaseQty, reason = 'تسوية جرد') => {
        const prod = products.find((p) => p.id === productId);
        if (!prod)
            return;
        const currentQty = getProductStock(productId, warehouseId);
        const diff = newBaseQty - currentQty;
        const now = new Date().toISOString();
        const updatedStockList = [...stock];
        const stockIdx = updatedStockList.findIndex((s) => s.productId === productId && s.warehouseId === warehouseId);
        if (stockIdx >= 0) {
            updatedStockList[stockIdx] = {
                ...updatedStockList[stockIdx],
                baseQuantity: newBaseQty,
            };
        }
        else {
            updatedStockList.push({
                productId,
                warehouseId,
                baseQuantity: newBaseQty,
            });
        }
        const movement = {
            id: 'mov-' + Date.now(),
            date: now,
            productId,
            productName: prod.name,
            warehouseId,
            warehouseName: warehouses.find((w) => w.id === warehouseId)?.name || 'المخزن',
            type: 'inventory_adjustment',
            unitName: prod.baseUnitName,
            quantityInUnit: Math.abs(diff),
            conversionFactor: 1,
            baseQuantityChange: diff,
            newBaseBalance: newBaseQty,
            referenceType: 'ADJUSTMENT',
            userId: currentUser.id,
            userName: currentUser.name,
            notes: reason,
        };
        await bulkPut('stock', updatedStockList);
        await putInStore('stock_movements', movement);
        await reloadData();
        showToast(`تم تعديل رصيد ${prod.name} إلى ${newBaseQty} ${prod.baseUnitName}`, 'info');
    }, [products, getProductStock, stock, warehouses, currentUser, reloadData, showToast]);
    const adjustStockCount = useCallback(async (warehouseId, adjustments, reason = 'تسوية جرد دوري') => {
        if (!warehouseId || adjustments.length === 0)
            return;
        const now = new Date().toISOString();
        const updatedStockList = [...stock];
        const movements = [];
        adjustments.forEach((entry, index) => {
            const prod = products.find((p) => p.id === entry.productId);
            if (!prod || !Number.isFinite(entry.actualQty))
                return;
            const stockIdx = updatedStockList.findIndex((item) => item.productId === entry.productId && item.warehouseId === warehouseId);
            const currentQty = stockIdx >= 0 ? updatedStockList[stockIdx].baseQuantity : 0;
            const nextQty = Math.max(0, entry.actualQty);
            const diff = nextQty - currentQty;
            if (stockIdx >= 0) {
                updatedStockList[stockIdx] = { ...updatedStockList[stockIdx], baseQuantity: nextQty };
            }
            else {
                updatedStockList.push({ productId: entry.productId, warehouseId, baseQuantity: nextQty });
            }
            movements.push({
                id: `mov-count-${Date.now()}-${index}`,
                date: now,
                productId: entry.productId,
                productName: prod.name,
                warehouseId,
                warehouseName: warehouses.find((w) => w.id === warehouseId)?.name || 'المخزن',
                type: 'inventory_adjustment',
                unitName: prod.baseUnitName,
                quantityInUnit: Math.abs(diff),
                conversionFactor: 1,
                baseQuantityChange: diff,
                newBaseBalance: nextQty,
                referenceType: 'STOCK_COUNT',
                userId: currentUser.id,
                userName: currentUser.name,
                notes: reason,
            });
        });
        await bulkPut('stock', updatedStockList);
        for (const movement of movements)
            await putInStore('stock_movements', movement);
        await reloadData();
        showToast(`تم اعتماد الجرد وتحديث ${movements.length} صنف بنجاح`, 'success');
    }, [stock, products, warehouses, currentUser, reloadData, showToast]);
    const transferStock = useCallback(async (productId, fromWarehouseId, toWarehouseId, unit, quantity, notes) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod)
            return;
        const baseQuantity = toBaseQuantity(quantity, unit);
        const fromQty = getProductStock(productId, fromWarehouseId);
        if (!settings.allowNegativeStock && fromQty < baseQuantity) {
            showToast('الكمية المراد تحويلها أكبر من المتوفر في المخزن المصدر!', 'error');
            return;
        }
        const now = new Date().toISOString();
        const updatedStockList = [...stock];
        // Deduct from source
        const fromIdx = updatedStockList.findIndex((s) => s.productId === productId && s.warehouseId === fromWarehouseId);
        const newFromQty = (fromIdx >= 0 ? updatedStockList[fromIdx].baseQuantity : 0) - baseQuantity;
        if (fromIdx >= 0) {
            updatedStockList[fromIdx] = { ...updatedStockList[fromIdx], baseQuantity: newFromQty };
        }
        else {
            updatedStockList.push({ productId, warehouseId: fromWarehouseId, baseQuantity: newFromQty });
        }
        // Add to destination
        const toIdx = updatedStockList.findIndex((s) => s.productId === productId && s.warehouseId === toWarehouseId);
        const newToQty = (toIdx >= 0 ? updatedStockList[toIdx].baseQuantity : 0) + baseQuantity;
        if (toIdx >= 0) {
            updatedStockList[toIdx] = { ...updatedStockList[toIdx], baseQuantity: newToQty };
        }
        else {
            updatedStockList.push({ productId, warehouseId: toWarehouseId, baseQuantity: newToQty });
        }
        const movOut = {
            id: 'mov-' + Date.now() + '-out',
            date: now,
            productId,
            productName: prod.name,
            warehouseId: fromWarehouseId,
            warehouseName: warehouses.find((w) => w.id === fromWarehouseId)?.name || '',
            type: 'transfer_out',
            unitName: unit.name,
            quantityInUnit: quantity,
            conversionFactor: unit.conversionToBase || 1,
            baseQuantityChange: -baseQuantity,
            newBaseBalance: newFromQty,
            userId: currentUser.id,
            userName: currentUser.name,
            notes: `تحويل إلى ${warehouses.find((w) => w.id === toWarehouseId)?.name || ''} ${notes ? `(${notes})` : ''}`,
        };
        const movIn = {
            id: 'mov-' + Date.now() + '-in',
            date: now,
            productId,
            productName: prod.name,
            warehouseId: toWarehouseId,
            warehouseName: warehouses.find((w) => w.id === toWarehouseId)?.name || '',
            type: 'transfer_in',
            unitName: unit.name,
            quantityInUnit: quantity,
            conversionFactor: unit.conversionToBase || 1,
            baseQuantityChange: baseQuantity,
            newBaseBalance: newToQty,
            userId: currentUser.id,
            userName: currentUser.name,
            notes: `تحويل من ${warehouses.find((w) => w.id === fromWarehouseId)?.name || ''} ${notes ? `(${notes})` : ''}`,
        };
        await bulkPut('stock', updatedStockList);
        await putInStore('stock_movements', movOut);
        await putInStore('stock_movements', movIn);
        await reloadData();
        showToast(`تم تحويل ${quantity} ${unit.name} من ${prod.name} بنجاح`, 'success');
    }, [products, getProductStock, settings.allowNegativeStock, stock, warehouses, currentUser, reloadData, showToast]);
    const transferStockBatch = useCallback(async (fromWarehouseId, toWarehouseId, items, notes = '') => {
        if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) {
            showToast('يجب اختيار مخزنين مختلفين للتحويل', 'error');
            return false;
        }
        const rows = (items || []).filter((row) => row?.productId && row?.unitId && Number(row?.quantity) > 0);
        if (!rows.length) {
            showToast('أضف صنفاً واحداً على الأقل للتحويل', 'warning');
            return false;
        }
        const now = new Date().toISOString();
        const updatedStockList = [...stock];
        const movements = [];
        const fromName = warehouses.find((w) => w.id === fromWarehouseId)?.name || '';
        const toName = warehouses.find((w) => w.id === toWarehouseId)?.name || '';
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            const prod = products.find((p) => p.id === row.productId);
            const unit = prod?.units?.find((u) => u.id === row.unitId) || prod?.units?.[0];
            if (!prod || !unit) {
                showToast('تعذر تحديد أحد الأصناف أو وحداته', 'error');
                return false;
            }
            const quantity = Number(row.quantity);
            const baseQuantity = toBaseQuantity(quantity, unit);
            const fromIdx = updatedStockList.findIndex((x) => x.productId === prod.id && x.warehouseId === fromWarehouseId);
            const currentFrom = Number(fromIdx >= 0 ? updatedStockList[fromIdx].baseQuantity : 0) || 0;
            if (!settings.allowNegativeStock && currentFrom < baseQuantity) {
                showToast(`الكمية المطلوبة من «${prod.name}» أكبر من المتوفر في المخزن المصدر`, 'error');
                return false;
            }
            const newFromQty = currentFrom - baseQuantity;
            if (fromIdx >= 0) updatedStockList[fromIdx] = { ...updatedStockList[fromIdx], baseQuantity: newFromQty };
            else updatedStockList.push({ productId: prod.id, warehouseId: fromWarehouseId, baseQuantity: newFromQty });
            const toIdx = updatedStockList.findIndex((x) => x.productId === prod.id && x.warehouseId === toWarehouseId);
            const currentTo = Number(toIdx >= 0 ? updatedStockList[toIdx].baseQuantity : 0) || 0;
            const newToQty = currentTo + baseQuantity;
            if (toIdx >= 0) updatedStockList[toIdx] = { ...updatedStockList[toIdx], baseQuantity: newToQty };
            else updatedStockList.push({ productId: prod.id, warehouseId: toWarehouseId, baseQuantity: newToQty });
            const stamp = `${Date.now()}-${index}`;
            movements.push({
                id: `mov-${stamp}-out`, date: now, productId: prod.id, productName: prod.name,
                warehouseId: fromWarehouseId, warehouseName: fromName, type: 'transfer_out',
                unitName: unit.name, quantityInUnit: quantity, conversionFactor: unit.conversionToBase || 1,
                baseQuantityChange: -baseQuantity, newBaseBalance: newFromQty, userId: currentUser.id, userName: currentUser.name,
                notes: `تحويل جماعي إلى ${toName}${notes ? ` (${notes})` : ''}`,
            });
            movements.push({
                id: `mov-${stamp}-in`, date: now, productId: prod.id, productName: prod.name,
                warehouseId: toWarehouseId, warehouseName: toName, type: 'transfer_in',
                unitName: unit.name, quantityInUnit: quantity, conversionFactor: unit.conversionToBase || 1,
                baseQuantityChange: baseQuantity, newBaseBalance: newToQty, userId: currentUser.id, userName: currentUser.name,
                notes: `تحويل جماعي من ${fromName}${notes ? ` (${notes})` : ''}`,
            });
        }
        await bulkPut('stock', updatedStockList);
        await bulkPut('stock_movements', movements);
        await reloadData();
        showToast(`تم تحويل ${rows.length} صنف بنجاح`, 'success');
        return true;
    }, [products, settings.allowNegativeStock, stock, warehouses, currentUser, reloadData, showToast]);
    // Master Data CRUD
    const saveProduct = useCallback(async (product) => {
        // Re-verify unit conversions and, for a brand-new product, post opening stock exactly once.
        const verifiedUnits = calculateUnitConversions(product.units, product.baseUnitId);
        const existedBefore = products.some((p) => p.id === product.id);
        const openingBaseQuantity = existedBefore ? 0 : Math.max(0, Number(product.openingBaseQuantity) || 0);
        const now = new Date().toISOString();
        const baseUnit = verifiedUnits.find((u) => u.id === product.baseUnitId) || verifiedUnits[0];
        const cleanProduct = {
            ...product,
            units: verifiedUnits.map((u) => ({ ...u, openingQuantity: Number(u.openingQuantity) || 0 })),
            openingBaseQuantity,
            updatedAt: now,
        };
        if (!existedBefore && openingBaseQuantity > 0) {
            const warehouseId = settings.activeWarehouseId || warehouses[0]?.id;
            const baseCost = Math.max(0, Number(baseUnit?.costPrice ?? product.costPrice) || 0);
            cleanProduct.fifoBatches = [
                ...(Array.isArray(cleanProduct.fifoBatches) ? cleanProduct.fifoBatches : []),
                { id: `opening-${product.id}-${Date.now()}`, purchaseId: 'opening-stock', warehouseId, receivedAt: now, expiryDate: product.expiryDate || '', unitCost: baseCost, remainingBaseQty: openingBaseQuantity },
            ];
            if (warehouseId) {
                await putInStore('stock', { productId: product.id, warehouseId, baseQuantity: openingBaseQuantity });
                // نحفظ الكمية الافتتاحية حسب كل وحدة بدلاً من دمجها كسطر واحد بالوحدة الأساسية.
                const openingRows = Array.isArray(product.openingUnitBreakdown) && product.openingUnitBreakdown.length
                    ? product.openingUnitBreakdown
                    : [{ unitId: baseUnit?.id, unitName: baseUnit?.name || product.baseUnitName || 'حبة', quantity: openingBaseQuantity, conversionToBase: 1, baseQuantity: openingBaseQuantity }];
                let runningBalance = 0;
                for (let index = 0; index < openingRows.length; index += 1) {
                    const row = openingRows[index];
                    const rowBase = Math.max(0, Number(row.baseQuantity) || (Number(row.quantity) || 0) * (Number(row.conversionToBase) || 1));
                    runningBalance += rowBase;
                    await putInStore('stock_movements', {
                        id: `mov-opening-${product.id}-${Date.now()}-${index}`,
                        date: now,
                        productId: product.id,
                        productName: product.name,
                        warehouseId,
                        warehouseName: warehouses.find((w) => w.id === warehouseId)?.name || 'صالة العرض',
                        type: 'opening',
                        unitName: row.unitName || baseUnit?.name || product.baseUnitName || 'حبة',
                        quantityInUnit: Number(row.quantity) || 0,
                        conversionFactor: Number(row.conversionToBase) || 1,
                        baseQuantityChange: rowBase,
                        newBaseBalance: runningBalance,
                        referenceType: 'OPENING',
                        userId: currentUser.id,
                        userName: currentUser.name,
                        notes: Number(row.conversionToBase) > 1
                            ? `كمية افتتاحية: ${row.quantity} ${row.unitName} = ${rowBase} ${baseUnit?.name || product.baseUnitName || 'حبة'}`
                            : `كمية افتتاحية: ${row.quantity} ${row.unitName || baseUnit?.name || 'حبة'}`,
                    });
                }
            }
        }
        await putInStore('products', cleanProduct);
        await reloadData();
        showToast(`تم حفظ الصنف: ${cleanProduct.name}`, 'success');
    }, [products, settings.activeWarehouseId, warehouses, currentUser, reloadData, showToast]);
    const softDeleteProduct = useCallback(async (productId) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod)
            return;
        const updated = {
            ...prod,
            deletedAt: new Date().toISOString(),
        };
        await putInStore('products', updated);
        await reloadData();
        showToast(`تم نقل الصنف «${prod.name}» إلى سلة المحذوفات`, 'info');
    }, [products, reloadData, showToast]);
    const restoreProduct = useCallback(async (productId) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod)
            return;
        const updated = {
            ...prod,
            deletedAt: null,
        };
        await putInStore('products', updated);
        await reloadData();
        showToast(`تم استرجاع الصنف «${prod.name}» بنجاح`, 'success');
    }, [products, reloadData, showToast]);
    const permanentDeleteProduct = useCallback(async (productId) => {
        await deleteFromStore('products', productId);
        await reloadData();
        showToast('تم حذف الصنف نهائياً', 'info');
    }, [reloadData, showToast]);
    const saveCategory = useCallback(async (category) => {
        await putInStore('categories', category);
        await reloadData();
        showToast('تم حفظ التصنيف', 'success');
    }, [reloadData, showToast]);
    const deleteCategory = useCallback(async (categoryId) => {
        await deleteFromStore('categories', categoryId);
        await reloadData();
        showToast('تم حذف التصنيف', 'info');
    }, [reloadData, showToast]);
    const saveCustomer = useCallback(async (customer) => {
        await putInStore('customers', customer);
        await reloadData();
        showToast(`تم حفظ العميل: ${customer.name}`, 'success');
    }, [reloadData, showToast]);
    const deleteCustomer = useCallback(async (customerId) => {
        const cust = customers.find((c) => c.id === customerId);
        if (cust) {
            await putInStore('customers', { ...cust, deletedAt: new Date().toISOString() });
            await reloadData();
            showToast('تم نقل العميل إلى سلة المحذوفات', 'info');
        }
    }, [customers, reloadData, showToast]);
    const softDeleteCustomer = deleteCustomer;
    const restoreCustomer = useCallback(async (customerId) => {
        const cust = customers.find((c) => c.id === customerId);
        if (!cust)
            return;
        await putInStore('customers', { ...cust, deletedAt: null });
        await reloadData();
        showToast(`تم استرجاع العميل «${cust.name}»`, 'success');
    }, [customers, reloadData, showToast]);
    const saveSupplier = useCallback(async (supplier) => {
        await putInStore('suppliers', supplier);
        await reloadData();
        showToast(`تم حفظ المورد: ${supplier.name}`, 'success');
    }, [reloadData, showToast]);
    const deleteSupplier = useCallback(async (supplierId) => {
        const supp = suppliers.find((s) => s.id === supplierId);
        if (supp) {
            await putInStore('suppliers', { ...supp, deletedAt: new Date().toISOString() });
            await reloadData();
            showToast('تم نقل المورد إلى سلة المحذوفات', 'info');
        }
    }, [suppliers, reloadData, showToast]);
    const softDeleteSupplier = deleteSupplier;
    const restoreSupplier = useCallback(async (supplierId) => {
        const supp = suppliers.find((s) => s.id === supplierId);
        if (!supp)
            return;
        await putInStore('suppliers', { ...supp, deletedAt: null });
        await reloadData();
        showToast(`تم استرجاع المورد «${supp.name}»`, 'success');
    }, [suppliers, reloadData, showToast]);
    const saveAccount = useCallback(async (account) => {
        // Always keep one starred/default account. The starred account is used automatically
        // in every account/cashbox dropdown across POS, vouchers, expenses and purchases.
        const mustBeDefault = Boolean(account.isDefault) || accounts.length === 0 || !accounts.some((a) => a.isDefault && a.id !== account.id);
        const nextAccount = { ...account, isDefault: mustBeDefault };
        if (nextAccount.isDefault) {
            for (const existing of accounts) {
                if (existing.id !== nextAccount.id && existing.isDefault) {
                    await putInStore('accounts', { ...existing, isDefault: false });
                }
            }
        }
        await putInStore('accounts', nextAccount);
        await reloadData();
        showToast(nextAccount.isDefault ? 'تم حفظ الحساب وتعيينه كحساب افتراضي ★' : 'تم حفظ الحساب المالي', 'success');
    }, [accounts, reloadData, showToast]);
    const deleteAccount = useCallback(async (accountId) => {
        const account = accounts.find((a) => a.id === accountId);
        if (!account)
            return;
        if (accounts.length <= 1) {
            showToast('يجب الإبقاء على حساب مالي واحد على الأقل', 'warning');
            return;
        }
        const remaining = accounts.filter((a) => a.id !== accountId);
        await deleteFromStore('accounts', accountId);
        if (account.isDefault && remaining.length > 0) {
            await putInStore('accounts', { ...remaining[0], isDefault: true });
        }
        await reloadData();
        showToast(`تم حذف الحساب «${account.name}»`, 'info');
    }, [accounts, reloadData, showToast]);
    const transferBetweenAccounts = useCallback(async (fromId, toId, amount, notes) => {
        const fromAcc = accounts.find((a) => a.id === fromId);
        const toAcc = accounts.find((a) => a.id === toId);
        if (!fromAcc || !toAcc)
            return;
        if (fromAcc.balance < amount) {
            showToast('الرصيد في الحساب المصدر غير كافٍ!', 'error');
            return;
        }
        await putInStore('accounts', { ...fromAcc, balance: fromAcc.balance - amount });
        await putInStore('accounts', { ...toAcc, balance: toAcc.balance + amount });
        const transferRecord = {
            id: 'trans-' + Date.now(),
            date: new Date().toISOString(),
            fromAccountId: fromId,
            fromAccountName: fromAcc.name,
            toAccountId: toId,
            toAccountName: toAcc.name,
            amount,
            notes,
            userId: currentUser.id,
            userName: currentUser.name,
        };
        await putInStore('transfers', transferRecord);
        await reloadData();
        showToast(`تم تحويل ${amount} ${settings.currencySymbol} بنجاح`, 'success');
    }, [accounts, currentUser, settings.currencySymbol, reloadData, showToast]);
    const saveExpense = useCallback(async (exp) => {
        const newExpense = {
            ...exp,
            id: 'exp-' + Date.now(),
            createdAt: new Date().toISOString(),
        };
        await putInStore('expenses', newExpense);
        const acc = accounts.find((a) => a.id === exp.accountId);
        if (acc)
            await putInStore('accounts', { ...acc, balance: acc.balance - exp.amount });
        if (activeShift && acc?.type === 'cash') {
            await putInStore('shifts', {
                ...activeShift,
                totalCashExpenses: activeShift.totalCashExpenses + exp.amount,
                expectedCash: activeShift.expectedCash - exp.amount,
            });
        }
        await reloadData();
        showToast('تم تسجيل المصروف بنجاح', 'success');
    }, [accounts, activeShift, reloadData, showToast]);
    const recordExpense = useCallback(async (payload) => {
        const acc = accounts.find((a) => a.id === payload.accountId);
        if (!acc) {
            showToast('يرجى اختيار حساب مالي صالح للمصروف', 'error');
            return;
        }
        await saveExpense({
            date: payload.date || new Date().toISOString(),
            category: payload.category,
            amount: payload.amount,
            accountId: acc.id,
            accountName: acc.name,
            notes: payload.notes,
            userId: currentUser.id,
            userName: currentUser.name,
            deletedAt: null,
        });
    }, [accounts, currentUser, saveExpense, showToast]);
    const updateExpense = useCallback(async (nextExpense) => {
        const previous = expenses.find((e) => e.id === nextExpense.id);
        if (!previous)
            return;
        const oldAcc = accounts.find((a) => a.id === previous.accountId);
        const newAcc = accounts.find((a) => a.id === nextExpense.accountId);
        if (!newAcc) {
            showToast('الحساب المالي الجديد غير موجود', 'error');
            return;
        }
        if (oldAcc && oldAcc.id === newAcc.id) {
            await putInStore('accounts', {
                ...oldAcc,
                balance: oldAcc.balance + previous.amount - nextExpense.amount,
            });
        }
        else {
            if (oldAcc)
                await putInStore('accounts', { ...oldAcc, balance: oldAcc.balance + previous.amount });
            await putInStore('accounts', { ...newAcc, balance: newAcc.balance - nextExpense.amount });
        }
        await putInStore('expenses', {
            ...nextExpense,
            accountName: newAcc.name,
            deletedAt: null,
        });
        await reloadData();
        showToast('تم تعديل المصروف وإعادة احتساب أثره المالي', 'success');
    }, [expenses, accounts, reloadData, showToast]);
    const deleteExpense = useCallback(async (id) => {
        const exp = expenses.find((e) => e.id === id);
        if (!exp || exp.deletedAt)
            return;
        const acc = accounts.find((a) => a.id === exp.accountId);
        if (acc)
            await putInStore('accounts', { ...acc, balance: acc.balance + exp.amount });
        if (activeShift && acc?.type === 'cash') {
            await putInStore('shifts', {
                ...activeShift,
                totalCashExpenses: Math.max(0, activeShift.totalCashExpenses - exp.amount),
                expectedCash: activeShift.expectedCash + exp.amount,
            });
        }
        await putInStore('expenses', { ...exp, deletedAt: new Date().toISOString() });
        await reloadData();
        showToast('تم نقل المصروف إلى سلة المحذوفات وإلغاء أثره المالي', 'info');
    }, [expenses, accounts, activeShift, reloadData, showToast]);
    const softDeleteExpense = deleteExpense;
    const restoreExpense = useCallback(async (id) => {
        const exp = expenses.find((e) => e.id === id);
        if (!exp || !exp.deletedAt)
            return;
        const acc = accounts.find((a) => a.id === exp.accountId);
        if (acc)
            await putInStore('accounts', { ...acc, balance: acc.balance - exp.amount });
        await putInStore('expenses', { ...exp, deletedAt: null });
        await reloadData();
        showToast('تم استرجاع المصروف وإعادة تطبيق أثره المالي', 'success');
    }, [expenses, accounts, reloadData, showToast]);
    const saveWarehouse = useCallback(async (warehouse) => {
        if (warehouse.isDefault) {
            for (const existing of warehouses) {
                if (existing.id !== warehouse.id && existing.isDefault) {
                    await putInStore('warehouses', { ...existing, isDefault: false });
                }
            }
        }
        await putInStore('warehouses', warehouse);
        await reloadData();
        showToast('تم حفظ المخزن/الفرع بنجاح', 'success');
    }, [warehouses, reloadData, showToast]);
    const deleteWarehouse = useCallback(async (warehouseId) => {
        const warehouse = warehouses.find((w) => w.id === warehouseId);
        if (!warehouse)
            return;
        if (warehouses.length <= 1) {
            showToast('يجب الإبقاء على مخزن واحد على الأقل', 'warning');
            return;
        }
        const hasStock = stock.some((item) => item.warehouseId === warehouseId && Math.abs(item.baseQuantity) > 0.00001);
        if (hasStock) {
            showToast('لا يمكن حذف مخزن يحتوي على رصيد. انقل أو صفّر المخزون أولاً.', 'warning');
            return;
        }
        await deleteFromStore('warehouses', warehouseId);
        const remaining = warehouses.filter((w) => w.id !== warehouseId);
        if (warehouse.isDefault && remaining.length > 0) {
            await putInStore('warehouses', { ...remaining[0], isDefault: true });
        }
        if (settings.activeWarehouseId === warehouseId && remaining.length > 0) {
            const nextSettings = { ...settings, activeWarehouseId: remaining[0].id };
            await putInStore('settings', { key: 'store_config', ...nextSettings });
        }
        await reloadData();
        showToast(`تم حذف المخزن «${warehouse.name}»`, 'info');
    }, [warehouses, stock, settings, reloadData, showToast]);
    const refreshData = reloadData;
    // Vouchers (سندات القبض والصرف)
    const createVoucher = useCallback(async (payload) => {
        if (!payload.amount || payload.amount <= 0) {
            showToast('يرجى إدخال مبلغ صحيح للسند', 'error');
            return null;
        }
        const now = payload.date ? new Date(payload.date).toISOString() : new Date().toISOString();
        const nextNumber = (vouchers[0]?.voucherNumber || 100) + 1;
        const voucherId = 'vouch-' + Date.now();
        const account = accounts.find((a) => a.id === payload.accountId);
        const voucher = {
            id: voucherId,
            voucherNumber: nextNumber,
            type: payload.type,
            partyType: payload.partyType,
            partyId: payload.partyId,
            partyName: payload.partyName,
            amount: payload.amount,
            date: now,
            sourceType: payload.sourceType,
            accountId: payload.accountId,
            accountName: account?.name,
            notes: payload.notes,
            userId: currentUser.id,
            userName: currentUser.name,
            createdAt: new Date().toISOString(),
        };
        await putInStore('vouchers', voucher);
        // 1. Account financial impact (if paid/received via account)
        if (payload.sourceType === 'account' && account) {
            const newBalance = payload.type === 'receipt'
                ? account.balance + payload.amount
                : account.balance - payload.amount;
            await putInStore('accounts', { ...account, balance: newBalance });
        }
        // 2. Customer or Supplier balance impact
        if (payload.partyType === 'customer' && payload.partyId) {
            const cust = customers.find((c) => c.id === payload.partyId);
            if (cust) {
                const newCustBalance = payload.type === 'receipt'
                    ? cust.balance - payload.amount
                    : cust.balance + payload.amount;
                await putInStore('customers', { ...cust, balance: newCustBalance });
                const stmt = {
                    id: 'stmt-' + Date.now(),
                    partnerType: 'customer',
                    partnerId: cust.id,
                    partnerName: cust.name,
                    date: now,
                    referenceType: payload.type === 'receipt' ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER',
                    referenceId: voucher.id,
                    referenceNumber: voucher.voucherNumber.toString(),
                    description: `${payload.type === 'receipt' ? 'سند قبض' : 'سند صرف'} رقم ${voucher.voucherNumber} ${payload.notes ? `(${payload.notes})` : ''}`,
                    debit: payload.type === 'payment' ? payload.amount : 0,
                    credit: payload.type === 'receipt' ? payload.amount : 0,
                    runningBalance: newCustBalance,
                };
                await putInStore('partner_statements', stmt);
            }
        }
        else if (payload.partyType === 'supplier' && payload.partyId) {
            const supp = suppliers.find((s) => s.id === payload.partyId);
            if (supp) {
                const newSuppBalance = payload.type === 'payment'
                    ? supp.balance - payload.amount
                    : supp.balance + payload.amount;
                await putInStore('suppliers', { ...supp, balance: newSuppBalance });
                const stmt = {
                    id: 'stmt-' + Date.now(),
                    partnerType: 'supplier',
                    partnerId: supp.id,
                    partnerName: supp.name,
                    date: now,
                    referenceType: payload.type === 'receipt' ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER',
                    referenceId: voucher.id,
                    referenceNumber: voucher.voucherNumber.toString(),
                    description: `${payload.type === 'receipt' ? 'سند قبض (استرداد)' : 'سند صرف توريد'} رقم ${voucher.voucherNumber} ${payload.notes ? `(${payload.notes})` : ''}`,
                    debit: payload.type === 'payment' ? payload.amount : 0,
                    credit: payload.type === 'receipt' ? payload.amount : 0,
                    runningBalance: newSuppBalance,
                };
                await putInStore('partner_statements', stmt);
            }
        }
        await reloadData();
        showToast(`تم حفظ ${payload.type === 'receipt' ? 'سند القبض' : 'سند الصرف'} رقم [${nextNumber}] بنجاح`, 'success');
        return voucher;
    }, [vouchers, accounts, customers, suppliers, currentUser, reloadData, showToast]);
    const deleteVoucher = useCallback(async (id) => {
        const v = vouchers.find((item) => item.id === id);
        if (!v)
            return;
        // Reverse account
        if (v.sourceType === 'account' && v.accountId) {
            const acc = accounts.find((a) => a.id === v.accountId);
            if (acc) {
                const revBalance = v.type === 'receipt' ? acc.balance - v.amount : acc.balance + v.amount;
                await putInStore('accounts', { ...acc, balance: revBalance });
            }
        }
        // Reverse customer or supplier
        if (v.partyType === 'customer' && v.partyId) {
            const cust = customers.find((c) => c.id === v.partyId);
            if (cust) {
                const revBalance = v.type === 'receipt' ? cust.balance + v.amount : cust.balance - v.amount;
                await putInStore('customers', { ...cust, balance: revBalance });
            }
        }
        else if (v.partyType === 'supplier' && v.partyId) {
            const supp = suppliers.find((s) => s.id === v.partyId);
            if (supp) {
                const revBalance = v.type === 'payment' ? supp.balance + v.amount : supp.balance - v.amount;
                await putInStore('suppliers', { ...supp, balance: revBalance });
            }
        }
        await deleteFromStore('vouchers', id);
        await reloadData();
        showToast('تم حذف السند وإلغاء أثره المالي بنجاح', 'info');
    }, [vouchers, accounts, customers, suppliers, reloadData, showToast]);
    const recordCustomerPayment = useCallback(async (payload) => {
        const customer = customers.find((c) => c.id === payload.customerId);
        if (!customer) {
            showToast('العميل غير موجود', 'error');
            return;
        }
        await createVoucher({
            type: 'receipt',
            partyType: 'customer',
            partyId: customer.id,
            partyName: customer.name,
            amount: payload.amount,
            sourceType: 'account',
            accountId: payload.accountId,
            notes: payload.notes,
        });
    }, [customers, createVoucher, showToast]);
    const recordSupplierPayment = useCallback(async (payload) => {
        const supplier = suppliers.find((s) => s.id === payload.supplierId);
        if (!supplier) {
            showToast('المورد غير موجود', 'error');
            return;
        }
        await createVoucher({
            type: 'payment',
            partyType: 'supplier',
            partyId: supplier.id,
            partyName: supplier.name,
            amount: payload.amount,
            sourceType: 'account',
            accountId: payload.accountId,
            notes: payload.notes,
        });
    }, [suppliers, createVoucher, showToast]);
    // Employees CRUD
    const saveEmployee = useCallback(async (employee) => {
        const nextEmployee = { ...employee, authVersion: employee.authVersion || `AUTH-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, updatedAt: new Date().toISOString() };
        await putInStore('employees', nextEmployee);
        await reloadData();
        showToast(`تم حفظ بيانات الموظف [${nextEmployee.name}] بنجاح`, 'success');
    }, [reloadData, showToast]);
    const deleteEmployee = useCallback(async (id) => {
        await deleteFromStore('employees', id);
        await reloadData();
        showToast('تم حذف الموظف بنجاح', 'info');
    }, [reloadData, showToast]);
    // Sales invoice deletion with full stock & financial reversal
    const deleteInvoice = useCallback(async (id) => {
        const inv = invoices.find((i) => i.id === id);
        if (!inv)
            return;
        // 1. Revert inventory for each item
        const updatedStockList = [...stock];
        for (const item of inv.items) {
            const baseQtyToAdd = item.quantity * item.conversionFactor;
            const stockIndex = updatedStockList.findIndex((s) => s.productId === item.productId && s.warehouseId === inv.warehouseId);
            if (stockIndex >= 0) {
                updatedStockList[stockIndex] = {
                    ...updatedStockList[stockIndex],
                    baseQuantity: updatedStockList[stockIndex].baseQuantity + baseQtyToAdd,
                };
            }
        }
        await bulkPut('stock', updatedStockList);
        // 2. Revert customer balance if debt/partial
        if (inv.customerId && inv.remainingAmount > 0) {
            const cust = customers.find((c) => c.id === inv.customerId);
            if (cust) {
                await putInStore('customers', {
                    ...cust,
                    balance: Math.max(0, cust.balance - inv.remainingAmount),
                });
            }
        }
        // 3. Revert account balances for cash/card payments
        if (inv.payments && inv.payments.length > 0) {
            for (const p of inv.payments) {
                const acc = accounts.find((a) => a.id === p.accountId);
                if (acc) {
                    await putInStore('accounts', {
                        ...acc,
                        balance: acc.balance - p.amount,
                    });
                }
            }
        }
        // 4. Remove invoice
        await deleteFromStore('invoices', id);
        await reloadData();
        showToast(`تم إلغاء وحذف الفاتورة [${inv.invoiceNumber}] واسترجاع المخزون`, 'info');
    }, [invoices, stock, customers, accounts, reloadData, showToast]);
    // Purchase invoice deletion with full stock & financial reversal
    const deletePurchase = useCallback(async (id) => {
        const pur = purchases.find((p) => p.id === id);
        if (!pur)
            return;
        // 1. Deduct back the added stock
        const updatedStockList = [...stock];
        for (const item of pur.items) {
            const baseQtyToDeduct = item.baseQuantity;
            const stockIndex = updatedStockList.findIndex((s) => s.productId === item.productId && s.warehouseId === pur.warehouseId);
            if (stockIndex >= 0) {
                updatedStockList[stockIndex] = {
                    ...updatedStockList[stockIndex],
                    baseQuantity: Math.max(0, updatedStockList[stockIndex].baseQuantity - baseQtyToDeduct),
                };
            }
        }
        await bulkPut('stock', updatedStockList);
        // 2. Revert supplier balance
        if (pur.supplierId && pur.remainingAmount > 0) {
            const supp = suppliers.find((s) => s.id === pur.supplierId);
            if (supp) {
                await putInStore('suppliers', {
                    ...supp,
                    balance: Math.max(0, supp.balance - pur.remainingAmount),
                });
            }
        }
        // 3. Revert accounts for paid payments
        if (pur.payments && pur.payments.length > 0) {
            for (const p of pur.payments) {
                const acc = accounts.find((a) => a.id === p.accountId);
                if (acc) {
                    await putInStore('accounts', {
                        ...acc,
                        balance: acc.balance + p.amount,
                    });
                }
            }
        }
        // 4. Remove purchase
        await deleteFromStore('purchases', id);
        await reloadData();
        showToast(`تم حذف فاتورة الشراء [${pur.invoiceNumber}] بنجاح`, 'info');
    }, [purchases, stock, suppliers, accounts, reloadData, showToast]);
    // Cashier Shifts
    const openShift = useCallback(async (openingCash) => {
        const newShift = {
            id: 'shift-' + Date.now(),
            shiftNumber: (shifts[0]?.shiftNumber || 0) + 1,
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            startTime: new Date().toISOString(),
            openingCash,
            totalCashSales: 0,
            totalOtherSales: 0,
            totalCashReturns: 0,
            totalCashExpenses: 0,
            expectedCash: openingCash,
            status: 'open',
        };
        await putInStore('shifts', newShift);
        await reloadData();
        showToast('تم فتح الوردية بنجاح', 'success');
    }, [shifts, currentUser, reloadData, showToast]);
    const closeShift = useCallback(async (actualCash, notes) => {
        if (!activeShift)
            return;
        const diff = actualCash - activeShift.expectedCash;
        const closedShift = {
            ...activeShift,
            endTime: new Date().toISOString(),
            actualCash,
            difference: diff,
            status: 'closed',
            notes,
        };
        await putInStore('shifts', closedShift);
        await reloadData();
        showToast(`تم إغلاق الوردية. الفرق: ${diff >= 0 ? `+${diff}` : diff} ${settings.currencySymbol}`, diff === 0 ? 'success' : 'warning');
    }, [activeShift, settings.currencySymbol, reloadData, showToast]);
    const saveSettings = useCallback(async (newSettings) => {
        await putInStore('settings', { key: 'store_config', ...newSettings });
        setSettings(newSettings);
        await reloadData();
        showToast('تم حفظ الإعدادات بنجاح', 'success');
    }, [reloadData, showToast]);
    const updateSettings = useCallback(async (patch) => {
        const nextSettings = { ...settings, ...patch };
        await putInStore('settings', { key: 'store_config', ...nextSettings });
        setSettings(nextSettings);
        await reloadData();
        showToast('تم تحديث الإعدادات بنجاح', 'success');
    }, [settings, reloadData, showToast]);
    // Professional tenant cloud sync
    const syncPendingQueue = useCallback(async () => {
        setIsSyncing(true);
        try {
            const result = await window.OscarCloudSync?.syncNow?.({ manual: true, force: true });
            if (result?.error) throw new Error(result.message || 'فشل الاتصال');
            setSyncQueue(window.OscarCloudSync?.pendingItems?.() || []);
            if (result?.changedStores?.length) await reloadStores(result.changedStores);
            showToast(result?.applied ? `تمت المزامنة وتحديث الشاشة (${result.applied} تغيير)` : 'اكتملت المزامنة — البيانات محدثة', 'success');
        } catch (err) {
            console.error('Sync failed:', err);
            showToast('تعذر الاتصال الآن. بياناتك محفوظة محلياً وستتم المحاولة تلقائياً.', 'warning');
        } finally { setIsSyncing(false); }
    }, [showToast, reloadStores]);
    const retrySyncItem = useCallback(async () => {
        await syncPendingQueue();
    }, [syncPendingQueue]);
    // Reset & Backup
    const handleResetData = useCallback(async (withDemo) => {
        await resetDatabase(withDemo);
        clearCart();
        await reloadData();
        showToast(withDemo ? 'تمت استعادة البيانات التجريبية' : 'تم تصفير البيانات بنجاح', 'info');
    }, [clearCart, reloadData, showToast]);
    const handleExportBackup = useCallback(async () => {
        return await exportDatabaseBackup();
    }, []);
    const handleImportBackup = useCallback(async (json) => {
        await importDatabaseBackup(json);
        clearCart();
        await reloadData();
        showToast('تمت استعادة النسخة الاحتياطية بنجاح', 'success');
    }, [clearCart, reloadData, showToast]);
    const value = {
        isLoaded,
        products,
        categories,
        warehouses,
        stock,
        stockMovements,
        invoices,
        purchases,
        customers,
        suppliers,
        accounts,
        transfers,
        expenses,
        shifts,
        activeShift,
        auditLogs,
        heldInvoices,
        syncQueue,
        settings,
        partnerStatements,
        vouchers,
        employees,
        activeEmployee,
        setActiveEmployee,
        activeTab,
        setActiveTab,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        posCartLayout,
        setPosCartLayout,
        isOnline,
        isSyncing,
        toasts,
        showToast,
        removeToast,
        showThermalModal,
        setShowThermalModal,
        showCameraModal,
        setShowCameraModal,
        showHoldInvoicesModal,
        setShowHoldInvoicesModal,
        showSyncModal,
        setShowSyncModal,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        currentUser,
        cart,
        invoiceDiscountType,
        setInvoiceDiscountType,
        invoiceDiscountValue,
        setInvoiceDiscountValue,
        selectedCustomer,
        setSelectedCustomer,
        addToCart,
        updateCartItemUnit,
        updateCartItemQuantity,
        updateCartItemPrice,
        updateCartItemScaleAmount,
        updateCartItemDiscount,
        removeFromCart,
        clearCart,
        holdCurrentInvoice,
        restoreHeldInvoice,
        deleteHeldInvoice,
        createSaleInvoice,
        createReturnInvoice,
        createPurchaseInvoice,
        recordDamagedStock,
        adjustStock,
        adjustStockCount,
        transferStock,
        transferStockBatch,
        getProductStock,
        saveProduct,
        softDeleteProduct,
        restoreProduct,
        permanentDeleteProduct,
        saveCategory,
        deleteCategory,
        saveCustomer,
        deleteCustomer,
        softDeleteCustomer,
        restoreCustomer,
        recordCustomerPayment,
        saveSupplier,
        deleteSupplier,
        softDeleteSupplier,
        restoreSupplier,
        recordSupplierPayment,
        saveAccount,
        deleteAccount,
        transferBetweenAccounts,
        saveExpense,
        recordExpense,
        updateExpense,
        deleteExpense,
        softDeleteExpense,
        restoreExpense,
        saveWarehouse,
        deleteWarehouse,
        refreshData,
        createVoucher,
        deleteVoucher,
        saveEmployee,
        deleteEmployee,
        deleteInvoice,
        deletePurchase,
        openShift,
        closeShift,
        saveSettings,
        updateSettings,
        syncPendingQueue,
        retrySyncItem,
        handleScannedBarcode,
        handleResetData,
        handleExportBackup,
        handleImportBackup,
    };
    return _jsx(AppContext.Provider, { value: value, children: children });
};
export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
