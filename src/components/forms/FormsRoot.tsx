/**
 * FormsRoot — layout route for /forms/*: reuses the Hub root (tokens, fonts, theme, toasts)
 * and adds the Forms styles. Renders the matched child route.
 */
import React from 'react';
import HubRoot from '../hub/HubRoot';
import './forms.css';

const FormsRoot: React.FC = () => <HubRoot />;

export default FormsRoot;
