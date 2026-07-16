// src/components/Settings.jsx
import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader,
  ShieldCheck,
  ExternalLink,
  Trash2,
  Info
} from 'lucide-react';
import { getLiveUrl } from '../services/api';

export default function Settings() {
  const [geminiKey, setGeminiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [keySource, setKeySource] = useState('backend'); // 'backend' | 'local'

  // On mount, check if a key was already saved locally (masked preview)
  useEffect(() => {
    const stored = localStorage.getItem('aegis_gemini_key_hint');
    if (stored) {
      setSavedKey(stored);
    }
  }, []);

  const maskKey = (key) => {
    if (!key || key.length < 8) return '••••••••';
    return key.substring(0, 4) + '•'.repeat(Math.max(key.length - 8, 8)) + key.substring(key.length - 4);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const trimmedKey = geminiKey.trim();
    if (!trimmedKey) {
      setStatus('error');
      setMessage('Please enter a valid API key.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      // POST to /settings/GEMINI_API_KEY on the live backend
      const baseUrl = getLiveUrl();
      const response = await fetch(`${baseUrl}/settings/GEMINI_API_KEY`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('aegis_token')
            ? { Authorization: `Bearer ${localStorage.getItem('aegis_token')}` }
            : {}),
        },
        body: JSON.stringify({ value: trimmedKey }),
      });

      if (!response.ok) {
        let detail = `Server error (${response.status})`;
        try {
          const err = await response.json();
          detail = err.detail || err.message || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      // Store a masked hint in localStorage for display purposes only (never the real key)
      localStorage.setItem('aegis_gemini_key_hint', maskKey(trimmedKey));
      setSavedKey(maskKey(trimmedKey));
      setGeminiKey('');
      setStatus('success');
      setMessage('Gemini API key saved successfully to the backend.');
      setKeySource('backend');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Failed to save the API key. Is the backend running?');
    }
  };

  const handleClear = () => {
    localStorage.removeItem('aegis_gemini_key_hint');
    setSavedKey('');
    setGeminiKey('');
    setStatus(null);
    setMessage('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '720px' }}>

      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
          System Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Configure AI credentials and integration keys for Aegis Deface.
        </p>
      </div>

      {/* Gemini API Key Card */}
      <div className="glass-card" style={{ padding: '1.75rem' }}>
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Key size={20} style={{ color: 'var(--accent-indigo)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '2px' }}>
              Gemini AI API Key
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Required for AI-powered defacement analysis and threat correlation
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div style={{
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
          marginBottom: '1.5rem'
        }}>
          <Info size={15} style={{ color: 'var(--accent-blue)', marginTop: '1px', flexShrink: 0 }} />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Your key is sent directly to the backend via <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' }}>POST /settings/GEMINI_API_KEY</code> and stored server-side.
            It is never persisted in your browser.{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-indigo)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
            >
              Get a key from Google AI Studio <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Currently Saved Key */}
        {savedKey && (
          <div style={{
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--severity-low)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--severity-low)', fontWeight: 600, display: 'block' }}>
                  Key Configured
                </span>
                <code style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em'
                }}>
                  {savedKey}
                </code>
              </div>
            </div>
            <button
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--severity-high)',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                flexShrink: 0
              }}
              title="Clear saved key hint"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              {savedKey ? 'Update Gemini API Key' : 'Enter Gemini API Key'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="form-input"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  if (status) { setStatus(null); setMessage(''); }
                }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  paddingRight: '2.75rem',
                  letterSpacing: showKey ? 'normal' : '0.1em'
                }}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
                tabIndex={-1}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Status Message */}
          {status && status !== 'loading' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              background: status === 'success'
                ? 'rgba(16,185,129,0.08)'
                : 'rgba(239,68,68,0.08)',
              border: `1px solid ${status === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: status === 'success' ? 'var(--severity-low)' : 'var(--severity-high)'
            }}>
              {status === 'success'
                ? <CheckCircle2 size={15} />
                : <AlertTriangle size={15} />}
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'loading' || !geminiKey.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {status === 'loading' ? (
                <>
                  <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Saving...
                </>
              ) : (
                <>
                  <Key size={15} />
                  {savedKey ? 'Update Key' : 'Save Key'}
                </>
              )}
            </button>

            {geminiKey && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => { setGeminiKey(''); setStatus(null); setMessage(''); }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* About / API Route Info Card */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={15} style={{ color: 'var(--text-muted)' }} />
          API Endpoint Reference
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { method: 'POST', path: '/settings/GEMINI_API_KEY', desc: 'Set or update the Gemini API key on the backend' },
          ].map(({ method, path, desc }) => (
            <div key={path} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.85rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: method === 'POST' ? 'var(--accent-indigo)' : 'var(--severity-low)',
                background: method === 'POST' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.1)',
                padding: '2px 7px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {method}
              </span>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {path}
              </code>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
