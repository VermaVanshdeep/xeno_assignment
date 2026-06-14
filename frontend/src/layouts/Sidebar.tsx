import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface UserInfo {
  name: string;
  email: string;
  workspace: string;
  role: string;
}

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load user data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("xeno_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse xeno_user from localStorage", e);
      }
    }
  }, []);

  const displayUser = user || {
    name: "User",
    email: "user@company.com",
    workspace: localStorage.getItem("xeno_workspace") || "Xeno Production",
    role: "Workspace Admin"
  };

  const getInitials = (name: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    const firstChar = parts[0][0] || '';
    const lastChar = parts[parts.length - 1][0] || '';
    return (firstChar + lastChar).toUpperCase();
  };

  const initials = getInitials(displayUser.name);

  // Close when clicking outside and on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem("xeno_auth");
    localStorage.removeItem("xeno_user");
    localStorage.removeItem("xeno_workspace");
    setIsOpen(false);
    navigate("/login");
  };

  const handleSwitchWorkspace = (workspaceName: string) => {
    localStorage.setItem("xeno_workspace", workspaceName);
    const storedUser = localStorage.getItem("xeno_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        parsed.workspace = workspaceName;
        localStorage.setItem("xeno_user", JSON.stringify(parsed));
      } catch (e) {}
    }
    setIsOpen(false);
    window.location.reload();
  };

  const menuItems: SidebarItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    {
      label: 'Customers',
      path: '/customers',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      label: 'Segments',
      path: '/segments',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 21v-7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v7" />
          <circle cx="12" cy="6" r="3" />
        </svg>
      )
    },
    {
      label: 'Campaigns',
      path: '/campaigns',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    },
    {
      label: 'Analytics',
      path: '/analytics',
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      )
    },
    {
      label: 'Xeno Assistant',
      path: '/copilot',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-dot"></div>
          Xeno CRM
        </div>
      </div>
      
      <ul className="sidebar-menu">
        {menuItems.map((item, idx) => (
          <li key={idx}>
            <NavLink 
              to={item.path} 
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      
      <div 
        ref={dropdownRef}
        className={`sidebar-footer ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
      >
        <div className="sidebar-avatar">
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="text-body font-semibold" style={{ lineHeight: 1.2 }}>{displayUser.name}</span>
          <span className="text-label" style={{ textTransform: 'none', fontSize: '10px', color: 'var(--accent-blue)' }}>{displayUser.workspace}</span>
        </div>
        
        {/* Chevron SVG */}
        <svg 
          className="sidebar-footer-chevron" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>

        {/* Dropdown Menu */}
        <div
          className={`sidebar-profile-dropdown ${isOpen ? 'open' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* User info */}
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #4F8CFF 0%, #7C5CFF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: '#fff',
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>{displayUser.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{displayUser.email}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: displayUser.workspace === 'Xeno Production'
                  ? 'rgba(16,185,129,0.1)' : displayUser.workspace === 'Xeno Staging'
                  ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                color: displayUser.workspace === 'Xeno Production'
                  ? '#10B981' : displayUser.workspace === 'Xeno Staging'
                  ? '#F59E0B' : '#8B5CF6',
                border: `1px solid ${displayUser.workspace === 'Xeno Production'
                  ? 'rgba(16,185,129,0.2)' : displayUser.workspace === 'Xeno Staging'
                  ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)'}`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.8 }}/>
                {displayUser.workspace === 'Xeno Production' ? 'Production' : displayUser.workspace === 'Xeno Staging' ? 'Staging' : 'Demo'}
              </span>
            </div>
          </div>

          {/* Workspace switcher */}
          <div style={{ padding: '8px 8px 4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 6px 6px' }}>
              Switch Workspace
            </div>
            {[
              { id: 'Xeno Production', label: 'Production', desc: 'Live Environment',    color: '#10B981' },
              { id: 'Xeno Staging',    label: 'Staging',    desc: 'Testing Environment', color: '#F59E0B' },
              { id: 'Xeno Demo',       label: 'Demo',       desc: 'Sandbox Environment', color: '#8B5CF6' },
            ].map(ws => (
              <button key={ws.id} type="button"
                onClick={(e) => { e.stopPropagation(); handleSwitchWorkspace(ws.id); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  background: displayUser.workspace === ws.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none', borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => { if (displayUser.workspace !== ws.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = displayUser.workspace === ws.id ? 'rgba(255,255,255,0.05)' : 'transparent'; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ws.color, flexShrink: 0, boxShadow: `0 0 6px ${ws.color}60` }}/>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>{ws.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>{ws.desc}</div>
                </div>
                {displayUser.workspace === ws.id && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ws.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Footer: logout + version */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 8px 10px', marginTop: 4 }}>
            <button className="dropdown-item dropdown-item-danger" onClick={handleLogout}
              style={{ width: '100%', borderRadius: 8, padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 8, fontWeight: 500 }}>
              Xeno CRM v1.0 · Enterprise
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
