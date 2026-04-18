import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaClock,
  FaFolderOpen,
  FaCalendarDay,
  FaUser,
  FaCog,
  FaStickyNote,
  FaBullseye,
  FaFlag,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import UserAvatar from './UserAvatar';
import './Dashboard.css';

const SIDEBAR_WIDTH = 260;

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[]; // if set, only show for these roles
  /** When true, Head PM (isHeadPM) may see this item even if roles is PM-only */
  alsoHeadPM?: boolean;
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'WORK',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaHome /> },
      { path: '/timeline', label: 'My Timeline', icon: <FaClock /> },
      { path: '/my-projects', label: 'My Projects', icon: <FaFolderOpen /> },
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
      { path: '/department-view/copy-writing', label: 'Copy Writing Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/designer', label: 'Design Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/developer', label: 'Development Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/ai-developer', label: 'AI Dev Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/social-media', label: 'Social Media Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/crm', label: 'CRM Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
      { path: '/department-view/seo-geo', label: 'SEO/GEO Board', icon: <FaFlag />, roles: ['Project Manager'], alsoHeadPM: true },
    ],
  },
  {
    title: 'TALK',
    items: [
      { path: '/forum', label: 'Forum', icon: <FaStickyNote /> },
    ],
  },
  {
    title: 'ME',
    items: [
      { path: '/profile', label: 'Profile', icon: <FaUser /> },
      { path: '/settings', label: 'Settings', icon: <FaCog /> },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getUser();

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
      if (item.roles && item.roles.length > 0) {
        const roleOk = user?.role && item.roles.includes(user.role);
        const headOk = item.alsoHeadPM && user?.isHeadPM;
        if (!roleOk && !headOk) return false;
      }
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100vh',
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        left: 0,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* User block at top */}
      <div
        style={{
          padding: '1.5rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UserAvatar
            name={user?.name}
            avatarUrl={user?.avatarUrl}
            size={40}
            color="#6366f1"
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
              {user?.role || ''}
            </div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
        {visibleSections.map((section) => (
          <div key={section.title} style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0 0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path + item.label}
                  type="button"
                  onClick={() => handleNav(item)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    marginBottom: '0.25rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: active ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    color: active ? 'white' : 'rgba(255,255,255,0.85)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                    }
                  }}
                >
                  <span style={{ fontSize: '1rem', opacity: 0.95 }}>{item.icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
export { SIDEBAR_WIDTH };
