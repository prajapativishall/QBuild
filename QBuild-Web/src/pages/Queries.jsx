import React, { useState, useEffect } from 'react';
import { queryApi } from '../services/api';
import '../styles/Queries.css';

const Queries = () => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ text: '' });
  const [editingId, setEditingId] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const loadQueries = async (page = 1, limit = pagination.limit) => {
    try {
      setLoading(true);
      setError(null);
      const response = await queryApi.getAll(page, limit);
      setQueries(response?.data || []);
      setPagination(response?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e) {
      setError(e.message || 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit) }));
    loadQueries(1, parseInt(newLimit));
  };

  useEffect(() => {
    loadQueries();
  }, []);

  const handleCreate = () => {
    setFormData({ text: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (query) => {
    setFormData({
      text: query.text
    });
    setEditingId(query.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.text.trim()) {
      setError('Query text is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (editingId) {
        await queryApi.update(editingId, formData);
      } else {
        await queryApi.create(formData);
      }
      setShowForm(false);
      setFormData({ text: '' });
      setEditingId(null);
      await loadQueries();
    } catch (e) {
      setError(e.message || 'Failed to save query');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this query?')) return;
    try {
      setLoading(true);
      setError(null);
      await queryApi.delete(id);
      await loadQueries();
    } catch (e) {
      setError(e.message || 'Failed to delete query');
    } finally {
      setLoading(false);
    }
  };

  const filteredQueries = queries.filter(query => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (query.text || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="queries-container">
      <div className="queries-header">
        <h1 className="queries-title">Queries Management</h1>
        <p className="queries-subtitle">Manage all inspection queries independently</p>
        <button className="btn btn-primary" onClick={handleCreate}>
          + New Query
        </button>
      </div>

      <div className="queries-search">
        <input
          className="search-input"
          placeholder="Search queries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
          {(pagination.totalPages > 1 || pagination.total > 0) && (
            <div className="pagination" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => loadQueries(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => loadQueries(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages || loading}
              >
                Next
              </button>
              <span style={{ marginLeft: '20px' }}>Show:</span>
              <select
                className="form-select"
                style={{ padding: '4px 8px', fontSize: '14px' }}
                value={pagination.limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                disabled={loading}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>per page</span>
            </div>
          )}

          <div className="queries-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Query Text</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueries.map((query) => (
                  <tr key={query.id}>
                    <td>{query.text}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(query)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(query.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <div className="modal-overlay" style={{ pointerEvents: 'none' }}>
          <div className="modal-content" style={{ pointerEvents: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Edit Query' : 'Create New Query'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setError(null);
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="query-text" className="form-label">
                  Query Text *
                </label>
                <textarea
                  id="query-text"
                  name="text"
                  required
                  rows={3}
                  className="form-textarea"
                  placeholder="Enter query text"
                  value={formData.text}
                  onChange={(e) => setFormData({...formData, text: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setError(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : (editingId ? 'Update Query' : 'Create Query')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queries;
