/* Persistent ESC/POS printer manager.
   Keeps the selected printer connection at app scope so SPA navigation does not disconnect it.
   Supports Web Bluetooth (BLE writable characteristics) and Web Serial fallback for classic/USB serial printers. */
const PREF_KEY = 'oscar-accounting-printer-pref-v1';
const BLE_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class SmartPrinterManager {
  constructor() {
    this.mode = '';
    this.name = '';
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.port = null;
    this.listeners = new Set();
    this.connecting = null;
    this.lastError = '';
    this._autoReconnectStarted = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', () => this.autoReconnect().catch(() => {}));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected()) this.autoReconnect().catch(() => {});
      });
      setTimeout(() => this.autoReconnect().catch(() => {}), 500);
    }
  }

  _readPref() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
  }
  _writePref(value) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(value || {})); } catch {}
  }
  _emit() {
    const state = this.getState();
    this.listeners.forEach(fn => { try { fn(state); } catch {} });
  }
  subscribe(fn) {
    this.listeners.add(fn);
    try { fn(this.getState()); } catch {}
    return () => this.listeners.delete(fn);
  }
  isConnected() {
    if (this.mode === 'bluetooth') return !!this.device?.gatt?.connected && !!this.characteristic;
    if (this.mode === 'serial') return !!this.port?.writable;
    return false;
  }
  getState() {
    return {
      connected: this.isConnected(),
      mode: this.mode,
      name: this.name || this.device?.name || '',
      connecting: this.connecting || '',
      lastError: this.lastError,
      bluetoothSupported: typeof navigator !== 'undefined' && !!navigator.bluetooth,
      serialSupported: typeof navigator !== 'undefined' && !!navigator.serial,
    };
  }

  async connectBluetooth() {
    if (!navigator.bluetooth) throw new Error('متصفحك لا يدعم Web Bluetooth. جرّب Chrome على Android أو استخدم اتصال Serial.');
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    return this._attachBluetooth(device, true);
  }

  async _attachBluetooth(device, remember = true) {
    if (!device?.gatt) throw new Error('الطابعة المختارة لا توفر اتصال Bluetooth GATT متوافق.');
    this.connecting = 'bluetooth'; this.lastError = ''; this._emit();
    try {
      const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
      let characteristic = null;
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          characteristic = chars.find(c => c.properties?.writeWithoutResponse || c.properties?.write) || characteristic;
          if (characteristic) break;
        } catch {}
      }
      if (!characteristic) throw new Error('تم الاتصال بالبلوتوث لكن لم يتم العثور على منفذ كتابة للطابعة.');
      this.mode = 'bluetooth';
      this.device = device;
      this.server = server;
      this.characteristic = characteristic;
      this.port = null;
      this.name = device.name || 'Bluetooth Printer';
      device.addEventListener?.('gattserverdisconnected', () => {
        this.characteristic = null; this.server = null; this._emit();
        setTimeout(() => this.autoReconnect().catch(() => {}), 1200);
      });
      if (remember) this._writePref({ mode:'bluetooth', deviceId:device.id || '', name:this.name });
      this._emit();
      return this.getState();
    } catch (err) {
      this.lastError = err?.message || String(err);
      this._emit();
      throw err;
    } finally {
      this.connecting = null; this._emit();
    }
  }

  async connectSerial() {
    if (!navigator.serial) throw new Error('متصفحك لا يدعم Web Serial. استخدم Chrome/Edge على جهاز يدعم Serial.');
    const port = await navigator.serial.requestPort();
    return this._attachSerial(port, true);
  }

  async _attachSerial(port, remember = true) {
    this.connecting = 'serial'; this.lastError = ''; this._emit();
    try {
      if (!port.readable && !port.writable) await port.open({ baudRate: 9600 });
      this.mode = 'serial'; this.port = port; this.device = null; this.server = null; this.characteristic = null;
      this.name = 'Serial / Bluetooth Printer';
      if (remember) this._writePref({ mode:'serial', name:this.name });
      this._emit();
      return this.getState();
    } catch (err) {
      this.lastError = err?.message || String(err); this._emit(); throw err;
    } finally {
      this.connecting = null; this._emit();
    }
  }

  async autoReconnect() {
    if (this.isConnected() || this.connecting) return this.getState();
    const pref = this._readPref();
    if (!pref?.mode) return this.getState();
    try {
      if (pref.mode === 'bluetooth' && navigator.bluetooth?.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        const device = devices.find(d => d.id === pref.deviceId) || devices.find(d => d.name === pref.name) || devices[0];
        if (device) return await this._attachBluetooth(device, false);
      }
      if (pref.mode === 'serial' && navigator.serial?.getPorts) {
        const ports = await navigator.serial.getPorts();
        if (ports?.[0]) return await this._attachSerial(ports[0], false);
      }
    } catch (err) {
      this.lastError = err?.message || String(err); this._emit();
    }
    return this.getState();
  }

  async disconnect({ forget = true } = {}) {
    try {
      if (this.mode === 'bluetooth' && this.device?.gatt?.connected) this.device.gatt.disconnect();
      if (this.mode === 'serial' && this.port) {
        try { await this.port.close(); } catch {}
      }
    } finally {
      this.mode = ''; this.name = ''; this.device = null; this.server = null; this.characteristic = null; this.port = null;
      if (forget) this._writePref({});
      this._emit();
    }
  }

  async writeBytes(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (!this.isConnected()) await this.autoReconnect();
    if (!this.isConnected()) throw new Error('لا توجد طابعة متصلة. اربط الطابعة من الإعدادات أولاً.');

    if (this.mode === 'bluetooth') {
      const fn = this.characteristic.writeValueWithoutResponse ? 'writeValueWithoutResponse' : 'writeValue';
      const chunkSize = 160;
      for (let i=0; i<data.length; i+=chunkSize) {
        await this.characteristic[fn](data.slice(i, i+chunkSize));
        if (data.length > 3000) await sleep(5);
      }
      return;
    }
    if (this.mode === 'serial') {
      const writer = this.port.writable.getWriter();
      try { await writer.write(data); } finally { writer.releaseLock(); }
    }
  }

  _canvasToRaster(canvas, paperWidth='80mm') {
    const maxWidth = paperWidth === '58mm' ? 384 : 576;
    const scale = Math.min(1, maxWidth / Math.max(1, canvas.width));
    const width = Math.max(8, Math.floor(canvas.width * scale / 8) * 8);
    const height = Math.max(1, Math.floor(canvas.height * (width / canvas.width)));
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d', { willReadFrequently:true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); ctx.drawImage(canvas,0,0,width,height);
    const rgba = ctx.getImageData(0,0,width,height).data;
    const bytesPerRow = width >> 3;
    const raster = new Uint8Array(bytesPerRow * height);
    for (let y=0; y<height; y++) {
      for (let xb=0; xb<bytesPerRow; xb++) {
        let b = 0;
        for (let bit=0; bit<8; bit++) {
          const x = xb*8 + bit, o = (y*width+x)*4;
          const gray = rgba[o]*0.299 + rgba[o+1]*0.587 + rgba[o+2]*0.114;
          if (rgba[o+3] > 20 && gray < 190) b |= (0x80 >> bit);
        }
        raster[y*bytesPerRow+xb] = b;
      }
    }
    const xL=bytesPerRow&255, xH=(bytesPerRow>>8)&255, yL=height&255, yH=(height>>8)&255;
    const header = new Uint8Array([0x1b,0x40,0x1b,0x61,0x01,0x1d,0x76,0x30,0x00,xL,xH,yL,yH]);
    const footer = new Uint8Array([0x0a,0x0a,0x0a,0x1d,0x56,0x00]);
    const out = new Uint8Array(header.length+raster.length+footer.length);
    out.set(header,0); out.set(raster,header.length); out.set(footer,header.length+raster.length);
    return out;
  }

  async printCanvas(canvas, { paperWidth='80mm' }={}) {
    if (!canvas) throw new Error('تعذر تجهيز الفاتورة للطباعة.');
    const bytes = this._canvasToRaster(canvas, paperWidth);
    await this.writeBytes(bytes);
    return true;
  }
}

export const smartPrinter = (typeof window !== 'undefined' && window.__OSCAR_ACCOUNTING_PRINTER__) || new SmartPrinterManager();
if (typeof window !== 'undefined') window.__OSCAR_ACCOUNTING_PRINTER__ = smartPrinter;
