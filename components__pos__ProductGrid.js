import React from 'react';
import { useApp } from './context__AppContext.js?v=7.9.4.36-customer-portal-stable-2';
import { Package, Layers } from 'lucide-react';

const h = React.createElement;

const normalizedSalesChannel = (p) => String((p && p.salesChannel) || 'both').toLowerCase();
const isRawMaterialOnly = (p) => {
  const c = normalizedSalesChannel(p);
  return c === 'raw_material' || c === 'raw' || c === 'ingredient' || !!(p && p.isRawMaterialOnly);
};
const isCashierVisibleProduct = (p) => {
  const c = normalizedSalesChannel(p);
  return !isRawMaterialOnly(p) && c !== 'restaurant' && c !== 'restaurant_only';
};
const unitStockLines = (baseStock, units=[]) => {
  const total = Math.max(0, Number(baseStock) || 0);
  if (!units.length) return [];
  const baseUnit = units.find(u => (Number(u.conversionToBase)||1) === 1) || units[0];
  const sorted = [...units].sort((a,b)=>(Number(b.conversionToBase)||1)-(Number(a.conversionToBase)||1));
  let remaining = total;
  const parts = [];
  for (const u of sorted) {
    const factor = Math.max(1, Number(u.conversionToBase)||1);
    if (factor > 1) {
      const count = Math.floor((remaining + 1e-9) / factor);
      if (count > 0) {
        const baseEquivalent = count * factor;
        parts.push({ id:u.id, name:u.name, value:count, factor, baseEquivalent, baseUnitName:baseUnit?.name || 'حبة' });
        remaining = Math.max(0, remaining - baseEquivalent);
      }
    } else if (remaining > 0 || parts.length === 0) {
      const value = Number.isInteger(remaining) ? remaining : Math.round(remaining*100)/100;
      parts.push({ id:u.id, name:u.name, value, factor:1, baseEquivalent:value, baseUnitName:u.name });
      remaining = 0;
    }
  }
  return parts.length ? parts : [{ id:baseUnit?.id || 'base', name:baseUnit?.name || 'حبة', value:0, factor:1, baseEquivalent:0, baseUnitName:baseUnit?.name || 'حبة' }];
};

export const ProductGrid = () => {
  const { products, categories, selectedCategory, setSelectedCategory, searchQuery, addToCart, getProductStock, settings } = useApp();
  const filteredProducts = products.filter(p => {
    if (p.status === 'archived' || p.deletedAt) return false;
    if (!isCashierVisibleProduct(p)) return false;
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name?.toLowerCase().includes(q) || p.shortName?.toLowerCase().includes(q);
      const matchSku = p.sku?.toLowerCase().includes(q) || p.internalCode?.toLowerCase?.().includes(q);
      const matchBrand = p.brand?.toLowerCase().includes(q);
      const matchBarcode = (p.units||[]).some(u => (u.barcodes||[]).some(b => String(b).toLowerCase().includes(q)));
      return matchName || matchSku || matchBrand || matchBarcode;
    }
    return true;
  });
  return h('div', { className:'flex flex-col h-full overflow-hidden text-right select-none' },
    h('div', { className:'p-2 border-b border-slate-200 bg-white overflow-x-auto flex items-center gap-1.5 custom-scrollbar shrink-0' },
      h('button', { onClick:()=>setSelectedCategory(null), className:`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${selectedCategory===null?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}` }, `كافة الأصناف (${products.filter(p=>!p.deletedAt&&p.status!=='archived'&&isCashierVisibleProduct(p)).length})`),
      ...categories.map(cat => {
        const active=selectedCategory===cat.id;
        const count=products.filter(p=>p.categoryId===cat.id&&!p.deletedAt&&p.status!=='archived'&&isCashierVisibleProduct(p)).length;
        return h('button',{key:cat.id,onClick:()=>setSelectedCategory(active?null:cat.id),className:`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${active?'bg-emerald-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`},
          h('span',{className:'w-2 h-2 rounded-full shrink-0',style:{backgroundColor:cat.color||'#10b981'}}), h('span',null,cat.name), h('span',{className:`text-[10px] ${active?'text-emerald-100':'text-slate-400'}`},`(${count})`));
      })
    ),
    h('div', { className:'flex-1 overflow-y-auto p-3 custom-scrollbar' },
      filteredProducts.length===0 ? h('div',{className:'h-full flex flex-col items-center justify-center p-8 text-center text-slate-400'}, h(Package,{className:'w-12 h-12 stroke-1 text-slate-300 mb-2'}), h('p',{className:'text-sm font-bold text-slate-600'},'لا توجد أصناف مطابقة'), h('p',{className:'text-xs mt-0.5'},'جرّب تغيير البحث أو التصنيف.')) :
      h('div',{className:'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5'}, ...filteredProducts.map(product=>{
        const baseStock=getProductStock(product.id,settings.activeWarehouseId);
        const defaultUnit=(product.units||[]).find(u=>u.isDefaultSale)||(product.units||[])[0];
        const low=product.reorderPoint!==undefined&&baseStock<=product.reorderPoint;
        const out=baseStock<=0;
        const lines=unitStockLines(baseStock,product.units||[]);
        return h('div',{key:product.id,id:`product-card-${product.id}`,onClick:()=>defaultUnit&&addToCart(product,defaultUnit,1),className:'group relative flex flex-col justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-500/70 hover:shadow-md transition-all cursor-pointer active:scale-[.995]'},
          h('div',null,
            h('div',{className:'flex items-start justify-between gap-2 mb-1.5'},
              h('span',{className:'text-[10px] text-slate-400 truncate pt-0.5'},product.brand||product.sku||product.internalCode||'صنف'),
              h('div',{className:`rounded-lg px-2 py-1 min-w-[72px] text-[9px] font-bold leading-4 ${out?'bg-rose-50 text-rose-700':low?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`},
                ...lines.map(x=>h('div',{key:x.id,className:'flex items-center justify-between gap-1 whitespace-nowrap'},
                  h('span',{className:'font-mono font-black'},x.value),
                  h('span',{className:'font-semibold'},x.name)))
              )
            ),
            h('h4',{className:'text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-emerald-600 leading-snug mb-2'},product.name)
          ),
          h('div',{className:'pt-2 border-t border-slate-100'},
            h('div',{className:'text-[10px] text-slate-400 mb-1 flex items-center gap-1'},h(Layers,{className:'w-2.5 h-2.5'}),h('span',null,'اختر وحدة للبيع:')),
            h('div',{className:'flex flex-wrap gap-1'},...(product.units||[]).map(unit=>h('button',{key:unit.id,type:'button',onClick:e=>{e.stopPropagation();addToCart(product,unit,1);},className:`flex items-center justify-between gap-1 px-1.5 py-1 rounded-md text-[10px] font-semibold active:scale-95 ${unit.isDefaultSale?'bg-emerald-50 text-emerald-800 border border-emerald-300/70':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`,title:`إضافة ${unit.name} بسعر ${unit.salePrice} ${settings.currencySymbol}`},h('span',null,unit.name),h('span',{className:'font-mono font-bold'},unit.salePrice))))
          )
        );
      }))
    )
  );
};
