import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAuthHook from '../hooks/useAuth';
import '../styles/Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, handleLogout } = useAuthHook();

  const handleNavigation = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  
  const handleUserMenuToggle = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  const handleLogoutClick = () => {
    handleLogout();
    navigate('/login');
    setUserMenuOpen(false);
  };

  const isActiveRoute = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="layout-container">
      {/* Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div>
              <h1 className="sidebar-title">QBuild</h1>
          
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {user?.role === 'reviewer' ? (
            // Reviewer - show inspections and dashboard
            <div className="sidebar-nav-section">
              <h3 className="sidebar-nav-title">Reviewer</h3>
              <ul className="sidebar-nav-list">
                <li className="sidebar-nav-item">
                  <a
                    href="/reviewer-dashboard"
                    className={`sidebar-nav-link ${isActiveRoute('/reviewer-dashboard') ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation('/reviewer-dashboard');
                    }}
                  >
                    <span className="sidebar-nav-text">Inspections</span>
                  </a>
                </li>
              </ul>
            </div>
          ) : user?.role === 'manager' ? (
            <React.Fragment>
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">Manager</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a
                      href="/manager-dashboard"
                      className={`sidebar-nav-link ${isActiveRoute('/manager-dashboard') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/manager-dashboard');
                      }}
                    >
                      <span className="sidebar-nav-text">Inspections</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/dashboard"
                      className={`sidebar-nav-link ${isActiveRoute('/dashboard') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/dashboard');
                      }}
                    >
                      <span className="sidebar-nav-text">Dashboard</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/projects"
                      className={`sidebar-nav-link ${isActiveRoute('/projects') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/projects');
                      }}
                    >
                      <span className="sidebar-nav-text">Projects</span>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">Library (Read-only)</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a
                      href="/domains"
                      className={`sidebar-nav-link ${isActiveRoute('/domains') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/domains');
                      }}
                    >
                      <span className="sidebar-nav-text">Domains</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/sub-domains"
                      className={`sidebar-nav-link ${isActiveRoute('/sub-domains') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/sub-domains');
                      }}
                    >
                      <span className="sidebar-nav-text">Sub-Domains</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/queries"
                      className={`sidebar-nav-link ${isActiveRoute('/queries') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/queries');
                      }}
                    >
                      <span className="sidebar-nav-text">Queries</span>
                    </a>
                  </li>
                </ul>
              </div>
            </React.Fragment>
          ) : user?.role === 'viewer' ? (
            // Viewer - only show dashboard
            <div className="sidebar-nav-section">
              <h3 className="sidebar-nav-title">Viewer</h3>
              <ul className="sidebar-nav-list">
                <li className="sidebar-nav-item">
                  <a
                    href="/dashboard"
                    className={`sidebar-nav-link ${isActiveRoute('/dashboard') ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation('/dashboard');
                    }}
                  >
                    <span className="sidebar-nav-text">Dashboard</span>
                  </a>
                </li>
              </ul>
            </div>
          ) : (
            // Admin - show all navigation
            <>
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">Main</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a
                      href="/dashboard"
                      className={`sidebar-nav-link ${isActiveRoute('/dashboard') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/dashboard');
                      }}
                    >
                      <span className="sidebar-nav-text">Dashboard</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/projects"
                      className={`sidebar-nav-link ${isActiveRoute('/projects') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/projects');
                      }}
                    >
                      <span className="sidebar-nav-text">Projects</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/reports"
                      className={`sidebar-nav-link ${isActiveRoute('/reports') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/reports');
                      }}
                    >
                      <span className="sidebar-nav-text">Reports</span>
                    </a>
                  </li>
                </ul>
              </div>
              
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">Library</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a
                      href="/domains"
                      className={`sidebar-nav-link ${isActiveRoute('/domains') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/domains');
                      }}
                    >
                      <span className="sidebar-nav-text">Domains</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/sub-domains"
                      className={`sidebar-nav-link ${isActiveRoute('/sub-domains') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/sub-domains');
                      }}
                    >
                      <span className="sidebar-nav-text">Sub-Domains</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a
                      href="/queries"
                      className={`sidebar-nav-link ${isActiveRoute('/queries') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/queries');
                      }}
                    >
                      <span className="sidebar-nav-text">Queries</span>
                    </a>
                  </li>
                </ul>
              </div>
              
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">Management</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a
                      href="/users"
                      className={`sidebar-nav-link ${isActiveRoute('/users') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/users');
                      }}
                    >
                      <span className="sidebar-nav-text">Users</span>
                    </a>
                  </li>
                </ul>
              </div>
              
              <div className="sidebar-nav-section">
                <h3 className="sidebar-nav-title">System</h3>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <a 
                      href="/settings" 
                      className={`sidebar-nav-link ${isActiveRoute('/settings') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/settings');
                      }}
                    >
                      <span className="sidebar-nav-text">Settings</span>
                    </a>
                  </li>
                  <li className="sidebar-nav-item">
                    <a 
                      href="/help" 
                      className={`sidebar-nav-link ${isActiveRoute('/help') ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation('/help');
                      }}
                    >
                      <span className="sidebar-nav-icon">?</span>
                      <span className="sidebar-nav-text">Help & Support</span>
                    </a>
                  </li>
                </ul>
              </div>
            </>
          )}
        </nav>
        
        {/* User Section at bottom of sidebar */}
        <div className="sidebar-user-section">
          <div className="sidebar-user" onClick={handleUserMenuToggle}>
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name || 'Admin User'}</div>
              <div className="sidebar-user-role">{user?.role || 'Administrator'}</div>
            </div>
            
            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="sidebar-user-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-user-name">{user?.name || 'Admin User'}</div>
                  <div className="dropdown-user-email">{user?.email || 'admin@qrating.com'}</div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => navigate('/settings')}>
                  Settings
                </button>
                <button className="dropdown-item" onClick={() => navigate('/profile')}>
                  Profile
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item logout" onClick={handleLogoutClick}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Mobile Toggle - now in main content area */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <span>☰</span>
        </button>
        
        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
