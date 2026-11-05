/**
 * WorkspaceRoot — layout route for /my-day, /vault and /pages: reuses the Hub root (tokens, fonts,
 * theme, toasts) and adds the Workspace styles. Renders the matched child route.
 */
import React from 'react';
import HubRoot from '../hub/HubRoot';
import './workspace.css';

const WorkspaceRoot: React.FC = () => <HubRoot />;

export default WorkspaceRoot;
