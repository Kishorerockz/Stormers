// src/components/AlertFeed.jsx
import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  AlertOctagon, 
  Clock, 
  Compass, 
  Flame, 
  CheckCircle2, 
  MinusCircle,
  HelpCircle,
  FileCode,
  Cpu,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

export default function AlertFeed({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('open'); // 'open' | 'reviewed' | 'dismissed' | 'all'
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  const fetchAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismiss = async (id) => {
    try {
      await api.dismissAlert(id, user.email);
      await fetchAlerts();
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert');
    }
  };

  const handleReview = async (id) => {
    try {
      await api.reviewAlert(id, user.email);
      await fetchAlerts();
    } catch (err) {
      alert(err.message || 'Failed to review alert');
    }
  };

  // Severity ordering weights (High -> Medium -> Low)
  const getSeverityWeight = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  };

  // Process, filter and sort alerts
  const processedAlerts = (Array.isArray(alerts) ? alerts : [])
    .filter(a => a && (filterStatus === 'all' ? true : a.status === filterStatus))
    .sort((a, b) => {
      if (!a || !b) return 0;
      // 1. Sort by severity (high to low)
      const severityDiff = getSeverityWeight(b.severity) - getSeverityWeight(a.severity);
      if (severityDiff !== 0) return severityDiff;
      // 2. Sort by creation time (latest first)
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });

  // Render before & after screenshot mocks dynamically inside the browser!
  const renderDynamicScreenshot = (assetId, isAfter, label) => {
    const isShopAdmin = label?.includes('Backoffice') || assetId?.includes('asset_2');
    
    if (isShopAdmin) {
      if (!isAfter) {
        // Clean Backoffice Portal Mock
        return (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#1f2937',
            padding: '12px',
            fontSize: '9px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#d1d5db',
            fontFamily: 'sans-serif'
          }}>
            {/* Header bar mock */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #374151', paddingBottom: '4px', color: '#10b981', fontWeight: 'bold' }}>
              <span>🛒 Shop Admin Portal v2.4</span>
              <span style={{ color: '#10b981' }}>● ONLINE</span>
            </div>
            {/* Mock stats blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ background: '#374151', padding: '4px', borderRadius: '3px' }}>
                <span style={{ color: '#9ca3af' }}>Revenue</span>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>$24,850</div>
              </div>
              <div style={{ background: '#374151', padding: '4px', borderRadius: '3px' }}>
                <span style={{ color: '#9ca3af' }}>Orders</span>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>142 active</div>
              </div>
            </div>
            {/* Content paragraph */}
            <div style={{ color: '#9ca3af', lineHeight: '1.2' }}>
              Welcome back, Admin. System is running at nominal levels. All sync pipelines active.
            </div>
          </div>
        );
      } else {
        // Defaced Backoffice Portal Mock
        return (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#090101',
            padding: '12px',
            fontSize: '9px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            color: '#ef4444',
            fontFamily: 'monospace',
            border: '1px solid rgba(239,68,68,0.3)'
          }}>
            {/* Defaced Header */}
            <div style={{ 
              color: '#ef4444', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              borderBottom: '1px solid rgba(239,68,68,0.3)',
              paddingBottom: '4px',
              animation: 'pulse-border 1.5s infinite',
              textShadow: '0 0 5px rgba(239,68,68,0.6)'
            }}>
              🚨 HACKED BY SYSTEM SIEGE 🚨
            </div>
            {/* Extortion Notice */}
            <div style={{ textAlign: 'center', color: '#fff', fontSize: '8px', background: '#250303', padding: '6px', borderRadius: '3px', border: '1px dashed #ef4444' }}>
              SYSTEM SIEGE WAS HERE.
              <br/>
              YOUR CATALOG DATABASES ENCRYPTED.
            </div>
            <div style={{ fontSize: '8px', color: '#9ca3af', lineHeight: '1.1' }}>
              [-] 142 orders deleted.
              <br/>
              [-] Customer tables exported to public repository.
              <br/>
              [-] Admin keys revoked.
            </div>
            <div style={{ color: '#eab308', fontWeight: 'bold', textAlign: 'center', fontSize: '7.5px', marginTop: 'auto' }}>
              ⏰ TIME REMAINING: 47:59:12
            </div>
          </div>
        );
      }
    } else {
      // General Corporate Landing page mock
      if (!isAfter) {
        return (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#111827',
            padding: '12px',
            fontSize: '9px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#9ca3af',
            fontFamily: 'sans-serif'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1f2937', paddingBottom: '4px', color: '#f3f4f6', fontWeight: 600 }}>
              <span>🏢 Corp Landing Homepage</span>
              <span>Home | Services | Contact</span>
            </div>
            <div style={{ height: '35px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              [ Hero Banner Image ]
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontWeight: 600, color: '#f3f4f6' }}>About Aegis Enterprise</div>
              <div style={{ fontSize: '8px' }}>Providing secure cloud architecture solutions since 2018.</div>
            </div>
          </div>
        );
      } else {
        return (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#0d0d16',
            padding: '12px',
            fontSize: '9px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#ef4444',
            fontFamily: 'sans-serif',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '4px', color: '#ef4444', fontWeight: 600 }}>
              <span>🏢 Corp Landing Homepage</span>
              <span style={{ color: '#eab308' }}>⚠️ TAMPERED</span>
            </div>
            
            {/* Defaced banner placeholder */}
            <div style={{ height: '35px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontWeight: 'bold', fontSize: '8px' }}>
              [ DOWN FOR MAINTENANCE ]
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontWeight: 600, color: '#ef4444' }}>Unauthorized Notice:</div>
              <div style={{ fontSize: '7.5px', color: '#9ca3af' }}>
                <span style={{ color: '#eab308' }}>Injected:</span> suspicious payload redirection.
              </div>
            </div>
            
            {/* Mock malware script indicator */}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              fontSize: '6px',
              fontFamily: 'monospace',
              color: '#f87171',
              background: '#1e1b4b',
              padding: '2px 4px',
              borderRadius: '2px'
            }}>
              &lt;script src="https://spam.ru/pay"&gt;
            </div>
          </div>
        );
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <RefreshCw size={32} className="brand-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Filters Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Tabs */}
        <div className="tabs-header" style={{ marginBottom: 0 }}>
          <button 
            className={`tab-btn ${filterStatus === 'open' ? 'active' : ''}`}
            onClick={() => setFilterStatus('open')}
          >
            Open Alerts ({alerts.filter(a => a.status === 'open').length})
          </button>
          <button 
            className={`tab-btn ${filterStatus === 'reviewed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('reviewed')}
          >
            Reviewed ({alerts.filter(a => a.status === 'reviewed').length})
          </button>
          <button 
            className={`tab-btn ${filterStatus === 'dismissed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('dismissed')}
          >
            Dismissed ({alerts.filter(a => a.status === 'dismissed').length})
          </button>
          <button 
            className={`tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All Alerts ({alerts.length})
          </button>
        </div>

        {/* View status text */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{processedAlerts.length}</strong> threat indicators (Sorted: Severity High → Low)
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="alerts-list">
        {processedAlerts.map((alert) => {
          const isHigh = alert.severity?.toLowerCase() === 'high';
          const isMedium = alert.severity?.toLowerCase() === 'medium';
          
          return (
            <div 
              key={alert.id} 
              className={`glass-card alert-item ${isHigh ? 'severity-high' : (isMedium ? 'severity-medium' : 'severity-low')}`}
            >
              
              {/* Alert Header */}
              <div className="alert-item-header">
                <div className="alert-meta">
                  {isHigh ? (
                    <AlertOctagon size={24} style={{ color: 'var(--severity-high)', filter: 'drop-shadow(var(--glow-red))' }} />
                  ) : (
                    <ShieldAlert size={24} style={{ color: isMedium ? 'var(--severity-medium)' : 'var(--severity-low)' }} />
                  )}
                  
                  <div className="alert-site-info">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{alert.asset_label}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {alert.asset_url}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${isHigh ? 'badge-high' : (isMedium ? 'badge-medium' : 'badge-low')}`}>
                    {alert.severity} Risk
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Clock size={12} />
                    <span>{new Date(alert.created_at).toLocaleTimeString()} ({new Date(alert.created_at).toLocaleDateString()})</span>
                  </div>
                </div>
              </div>

              {/* Visual Diff: Before & After Screens */}
              <div className="diff-container">
                <div className="diff-image-box">
                  <div className="diff-image-title">Reference Snapshot (Clean State)</div>
                  <div className="diff-image-wrapper">
                    {renderDynamicScreenshot(alert.asset_id, false, alert.asset_label)}
                    <span className="diff-overlay-tag" style={{ color: 'var(--severity-low)' }}>SECURE REF</span>
                  </div>
                </div>

                <div className="diff-image-box">
                  <div className="diff-image-title">Tampered Snapshot (Visual Shift: {alert.diff_score}%)</div>
                  <div className="diff-image-wrapper">
                    {renderDynamicScreenshot(alert.asset_id, true, alert.asset_label)}
                    <span className="diff-overlay-tag" style={{ color: 'var(--severity-high)' }}>FLAGGED DIFF</span>
                  </div>
                </div>
              </div>

              {/* Text Diff (DOM Changes snippet) */}
              {alert.diff_text && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div className="diff-stats-text">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FileCode size={14} />
                      DOM Code Mutations:
                    </span>
                    <span style={{ color: 'var(--severity-low)' }}>+{alert.diff_text?.added_lines} additions</span>
                    <span style={{ color: 'var(--severity-high)' }}>-{alert.diff_text?.removed_lines} deletions</span>
                  </div>

                  <div className="text-diff-box">
                    {alert.diff_text?.removed_sample?.map((line, idx) => (
                      <div key={`rem-${idx}`} className="diff-line diff-line-removed">{line}</div>
                    ))}
                    {alert.diff_text?.added_sample?.map((line, idx) => (
                      <div key={`add-${idx}`} className="diff-line diff-line-added">{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis and Recommendations */}
              <div className="ai-report-box">
                <div className="ai-report-title">
                  <Cpu size={16} />
                  <span>Generative Threat Assessment (LLM Correlated)</span>
                </div>
                <div className="ai-explanation">
                  {alert.ai_explanation}
                </div>
                <div className="ai-remediation">
                  <span className="remediation-label">Immediate Action Plan:</span>
                  {alert.ai_recommended_action}
                </div>
              </div>

              {/* Action Buttons - Admin Only */}
              {alert.status === 'open' && (
                <div className="alert-actions-row">
                  {isAdmin ? (
                    <>
                      <button 
                        className="btn btn-secondary btn-small"
                        onClick={() => handleDismiss(alert.id)}
                      >
                        <MinusCircle size={14} />
                        Dismiss False Alert
                      </button>
                      <button 
                        className="btn btn-primary btn-small"
                        style={{ color: '#fff', background: 'var(--accent-indigo)', borderColor: 'rgba(99,102,241,0.3)' }}
                        onClick={() => handleReview(alert.id)}
                      >
                        <CheckCircle2 size={14} />
                        Mark as Reviewed
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      🔒 Admin account privilege required to resolve alerts
                    </span>
                  )}
                </div>
              )}

              {alert.status !== 'open' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '1rem' }}>
                  Event resolved and marked as {alert.status.toUpperCase()}
                </div>
              )}

            </div>
          );
        })}

        {processedAlerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: 'var(--card-radius)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={48} style={{ color: 'var(--severity-low)', marginBottom: '0.75rem', filter: 'drop-shadow(var(--glow-green))' }} />
            <h3>All systems green!</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No open defacement alerts registered for this category.</p>
          </div>
        )}
      </div>

    </div>
  );
}
