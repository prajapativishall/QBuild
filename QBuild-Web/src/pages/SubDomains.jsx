import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { subDomainApi, queryApi } from '../services/api';
import '../styles/SubDomains.css';

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

const SubDomains = () => {
  const { isManager } = useAuth();
  const [subDomains, setSubDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Query import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSubDomainId, setSelectedSubDomainId] = useState(null);
  const [availableQueries, setAvailableQueries] = useState([]);
  const [selectedQueries, setSelectedQueries] = useState(new Set());
  const [queryConfig, setQueryConfig] = useState({});
  const [importSearchTerm, setImportSearchTerm] = useState('');

  // Edit query configuration state
  const [showEditQueryModal, setShowEditQueryModal] = useState(false);
  const [editingQueryId, setEditingQueryId] = useState(null);
  const [editQueryConfig, setEditQueryConfig] = useState({ type: 'primary', parentId: null });

  // Expanded sub_domains state
  const [expandedSubDomains, setExpandedSubDomains] = useState(new Set());

  const reloadSubDomains = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subDomainApi.getAll();
      const storedWeightages = JSON.parse(localStorage.getItem('subDomainWeightages') || '{}');
      const subDomainsWithWeightage = (response?.data || []).map(subDomain => ({
        ...subDomain,
        weightage: subDomain.weightage || storedWeightages[subDomain.id] || 10.00
      }));
      setSubDomains(subDomainsWithWeightage);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadSubDomains(); }, []);

  const filteredSubDomains = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return subDomains.filter(s => (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
  }, [subDomains, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredSubDomains.length / PAGE_SIZE));
  const paginatedSubDomains = filteredSubDomains.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const handleCreate = () => { setFormData({ name: '', description: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (sd) => { setFormData({ name: sd.name, description: sd.description }); setEditingId(sd.id); setShowForm(true); };

  const handleSave = async () => {
    if (!formData.name || !formData.description) return;
    try {
      setLoading(true); setError(null);
      if (editingId) {
        await subDomainApi.update(editingId, { name: formData.name, description: formData.description, isActive: true, queries: [] });
      } else {
        await subDomainApi.create({ name: formData.name, description: formData.description, isActive: true, queries: [] });
      }
      setShowForm(false); setFormData({ name: '', description: '' }); setEditingId(null);
      await reloadSubDomains();
    } catch (e) { setError(e.message || 'Failed to save'); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sub_domain?')) return;
    try { setLoading(true); setError(null); await subDomainApi.delete(id); await reloadSubDomains(); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="sections-container">
      <div className="sections-header">
        <div className="sections-title-section">
          <h1 className="sections-title">Sub-Domains Management</h1>
          <p className="sections-subtitle">Manage inspection sub-domains and their queries</p>
        </div>
        {!isManager && (
          <div className="sections-actions">
            <button className="btn btn-primary" onClick={handleCreate}>+ New Sub-Domain</button>
          </div>
        )}
      </div>

      {error && <div style={{ marginBottom: '16px', color: 'var(--error-700)' }}>{error}</div>}

      <div className="sections-filters">
        <div className="search-box">
          <input type="text" placeholder="Search sub-domains..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <span className="sections-count">Showing {filteredSubDomains.length} of {subDomains.length}</span>
      </div>

      {filteredSubDomains.length === 0 ? (
        <div className="sections-empty">
          <h2 className="sections-empty-title">{subDomains.length > 0 ? 'No matches' : 'No sub-domains yet'}</h2>
          <p className="sections-empty-description">{subDomains.length > 0 ? 'Try a different search term.' : 'Create your first sub-domain.'}</p>
          {subDomains.length === 0 && !isManager && (
            <button className="sections-empty-action" onClick={handleCreate} disabled={loading}>+ Create Sub-Domain</button>
          )}
        </div>
      ) : (
        <>
          <div className="sections-list">
            <table className="sections-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Queries</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubDomains.map(subDomain => (
                  <tr key={subDomain.id} className={!subDomain.is_active ? 'inactive' : 'active'}>
                    <td className="table-name">{subDomain.name}</td>
                    <td className="table-description">{subDomain.description || '-'}</td>
                    <td className="table-count">{subDomain.queries?.length || 0}</td>
                    <td className="table-status">
                      <span className={`status-badge ${subDomain.is_active ? 'active' : 'inactive'}`}>
                        {subDomain.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-actions">
                      {!isManager && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(subDomain)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(subDomain.id)}>Delete</button>
                        </>
                      )}
                      {isManager && <span style={{ color: '#6b7280', fontSize: '13px' }}>Read-only</span>}
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
          <div className="modal-content" style={{ pointerEvents: 'auto', maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Sub-Domain' : 'Create New Sub-Domain'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input type="text" className="form-input" placeholder="Enter name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" rows={3} placeholder="Enter description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubDomains;