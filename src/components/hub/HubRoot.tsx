/**
 * HubRoot — layout route for /products/*: the `.hub` root (tokens, fonts, theme), the toast
 * system and the page background. Renders the matched child route through <Outlet />.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { ToastProvider } from './ui/Toast';
import './hub.css';

const HubRoot: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="hub hub-app">
    <ToastProvider>{children ?? <Outlet />}</ToastProvider>
  </div>
);

export default HubRoot;
