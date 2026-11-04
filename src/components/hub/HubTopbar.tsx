/**
 * HubTopbar — sticky bar above Hub pages: breadcrumbs on the left, HubSearch on the right.
 *   <HubTopbar crumbs={[{ label: 'All products', to: '/products' }, { label: 'CourseForge' }]} />
 * The last crumb is the current page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './ui/Icon';
import HubSearch from './HubSearch';

export interface Crumb {
  label: string;
  to?: string;
}

const HubTopbar: React.FC<{ crumbs: Crumb[] }> = ({ crumbs }) => (
  <header className="hub-topbar">
    <nav className="hub-crumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <Icon name="chev" size={14} />}
            {last || !c.to ? (
              <span className="hub-cur" aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            ) : (
              <Link to={c.to}>{c.label}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
    <div className="hub-top-right">
      <HubSearch />
    </div>
  </header>
);

export default HubTopbar;
