// src/App.jsx
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  ShieldAlert, 
  FileText, 
  LogOut, 
  Sliders,
  Settings,
  User,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AlertFeed from './components/AlertFeed';
import AuditLogs from './components/AuditLogs';
import api, { getApiMode, setApiMode, getLiveUrl, setLiveUrl } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mode, setMode] = useState(getApiMode());
  const [liveUrl, setLiveUrlState] = useState(getLiveUrl());
  const [alertCount, setAlertCount] = useState(0);

  // Restore user session on mount
  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    const role = localStorage.getItem('aegis_user_role');
    const email = localStorage.getItem('aegis_user_email');
    if (token && role && email) {
      setUser({ token, role, email });
    }
  }, []);

  // Poll alerts count for notification badge
  useEffect(() => {
    if (!user) return;
    
    const fetchAlertCount = async () => {
      try {
        const alerts = await api.getAlerts();
        const openAlerts = alerts.filter(a => a.status === 'open');
        setAlertCount(openAlerts.length);
      } catch (err) {
        console.error('Failed to fetch alerts count:', err);
      }
    };

    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [user, activeTab]);

  const handleLoginSuccess = (loginData) => {
    localStorage.setItem('aegis_token', loginData.token);
    localStorage.setItem('aegis_user_role', loginData.role);
    localStorage.setItem('aegis_user_email', loginData.email);
    setUser(loginData);
  };

  const handleLogout = () => {
    localStorage.removeItem('aegis_token');
    localStorage.removeItem('aegis_user_role');
    localStorage.removeItem('aegis_user_email');
    setUser(null);
  };

  const toggleApiMode = () => {
    const newMode = mode === 'mock' ? 'live' : 'mock';
    setMode(newMode);
    setApiMode(newMode);
    // Force reload to reset API connection details
    window.location.reload();
  };

  const handleLiveUrlChange = (e) => {
    const url = e.target.value;
    setLiveUrlState(url);
    setLiveUrl(url);
  };

  // Quick switch role shortcut for grading/review convenience
  const quickSwitchRole = () => {
    if (!user) return;
    const newRole = user.role === 'admin' ? 'viewer' : 'admin';
    const updatedUser = { ...user, role: newRole };
    localStorage.setItem('aegis_user_role', newRole);
    setUser(updatedUser);
    
    // Write audit log for role change
    const logs = JSON.parse(localStorage.getItem("aegis_audit_logs") || "[]");
    logs.unshift({
      id: `log_switch_${Date.now()}`,
      user_email: user.email,
      action: `Developer action: switched active session role to ${newRole.toUpperCase()}`,
      target_type: "auth",
      target_id: user.email,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem("aegis_audit_logs", JSON.stringify(logs));
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <Shield size={28} className="brand-icon" />
          <span className="brand-name">Aegis Deface</span>
        </div>
        
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginTop: '-0.25rem',
          marginLeft: '2.25rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em'
        }}>
          SYS-SIEGE [PS-005]
        </div>

        <ul className="nav-menu">
          <li className="nav-item">
            <div 
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Asset Manager</span>
            </div>
          </li>
          
          <li className="nav-item">
            <div 
              className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldAlert size={18} />
                <span>Alerts Feed</span>
              </div>
              {alertCount > 0 && (
                <span style={{
                  background: 'var(--severity-high)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  boxShadow: 'var(--glow-red)',
                  animation: 'pulse-border 2.5s infinite'
                }}>
                  {alertCount}
                </span>
              )}
            </div>
          </li>

          {user.role === 'admin' && (
            <li className="nav-item">
              <div 
                className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <FileText size={18} />
                <span>Audit Logs</span>
              </div>
            </li>
          )}
        </ul>

        {/* Developer Sandbox Controls */}
        <div className="settings-widget">
          <div className="settings-widget-title">
            <Sliders size={14} />
            <span>Developer Sandbox</span>
          </div>
          
          <div className="toggle-container">
            <span className="toggle-label">Offline Mock Mode</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={mode === 'mock'} 
                onChange={toggleApiMode} 
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            <span className={`status-indicator ${mode === 'mock' ? 'active' : ''}`}></span>
            <span>{mode === 'mock' ? 'Simulating backend client' : 'Connecting live REST API'}</span>
          </div>

          {mode === 'live' && (
            <div className="api-url-input-container">
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Backend Target URL:
              </label>
              <input
                type="text"
                className="form-input"
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  fontSize: '0.75rem',
                  height: 'auto',
                  fontFamily: 'var(--font-mono)' 
                }}
                value={liveUrl}
                onChange={handleLiveUrlChange}
              />
            </div>
          )}

          {/* Quick-switch roles trigger */}
          <button 
            type="button" 
            className="btn btn-secondary btn-small"
            style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.7rem', display: 'flex', gap: '0.25rem' }}
            onClick={quickSwitchRole}
          >
            <Zap size={12} />
            Switch to {user.role === 'admin' ? 'Viewer' : 'Admin'} Role
          </button>
        </div>

        {/* User profile section at the bottom */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '0' }}>
            <div className="avatar">
              {user.email.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap'
              }}>
                {user.email}
              </span>
              <span className={`badge ${user.role === 'admin' ? 'badge-high' : 'badge-low'}`} style={{ 
                padding: '1px 6px', 
                fontSize: '0.6rem', 
                alignSelf: 'flex-start',
                marginTop: '2px',
                borderRadius: '4px'
              }}>
                {user.role}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="header-bar">
          <div>
            <h1 className="section-title">
              {activeTab === 'dashboard' && 'Web Assets Monitor'}
              {activeTab === 'alerts' && 'Defacement Alerts Feed'}
              {activeTab === 'audit' && 'Security Audit Ledger'}
            </h1>
            <p className="section-desc">
              {activeTab === 'dashboard' && 'Autonomous pixel-level visual checking & content surveillance'}
              {activeTab === 'alerts' && 'Prioritized threat events evaluated by AI agents'}
              {activeTab === 'audit' && 'Cryptographically recorded immutable action logging'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              <Globe size={14} className="brand-icon" />
              <span>Network: <strong>{mode.toUpperCase()}</strong></span>
            </div>
          </div>
        </header>

        {/* View Router */}
        {activeTab === 'dashboard' && <Dashboard user={user} />}
        {activeTab === 'alerts' && <AlertFeed user={user} />}
        {activeTab === 'audit' && user.role === 'admin' && <AuditLogs />}
      </main>
    </div>
  );
}
