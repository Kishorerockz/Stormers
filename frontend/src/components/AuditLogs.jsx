// src/components/AuditLogs.jsx
import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Filter, Calendar } from 'lucide-react';
import api from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'auth' | 'asset' | 'alert'
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs based on search term and target type
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' ? true : log.target_type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Search and Filters Bar */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search 
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
            type="text"
            className="form-input"
            style={{ paddingLeft: '40px' }}
            placeholder="Search logs by operator email, action or target..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <select
            className="form-input"
            style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Logs</option>
            <option value="auth">Auth Audits</option>
            <option value="asset">Asset Changes</option>
            <option value="alert">Alert Decisions</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button 
          className="btn btn-secondary" 
          onClick={fetchLogs}
          disabled={loading}
          title="Refresh Log Feed"
          style={{ padding: '0.65rem' }}
        >
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <RefreshCw size={32} className="brand-icon" style={{ animation: 'spin 2s linear infinite' }} />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Timestamp</th>
                <th style={{ width: '220px' }}>Operator Email</th>
                <th style={{ width: '100px' }}>Target Type</th>
                <th>Detailed Action Performed</th>
                <th style={{ width: '120px' }}>Target ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                let tagColor = 'var(--text-muted)';
                if (log.target_type === 'auth') tagColor = 'var(--accent-indigo)';
                if (log.target_type === 'asset') tagColor = 'var(--accent-cyan)';
                if (log.target_type === 'alert') tagColor = 'var(--severity-high)';

                return (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.user_email}</span>
                    </td>
                    <td>
                      <span 
                        className="log-action-badge" 
                        style={{ 
                          color: tagColor, 
                          background: `rgba(${tagColor === 'var(--accent-indigo)' ? '99, 102, 241' : (tagColor === 'var(--accent-cyan)' ? '6, 182, 212' : '239, 68, 68')}, 0.08)`,
                          border: `1px solid rgba(${tagColor === 'var(--accent-indigo)' ? '99, 102, 241' : (tagColor === 'var(--accent-cyan)' ? '6, 182, 212' : '239, 68, 68')}, 0.15)`
                        }}
                      >
                        {log.target_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {log.action}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.target_id}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No audit records match the active filters or search terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
