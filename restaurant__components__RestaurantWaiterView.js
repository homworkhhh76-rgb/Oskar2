import React, { useMemo, useState, useEffect } from 'react';
import { useRestaurant } from './restaurant__context__RestaurantContext.js?v=7.9.4.11-notifications-popup';
import { useApp } from './restaurant__context__AppContext.js?v=7.9.4.11-notifications-popup';
import { Utensils, Search, Plus, Minus, Trash2, Send, Printer, Users, ShoppingBag, ShoppingCart, AlertTriangle, Lock, X, StickyNote } from 'lucide-react';
import { KitchenTicketModal } from './restaurant__components__KitchenTicketModal.js?v=7.9.4.11-notifications-popup';

const h = React.createElement;
const orderNoteText = (notes) => typeof notes === 'string' ? notes : String(notes?.kitchenNotes || notes?.general || '');

export const RestaurantWaiterView = () => {
  const { tables, orders, recipes, createOrder, updateOrder, sendOrderToKitchen, updateOrderItemStatus } = useRestaurant();
  const { products, categories, activeEmployee, showToast, settings } = useApp();
  const [orderType, setOrderType] = useState('dine_in');
  const [selectedTableId, setSelectedTableId] = useState(tables.find(t => t.status === 'available')?.id || tables[0]?.id || '');
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [activeExistingOrder, setActiveExistingOrder] = useState(null);
  const [orderNote, setOrderNote] = useState('');
  const [showTicketModal, setShowTicketModal] = useState(null);
  const [isAdditionTicket, setIsAdditionTicket] = useState(false);
  const [ignoreHydrateTableId, setIgnoreHydrateTableId] = useState('');
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('طلب العميل التراجع');
  const [managerPin, setManagerPin] = useState('');
  const selectedTable = tables.find(t => t.id === selectedTableId);

  useEffect(() => {
    if (!selectedTableId && (tables || []).length) {
      setSelectedTableId(tables.find(t => t.status === 'available')?.id || tables[0].id);
    }
  }, [tables, selectedTableId]);

  useEffect(() => {
    if (orderType === 'dine_in' && selectedTable?.currentOrderId) {
      const existing = orders.find(o => o.id === selectedTable.currentOrderId);
      if (existing && !['paid','cancelled'].includes(existing.status)) {
        setActiveExistingOrder(existing);
        setCustomerName(existing.customerName || '');
        setGuestCount(existing.guestCount || 2);
        if (ignoreHydrateTableId !== selectedTableId) {
          setDraftItems(existing.items || []);
          setOrderNote(orderNoteText(existing.notes));
        }
        return;
      }
    }
    setActiveExistingOrder(null);
    setDraftItems([]);
    setOrderNote('');
  }, [selectedTableId, orderType, selectedTable?.currentOrderId, orders, ignoreHydrateTableId]);

  const recipeProductIds = useMemo(() => new Set((recipes || []).map(r => r.productId || r.mealProductId).filter(Boolean)), [recipes]);
  const restaurantProducts = useMemo(() => (products || []).filter(p => {
    if (!p || p.deletedAt || p.status === 'archived') return false;
    const channel = String(p.salesChannel || 'both').toLowerCase();
    const rawOnly = ['raw_material','raw','ingredient'].includes(channel) || !!p.isRawMaterialOnly;
    if (rawOnly) return false;
    return ['restaurant','restaurant_only','both'].includes(channel) || p.showInRestaurant === true || p.restaurantEnabled === true || p.availableInRestaurant === true || recipeProductIds.has(p.id);
  }), [products, recipeProductIds]);
  const restaurantCategories = useMemo(() => (categories || []).filter(cat => restaurantProducts.some(p => p.categoryId === cat.id)), [categories, restaurantProducts]);
  const filteredProducts = useMemo(() => restaurantProducts.filter(p => {
    if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q) || (p.units || []).some(u => (u.barcodes || []).some(b => String(b).toLowerCase().includes(q)));
  }), [restaurantProducts, selectedCategoryId, searchTerm]);

  const handleQuickAdd = (product) => {
    const defaultUnit = (product.units || []).find(u => u.isDefaultSale) || (product.units || [])[0];
    const unitPrice = Number(defaultUnit?.salePrice ?? product.sellingPrice ?? product.salePrice ?? 0) || 0;
    setDraftItems(prev => {
      const idx = prev.findIndex(i => i.status === 'new' && i.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: Number(copy[idx].quantity || 0) + 1 };
        return copy;
      }
      return [...prev, {
        id: 'roi-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice,
        status: 'new'
      }];
    });
  };

  const updateItemQty = (index, delta) => {
    setDraftItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      if (item.status !== 'new' && delta < 0) { setCancelModalItem(item); return prev; }
      const next = Number(item.quantity || 0) + delta;
      if (next <= 0) return prev.filter((_,i) => i !== index);
      const copy = [...prev]; copy[index] = { ...item, quantity: next }; return copy;
    });
  };
  const handleRemoveItem = (item, index) => item.status !== 'new' ? setCancelModalItem(item) : setDraftItems(prev => prev.filter((_,i) => i !== index));
  const subtotal = draftItems.reduce((sum,item) => item.status === 'cancelled' ? sum : sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);

  const forceRestaurantSync = () => {
    try { window.dispatchEvent(new CustomEvent('oscar:restaurant-order-change')); } catch {}
    try { window.OscarCloudSync?.requestSync?.(0); } catch {}
    try { window.OscarCloudSync?.syncNow?.({ force:true }).catch(() => {}); } catch {}
  };

  const handleSendToKitchen = async () => {
    const activeItems = draftItems.filter(i => i.status !== 'cancelled');
    const noteChangedForExisting = !!activeExistingOrder && orderNoteText(activeExistingOrder.notes) !== orderNote.trim();
    if (!activeItems.length && !noteChangedForExisting) return showToast('الطلب فارغ! اختر الأصناف أولاً', 'error');
    if (orderType === 'dine_in' && !selectedTable) return showToast('يرجى تحديد الطاولة', 'error');
    const notes = orderNote.trim() ? { kitchenNotes: orderNote.trim() } : undefined;
    try {
      let ticketOrder = null;
      if (activeExistingOrder) {
        const hasNewItems = draftItems.some(i => i.status === 'new');
        const noteChanged = orderNoteText(activeExistingOrder.notes) !== orderNote.trim();
        if (!hasNewItems && !noteChanged) return showToast('لا توجد أصناف أو ملاحظات جديدة لإرسالها', 'info');
        const draftContainsSentLines = draftItems.some(i => i.status !== 'new' && i.status !== 'cancelled');
        const itemsForUpdate = draftContainsSentLines
          ? draftItems
          : [...(activeExistingOrder.items || []), ...draftItems];
        const updated = await updateOrder(activeExistingOrder.id, {
          items: itemsForUpdate,
          customerName: customerName || activeExistingOrder.customerName,
          guestCount: guestCount || activeExistingOrder.guestCount,
          notes
        });
        if (hasNewItems) {
          ticketOrder = await sendOrderToKitchen(activeExistingOrder.id, { isAddition:true });
          setIsAdditionTicket(true);
        } else {
          ticketOrder = updated;
          setIsAdditionTicket(false);
          showToast('تم تحديث ملاحظات الطلب في المطبخ', 'success');
        }
        setActiveExistingOrder(ticketOrder || updated || activeExistingOrder);
      } else {
        const created = await createOrder({
          orderType,
          tableId: orderType === 'dine_in' ? selectedTable?.id : undefined,
          tableNumber: orderType === 'dine_in' ? selectedTable?.tableNumber : undefined,
          tableName: orderType === 'dine_in' ? selectedTable?.name : undefined,
          sectionName: orderType === 'dine_in' ? selectedTable?.sectionName : undefined,
          waiterId: activeEmployee?.id || 'emp-waiter',
          waiterName: activeEmployee?.name || 'الجرسون',
          customerName,
          guestCount: orderType === 'dine_in' ? guestCount : undefined,
          items: draftItems,
          notes
        });
        ticketOrder = await sendOrderToKitchen(created.id);
        setIsAdditionTicket(false);
        setActiveExistingOrder(orderType === 'dine_in' ? (ticketOrder || created) : null);
      }
      // بعد الإرسال: فرّغ سلة الجرسون فوراً، أغلق نافذة الطلب وافتح نافذة الطباعة.
      setDraftItems([]);
      setOrderNote('');
      setIsCartOpen(false);
      if (orderType === 'dine_in' && selectedTableId) setIgnoreHydrateTableId(selectedTableId);
      else { setIgnoreHydrateTableId(''); setCustomerName(''); }
      if (ticketOrder) setShowTicketModal(ticketOrder);
      forceRestaurantSync();
    } catch (err) {
      console.error(err); showToast('حدث خطأ أثناء إرسال الطلب', 'error');
    }
  };


  const handleConfirmCancelItem = async () => {
    if (!cancelModalItem || !activeExistingOrder) return;
    if (managerPin !== '1234' && !activeEmployee?.permissions?.canDeleteInvoice) return showToast('رمز المشرف غير صحيح أو لا تملك صلاحية الإلغاء', 'error');
    await updateOrderItemStatus(activeExistingOrder.id, cancelModalItem.id, 'cancelled', cancelReason);
    setDraftItems(prev => prev.map(i => i.id === cancelModalItem.id ? { ...i, status:'cancelled', cancelledReason:cancelReason } : i));
    setCancelModalItem(null); setManagerPin(''); forceRestaurantSync();
  };

  const money = n => Number(n || 0).toLocaleString('ar-EG');
  return h('div',{dir:'rtl',className:'flex flex-col h-full w-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none text-right'},
    h('div',{className:'flex-1 flex flex-col min-w-0 h-full overflow-hidden p-3 sm:p-4 gap-3'},
      h('div',{className:'bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-hidden'},
        h('div',{className:'flex shrink-0 items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl'},
          h('button',{onClick:()=>{setIgnoreHydrateTableId('');setOrderType('dine_in')},className:`h-9 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap ${orderType==='dine_in'?'bg-amber-600 text-white':'text-slate-600 dark:text-slate-300'}`},h(Utensils,{className:'inline w-3.5 h-3.5 ml-0.5'}),'طاولة'),
          h('button',{onClick:()=>{setIgnoreHydrateTableId('');setOrderType('takeaway')},className:`h-9 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap ${orderType==='takeaway'?'bg-amber-600 text-white':'text-slate-600 dark:text-slate-300'}`},h(ShoppingBag,{className:'inline w-3.5 h-3.5 ml-0.5'}),'سفري')
        ),
        orderType==='dine_in' ? h('select',{value:selectedTableId,onChange:e=>{setIgnoreHydrateTableId('');setSelectedTableId(e.target.value)},className:'h-10 min-w-0 flex-1 max-w-[155px] sm:max-w-none px-1.5 sm:px-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-[11px] sm:text-xs font-bold truncate'},tables.map((t,idx)=>{const label=t.tableNumber ?? t.name ?? (idx+1); const section=t.sectionName?` - ${t.sectionName}`:''; return h('option',{key:t.id,value:t.id},`طاولة ${label}${section} (${t.status==='available'?'متاحة':'مشغولة'})`)})) : h('input',{value:customerName,onChange:e=>setCustomerName(e.target.value),placeholder:'اسم العميل',className:'h-10 min-w-0 flex-1 px-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-[11px] sm:text-xs'}),
        orderType==='dine_in' && h('div',{className:'h-10 shrink-0 flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 px-1.5 sm:px-2 rounded-xl border',title:'عدد الأفراد'},h(Users,{className:'w-3.5 h-3.5 shrink-0'}),h('input',{type:'number',min:1,max:25,value:guestCount,onChange:e=>setGuestCount(parseInt(e.target.value)||1),className:'w-7 sm:w-9 bg-transparent text-center text-[11px] sm:text-xs font-black outline-none'}))
      ),
      h('div',{className:'flex flex-col sm:flex-row gap-2'},
        h('div',{className:'flex gap-1.5 overflow-x-auto flex-1'},
          h('button',{onClick:()=>setSelectedCategoryId('all'),className:`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCategoryId==='all'?'bg-emerald-600 text-white':'bg-white dark:bg-slate-900 border'}`},`الكل (${restaurantProducts.length})`),
          restaurantCategories.map(cat=>h('button',{key:cat.id,onClick:()=>setSelectedCategoryId(cat.id),className:`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCategoryId===cat.id?'bg-emerald-600 text-white':'bg-white dark:bg-slate-900 border'}`},cat.name))
        ),
        h('div',{className:'relative w-full sm:w-60'},h(Search,{className:'absolute right-3 top-2.5 w-4 h-4 text-slate-400'}),h('input',{value:searchTerm,onChange:e=>setSearchTerm(e.target.value),placeholder:'بحث في الأصناف...',className:'w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border'}))
      ),
      h('div',{className:'flex-1 overflow-y-auto custom-scrollbar'},
        h('div',{className:'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5'},filteredProducts.map(prod=>{
          const unit=(prod.units||[]).find(u=>u.isDefaultSale)||(prod.units||[])[0]; const price=Number(unit?.salePrice??prod.sellingPrice??prod.salePrice??0)||0;
          return h('button',{key:prod.id,onClick:()=>handleQuickAdd(prod),className:'p-3 min-h-[94px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right flex flex-col justify-between active:scale-[.98]'},
            h('div',null,h('span',{className:'text-[10px] text-slate-400 block truncate'},prod.categoryName||'مطعم'),h('div',{className:'font-black text-xs text-slate-900 dark:text-white line-clamp-2'},prod.name)),
            h('div',{className:'flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800'},h('span',{className:'font-black text-emerald-600 text-sm'},`${money(price)} ${settings.currencySymbol||'₪'}`),h(Plus,{className:'w-4 h-4'}))
          );
        }))
      )
    ),
    isCartOpen && h('div',{id:'waiter-cart-backdrop',onClick:()=>setIsCartOpen(false),className:'fixed bg-black/55'}),
    h('div',{id:'waiter-cart-modal',className:isCartOpen?'fixed bg-white border border-slate-200 flex flex-col rounded-2xl overflow-hidden shadow-2xl':'hidden'},
      h('div',{className:'p-3 border-b flex items-center justify-between'},h('div',null,h('div',{className:'font-black text-sm'},orderType==='dine_in'?`طلب طاولة ${selectedTable?.tableNumber||'-'}`:'طلب سفري'),h('div',{className:'text-[10px] text-slate-500'},`الجرسون: ${activeEmployee?.name||'غير محدد'}`)),h('button',{onClick:()=>setIsCartOpen(false),className:'w-8 h-8 rounded-lg border flex items-center justify-center'},h(X,{className:'w-4 h-4'}))),
      h('div',{className:'flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2 custom-scrollbar'},draftItems.length===0?h('div',{className:'py-16 text-center text-slate-400 text-xs'},'السلة فارغة'):draftItems.map((item,idx)=>{
        const sent=item.status!=='new'; return h('div',{key:item.id||idx,className:`p-2.5 rounded-xl border ${item.status==='cancelled'?'opacity-50 line-through':sent?'bg-slate-50 dark:bg-slate-800/50':'bg-white dark:bg-slate-900'}`},
          h('div',{className:'flex items-center justify-between gap-2'},h('div',{className:'min-w-0'},h('div',{className:'font-black text-xs truncate'},item.productName),h('div',{className:'text-[9px] text-slate-500'},item.status==='new'?'جديد':item.status==='ready'?'جاهز':'مرسل للمطبخ')),h('div',{className:'font-black text-xs'},`${money(Number(item.unitPrice)*Number(item.quantity))} ${settings.currencySymbol||'₪'}`)),
          item.status!=='cancelled'&&h('div',{className:'mt-2 pt-2 border-t flex items-center justify-between'},h('div',{className:'flex items-center gap-2'},h('button',{onClick:()=>updateItemQty(idx,-1),className:'w-7 h-7 rounded-lg border flex items-center justify-center'},h(Minus,{className:'w-3 h-3'})),h('span',{className:'w-6 text-center font-black text-xs'},item.quantity),h('button',{onClick:()=>updateItemQty(idx,1),className:'w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center'},h(Plus,{className:'w-3 h-3'}))),h('button',{onClick:()=>handleRemoveItem(item,idx),className:'p-1.5 text-rose-600'},h(Trash2,{className:'w-4 h-4'})))
        );
      })),
      h('div',{className:'p-3 border-t bg-slate-50 dark:bg-slate-800/40 space-y-2'},
        h('label',{className:'block text-[11px] font-black'},h(StickyNote,{className:'inline w-3.5 h-3.5 ml-1'}),'ملاحظات الطلب كاملة للمطبخ'),
        h('textarea',{value:orderNote,onChange:e=>setOrderNote(e.target.value),rows:2,placeholder:'مثال: بدون ملح، الطلب مستعجل، تقديم المشروبات أولاً...',className:'w-full resize-none rounded-xl border bg-white dark:bg-black p-2 text-xs outline-none'}),
        h('div',{className:'flex items-center justify-between'},h('span',{className:'text-xs font-bold text-slate-500'},'الإجمالي'),h('span',{className:'font-black text-base'},`${money(subtotal)} ${settings.currencySymbol||'₪'}`)),
        h('div',{className:'grid grid-cols-2 gap-2 pt-1'},activeExistingOrder&&h('button',{onClick:()=>{setShowTicketModal(activeExistingOrder);setIsAdditionTicket(false);},className:'h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active:scale-[.98]'},h(Printer,{className:'w-4 h-4'}),'طباعة التذكرة'),h('button',{onClick:handleSendToKitchen,disabled:!draftItems.length,className:`h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active:scale-[.98] ${activeExistingOrder?'':'col-span-2'}`},h(Send,{className:'w-4 h-4'}),activeExistingOrder?'إرسال التحديث للمطبخ':'إرسال للمطبخ'))
      )
    ),
    h('button',{id:'waiter-cart-fab',onClick:()=>setIsCartOpen(v=>!v),className:'fixed w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center justify-center border-2 border-white'},h(ShoppingCart,{className:'w-6 h-6'}),draftItems.filter(i=>i.status!=='cancelled').length>0&&h('span',{className:'absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center'},draftItems.filter(i=>i.status!=='cancelled').reduce((n,i)=>n+Number(i.quantity||0),0))),
    showTicketModal&&h(KitchenTicketModal,{order:showTicketModal,isAdditionOnly:isAdditionTicket,onClose:()=>setShowTicketModal(null)}),
    cancelModalItem&&h('div',{className:'fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4'},h('div',{className:'w-full max-w-sm rounded-2xl bg-white dark:bg-black border p-4 space-y-3'},h('div',{className:'font-black text-rose-600 flex items-center gap-2'},h(AlertTriangle,{className:'w-5 h-5'}),'إلغاء صنف مرسل للمطبخ'),h('div',{className:'text-xs'},cancelModalItem.productName),h('select',{value:cancelReason,onChange:e=>setCancelReason(e.target.value),className:'w-full p-2 rounded-xl border bg-transparent text-xs'},['طلب العميل التراجع','خطأ الجرسون في الاختيار','غير متوفر في المطبخ','تأخر التحضير'].map(x=>h('option',{key:x,value:x},x))),h('div',{className:'relative'},h(Lock,{className:'absolute right-3 top-2.5 w-4 h-4'}),h('input',{type:'password',value:managerPin,onChange:e=>setManagerPin(e.target.value),placeholder:'PIN المشرف',className:'w-full pr-9 p-2 rounded-xl border bg-transparent text-center text-xs'})),h('div',{className:'flex justify-end gap-2'},h('button',{onClick:()=>setCancelModalItem(null),className:'px-3 py-2 rounded-xl border text-xs font-bold'},'تراجع'),h('button',{onClick:handleConfirmCancelItem,className:'px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-black'},'تأكيد الحذف'))))
  );
};
