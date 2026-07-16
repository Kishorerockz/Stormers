// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Globe, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Eye, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard({ user }) {
  const [assets, setAssets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [scanningId, setScanningId] = useState(null);

  const isAdmin = user?.role === 'admin';

  const fetchData = async () => {
    try {
      const fetchedAssets = await api.getAssets();
      const fetchedAlerts = await api.getAlerts();
      setAssets(Array.isArray(fetchedAssets) ? fetchedAssets : []);
      setAlerts(Array.isArray(fetchedAlerts) ? fetchedAlerts : []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setAssets([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newUrl || !newLabel) return;
    setActionLoading(true);
    try {
      let formattedUrl = newUrl;
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }
      await api.addAsset(formattedUrl, newLabel, user.email);
      setNewUrl('');
      setNewLabel('');
      setShowAddModal(false);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to add asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!window.confirm('Are you sure you want to remove this asset? Related alerts will also be deleted.')) return;
    try {
      await api.deleteAsset(id, user.email);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete asset');
    }
  };

  const handleTriggerSnapshot = async (id) => {
    setScanningId(id);
    
    // Optimistically update status to checking
    setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'checking', last_snapshot_at: new Date().toISOString() } : a));
    
    try {
      await api.triggerSnapshot(id, user.email);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to capture snapshot');
    } finally {
      setScanningId(null);
    }
  };

  // Render mock thumbnail using high-tech inline styling (simulates headless capture preview)
  const renderMockThumbnail = (asset) => {
    const isFlagged = asset.status === 'flagged';
    const isChecking = asset.status === 'checking';
    const cleanGradient = 'linear-gradient(135deg, #111827 0%, #06b6d4 120%)';
    const flaggedGradient = 'linear-gradient(135deg, #1f121b 0%, #ef4444 140%)';
    const checkingGradient = 'linear-gradient(135deg, #111827 0%, #3b82f6 120%)';

    return (
      <div 
        className="asset-preview" 
        style={{ 
          background: isFlagged ? flaggedGradient : (isChecking ? checkingGradient : cleanGradient),
          transition: 'background 0.5s ease'
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.6) 100%)',
          zIndex: 1
        }}></div>

        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', textAlign: 'center', padding: '1rem' }}>
          {isChecking ? (
            <>
              <RefreshCw size={24} className="brand-icon" style={{ animation: 'spin 2s linear infinite', color: 'var(--status-checking)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-checking)', letterSpacing: '0.05em' }}>CAPTURING SNAPSHOT...</span>
            </>
          ) : isFlagged ? (
            <>
              <ShieldAlert size={28} style={{ color: 'var(--severity-high)', filter: 'drop-shadow(var(--glow-red))' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--severity-high)', letterSpacing: '0.05em' }}>DEFACEMENT DETECTED</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>AI SEVERITY: HIGH</span>
            </>
          ) : (
            <>
              <ShieldCheck size={28} style={{ color: 'var(--severity-low)', filter: 'drop-shadow(var(--glow-green))' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--severity-low)', letterSpacing: '0.05em' }}>SECURED</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>LAST SCAN STABLE</span>
            </>
          )}
        </div>

        {/* Small browser-mock address bar */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '4px',
          padding: '2px 8px',
          fontSize: '0.6rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          zIndex: 2
        }}>
          {asset.url}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <RefreshCw size={32} className="brand-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    );
  }

  // Stats calculation
  const totalAssets = assets.length;
  const flaggedAssets = assets.filter(a => a.status === 'flagged').length;
  const checkingAssets = assets.filter(a => a.status === 'checking').length;
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Summary Cards */}
      <section className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon">
            <Globe size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{totalAssets}</span>
            <span className="stat-label">Monitored Assets</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '3px solid var(--severity-high)' }}>
          <div className="stat-icon" style={{ color: 'var(--severity-high)', background: 'rgba(239, 68, 68, 0.05)' }}>
            <ShieldAlert size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value" style={{ color: 'var(--severity-high)' }}>{flaggedAssets}</span>
            <span className="stat-label">Flagged Websites</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '3px solid var(--status-checking)' }}>
          <div className="stat-icon" style={{ color: 'var(--status-checking)', background: 'rgba(59, 130, 246, 0.05)' }}>
            <RefreshCw size={24} style={{ animation: checkingAssets > 0 ? 'spin 3s linear infinite' : 'none' }} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{checkingAssets}</span>
            <span className="stat-label">Active Scans</span>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '3px solid var(--severity-medium)' }}>
          <div className="stat-icon" style={{ color: 'var(--severity-medium)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value" style={{ color: 'var(--severity-medium)' }}>{openAlerts}</span>
            <span className="stat-label">Open Alerts</span>
          </div>
        </div>
      </section>

      {/* Asset Header Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Web Assets Register</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Configured surveillance targets</p>
        </div>

        {isAdmin ? (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Register Asset
          </button>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            🔒 View-Only Session (Administrator role required to add assets)
          </div>
        )}
      </div>

      {/* Assets Grid */}
      <section className="assets-grid">
        {assets.map((asset) => (
          <div key={asset.id} className="glass-card asset-card">
            
            {/* Header */}
            <div className="asset-card-header">
              <div className="asset-label-group">
                <h4 className="asset-title" title={asset.label}>{asset.label}</h4>
                <p className="asset-url" title={asset.url}>{asset.url}</p>
              </div>

              {/* Status Badge */}
              {asset.status === 'clean' && <span className="badge badge-low"><ShieldCheck size={12} /> Clean</span>}
              {asset.status === 'flagged' && <span className="badge badge-high"><ShieldAlert size={12} /> Flagged</span>}
              {asset.status === 'checking' && <span className="badge badge-checking"><RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} /> Checking</span>}
            </div>

            {/* Simulated Headless Preview */}
            {renderMockThumbnail(asset)}

            {/* Timestamp */}
            <div className="asset-card-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={12} />
                <span>
                  {asset.last_snapshot_at 
                    ? `Scanned: ${new Date(asset.last_snapshot_at).toLocaleTimeString()}` 
                    : 'Not scanned yet'}
                </span>
              </div>

              {/* Controls - Admin Only */}
              {isAdmin && (
                <div className="asset-actions">
                  <button 
                    className="btn btn-secondary btn-small"
                    style={{ padding: '4px 8px' }}
                    onClick={() => handleTriggerSnapshot(asset.id)}
                    disabled={scanningId === asset.id || asset.status === 'checking'}
                    title="Run Defacement Check"
                  >
                    <RefreshCw size={12} style={{ animation: scanningId === asset.id ? 'spin 1.5s linear infinite' : 'none' }} />
                  </button>
                  <button 
                    className="btn btn-danger btn-small"
                    style={{ padding: '4px 8px' }}
                    onClick={() => handleDeleteAsset(asset.id)}
                    title="Remove Asset"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {assets.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: 'var(--card-radius)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            <Globe size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
            <p>No web assets registered. Add a site URL to start monitoring.</p>
          </div>
        )}
      </section>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem' }}>Register Monitored Asset</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddAsset}>
              <div className="form-group">
                <label className="form-label">Asset Tag/Label</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Corporate Billing Web"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Website URL</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. shop.company.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required 
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
