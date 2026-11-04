import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaClock,
  FaFolderOpen,
  FaCalendarDay,
  FaCog,
  FaStickyNote,
  FaBullseye,
  FaFlag,
  FaBars,
  FaTimes,
  FaCubes,
  FaWpforms,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import UserAvatar from './UserAvatar';
import './Dashboard.css';
import './AppSidebar.css';

const SIDEBAR_WIDTH = 246;
/** Below this width the sidebar becomes a slide-in drawer so the page keeps its full width */
const MOBILE_QUERY = '(max-width: 768px)';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
};

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[]; // if set, only show for these roles
  /** When true, Head PM (isHeadPM) may see this item even if roles is PM-only */
  alsoHeadPM?: boolean;
};

/** Page-level navigation a dashboard can place at the top of the sidebar */
export type SidebarWorkspaceItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onClick: () => void;
};
export type SidebarPinnedProject = {
  id: string;
  label: string;
  color: string;
  active?: boolean;
  onClick: () => void;
};
export type SidebarWorkspace = {
  items: SidebarWorkspaceItem[];
  pinned?: SidebarPinnedProject[];
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'WORK',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaHome /> },
      { path: '/timeline', label: 'My Timeline', icon: <FaClock /> },
      { path: '/my-projects', label: 'My Projects', icon: <FaFolderOpen /> },
      { path: '/products', label: 'Products', icon: <FaCubes /> },
      { path: '/forms', label: 'Forms', icon: <FaWpforms /> },
    ],
  },
  {
    title: 'TASKS',
    items: [
      { path: '/tasks-due-today', label: 'Tasks due today', icon: <FaCalendarDay /> },
      {
        path: '/daily-focus',
        label: 'Daily focus & EOD',
        icon: <FaBullseye />,
        roles: ['Project Manager'],
      },
      {
        path: '/department-priorities',
        label: 'Department priorities',
        icon: <FaFlag />,
        roles: ['Project Manager'],
        alsoHeadPM: true,
      },
      {
        path: '/rapid-prospect',
        label: 'Rapid Prospect',
        icon: <FaBullseye />,
        roles: ['Project Manager', 'FOUNDER/CEO', 'Rapid Prospect'],
        alsoHeadPM: true,
      },
    ],
  },
  {
    title: 'DEPARTMENTS',
    items: [
      { path: '/department-view/copy-writing', label: 'Copy Writing Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/designer', label: 'Design Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/developer', label: 'Development Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/ai-developer', label: 'AI Dev Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/social-media', label: 'Social Media Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/crm', label: 'CRM Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
      { path: '/department-view/seo-geo', label: 'SEO/GEO Board', icon: <FaFlag />, roles: ['Project Manager', 'FOUNDER/CEO'], alsoHeadPM: true },
    ],
  },
  {
    title: 'TALK',
    items: [
      { path: '/forum', label: 'Forum', icon: <FaStickyNote /> },
    ],
  },
];

const AppSidebar: React.FC<{ workspace?: SidebarWorkspace }> = ({ workspace }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getUser();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer after navigating or when growing back to desktop width
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const getEffectivePath = (item: NavItem): string => {
    if (item.path === '/dashboard' && user?.role === 'Project Manager') return '/pm-dashboard';
    return item.path;
  };

  const handleNav = (item: NavItem) => {
    const path = getEffectivePath(item);
    if (path.startsWith('/')) navigate(path);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/pm-dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const visibleSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (workspace && item.path === '/dashboard' && location.pathname === '/dashboard') return false;
      if (item.roles && item.roles.length > 0) {
        const roleOk = user?.role && item.roles.includes(user.role);
        const headOk = item.alsoHeadPM && user?.isHeadPM;
        if (!roleOk && !headOk) return false;
      }
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  if (isMobile && !drawerOpen) {
    return (
      <button
        type="button"
        className="app-sidebar-toggle"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        aria-expanded={false}
      >
        <FaBars />
      </button>
    );
  }

  return (
    <>
      {isMobile && <div className="as-scrim" onClick={() => setDrawerOpen(false)} />}
      <aside className={`as-sidebar${isMobile ? ' as-mobile' : ''}`}>
        {isMobile && (
          <button type="button" className="as-close" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
            <FaTimes />
          </button>
        )}
        <div className="as-brand">
          <div className="as-brandmark" aria-hidden="true">K</div>
          <div>
            <div className="as-brandname">Katalyst PM</div>
            <div className="as-brandcaption">TEAM OPERATIONS</div>
          </div>
        </div>

        <nav className="as-nav" aria-label="Main">
          {workspace && (
            <>
              <div className="as-label">Workspace</div>
              {workspace.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`as-item${item.active ? ' active' : ''}`}
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => { item.onClick(); setDrawerOpen(false); }}
                >
                  {item.icon}
                  <span className="as-item-label">{item.label}</span>
                  {typeof item.count === 'number' && item.count > 0 && <span className="as-count">{item.count}</span>}
                </button>
              ))}
              {workspace.pinned && workspace.pinned.length > 0 && (
                <>
                  <div className="as-label">My active projects</div>
                  {workspace.pinned.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={`as-project${project.active ? ' active' : ''}`}
                      onClick={() => { project.onClick(); setDrawerOpen(false); }}
                    >
                      <i className="as-project-dot" style={{ background: project.color }} />
                      <span className="as-item-label">{project.label}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
          {visibleSections.map((section) => (
            <div key={section.title}>
              <div className="as-label">{section.title}</div>
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path + item.label}
                    type="button"
                    className={`as-item${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleNav(item)}
                  >
                    {item.icon}
                    <span className="as-item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="as-bottom">
          <button
            type="button"
            className={`as-item${isActive('/settings') ? ' active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <FaCog />
            <span className="as-item-label">Settings</span>
          </button>
          <button type="button" className="as-person" onClick={() => navigate('/profile')} title="Open your profile">
            <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size={34} color="#6555e9" />
            <span className="as-person-text">
              <b>{user?.name || 'User'}</b>
              <small>{user?.role || ''}</small>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
export { SIDEBAR_WIDTH };
