import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useApp } from './context__AppContext.js?v=7.9.4.41-recipe-accounting';
import { SearchableDropdown } from './components__common__Dropdown.js?v=7.9.4.41-recipe-accounting';
import { usePWAInstall } from './hooks__usePWAInstall.js?v=7.9.4.41-recipe-accounting';
import { db } from './services__db.js?v=7.9.4.41-recipe-accounting';
import { smartPrinter } from './services__printer.js?v=7.9.4.41-recipe-accounting';
import { TELEGRAM_BOT_URL, normalizeTelegramRecipients, resolveTelegramUsername, testTelegramRecipient, testAllTelegramRecipients, sendFullTelegramReport } from './services__telegram.js?v=7.9.4.41-recipe-accounting';
import { materializeLogoSource, getBrandLogoDisplayUrl, DEFAULT_LOGO_DATA_URL } from './brand__logo.js?v=7.9.4.41-recipe-accounting';
import { Store, Printer, ShieldCheck, Building2, Database, Download, Upload, RefreshCw, Trash2, Save, Edit2, X, Bluetooth, Cable, Bot, Send, ExternalLink, UserPlus, MessageCircle, } from 'lucide-react';
export const SettingsView = () => {
    const { settings, updateSettings, warehouses, saveWarehouse, deleteWarehouse, showToast, refreshData, currentUser, } = useApp();
    const { isInstallable, isInstalled, isIOS, isSecureContext, promptInstall } = usePWAInstall();
    const [printerState, setPrinterState] = useState(() => smartPrinter.getState());
    useEffect(() => smartPrinter.subscribe(setPrinterState), []);
    useEffect(() => { smartPrinter.autoReconnect().catch(() => {}); }, []);
    // Local copy of settings for form editing
    const [formSettings, setFormSettings] = useState(settings);
    // Warehouse modal / editing
    const [newWarehouseName, setNewWarehouseName] = useState('');
    const [newWarehouseCode, setNewWarehouseCode] = useState('');
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [telegramUsernameInput, setTelegramUsernameInput] = useState('');
    const [telegramBusy, setTelegramBusy] = useState('');
    const isTelegramManager = !!(currentUser?.isCompanyManager || ['admin','manager','owner'].includes(String(currentUser?.roleCode || '').toLowerCase()) || /مدير|admin|manager|owner/i.test(String(currentUser?.role || '')));
    useEffect(() => {
        setFormSettings(settings);
    }, [settings]);
    const logoPreviewUrl = getBrandLogoDisplayUrl(formSettings);
    const resolveLogoSettings = async (draftSettings) => {
        const nextSettings = { ...draftSettings };
        const explicitUrl = typeof nextSettings.logoSourceUrl === 'string' ? nextSettings.logoSourceUrl.trim() : '';
        const legacyUrl = !explicitUrl && typeof nextSettings.logoUrl === 'string' && nextSettings.logoUrl.trim() && !/^data:image\//i.test(nextSettings.logoUrl.trim()) ? nextSettings.logoUrl.trim() : '';
        const inputUrl = explicitUrl || legacyUrl;
        if (!inputUrl) {
            if (typeof nextSettings.logoUrl === 'string' && /^data:image\//i.test(nextSettings.logoUrl.trim())) {
                nextSettings.logoSourceUrl = '';
                return nextSettings;
            }
            nextSettings.logoUrl = '';
            nextSettings.logoSourceUrl = '';
            return nextSettings;
        }
        const resolved = await materializeLogoSource(inputUrl);
        nextSettings.logoSourceUrl = resolved.logoSourceUrl || inputUrl;
        nextSettings.logoUrl = resolved.logoUrl || nextSettings.logoUrl || '';
        if (!resolved.logoUrl)
            showToast('تم حفظ رابط الصورة. إذا لم يظهر في الفواتير فاستعمل رابطاً مباشراً للصورة.', 'warning');
        return nextSettings;
    };
    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        const nextSettings = await resolveLogoSettings(formSettings);
        setFormSettings(nextSettings);
        await updateSettings(nextSettings);
        showToast('تم حفظ الإعدادات بنجاح', 'success');
    };
    const handleAddWarehouse = async (e) => {
        e.preventDefault();
        if (!newWarehouseName.trim())
            return;
        const newW = {
            id: editingWarehouse?.id || 'wh-' + Date.now(),
            name: newWarehouseName.trim(),
            code: newWarehouseCode.trim() || editingWarehouse?.code || 'WH-' + (warehouses.length + 1),
            isDefault: editingWarehouse?.isDefault || false,
        };
        await saveWarehouse(newW);
        setNewWarehouseName('');
        setNewWarehouseCode('');
        setEditingWarehouse(null);
    };
    // Full Database JSON Export
    const handleExportBackup = async () => {
        const backupData = await db.exportCompleteBackup();
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Oscar_Accounting_Backup_${new Date().toISOString().split('T')[0]}.json`;
        link.rel = 'noopener';
        link.style.position = 'fixed';
        link.style.left = '-9999px';
        document.body.appendChild(link);
        try { link.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); }
        catch (_) { try { link.click(); } catch (_) { window.open(url, '_blank', 'noopener'); } }
        setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 15000);
        showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
    };
    // Full Database JSON Restore
    const handleImportBackup = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result);
                await db.importBackup(json);
                await refreshData();
                showToast('تم استرجاع النسخة الاحتياطية بنجاح!', 'success');
            }
            catch (err) {
                showToast('ملف النسخة الاحتياطية غير صالح', 'error');
            }
        };
        reader.readAsText(file);
    };
    const handleInstallApp = async () => {
        if (isInstalled) {
            showToast('التطبيق مثبت بالفعل على هذا الجهاز', 'success');
            return;
        }
        if (!isInstallable) {
            if (isIOS)
                showToast('على iPhone/iPad استخدم Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية', 'warning');
            else if (!isSecureContext)
                showToast('تثبيت التطبيق يحتاج فتح النظام عبر HTTPS أو localhost في Chrome', 'warning');
            else
                showToast('نافذة التثبيت غير متاحة الآن. افتح النظام عبر Chrome وانتظر لحظات ثم أعد المحاولة.', 'warning');
            return;
        }
        const result = await promptInstall();
        if (result?.installed)
            showToast('تم بدء تثبيت تطبيق أوسكار على الجهاز', 'success');
        else if (result?.outcome === 'dismissed')
            showToast('تم إلغاء التثبيت', 'warning');
        else if (result?.alreadyInstalled)
            showToast('التطبيق مثبت بالفعل على هذا الجهاز', 'success');
        else
            showToast('تعذر فتح نافذة التثبيت من Chrome الآن', 'warning');
    };
    const handleConnectBluetoothPrinter = async () => {
        try {
            const state = await smartPrinter.connectBluetooth();
            showToast(`تم الاتصال بالطابعة ${state.name || ''}`.trim(), 'success');
        } catch (err) {
            if (err?.name === 'NotFoundError') return;
            showToast(err?.message || 'تعذر الاتصال بطابعة البلوتوث', 'error');
        }
    };
    const handleConnectSerialPrinter = async () => {
        try {
            const state = await smartPrinter.connectSerial();
            showToast(`تم الاتصال بالطابعة ${state.name || ''}`.trim(), 'success');
        } catch (err) {
            if (err?.name === 'NotFoundError') return;
            showToast(err?.message || 'تعذر الاتصال بالطابعة عبر Serial', 'error');
        }
    };
    const handleReconnectPrinter = async () => {
        try {
            await smartPrinter.autoReconnect({ retries: 3 });
            const state = smartPrinter.getState();
            if (state.connected) showToast(`تمت إعادة الاتصال بالطابعة ${state.name || state.preferredName || ''}`.trim(), 'success');
            else showToast('تعذر الوصول للطابعة المحفوظة. تأكد أنها تعمل والبلوتوث مفتوح.', 'warning');
        } catch (err) {
            showToast(err?.message || 'تعذر إعادة الاتصال بالطابعة', 'error');
        }
    };
    const handleDisconnectPrinter = async () => {
        await smartPrinter.disconnect({ forget:true });
        showToast('تم فصل الطابعة وإلغاء الربط المحفوظ', 'info');
    };
    const handleResetSeedData = async () => {
        if (window.confirm('هل أنت متأكد من إعادة تعيين البيانات وتحميل البيانات التجريبية الشاملة؟')) {
            await db.resetToSeedData();
            await refreshData();
            showToast('تمت إعادة ضبط البيانات بنجاح', 'success');
        }
    };
    const telegramRecipients = normalizeTelegramRecipients(formSettings.telegramRecipients);
    const handleAddTelegramRecipient = async () => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        const raw = String(telegramUsernameInput || '').trim();
        const username = raw ? (raw.startsWith('@') ? raw : `@${raw}`) : '';
        if (!/^@[A-Za-z0-9_]{5,32}$/.test(username)) {
            showToast('اكتب يوزر Telegram صحيح مثل @username', 'warning');
            return;
        }
        setTelegramBusy(`add:${username.toLowerCase()}`);
        try {
            const resolved = await resolveTelegramUsername(username);
            const chatId = String(resolved?.chatId || '').trim();
            if (!chatId) throw new Error('تعذر العثور على المستخدم داخل البوت');
            const normalizedUsername = String(resolved?.username || username).trim();
            const nextRecipients = [
                ...telegramRecipients.filter((r) => r.chatId !== chatId && String(r.username || '').toLowerCase() !== normalizedUsername.toLowerCase()),
                { chatId, username: normalizedUsername, label: String(resolved?.name || normalizedUsername), enabled: true },
            ];
            await updateSettings({
                telegramEnabled: true,
                telegramBotUsername: 'Oskarteaam_bot',
                telegramBotUrl: TELEGRAM_BOT_URL,
                telegramRecipients: nextRecipients,
            });
            setFormSettings((prev) => ({ ...prev, telegramEnabled:true, telegramRecipients:nextRecipients }));
            setTelegramUsernameInput('');
            try {
                await testTelegramRecipient(chatId);
                showToast(`تم ربط ${normalizedUsername} وإرسال رسالة اختبار بنجاح`, 'success');
            } catch (error) {
                showToast(`تم ربط ${normalizedUsername} لكن الاختبار فشل. ${error?.message || ''}`.trim(), 'warning');
            }
        } catch (error) {
            showToast(error?.message || 'تعذر العثور على هذا اليوزر. تأكد أنه فتح البوت وضغط Start.', 'error');
        } finally {
            setTelegramBusy('');
        }
    };
    const handleToggleTelegramRecipient = async (chatId) => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        const nextRecipients = telegramRecipients.map((r) => r.chatId === chatId ? { ...r, enabled: r.enabled === false } : r);
        await updateSettings({ telegramRecipients: nextRecipients });
    };
    const handleRemoveTelegramRecipient = async (chatId) => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        const nextRecipients = telegramRecipients.filter((r) => r.chatId !== chatId);
        await updateSettings({ telegramRecipients: nextRecipients });
    };
    const handleTestTelegramRecipient = async (chatId) => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        setTelegramBusy(`test:${chatId}`);
        try {
            await testTelegramRecipient(chatId);
            showToast('وصلت رسالة الاختبار إلى Telegram بنجاح', 'success');
        }
        catch (error) {
            showToast(`تعذر الإرسال. يجب فتح البوت والضغط على Start أولاً. ${error?.message || ''}`.trim(), 'error');
        }
        finally { setTelegramBusy(''); }
    };
    const handleTestAllTelegram = async () => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        setTelegramBusy('test-all');
        try {
            const result = await testAllTelegramRecipients();
            if (result?.ok) showToast(`تم إرسال الاختبار إلى ${result.sent || telegramRecipients.length} مستخدم`, 'success');
            else throw new Error(result?.failures?.[0]?.error || 'فشل الإرسال');
        }
        catch (error) { showToast(error?.message || 'تعذر اختبار مستخدمي Telegram', 'error'); }
        finally { setTelegramBusy(''); }
    };
    const handleSendTelegramReportNow = async () => {
        if (!isTelegramManager) { showToast('إعدادات Telegram متاحة للمدير فقط', 'error'); return; }
        setTelegramBusy('report');
        try {
            const result = await sendFullTelegramReport({ manual: true, force: true });
            showToast(`تم إرسال جميع التقارير إلى ${result?.sent || telegramRecipients.filter(r => r.enabled !== false).length} مستخدم`, 'success');
        }
        catch (error) { showToast(error?.message || 'تعذر إرسال تقرير Telegram', 'error'); }
        finally { setTelegramBusy(''); }
    };
    const telegramNotificationOptions = [
        ['telegramInvoiceNotifications','المبيعات وفواتير البيع'],
        ['telegramPurchaseNotifications','المشتريات وفواتير الموردين'],
        ['telegramReturnNotifications','المرتجعات'],
        ['telegramNotifyCustomers','العملاء وتغيّر أرصدتهم'],
        ['telegramNotifySuppliers','الموردون وتغيّر أرصدتهم'],
        ['telegramNotifyVouchers','سندات القبض والصرف'],
        ['telegramNotifyExpenses','المصروفات'],
        ['telegramNotifyTransfers','التحويلات بين الحسابات'],
        ['telegramNotifyAccounts','تغيّرات الحسابات المالية'],
        ['telegramNotifyProducts','الأصناف والأقسام والوصفات'],
        ['telegramNotifyInventory','حركات المخزون والتالف'],
        ['telegramNotifyWarehouses','المخازن والفروع'],
        ['telegramNotifyEmployees','الموظفون'],
        ['telegramNotifyShifts','فتح وإغلاق وتعديل الورديات'],
        ['telegramNotifyHeldInvoices','الفواتير المعلقة'],
        ['telegramNotifyRestaurant','طلبات وحجوزات المطعم'],
        ['telegramNotifyAuditLogs','سجل العمليات والتدقيق'],
        ['telegramSendImages','إرسال صور مصممة للفواتير والسندات والتنبيهات والتقارير'],
    ];
    const telegramCard = isTelegramManager ? _jsxs("div", { id: "settings-telegram", className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900/70 shadow-xs space-y-4", children: [
        _jsxs("div", { className: "flex items-start justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800", children: [
            _jsxs("div", { className: "flex items-center gap-3", children: [
                _jsx("div", { className: "w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center shrink-0", children: _jsx(Bot, { className: "w-5 h-5 text-sky-600" }) }),
                _jsxs("div", { children: [
                    _jsx("h3", { className: "text-sm font-black text-slate-900 dark:text-white", children: "ربط Telegram والإشعارات" }),
                    _jsx("p", { className: "text-[11px] text-slate-500 mt-0.5 leading-5", children: "اربط أكثر من مستخدم، واختر كمدير بالضبط أي حركات يرسلها البوت، مع جميع تقارير البرنامج كل 24 ساعة، وإرسال صور مصممة للفواتير والسندات والتنبيهات عند التفعيل." })
                ] })
            ] }),
            _jsxs("label", { className: "flex items-center gap-2 text-[11px] font-bold text-slate-600", children: [
                _jsx("span", { children: "تفعيل" }),
                _jsx("input", { type: "checkbox", checked: formSettings.telegramEnabled !== false, onChange: (e) => setFormSettings({ ...formSettings, telegramEnabled: e.target.checked }), className: "w-5 h-5 accent-sky-600 rounded" })
            ] })
        ] }),
        _jsxs("div", { className: "rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[11px] text-sky-900 leading-6", children: [
            _jsx("div", { className: "font-black", children: "مهم قبل الربط" }),
            _jsx("div", { children: "كل مستخدم لازم يفتح البوت ويضغط Start مرة واحدة على الأقل. بعد ذلك اكتب اليوزر فقط، والاستضافة تربطه داخلياً بدون إدخال أو عرض Chat ID." }),
            _jsxs("button", { type: "button", onClick: () => window.open(TELEGRAM_BOT_URL, '_blank', 'noopener'), className: "mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold", children: [_jsx(ExternalLink, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "فتح @Oskarteaam_bot" })] })
        ] }),
        _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2", children: [
            _jsx("input", { type: "text", dir: "ltr", value: telegramUsernameInput, onChange: (e) => setTelegramUsernameInput(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTelegramRecipient(); } }, placeholder: "@username أو username", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 font-mono" }),
            _jsxs("button", { type: "button", onClick: handleAddTelegramRecipient, disabled: !!telegramBusy, className: "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black", children: [_jsx(UserPlus, { className: "w-4 h-4" }), _jsx("span", { children: telegramBusy.startsWith('add:') ? "جاري البحث والربط..." : "ربط اليوزر" })] })
        ] }),
        _jsx("div", { className: "text-[10px] text-slate-500 leading-5", children: "لا تحتاج لمعرفة Chat ID. الاستضافة تكتشف حسابات من سبق لهم بدء البوت وتحفظ المعرّف داخلياً، وأنت تتعامل بالـ @username فقط." }),
        telegramRecipients.length ? _jsx("div", { className: "space-y-2", children: telegramRecipients.map((recipient) => _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50", children: [
            _jsxs("div", { className: "flex-1 min-w-0", children: [
                _jsx("div", { className: "text-xs font-black text-slate-800 dark:text-slate-100 truncate", children: recipient.username || recipient.label || 'مستخدم Telegram' }),
                _jsx("div", { className: "text-[10px] text-slate-500 truncate", children: recipient.label && recipient.label !== recipient.username ? recipient.label : 'مرتبط عبر اليوزر — المعرّف مخفي' })
            ] }),
            _jsxs("div", { className: "flex items-center gap-1.5", children: [
                _jsxs("button", { type: "button", onClick: () => handleToggleTelegramRecipient(recipient.chatId), className: `px-2.5 py-1.5 rounded-lg text-[10px] font-black ${recipient.enabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`, children: [recipient.enabled !== false ? 'مفعّل' : 'متوقف'] }),
                _jsxs("button", { type: "button", onClick: () => handleTestTelegramRecipient(recipient.chatId), disabled: !!telegramBusy, className: "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border text-sky-700 text-[10px] font-black disabled:opacity-50", children: [_jsx(MessageCircle, { className: "w-3.5 h-3.5" }), _jsx("span", { children: telegramBusy === `test:${recipient.chatId}` ? 'يرسل...' : 'اختبار' })] }),
                _jsx("button", { type: "button", onClick: () => handleRemoveTelegramRecipient(recipient.chatId), className: "p-1.5 rounded-lg bg-white border text-rose-600", title: "حذف المستخدم", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })
            ] })
        ] }, recipient.chatId)) }) : _jsx("div", { className: "p-3 rounded-xl border border-dashed text-center text-xs text-slate-400", children: "لم تتم إضافة أي مستخدم Telegram بعد." }),
        _jsx("div", { className: "space-y-2", children: [
            _jsx("div", { className: "text-xs font-black text-slate-700 dark:text-slate-200", children: "ما الذي يرسله البوت؟ — المدير فقط يتحكم بهذه المفاتيح" }),
            _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: telegramNotificationOptions.map(([key,label]) => _jsxs("label", { className: "flex items-center justify-between gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800", children: [_jsx("span", { className: "text-[11px] font-bold", children: label }), _jsx("input", { type: "checkbox", checked: formSettings[key] !== false, onChange: (e) => setFormSettings({ ...formSettings, [key]: e.target.checked }), className: "w-5 h-5 accent-sky-600" })] }, key)) }),
            _jsxs("label", { className: "flex items-center justify-between gap-3 p-3 rounded-xl border border-sky-200 bg-sky-50/60 dark:bg-sky-950/20", children: [_jsxs("span", { children: [_jsx("span", { className: "text-xs font-black block", children: "إرسال جميع تقارير البرنامج تلقائياً كل 24 ساعة" }), _jsx("span", { className: "text-[10px] text-slate-500", children: "المبيعات، المرتجعات، المشتريات، القبض والصرف، المصروفات، العملاء والمديونون، الموردون، الحسابات، المخزون، النواقص، المخازن، الموظفون، الورديات وسجل العمليات." })] }), _jsx("input", { type: "checkbox", checked: formSettings.telegramAutoReportEnabled !== false, onChange: (e) => setFormSettings({ ...formSettings, telegramAutoReportEnabled: e.target.checked, telegramReportIntervalHours: 24 }), className: "w-5 h-5 accent-sky-600" })] })
        ] }),
        _jsxs("div", { className: "flex flex-wrap gap-2 pt-1", children: [
            _jsxs("button", { type: "button", onClick: handleSendTelegramReportNow, disabled: !!telegramBusy || !telegramRecipients.some(r => r.enabled !== false), className: "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black", children: [_jsx(Send, { className: "w-4 h-4" }), _jsx("span", { children: telegramBusy === 'report' ? 'جاري إرسال جميع التقارير...' : 'إرسال جميع التقارير الآن' })] }),
            _jsx("button", { type: "button", onClick: handleTestAllTelegram, disabled: !!telegramBusy || !telegramRecipients.some(r => r.enabled !== false), className: "px-4 py-2 rounded-xl border border-sky-200 text-sky-700 bg-white text-xs font-black disabled:opacity-50", children: telegramBusy === 'test-all' ? 'جاري الاختبار...' : 'اختبار جميع المستخدمين' }),
            _jsx("button", { type: "button", onClick: async () => { if (!isTelegramManager) return; await updateSettings({ ...formSettings, telegramEnabled: formSettings.telegramEnabled !== false, telegramReportIntervalHours: 24, telegramBotUsername: 'Oskarteaam_bot', telegramBotUrl: TELEGRAM_BOT_URL, telegramRecipients }); showToast('تم حفظ إعدادات Telegram', 'success'); }, className: "px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-black", children: "حفظ إعدادات Telegram" })
        ] })
    ] }) : null;
    return (_jsxs("div", { id: "settings-screen", className: "p-4 sm:p-6 space-y-6 max-w-4xl mx-auto text-right select-none", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white", children: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u062a\u062e\u0635\u064a\u0635 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062d\u0644\u060c \u0627\u0644\u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u064a\u0629\u060c \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0628\u064a\u0639 \u0628\u0627\u0644\u0633\u0627\u0644\u0628\u060c \u0627\u0644\u0641\u0631\u0648\u0639\u060c \u0648\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a \u0627\u0644\u0643\u0627\u0645\u0644" })] }), _jsxs("form", { onSubmit: handleSaveGeneral, className: "space-y-6", children: [_jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx(Store, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0627\u0644\u0645\u062a\u062c\u0631" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062d\u0644 \u0623\u0648 \u0627\u0644\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062a:" }), _jsx("input", { type: "text", value: formSettings.storeName, onChange: (e) => setFormSettings({ ...formSettings, storeName: e.target.value }), className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0631\u0645\u0632 \u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a:" }), _jsx("input", { type: "text", value: formSettings.currencySymbol, onChange: (e) => setFormSettings({ ...formSettings, currencySymbol: e.target.value }), className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 font-mono font-bold" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0648\u0627\u0644\u062a\u0648\u0627\u0635\u0644:" }), _jsx("input", { type: "text", value: formSettings.phone, onChange: (e) => setFormSettings({ ...formSettings, phone: e.target.value }), className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 font-mono" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u0644\u0645\u0648\u0642\u0639:" }), _jsx("input", { type: "text", value: formSettings.address, onChange: (e) => setFormSettings({ ...formSettings, address: e.target.value }), className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064a\u0628\u064a (\u0625\u0646 \u0648\u062c\u062f):" }), _jsx("input", { type: "text", value: formSettings.taxNumber || '', onChange: (e) => setFormSettings({ ...formSettings, taxNumber: e.target.value }), className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 font-mono" })] }), _jsxs("div", { className: "sm:col-span-2 space-y-3", children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0631\u0627\u0628\u0637 \u0635\u0648\u0631\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 / \u0627\u0644\u0634\u0639\u0627\u0631:" }), _jsx("input", { type: "url", dir: "ltr", value: formSettings.logoSourceUrl || '', onChange: (e) => setFormSettings({ ...formSettings, logoSourceUrl: e.target.value }), placeholder: "https://example.com/logo.png", className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800" }), _jsxs("div", { className: "flex items-center gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50", children: [_jsx("img", { src: logoPreviewUrl, alt: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0634\u0639\u0627\u0631", className: "w-16 h-16 object-contain rounded-lg bg-white border p-1", onError: (e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_LOGO_DATA_URL; } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-xs font-bold text-slate-800 dark:text-slate-100", children: "\u0633\u064a\u0638\u0647\u0631 \u0647\u0630\u0627 \u0627\u0644\u0634\u0639\u0627\u0631 \u0641\u064a \u0627\u0644\u0646\u0638\u0627\u0645\u060c \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631\u060c \u0627\u0644\u0633\u0646\u062f\u0627\u062a\u060c \u0648\u0627\u0644\u062a\u062d\u0645\u064a\u0644\u0627\u062a." }), _jsx("div", { className: "text-[11px] text-slate-500 mt-1 leading-5", children: "\u0627\u0644\u0635\u0642 \u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629 \u062b\u0645 \u0627\u062d\u0641\u0638. \u064a\u0641\u0636\u0644 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0631\u0627\u0628\u0637\u0627\u064b \u0645\u0628\u0627\u0634\u0631\u0627\u064b \u064a\u0646\u062a\u0647\u064a \u0628\u0640 png \u0623\u0648 jpg \u0623\u0648 webp." })] }), _jsx("button", { type: "button", onClick: () => setFormSettings({ ...formSettings, logoSourceUrl: '', logoUrl: '' }), className: "px-3 py-2 text-[11px] font-bold rounded-lg border border-rose-200 text-rose-600 bg-white", children: "\u0645\u0633\u062d" })] })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx(Printer, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u064a\u0629 \u0648\u0627\u0644\u0625\u064a\u0635\u0627\u0644\u0627\u062a" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u0645\u0642\u0627\u0633 \u0648\u0631\u0642 \u0627\u0644\u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u064a\u0629:" }), _jsx(SearchableDropdown, { id: "settings-printer-width", options: [{id:"80mm",label:"80 \u0645\u0644\u0645",subLabel:"\u0637\u0627\u0628\u0639\u0629 \u062d\u0631\u0627\u0631\u064a\u0629 \u0642\u064a\u0627\u0633\u064a\u0629 \u0639\u0631\u064a\u0636\u0629"},{id:"58mm",label:"58 \u0645\u0644\u0645",subLabel:"\u0637\u0627\u0628\u0639\u0629 \u062d\u0631\u0627\u0631\u064a\u0629 \u0635\u063a\u064a\u0631\u0629 \u0648\u0645\u062d\u0645\u0648\u0644\u0629"},{id:"a4",label:"A4",subLabel:"\u0641\u0627\u062a\u0648\u0631\u0629 \u0643\u0627\u0645\u0644\u0629 \u0639\u0644\u0649 \u0648\u0631\u0642 A4"}], selectedId: formSettings.printerWidth, onSelect: (id) => setFormSettings({ ...formSettings, printerWidth: id }), placeholder: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0645\u0642\u0627\u0633..." })] }), _jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-800", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-bold block", children: "\u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0639\u0646\u062f \u0627\u0644\u062d\u0641\u0638:" }), _jsx("span", { className: "text-[11px] text-slate-400", children: "\u0641\u062a\u062d \u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0639\u062f \u062d\u0641\u0638 \u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0628\u064a\u0639" })] }), _jsx("input", { type: "checkbox", checked: (formSettings.printOnSave ?? formSettings.autoPrintReceipt), onChange: (e) => setFormSettings({ ...formSettings, printOnSave: e.target.checked, autoPrintReceipt: e.target.checked }), className: "w-5 h-5 accent-emerald-600 rounded" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "text-xs font-semibold block mb-1", children: "\u062a\u0630\u064a\u064a\u0644 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0645\u0637\u0628\u0648\u0639 (\u0631\u0633\u0627\u0644\u0629 \u0623\u0633\u0641\u0644 \u0627\u0644\u0625\u064a\u0635\u0627\u0644):" }), _jsx("input", { type: "text", value: formSettings.receiptFooterMessage, onChange: (e) => setFormSettings({ ...formSettings, receiptFooterMessage: e.target.value }), placeholder: "\u0634\u0643\u0631\u0627\u064b \u0644\u0632\u064a\u0627\u0631\u062a\u0643\u0645! \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 \u062a\u0631\u062f \u0648\u062a\u0633\u062a\u0628\u062f\u0644 \u062e\u0644\u0627\u0644 3 \u0623\u064a\u0627\u0645", className: "w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800" })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Bluetooth, { className: "w-5 h-5 text-emerald-600" }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-black text-slate-900 dark:text-white", children: "طابعة Bluetooth / Serial" }), _jsx("p", { className: "text-[11px] text-slate-500", children: "اختر الطابعة مرة واحدة من داخل البرنامج. يتم حفظها على هذا الجهاز ويعيد النظام الاتصال بها تلقائياً أثناء التنقل أو بعد رجوع التطبيق من الخلفية." })] })] }), _jsx("span", { className: `px-2.5 py-1 rounded-full text-[10px] font-black ${printerState.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`, children: printerState.connected ? `متصل دائماً • ${printerState.name || printerState.preferredName || 'الطابعة'}` : printerState.hasRememberedPrinter ? `محفوظة • ${printerState.preferredName || 'الطابعة'}` : 'لم يتم اختيار طابعة' })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { type: "button", onClick: handleConnectBluetoothPrinter, disabled: printerState.connecting || !printerState.bluetoothSupported, className: "flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40", children: [_jsx(Bluetooth, { className: "w-4 h-4" }), _jsx("span", { children: printerState.connecting === 'bluetooth' ? 'جاري الاتصال...' : 'اختيار / تغيير طابعة Bluetooth' })] }), (!printerState.connected && printerState.hasRememberedPrinter) ? _jsxs("button", { type: "button", onClick: handleReconnectPrinter, disabled: !!printerState.connecting, className: "flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 text-xs font-bold disabled:opacity-40", children: [_jsx(RefreshCw, { className: "w-4 h-4" }), _jsx("span", { children: "إعادة الاتصال بالطابعة المحفوظة" })] }) : null, _jsxs("button", { type: "button", onClick: handleConnectSerialPrinter, disabled: printerState.connecting || !printerState.serialSupported, className: "flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs font-bold disabled:opacity-40", children: [_jsx(Cable, { className: "w-4 h-4" }), _jsx("span", { children: "اختيار طابعة Serial" })] }), printerState.connected ? _jsxs("button", { type: "button", onClick: handleDisconnectPrinter, className: "flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-rose-600 bg-rose-50 text-xs font-bold", children: [_jsx(X, { className: "w-4 h-4" }), _jsx("span", { children: "فصل الطابعة" })] }) : null] }), _jsx("p", { className: "text-[10px] leading-relaxed text-slate-400", children: "بعد اختيار الطابعة تبقى محفوظة في هذا الجهاز. عند انقطاع الاتصال مؤقتاً يحاول النظام استعادته تلقائياً قبل الطباعة بدون الحاجة لاختيار الطابعة كل مرة." })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx(ShieldCheck, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u0633\u064a\u0627\u0633\u0627\u062a \u0627\u0644\u0628\u064a\u0639 \u0648\u0627\u0644\u0645\u062e\u0632\u0648\u0646" })] }), _jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-800", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-bold block", children: "\u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0627\u0644\u0628\u064a\u0639 \u0628\u0627\u0644\u0633\u0627\u0644\u0628 (Negative Stock):" }), _jsx("span", { className: "text-[11px] text-slate-400", children: "\u0625\u062a\u0645\u0627\u0645 \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0628\u064a\u0639 \u0628\u0627\u0644\u0643\u0627\u0634\u064a\u0631 \u062d\u062a\u0649 \u0644\u0648 \u0643\u0627\u0646\u062a \u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0633\u062c\u0644\u0629 \u0628\u0627\u0644\u0645\u062e\u0632\u0646 0 (\u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062a \u0644\u062a\u062c\u0646\u0628 \u062a\u0639\u0637\u064a\u0644 \u0627\u0644\u0632\u0628\u0627\u0626\u0646)" })] }), _jsx("input", { type: "checkbox", checked: formSettings.allowNegativeStock, onChange: (e) => setFormSettings({ ...formSettings, allowNegativeStock: e.target.checked }), className: "w-5 h-5 accent-emerald-600 rounded" }), _jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-800", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-bold block", children: "تفعيل بيع الميزان" }), _jsx("span", { className: "text-[11px] text-slate-400", children: "عند تعديل مبلغ الصنف في السلة تُحسب الكمية تلقائياً ويُقرب صافي الفاتورة لأقرب عدد صحيح." })] }), _jsx("input", { type: "checkbox", checked: !!formSettings.scaleModeEnabled, onChange: (e) => setFormSettings({ ...formSettings, scaleModeEnabled: e.target.checked }), className: "w-5 h-5 accent-emerald-600 rounded" })] })] })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { type: "submit", className: "flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition", children: [_jsx(Save, { className: "w-4 h-4" }), _jsx("span", { children: "\u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0639\u0627\u0645\u0629" })] }) })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx(Building2, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0641\u0631\u0648\u0639 \u0648\u0627\u0644\u0645\u062e\u0627\u0632\u0646" })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: warehouses.map((w) => (_jsxs("div", { className: `p-3 rounded-xl border flex items-center justify-between ${w.id === settings.activeWarehouseId
                                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                                : 'bg-slate-50 dark:bg-slate-800/40'}`, children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-bold text-slate-900 dark:text-white", children: w.name }), _jsxs("div", { className: "text-[10px] text-slate-400 font-mono", children: ["\u0627\u0644\u0643\u0648\u062f: ", w.code] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [w.id === settings.activeWarehouseId ? (_jsx("span", { className: "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white", children: "\u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a \u0627\u0644\u0646\u0634\u0637" })) : (_jsx("button", { type: "button", onClick: () => updateSettings({ activeWarehouseId: w.id }), className: "px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-emerald-600 hover:bg-slate-200 rounded", children: "\u062a\u0641\u0639\u064a\u0644" })), _jsx("button", { type: "button", onClick: () => {
                                                setEditingWarehouse(w);
                                                setNewWarehouseName(w.name);
                                                setNewWarehouseCode(w.code);
                                            }, className: "p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50", title: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u062e\u0632\u0646", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }), _jsx("button", { type: "button", onClick: () => deleteWarehouse(w.id), className: "p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50", title: "\u062d\u0630\u0641 \u0627\u0644\u0645\u062e\u0632\u0646", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }, w.id))) }), _jsxs("form", { onSubmit: handleAddWarehouse, className: "flex gap-2 pt-2", children: [_jsx("input", { type: "text", placeholder: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0623\u0648 \u0627\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u062c\u062f\u064a\u062f...", value: newWarehouseName, onChange: (e) => setNewWarehouseName(e.target.value), className: "flex-1 px-3 py-1.5 text-xs border rounded-lg" }), _jsx("input", { type: "text", placeholder: "\u0627\u0644\u0643\u0648\u062f (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)", value: newWarehouseCode, onChange: (e) => setNewWarehouseCode(e.target.value), className: "w-28 px-3 py-1.5 text-xs border rounded-lg font-mono" }), _jsx("button", { type: "submit", className: "px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg", children: editingWarehouse ? 'حفظ التعديل' : 'إضافة مخزن' }), editingWarehouse && (_jsx("button", { type: "button", onClick: () => {
                                    setEditingWarehouse(null);
                                    setNewWarehouseName('');
                                    setNewWarehouseCode('');
                                }, className: "px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold rounded-lg", title: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u0639\u062f\u064a\u0644", children: _jsx(X, { className: "w-4 h-4" }) }))] })] }), telegramCard, _jsxs("div", { id: "settings-install-app", className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/70 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0", children: _jsx(Download, { className: "w-5 h-5 text-emerald-600" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "تثبيت التطبيق على الجهاز" }), _jsx("p", { className: "text-[11px] text-slate-500 mt-0.5", children: "تثبيت مباشر من Chrome كتطبيق مستقل بأيقونة على الجهاز وتشغيل أسرع وأفضل للأوفلاين." })] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-3", children: [_jsxs("button", { id: "btn-settings-install-pwa", type: "button", onClick: handleInstallApp, disabled: isInstalled, className: `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition shadow-sm ${isInstalled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[.98]'}`, children: [_jsx(Download, { className: "w-4 h-4" }), _jsx("span", { children: isInstalled ? "التطبيق مثبت" : "تثبيت التطبيق" })] }), _jsx("div", { className: `text-[11px] font-semibold ${isInstalled ? 'text-emerald-600' : isInstallable ? 'text-emerald-600' : 'text-slate-500'}`, children: isInstalled ? "التطبيق مثبت على هذا الجهاز" : isInstallable ? "جاهز للتثبيت عبر Chrome — اضغط الزر لفتح نافذة التثبيت" : isIOS ? "على iPhone/iPad: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية" : isSecureContext ? "بانتظار توفر نافذة التثبيت من Chrome" : "التثبيت يحتاج HTTPS أو localhost" })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800", children: [_jsx(Database, { className: "w-5 h-5 text-emerald-600" }), _jsx("h3", { className: "text-sm font-bold text-slate-900 dark:text-white", children: "\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a \u0648\u0627\u0633\u062a\u0639\u0627\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a" })] }), _jsx("p", { className: "text-xs text-slate-500", children: "\u0646\u0638\u0627\u0645 \u0623\u0648\u0633\u0643\u0627\u0631 \u0627\u0644\u0645\u062d\u0627\u0633\u0628\u064a \u064a\u062e\u0632\u0646 \u0643\u0627\u0641\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u062d\u0644\u064a\u0627\u064b \u0648\u0628\u0634\u0643\u0644 \u0622\u0645\u0646 \u0641\u064a \u062c\u0647\u0627\u0632\u0643 \u0639\u0628\u0631 \u0645\u062a\u0635\u0641\u062d \u0627\u0644\u0648\u064a\u0628 \u0628\u062f\u0648\u0646 \u0627\u0644\u062d\u0627\u062c\u0629 \u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a. \u064a\u0645\u0643\u0646\u0643 \u062d\u0641\u0638 \u0646\u0633\u062e\u0629 \u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629 \u062f\u0648\u0631\u064a\u0629 \u0628\u0645\u0644\u0641 JSON." }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 pt-2", children: [_jsxs("button", { onClick: handleExportBackup, className: "flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition", children: [_jsx(Download, { className: "w-4 h-4" }), _jsx("span", { children: "\u062a\u0635\u062f\u064a\u0631 \u0646\u0633\u062e\u0629 \u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629 \u0643\u0627\u0645\u0644\u0629 (JSON)" })] }), _jsxs("label", { className: "flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition", children: [_jsx(Upload, { className: "w-4 h-4" }), _jsx("span", { children: "\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0646\u0633\u062e\u0629 \u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629 \u0645\u0646 \u0645\u0644\u0641" }), _jsx("input", { type: "file", accept: ".json", onChange: handleImportBackup, className: "hidden" })] }), _jsxs("button", { onClick: handleResetSeedData, className: "flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-rose-600 text-xs font-semibold mr-auto transition", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u0625\u0639\u0627\u062f\u0629 \u0636\u0628\u0637 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0644\u0648\u0636\u0639 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a \u0627\u0644\u0623\u0648\u0644\u064a" })] })] })] })] }));
};
