/**
 * FormsTopbar — sticky bar above Forms pages: breadcrumbs on the left, optional actions on the right.
 * Same look as the Hub's topbar, without the product search.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../hub/ui/Icon';

export interface Crumb {
  label: string;
  to?: string;
}

const FormsTopbar: React.FC<{ crumbs: Crumb[]; children?: React.ReactNode }> = ({ crumbs, children }) => (
  <header className="hub-topbar">
    <nav className="hub-crumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <Icon name="chev" size={14} />}
            {c.to && !last ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span className={last ? 'hub-cur' : undefined} aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
    {children ? <div className="hub-top-right">{children}</div> : null}
  </header>
);

export default FormsTopbar;
