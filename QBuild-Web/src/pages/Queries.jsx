import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { queryApi } from '../services/api';
import '../styles/Queries.css';

const PAGE_SIZE = 25;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="pagination">
      <button className="pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} title="First">&laquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>&lsaquo;</button>
      {start > 1 && <span className="pagination-ellipsis">...</span>}
      {pages.map(p => (
        <button key={p} className={`pagination-btn ${p === currentPage ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
      ))}
      {end < totalPages && <span className="pagination-ellipsis">...</span>}
      <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>&rsaquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} title="Last">&raquo;</button>
      <span className="pagination-info">Page {currentPage} of {totalPages}</span>
    </div>
  );
};

const Queries = () => {
  const { isManager } = useAuth();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ text: '' });
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await queryApi.getAll(1, 10000);
      setQueries(response?.data || []);
    } catch (e) {
      setError(e.message || 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueries(); }, []);

  const filteredQueries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return queries;
    return queries.filter(query => (query.text || '').toLowerCase().includes(q));
  }, [queries, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredQueries.length / PAGE_SIZE));
  const paginatedQueries = filteredQueries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const handleCreate = () => { setFormData({ text: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (query) => { setFormData({ text: query.text }); setEditingId(query.id); setShowForm(true); };

  const handleSave = async () => {
    if (!formData.text.trim()) { setError('Query text is required'); return; }
    try {
      setLoading(true); setError(null);
      if (editingId) { await queryApi.update(editingId, formData); }
      else { await queryApi.create(formData); }
      setShowForm(false); setFormData({ text: '' }); setEditingId(null);
      await loadQueries();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this query?')) return;
    try { setLoading(true); setError(null); await queryApi.delete(id); await loadQueries(); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="queries-container">
      <div className="queries-header">
        <h1 className="queries-title">Queries Management</h1>
        <p className="queries-subtitle">Manage all inspection queries independently</p>
        {!isManager && (
          <button className="btn btn-primary" onClick={handleCreate}>+ New Query</button>
        )}
      </div>

      <div className="queries-search">
        <input className="search-input" placeholder="Search queries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        {error && <div style={{ marginTop: '12px', color: 'var(--error-700)' }}>{error}</div>}
      </div>

      {loading ? (
        <div className="queries-loading">Loading...</div>
      ) : queries.length === 0 ? (
        <div className="queries-empty">
          <h2>No queries found</h2>
          <p>Create queries to build your inspection checklist library.</p>
        </div>
      ) : (
        <>
          <div className="queries-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Query Text</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQueries.map((query) => (
                  <tr key={query.id}>
                    <td>{query.text}</td>
                    <td>
                      {!isManager ? (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(query)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(query.id)}>Delete</button>
                        </>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>Read-only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}

      {showForm && (
        <div className="modal-overlay" style={{ pointerEvents: 'none' }}>
          <div className="modal-content" style={{ pointerEvents: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Query' : 'Create New Query'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setError(null); }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="query-text" className="form-label">Query Text *</label>
                <textarea id="query-text" name="text" required rows={3} className="form-textarea" placeholder="Enter query text" value={formData.text} onChange={(e) => setFormData({...formData, text: e.target.value})} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setError(null); }} className="btn btn-secondary">Cancel</button>
              <button type="button" onClick={handleSave} className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : (editingId ? 'Update Query' : 'Create Query')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queries;