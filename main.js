import { jsx as _jsx } from "react/jsx-runtime";
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js?v=7.9.4.33-waiter-mobile-centered';

class OscarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    try { console.error('OSCAR_RENDER_ERROR', error, info); } catch (_) {}
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return React.createElement('div', {
      dir: 'rtl',
      style: {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', background: '#f8fafc', fontFamily: 'Cairo, sans-serif'
      }
    }, React.createElement('div', {
      style: { width: '100%', maxWidth: '420px', textAlign: 'center', background: '#fff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0' }
    },
      React.createElement('div', { style: { fontSize: '34px', marginBottom: '8px' } }, '🔄'),
      React.createElement('div', { style: { fontWeight: 900, color: '#0f172a', marginBottom: '8px' } }, 'إعادة تحميل واجهة النظام'),
      React.createElement('div', { style: { fontSize: '12px', color: '#64748b', marginBottom: '16px' } }, 'بياناتك محفوظة. أعد تحميل الواجهة فقط.'),
      React.createElement('button', {
        onClick: () => location.reload(),
        style: { border: 0, borderRadius: '12px', background: '#059669', color: '#fff', padding: '11px 18px', fontWeight: 800, cursor: 'pointer' }
      }, 'إعادة التحميل')
    ));
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('ROOT_NOT_FOUND');

createRoot(rootElement).render(
  _jsx(StrictMode, {
    children: _jsx(OscarErrorBoundary, { children: _jsx(App, {}) })
  })
);
