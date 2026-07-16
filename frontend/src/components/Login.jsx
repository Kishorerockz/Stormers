// src/components/Login.jsx
import React, { useState } from 'react';
import { Shield, KeyRound, Mail, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer'); // default role for register
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fillCredentials = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        // Register flow
        await api.register(email, password, role);
        // After register, perform automatic login
        const loginData = await api.login(email, password);
        onLoginSuccess(loginData);
      } else {
        // Login flow
        const loginData = await api.login(email, password);
        onLoginSuccess(loginData);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Shield size={48} className="brand-icon" />
          </div>
          <h2 className="auth-title">Aegis Deface</h2>
          <p className="auth-subtitle">
            {isRegisterMode 
              ? 'Register defensive account credentials' 
              : 'Sign in to access threat control center'}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '0.75rem',
            borderRadius: 'var(--input-radius)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Demo Roles Helper Banner */}
        {!isRegisterMode && (
          <div className="role-switcher-banner">
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Quick Sandbox Login:</span>
            <div>
              <button 
                type="button" 
                className="demo-credentials-btn" 
                onClick={() => fillCredentials('admin@aegis.io', 'password')}
              >
                Admin (Full Access)
              </button>
              <button 
                type="button" 
                className="demo-credentials-btn" 
                onClick={() => fillCredentials('viewer@aegis.io', 'password')}
              >
                Viewer (Read-Only)
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} 
              />
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="operator@aegis.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Access Credentials</label>
            <div style={{ position: 'relative' }}>
              <KeyRound 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} 
              />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">System Access Role</label>
              <select
                className="form-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="viewer">Viewer (Monitor & Audit Feed)</option>
                <option value="admin">Administrator (Trigger Actions & Resolve Alerts)</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading 
              ? 'Verifying...' 
              : isRegisterMode 
                ? 'Register & Establish Session' 
                : 'Authenticate Credentials'}
          </button>
        </form>

        <div className="auth-mode-toggle">
          {isRegisterMode ? (
            <span>
              Already have an operator profile?
              <span className="auth-mode-link" onClick={() => { setIsRegisterMode(false); setError(''); }}>
                Sign In
              </span>
            </span>
          ) : (
            <span>
              Need access credentials?
              <span className="auth-mode-link" onClick={() => { setIsRegisterMode(true); setError(''); }}>
                Create Profile
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
