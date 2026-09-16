import { calculateUnitConversions } from './utils__unitTree.js';
const DB_BASE_NAME = 'Oscar_Accounting_POS_DB';
const DB_VERSION = 5;
export const getTenantId = () => String(window.OscarActivation?.readRuntime?.()?.companyId || 'local').trim() || 'local';
const dbNameForTenant = () => `${DB_BASE_NAME}__${encodeURIComponent(getTenantId())}`;
let cachedTenant = '';
// Realtime sync broadcast channel for cross-tab communication
export const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('oscar_pos_sync')
    : null;
let cachedDB = null;
let dbOpenPromise = null;
let storageStatusPromise = null;
export async function enablePersistentLocalStorage() {
    if (storageStatusPromise) return storageStatusPromise;
    storageStatusPromise = (async () => {
        try {
            const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
            if (!storage) return { supported: false, persisted: false };
            let persisted = false;
            try { persisted = !!(await storage.persisted?.()); } catch {}
            if (!persisted) { try { persisted = !!(await storage.persist?.()); } catch {} }
            let estimate = {};
            try { estimate = await storage.estimate?.() || {}; } catch {}
            const detail = { supported: true, persisted, usage: Number(estimate.usage || 0), quota: Number(estimate.quota || 0), at: Date.now() };
            try { localStorage.setItem('oscar_storage_status_v1', JSON.stringify(detail)); } catch {}
            try { window.dispatchEvent(new CustomEvent('oscar:storage-status', { detail })); } catch {}
            return detail;
        } catch (error) {
            return { supported: false, persisted: false, error: String(error?.message || error) };
        }
    })();
    return storageStatusPromise;
}
function openDB() {
    const wantedTenant = getTenantId();
    if (cachedDB && cachedTenant === wantedTenant) {
        return Promise.resolve(cachedDB);
    }
    if (cachedDB && cachedTenant !== wantedTenant) { try { cachedDB.close(); } catch {} cachedDB = null; dbOpenPromise = null; }
    if (dbOpenPromise) {
        return dbOpenPromise;
    }
    dbOpenPromise = new Promise((resolve, reject) => {
        try {
            if (typeof window === 'undefined' || !window.indexedDB) {
                throw new Error('IndexedDB is not supported');
            }
            const request = indexedDB.open(dbNameForTenant(), DB_VERSION);
            request.onblocked = () => {
                console.warn('IndexedDB version upgrade blocked by another connection');
            };
            request.onerror = () => {
                dbOpenPromise = null;
                reject(request.error || new Error('Failed to open database'));
            };
            request.onsuccess = () => {
                cachedDB = request.result;
                cachedTenant = wantedTenant;
                cachedDB.onclose = () => {
                    cachedDB = null;
                    cachedTenant = '';
                    dbOpenPromise = null;
                };
                cachedDB.onversionchange = () => {
                    cachedDB?.close();
                    cachedDB = null;
                    cachedTenant = '';
                    dbOpenPromise = null;
                };
                resolve(cachedDB);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = [
                    'products',
                    'categories',
                    'warehouses',
                    'stock',
                    'stock_movements',
                    'invoices',
                    'purchases',
                    'customers',
                    'suppliers',
                    'partner_statements',
                    'accounts',
                    'transfers',
                    'expenses',
                    'shifts',
                    'audit_logs',
                    'held_invoices',
                    'sync_queue',
                    'settings',
                    'vouchers',
                    'employees',
                ];
                stores.forEach((storeName) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        if (storeName === 'stock') {
                            db.createObjectStore(storeName, { keyPath: ['productId', 'warehouseId'] });
                        }
                        else if (storeName === 'settings') {
                            db.createObjectStore(storeName, { keyPath: 'key' });
                        }
                        else {
                            db.createObjectStore(storeName, { keyPath: 'id' });
                        }
                    }
                });
            };
        }
        catch (e) {
            dbOpenPromise = null;
            reject(e);
        }
    });
    return dbOpenPromise;
}
// Cloud sync capture is intentionally kept outside IndexedDB transactions.
function captureCloud(storeName, value, opts={}) {
    try { if (!window.OscarCloudSync?.suppress) return window.OscarCloudSync?.captureStoreChange?.(storeName, value, opts) || Promise.resolve(false); } catch (e) { console.warn('Cloud capture warning', e); }
    return Promise.resolve(false);
}
// Generic CRUD operations
function recordKey(storeName, value) {
    if (storeName === 'stock') return [value?.productId, value?.warehouseId];
    if (storeName === 'settings') return value?.key;
    return value?.id;
}
function stableRecord(value) {
    if (value === undefined) return '__undefined__';
    try {
        if (!value || typeof value !== 'object') return JSON.stringify(value);
        const sort = (v) => Array.isArray(v) ? v.map(sort) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=sort(v[k]),o),{}) : v);
        return JSON.stringify(sort(value));
    } catch { return String(value); }
}
function sameRecord(a, b) { return stableRecord(a) === stableRecord(b); }
export async function getAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function getFromStore(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function putInStore(storeName, value, notifySync = true) {
    const db = await openDB();
    let changed = true;
    if (notifySync) {
        try {
            const before = await getFromStore(storeName, recordKey(storeName, value));
            changed = !sameRecord(before, value);
        } catch { changed = true; }
    }
    if (!changed) return;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = async () => {
            if (notifySync) {
                await captureCloud(storeName, value).catch(() => {});
                if (syncChannel) syncChannel.postMessage({ type: 'STORE_UPDATED', storeName, tenantId: getTenantId() });
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}
export async function deleteFromStore(storeName, key, notifySync = true) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = async () => {
            if (notifySync) {
                await captureCloud(storeName, null, { deleted: true, key }).catch(() => {});
                if (syncChannel) syncChannel.postMessage({ type: 'STORE_UPDATED', storeName, tenantId: getTenantId() });
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}
export async function clearStore(storeName, notifySync = true) {
    const existing = notifySync ? await getAllFromStore(storeName).catch(() => []) : [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = async () => {
            if (notifySync) await Promise.allSettled(existing.map(v => captureCloud(storeName, null, { deleted:true, key: storeName === 'stock' ? [v.productId, v.warehouseId] : (storeName === 'settings' ? v.key : v.id) })));
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}
// Bulk put items
export async function bulkPut(storeName, items, notifySync = true) {
    const db = await openDB();
    let changedItems = Array.isArray(items) ? items : [];
    if (notifySync && changedItems.length) {
        try {
            const beforeRows = await getAllFromStore(storeName);
            const beforeMap = new Map(beforeRows.map(row => [JSON.stringify(recordKey(storeName, row)), row]));
            changedItems = changedItems.filter(item => !sameRecord(beforeMap.get(JSON.stringify(recordKey(storeName, item))), item));
        } catch { changedItems = Array.isArray(items) ? items : []; }
    }
    if (!changedItems.length) return;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        changedItems.forEach((item) => store.put(item));
        tx.oncomplete = async () => {
            if (notifySync) {
                await Promise.allSettled(changedItems.map(item => captureCloud(storeName, item)));
                if (syncChannel) syncChannel.postMessage({ type: 'STORE_UPDATED', storeName, tenantId: getTenantId() });
            }
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}
// Initial default settings
export const DEFAULT_SETTINGS = {
    storeName: 'أوسكار المحاسبي',
    subtitle: 'إدارة ذكية',
    phone: '0599-123456',
    address: 'فلسطين - الشارع العام',
    taxNumber: '300987654',
    currency: 'ILS',
    currencySymbol: '₪',
    taxRate: 0,
    theme: 'light',
    printerWidth: '80mm',
    autoPrintReceipt: true,
    printOnSave: true,
    scaleModeEnabled: false,
    receiptShowLogo: true,
    receiptShowStoreInfo: true,
    receiptShowBarcode: true,
    scannerBeepEnabled: true,
    allowNegativeStock: false,
    warnSellingBelowCost: true,
    receiptFooterMessage: 'شكراً لاستخدام أوسكار المحاسبي - نسعد بخدمتكم دائماً',
    barcodePrefix: '21',
    activeWarehouseId: 'wh-main',
    activeBranchName: 'الفرع الرئيسي',
};
// Initial Warehouses
export const DEFAULT_WAREHOUSES = [
    { id: 'wh-main', name: 'صالة العرض', code: 'SHOWROOM', isDefault: true },
    { id: 'wh-shop', name: 'المخزن الإضافي', code: 'WH-2', isDefault: false },
];
// Initial Categories
export const DEFAULT_CATEGORIES = [
    { id: 'cat-drinks', name: 'مشروبات وعصائر', color: '#0284c7', displayOrder: 1 },
    { id: 'cat-dairy', name: 'ألبان وأجبان', color: '#16a34a', displayOrder: 2 },
    { id: 'cat-food', name: 'مواد غذائية وتموين', color: '#d97706', displayOrder: 3 },
    { id: 'cat-sweets', name: 'حلويات وشوكولاتة', color: '#db2777', displayOrder: 4 },
    { id: 'cat-cleaners', name: 'منظفات وعناية', color: '#7c3aed', displayOrder: 5 },
    { id: 'cat-frozen', name: 'مجمدات ولحوم', color: '#2563eb', displayOrder: 6 },
    { id: 'cat-bakery', name: 'مخبوزات وطحين', color: '#b45309', displayOrder: 7 },
];
// Initial Financial Accounts
export const DEFAULT_ACCOUNTS = [
    { id: 'acc-cash', name: 'الصندوق الرئيسي (الكاش)', type: 'cash', balance: 1500, isDefault: true },
    { id: 'acc-bank', name: 'حساب البنك (فلسطين/العربي)', type: 'bank', balance: 12000, accountNumber: 'PS-1234-5678', isDefault: false },
    { id: 'acc-wallet', name: 'المحفظة الإلكترونية (Jawwal Pay / PalPay)', type: 'wallet', balance: 850, isDefault: false },
    { id: 'acc-card', name: 'جهاز نقاط البيع (فيزا / ماستركارد)', type: 'card', balance: 2400, isDefault: false },
];
// Initial Demo Products demonstrating the Multi-level Unit Tree
export function getDemoProducts() {
    // 1. Mineral water with full 4-level tree: مشطاح -> كرتونة -> باكيت -> حبة
    const waterUnits = calculateUnitConversions([
        {
            id: 'u-water-piece',
            name: 'حبة',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['625100100101'],
            salePrice: 1.5,
            wholesalePrice: 1.2,
            costPrice: 0.9,
            isDefaultSale: true,
        },
        {
            id: 'u-water-pack',
            name: 'باكيت (6 حبات)',
            childUnitId: 'u-water-piece',
            multiplier: 6,
            conversionToBase: 6,
            barcodes: ['625100100106'],
            salePrice: 8.0,
            wholesalePrice: 7.0,
            costPrice: 5.4,
        },
        {
            id: 'u-water-carton',
            name: 'كرتونة (12 باكيت)',
            childUnitId: 'u-water-pack',
            multiplier: 12,
            conversionToBase: 72,
            barcodes: ['625100100112'],
            salePrice: 90.0,
            wholesalePrice: 80.0,
            costPrice: 64.8,
        },
        {
            id: 'u-water-pallet',
            name: 'مشطاح (50 كرتونة)',
            childUnitId: 'u-water-carton',
            multiplier: 50,
            conversionToBase: 3600,
            barcodes: ['625100100150'],
            salePrice: 4200.0,
            wholesalePrice: 3900.0,
            costPrice: 3240.0,
        },
    ], 'u-water-piece');
    // 2. Coca Cola 330ml Can: كرتونة -> درزن -> حبة
    const colaUnits = calculateUnitConversions([
        {
            id: 'u-cola-piece',
            name: 'حبة',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['5449000000996'],
            salePrice: 2.5,
            wholesalePrice: 2.1,
            costPrice: 1.75,
            isDefaultSale: true,
        },
        {
            id: 'u-cola-dozen',
            name: 'درزن (12 حبة)',
            childUnitId: 'u-cola-piece',
            multiplier: 12,
            conversionToBase: 12,
            barcodes: ['5449000000128'],
            salePrice: 28.0,
            wholesalePrice: 24.0,
            costPrice: 21.0,
        },
        {
            id: 'u-cola-carton',
            name: 'كرتونة (24 حبة)',
            childUnitId: 'u-cola-dozen',
            multiplier: 2,
            conversionToBase: 24,
            barcodes: ['5449000000241'],
            salePrice: 54.0,
            wholesalePrice: 48.0,
            costPrice: 42.0,
        },
    ], 'u-cola-piece');
    // 3. Rice (Sugar / Grains): شوال كبير -> كيس 5 كجم -> كيس 1 كجم
    const riceUnits = calculateUnitConversions([
        {
            id: 'u-rice-1kg',
            name: 'كيس 1 كجم',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['625200300101'],
            salePrice: 7.0,
            wholesalePrice: 6.0,
            costPrice: 5.0,
            isDefaultSale: true,
        },
        {
            id: 'u-rice-5kg',
            name: 'كيس 5 كجم',
            childUnitId: 'u-rice-1kg',
            multiplier: 5,
            conversionToBase: 5,
            barcodes: ['625200300105'],
            salePrice: 32.0,
            wholesalePrice: 28.0,
            costPrice: 24.0,
        },
        {
            id: 'u-rice-sack',
            name: 'شوال (25 كجم)',
            childUnitId: 'u-rice-5kg',
            multiplier: 5,
            conversionToBase: 25,
            barcodes: ['625200300125'],
            salePrice: 150.0,
            wholesalePrice: 135.0,
            costPrice: 115.0,
        },
    ], 'u-rice-1kg');
    // 4. Fresh Milk 1L: كرتونة -> حبة
    const milkUnits = calculateUnitConversions([
        {
            id: 'u-milk-piece',
            name: 'حبة',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['625300400101'],
            salePrice: 6.0,
            wholesalePrice: 5.4,
            costPrice: 4.8,
            isDefaultSale: true,
        },
        {
            id: 'u-milk-carton',
            name: 'كرتونة (12 حبة)',
            childUnitId: 'u-milk-piece',
            multiplier: 12,
            conversionToBase: 12,
            barcodes: ['625300400112'],
            salePrice: 68.0,
            wholesalePrice: 62.0,
            costPrice: 57.6,
        },
    ], 'u-milk-piece');
    // 5. Chocolate Biscuit: كرتونة -> باكيت -> حبة
    const biscuitUnits = calculateUnitConversions([
        {
            id: 'u-bisc-piece',
            name: 'حبة',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['625400500101'],
            salePrice: 1.0,
            wholesalePrice: 0.8,
            costPrice: 0.65,
            isDefaultSale: true,
        },
        {
            id: 'u-bisc-pack',
            name: 'باكيت (12 حبة)',
            childUnitId: 'u-bisc-piece',
            multiplier: 12,
            conversionToBase: 12,
            barcodes: ['625400500112'],
            salePrice: 10.0,
            wholesalePrice: 8.5,
            costPrice: 7.5,
        },
        {
            id: 'u-bisc-carton',
            name: 'كرتونة (6 باكيت)',
            childUnitId: 'u-bisc-pack',
            multiplier: 6,
            conversionToBase: 72,
            barcodes: ['625400500172'],
            salePrice: 55.0,
            wholesalePrice: 48.0,
            costPrice: 43.0,
        },
    ], 'u-bisc-piece');
    // 6. Ariel Washing Powder: كرتونة -> كيس
    const arielUnits = calculateUnitConversions([
        {
            id: 'u-ariel-bag',
            name: 'كيس 2.5 كجم',
            childUnitId: null,
            multiplier: 1,
            conversionToBase: 1,
            barcodes: ['625500600101'],
            salePrice: 28.0,
            wholesalePrice: 25.0,
            costPrice: 22.0,
            isDefaultSale: true,
        },
        {
            id: 'u-ariel-carton',
            name: 'كرتونة (4 أكياس)',
            childUnitId: 'u-ariel-bag',
            multiplier: 4,
            conversionToBase: 4,
            barcodes: ['625500600104'],
            salePrice: 105.0,
            wholesalePrice: 95.0,
            costPrice: 86.0,
        },
    ], 'u-ariel-bag');
    return [
        {
            id: 'prod-water',
            name: 'مياه معدنية أروى 500 مل',
            shortName: 'مياه أروى',
            sku: 'WAT-500',
            internalCode: '1001',
            categoryId: 'cat-drinks',
            brand: 'أروى Arwa',
            costPrice: 0.9,
            sellingPrice: 1.5,
            reorderPoint: 200,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-water-piece',
            baseUnitName: 'حبة',
            units: waterUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'prod-cola',
            name: 'كوكاكولا علب 330 مل',
            shortName: 'كولا علب',
            sku: 'COLA-330',
            internalCode: '1002',
            categoryId: 'cat-drinks',
            brand: 'Coca-Cola',
            costPrice: 1.75,
            sellingPrice: 2.5,
            reorderPoint: 100,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-cola-piece',
            baseUnitName: 'حبة',
            units: colaUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'prod-rice',
            name: 'أرز صنوايت كالروز ممتاز',
            shortName: 'أرز صنوايت',
            sku: 'RICE-SUN',
            internalCode: '1003',
            categoryId: 'cat-food',
            brand: 'Sunwhite',
            costPrice: 5.0,
            sellingPrice: 7.0,
            reorderPoint: 50,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-rice-1kg',
            baseUnitName: 'كيس 1 كجم',
            units: riceUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'prod-milk',
            name: 'حليب الجنيدي طازج 1 لتر',
            shortName: 'حليب الجنيدي',
            sku: 'MILK-JND',
            internalCode: '1004',
            categoryId: 'cat-dairy',
            brand: 'الجنيدي',
            costPrice: 4.8,
            sellingPrice: 6.0,
            reorderPoint: 36,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-milk-piece',
            baseUnitName: 'حبة',
            units: milkUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'prod-bisc',
            name: 'بسكويت أوريو شوكولاتة الأصلي',
            shortName: 'أوريو',
            sku: 'OREO-CHOC',
            internalCode: '1005',
            categoryId: 'cat-sweets',
            brand: 'Oreo',
            costPrice: 0.65,
            sellingPrice: 1.0,
            reorderPoint: 120,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-bisc-piece',
            baseUnitName: 'حبة',
            units: biscuitUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'prod-ariel',
            name: 'مسحوق غسيل أوتوماتيك أريال 2.5 كجم',
            shortName: 'أريال 2.5 كجم',
            sku: 'ARL-25',
            internalCode: '1006',
            categoryId: 'cat-cleaners',
            brand: 'Ariel',
            costPrice: 22.0,
            sellingPrice: 28.0,
            reorderPoint: 20,
            taxRate: 0,
            status: 'active',
            baseUnitId: 'u-ariel-bag',
            baseUnitName: 'كيس 2.5 كجم',
            units: arielUnits,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ];
}
// Initial stock per warehouse
export function getDemoStock() {
    return [
        { productId: 'prod-water', warehouseId: 'wh-main', baseQuantity: 3780 }, // 1 مشطاح + 2 كرتونة + 6 باكيت
        { productId: 'prod-water', warehouseId: 'wh-shop', baseQuantity: 144 }, // 2 كرتونة
        { productId: 'prod-cola', warehouseId: 'wh-main', baseQuantity: 480 }, // 20 كرتونة
        { productId: 'prod-cola', warehouseId: 'wh-shop', baseQuantity: 72 }, // 3 كرتونة
        { productId: 'prod-rice', warehouseId: 'wh-main', baseQuantity: 250 }, // 10 شوالات
        { productId: 'prod-rice', warehouseId: 'wh-shop', baseQuantity: 25 }, // 5 أكياس 5 كجم
        { productId: 'prod-milk', warehouseId: 'wh-main', baseQuantity: 120 }, // 10 كراتين
        { productId: 'prod-milk', warehouseId: 'wh-shop', baseQuantity: 24 }, // 2 كرتونة
        { productId: 'prod-bisc', warehouseId: 'wh-main', baseQuantity: 720 }, // 10 كراتين
        { productId: 'prod-bisc', warehouseId: 'wh-shop', baseQuantity: 144 }, // 2 كرتونة
        { productId: 'prod-ariel', warehouseId: 'wh-main', baseQuantity: 60 }, // 15 كرتونة
        { productId: 'prod-ariel', warehouseId: 'wh-shop', baseQuantity: 12 }, // 3 كراتين
    ];
}
// Virtual cash customer used only inside the POS. It is never stored in the customers table.
export const CASH_CUSTOMER = Object.freeze({
    id: 'cust-walkin',
    name: 'عميل نقدي',
    phone: '',
    address: '',
    balance: 0,
    priceList: 'retail',
    isVirtual: true,
});
// Initial Demo Customers (registered customers only)
export const DEFAULT_CUSTOMERS = [
    {
        id: 'cust-1',
        name: 'أحمد محمود القواسمي',
        phone: '0599-223344',
        whatsapp: '0599223344',
        address: 'الشارع الرئيسي - عمارة الأمل',
        balance: 450.0, // له دين سابق
        creditLimit: 1500,
        priceList: 'retail',
        notes: 'زبون دائم يسدد نهاية كل شهر',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'cust-2',
        name: 'كافتيريا السلام (جملة)',
        phone: '0568-778899',
        address: 'شارع الجامعة',
        balance: 1200.0,
        creditLimit: 3000,
        priceList: 'wholesale',
        notes: 'يشتري بالكرتونة أسبوعياً',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'cust-3',
        name: 'مها إبراهيم عودة',
        phone: '0598-112233',
        address: 'حي الزيتون',
        balance: 0,
        creditLimit: 500,
        priceList: 'retail',
        createdAt: new Date().toISOString(),
    },
];
// Initial Demo Suppliers
export const DEFAULT_SUPPLIERS = [
    {
        id: 'supp-1',
        name: 'شركة المشروبات الوطنية (كوكاكولا وكابي)',
        phone: '02-2987654',
        address: 'بيتونيا - المنطقة الصناعية',
        companyName: 'المشروبات الوطنية كوكاكولا',
        balance: 3450.0, // نحن مدينون لهم
        notes: 'توريد كل ثلاثاء وخميس',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'supp-2',
        name: 'شركة الجنيدي للألبان والصناعات الغذائية',
        phone: '02-2228899',
        address: 'الخليل - عين سارة',
        companyName: 'الجنيدي',
        balance: 1800.0,
        notes: 'توريد يومي للألبان الطازجة',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'supp-3',
        name: 'شركة الأمل للتجارة العامة والتوزيع',
        phone: '0599-880011',
        address: 'رام الله',
        companyName: 'الأمل للمواد الغذائية',
        balance: 0,
        notes: 'وكيل أرز صنوايت وزيوت',
        createdAt: new Date().toISOString(),
    },
];
// Initial Shift
export const DEFAULT_SHIFT = {
    id: 'shift-1',
    shiftNumber: 1,
    cashierId: 'usr-cashier-1',
    cashierName: 'أبو أحمد (الكاشير الأول)',
    startTime: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    openingCash: 500.0,
    totalCashSales: 1250.0,
    totalOtherSales: 450.0,
    totalCashReturns: 0,
    totalCashExpenses: 50.0,
    expectedCash: 1700.0,
    status: 'open',
};
// Initial Employees
export const DEFAULT_EMPLOYEES = [
    {
        id: 'emp-admin',
        name: 'أحمد القواسمي (المدير العام)',
        phone: '0599-112233',
        role: 'admin',
        roleName: 'مدير عام',
        pin: '1234',
        active: true,
        permissions: {
            canDiscount: true,
            canEditPrice: true,
            canDeleteInvoice: true,
            canDeleteProducts: true,
            canManagePurchases: true,
            canManageVouchers: true,
            canManageInventory: true,
            canViewReports: true,
            canAccessSettings: true,
        },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'emp-cashier-1',
        name: 'محمود ناصر (كاشير أول)',
        phone: '0599-445566',
        role: 'cashier',
        roleName: 'كاشير',
        pin: '1111',
        active: true,
        permissions: {
            canDiscount: true,
            canEditPrice: false,
            canDeleteInvoice: false,
            canDeleteProducts: false,
            canManagePurchases: false,
            canManageVouchers: true,
            canManageInventory: false,
            canViewReports: false,
            canAccessSettings: false,
        },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'emp-accountant',
        name: 'سارة رضوان (محاسبة مالية)',
        phone: '0599-778899',
        role: 'accountant',
        roleName: 'محاسب',
        pin: '2222',
        active: true,
        permissions: {
            canDiscount: false,
            canEditPrice: false,
            canDeleteInvoice: true,
            canDeleteProducts: false,
            canManagePurchases: true,
            canManageVouchers: true,
            canManageInventory: true,
            canViewReports: true,
            canAccessSettings: false,
        },
        createdAt: new Date().toISOString(),
    },
];
// Initial Vouchers
export const DEFAULT_VOUCHERS = [
    {
        id: 'vouch-1',
        voucherNumber: 101,
        type: 'receipt',
        partyType: 'customer',
        partyId: 'cust-1',
        partyName: 'أحمد محمود القواسمي',
        amount: 150.0,
        date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        sourceType: 'account',
        accountId: 'acc-cash',
        accountName: 'الصندوق النقدي الرئيسي (الكاشير)',
        notes: 'دفعة نقدية تحت الحساب',
        userId: 'emp-admin',
        userName: 'أحمد القواسمي',
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
        id: 'vouch-2',
        voucherNumber: 102,
        type: 'payment',
        partyType: 'supplier',
        partyId: 'supp-1',
        partyName: 'شركة المشروبات الوطنية كوكاكولا كابي',
        amount: 500.0,
        date: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        sourceType: 'account',
        accountId: 'acc-cash',
        accountName: 'الصندوق النقدي الرئيسي (الكاشير)',
        notes: 'سداد دفعة نقدية من حساب توريد سابق',
        userId: 'emp-admin',
        userName: 'أحمد القواسمي',
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    },
];
export async function ensurePrimaryShowroomWarehouse() {
    try {
        const rows = await getAllFromStore('warehouses');
        if (!Array.isArray(rows) || !rows.length) return false;
        const main = rows.find(w => w?.id === 'wh-main') || rows.find(w => w?.isDefault) || rows.find(w => /صالة\s*العرض/.test(String(w?.name || '')));
        if (!main) return false;
        const oldDefaultNames = new Set(['المخزن الرئيسي','المستودع الرئيسي','واجهة المحل (الرفوف)']);
        const next = rows.map(w => ({
            ...w,
            isDefault: w.id === main.id,
            ...(w.id === main.id && (w.id === 'wh-main' || oldDefaultNames.has(String(w.name || ''))) ? { name: 'صالة العرض', code: 'SHOWROOM' } : {})
        }));
        await bulkPut('warehouses', next, false);
        const settings = await getFromStore('settings', 'store_config');
        if (settings && settings.activeWarehouseId !== main.id) await putInStore('settings', { ...settings, activeWarehouseId: main.id }, false);
        return true;
    } catch { return false; }
}

// Seed initial database if empty
export async function seedDatabaseDefaults() {
    const settings = await getFromStore('settings', 'store_config');
    if (!settings) {
        const companyName = String(window.OscarActivation?.readRuntime?.()?.companyName || '').trim();
        await putInStore('settings', { key: 'store_config', ...DEFAULT_SETTINGS, ...(companyName ? { storeName: companyName } : {}) });
        await bulkPut('warehouses', DEFAULT_WAREHOUSES);
        await bulkPut('categories', DEFAULT_CATEGORIES);
        await bulkPut('accounts', DEFAULT_ACCOUNTS);
        await bulkPut('customers', DEFAULT_CUSTOMERS);
        await bulkPut('suppliers', DEFAULT_SUPPLIERS);
        await bulkPut('products', getDemoProducts());
        await bulkPut('stock', getDemoStock());
        await bulkPut('employees', DEFAULT_EMPLOYEES);
        await bulkPut('vouchers', DEFAULT_VOUCHERS);
        await putInStore('shifts', DEFAULT_SHIFT);
        // Initial audit log
        await putInStore('audit_logs', {
            id: 'log-init',
            timestamp: new Date().toISOString(),
            userId: 'usr-admin',
            userName: 'مدير النظام',
            action: 'تهيئة النظام',
            targetType: 'SYSTEM',
            targetId: 'initial_setup',
            details: 'تم بدء تشغيل أوسكار المحاسبي بنجاح مع البيانات التأسيسية وشجرة الوحدات.',
        });
    }
}

// One-time upgrade path: move the data from the old single-company database
// into the first tenant database only when that tenant is still empty.
export async function migrateLegacyDatabaseIfNeeded() {
    const tenantId = getTenantId();
    if (!tenantId || tenantId === 'local') return false;
    const marker = `oscar_legacy_migrated_v1::${encodeURIComponent(tenantId)}`;
    const claimKey = 'oscar_legacy_claimed_v1';
    try {
        if (localStorage.getItem(marker) === '1') return false;
        const claimedBy = localStorage.getItem(claimKey);
        if (claimedBy && claimedBy !== tenantId) { localStorage.setItem(marker, '1'); return false; }
    } catch {}
    try {
        const currentSettings = await getFromStore('settings', 'store_config');
        if (currentSettings) { try { localStorage.setItem(marker, '1'); } catch {} return false; }
        const legacyCandidates = ['Oscar_Accounting_POS_DB', 'AlMezan_POS_DB'];
        let legacyDbName = legacyCandidates[0];
        if (indexedDB.databases) {
            const list = await indexedDB.databases();
            const names = new Set((list || []).map(x => x?.name).filter(Boolean));
            legacyDbName = legacyCandidates.find(name => names.has(name)) || '';
            if (!legacyDbName) { try { localStorage.setItem(marker, '1'); } catch {} return false; }
        }
        const legacy = await new Promise((resolve, reject) => {
            const req = indexedDB.open(legacyDbName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('تعذر فتح قاعدة البيانات القديمة'));
            req.onupgradeneeded = () => {};
        });
        const stores = ['products','categories','warehouses','stock','stock_movements','invoices','purchases','customers','suppliers','partner_statements','accounts','transfers','expenses','shifts','audit_logs','held_invoices','settings','vouchers','employees'];
        let copied = 0;
        try {
            for (const storeName of stores) {
                if (!legacy.objectStoreNames.contains(storeName)) continue;
                const rows = await new Promise((resolve, reject) => {
                    const tx = legacy.transaction(storeName, 'readonly');
                    const req = tx.objectStore(storeName).getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                if (rows.length) {
                    await bulkPut(storeName, rows, true);
                    copied += rows.length;
                }
            }
        } finally { try { legacy.close(); } catch {} }
        if (copied) await ensurePrimaryShowroomWarehouse().catch(() => {});
        try { localStorage.setItem(marker, '1'); if (copied) localStorage.setItem(claimKey, tenantId); } catch {}
        if (copied) {
            try { window.dispatchEvent(new CustomEvent('oscar:legacy-migrated', { detail: { copied, tenantId } })); } catch {}
            window.OscarCloudSync?.requestSync?.(50);
        }
        return copied > 0;
    } catch (e) {
        console.warn('Legacy database migration skipped:', e);
        return false;
    }
}

export async function initializeDatabase(options = {}) {
    await openDB();
    enablePersistentLocalStorage().catch(() => {});
    if (!options.deferSeed) await seedDatabaseDefaults();
    await ensurePrimaryShowroomWarehouse().catch(() => {});
    return true;
}
// Reset Database to clean state
export async function resetDatabase(withDemo = false) {
    const stores = [
        'products',
        'categories',
        'warehouses',
        'stock',
        'stock_movements',
        'invoices',
        'purchases',
        'customers',
        'suppliers',
        'partner_statements',
        'accounts',
        'transfers',
        'expenses',
        'shifts',
        'audit_logs',
        'held_invoices',
        'sync_queue',
        'settings',
        'vouchers',
        'employees',
    ];
    for (const store of stores) {
        await clearStore(store);
    }
    await putInStore('settings', { key: 'store_config', ...DEFAULT_SETTINGS });
    await bulkPut('warehouses', DEFAULT_WAREHOUSES);
    await bulkPut('categories', DEFAULT_CATEGORIES);
    await bulkPut('accounts', DEFAULT_ACCOUNTS);
    // No virtual cash customer is stored in the customers table.
    await bulkPut('employees', DEFAULT_EMPLOYEES);
    if (withDemo) {
        await bulkPut('customers', DEFAULT_CUSTOMERS);
        await bulkPut('suppliers', DEFAULT_SUPPLIERS);
        await bulkPut('products', getDemoProducts());
        await bulkPut('stock', getDemoStock());
        await bulkPut('vouchers', DEFAULT_VOUCHERS);
        await putInStore('shifts', DEFAULT_SHIFT);
    }
    if (syncChannel) {
        syncChannel.postMessage({ type: 'DATABASE_RESET' });
    }
}
// Export database to JSON
export async function exportDatabaseBackup() {
    const data = {};
    const stores = [
        'products',
        'categories',
        'warehouses',
        'stock',
        'stock_movements',
        'invoices',
        'purchases',
        'customers',
        'suppliers',
        'partner_statements',
        'accounts',
        'transfers',
        'expenses',
        'shifts',
        'audit_logs',
        'settings',
        'vouchers',
        'employees',
    ];
    for (const store of stores) {
        data[store] = await getAllFromStore(store);
    }
    return JSON.stringify(data, null, 2);
}
// Import database from JSON
export async function importDatabaseBackup(jsonString) {
    const data = JSON.parse(jsonString);
    for (const store in data) {
        if (Array.isArray(data[store])) {
            await clearStore(store);
            await bulkPut(store, data[store]);
        }
    }
    if (syncChannel) {
        syncChannel.postMessage({ type: 'DATABASE_RESET' });
    }
}
export const db = {
    exportCompleteBackup: async () => {
        const jsonStr = await exportDatabaseBackup();
        return JSON.parse(jsonStr);
    },
    importBackup: async (data) => {
        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
        await importDatabaseBackup(jsonStr);
    },
    resetToSeedData: async () => {
        await resetDatabase();
    },
};
