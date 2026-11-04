import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './services/apiSetup'; // Setup 401 interceptor to handle session expiry
import App from './App';

/** The only address people should use or share. Railway's generated hosts send visitors here. */
const OFFICIAL_APP_URL = 'https://telos.katek-ai.com';
const { hostname, pathname, search, hash } = window.location;
const onRailwayHost = hostname === 'railway.app' || hostname.endsWith('.railway.app');

if (onRailwayHost) {
  // Same page, official address — so share links, form links and copied task links never carry the Railway host.
  window.location.replace(`${OFFICIAL_APP_URL}${pathname}${search}${hash}`);
} else {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
