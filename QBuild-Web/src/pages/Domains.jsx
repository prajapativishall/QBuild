import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { domainApi, subDomainApi } from '../services/api';
import '../styles/Domains.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 25;

const Domains = () => {
  const { isManager } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    sub_domains: []
  });

  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const [sections, setSections] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [domainRes, subDomainRes] = await Promise.all([domainApi.getAll(), subDomainApi.getAll()]);
      
      const domainsData = domainRes?.data || [];
      const sectionsData = subDomainRes?.data || [];
      
      // Fetch domain-sub-domain relationships from junction table
      const domainSubDomainsRes = await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const domainSubDomainsData = await domainSubDomainsRes.json();
      
      // Enrich domains with their associated sub-domains from junction table
      const enrichedDomains = domainsData.map(domain => {
        const domainSubDomains = (domainSubDomainsData.data || [])
          .filter(dsd => dsd.domain_id === domain.id)
          .map(dsd => ({
            subDomainId: dsd.sub_domain_id,
            subDomainName: dsd.sub_domain_name,
            weightage: dsd.weightage || 0
          }));
        
        return {
          ...domain,
          sub_domains: domainSubDomains
        };
      });
      
      setDomains(enrichedDomains);
      setSections(sectionsData);
    } catch (e) {
      setError(e.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredDomains = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((s) => {
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      );
    });
  }, [domains, searchTerm]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredDomains.length / PAGE_SIZE));
  const paginatedDomains = filteredDomains.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', isActive: true, sub_domains: [] });
    setSelectedSectionId('');
    setShowForm(true);
  };

  const handleEdit = (domain) => {
    setEditingId(domain.id);
    setFormData({
      name: domain.name || '',
      description: domain.description || '',
      isActive: domain.isActive !== false,
      sub_domains: domain.sub_domains || []
    });
    setSelectedSectionId('');
    setShowForm(true);
  };

  const handleAddSubDomain = () => {
    if (!selectedSectionId) return;
    const subDomain = sections.find((s) => s.id === parseInt(selectedSectionId));
    if (!subDomain) return;

    setFormData((prev) => ({
      ...prev,
      sub_domains: [...(prev.sub_domains || []), { subDomainId: subDomain.id, subDomainName: subDomain.name, weightage: 0 }]
    }));
    setSelectedSectionId('');
  };

  const handleRemoveSubDomain = (index) => {
    setFormData((prev) => ({
      ...prev,
      sub_domains: (prev.sub_domains || []).filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Domain name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let domainId;
      if (editingId) {
        await domainApi.update(editingId, {
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive
        });
        domainId = editingId;
      } else {
        const response = await domainApi.create({
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive
        });
        domainId = response.data.id;
      }
      
      // Handle sub-domains junction table updates
      if (formData.sub_domains && formData.sub_domains.length > 0) {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
        
        const existingRes = await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains/${domainId}`, {
          headers
        });
        const existingData = await existingRes.json();
        const existingSubDomains = (existingData.data || []).map(dsd => ({
          subDomainId: dsd.sub_domain_id || dsd.subDomainId,
          subDomainName: dsd.sub_domain_name || dsd.subDomainName
        }));
        
        for (const subDomain of formData.sub_domains) {
          const exists = existingSubDomains.find(esd => esd.subDomainId === subDomain.subDomainId);
          if (!exists) {
            await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains/${domainId}/${subDomain.subDomainId}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ weightage: parseFloat(subDomain.weightage) || 0 })
            });
          }
        }
        
        for (const existing of existingSubDomains) {
          const stillExists = formData.sub_domains.find(sd => sd.subDomainId === existing.subDomainId);
          if (!stillExists) {
            await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains/${domainId}/${existing.subDomainId}`, {
              method: 'DELETE',
              headers
            });
          }
        }
      }
      
      setShowForm(false);
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to save domain');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this domain?')) return;
    try {
      setLoading(true);
      setError(null);
      await domainApi.delete(id);
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to delete domain');
    } finally {
      setLoading(false);
    }
  };

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    
    return (
      <div className="pagination">
        <button className="pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} title="First">
          &laquo;
        </button>
        <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          &lsaquo;
        </button>
        {start > 1 && <span className="pagination-ellipsis">...</span>}
        {pages.map(p => (
          <button key={p} className={`pagination-btn ${p === currentPage ? 'active' : ''}`} onClick={() => onPageChange(p)}>
            {p}
          </button>
        ))}
        {end < totalPages && <span className="pagination-ellipsis">...</span>}
        <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          &rsaquo;
        </button>
        <button className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} title="Last">
          &raquo;
        </button>
      </div>
    );
  };

  return (
    <div className={`stages-container ${loading ? 'stages-loading' : ''}`}>
      <div className="stages-header">
        <div className="stages-title-section">
          <h1 className="stages-title">Domains</h1>
          <p className="stages-subtitle">Define domains and link available sub-domains</p>
        </div>
        {!isManager && (
          <div className="stages-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              + New Domain
            </button>
          </div>
        )}
      </div>

      <div className="stages-search">
        <div className="search-input-group">
          <input
            className="search-input"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {error && <div style={{ marginTop: '12px', color: 'var(--error-700)' }}>{error}</div>}
      </div>

      {filteredDomains.length === 0 ? (
        <div className="stages-empty">
          <h2 className="stages-empty-title">No domains found</h2>
          <p className="stages-empty-description">
            Create a domain and link sub-domains to start building your checklist structure.
          </p>
          {!isManager && (
            <button className="stages-empty-action" onClick={handleCreate}>
              + Create Domain
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="stages-list">
            <table className="stages-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Sub-Domains</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDomains.map((domain) => (
                  <tr key={domain.id} className={domain.isActive === false ? 'inactive' : ''}>
                    <td className="table-name">{domain.name}</td>
                    <td className="table-description">{domain.description || '-'}</td>
                    <td className="table-count">{domain.sub_domains?.length || 0}</td>
                    <td className="table-status">
                      <span className={`status-badge ${domain.isActive === false ? 'inactive' : 'active'}`}>
                        {domain.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="table-actions">
                      {!isManager && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(domain)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(domain.id)}>
                            Delete
                          </button>
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
        <div className="modal-overlay" style={{ pointerEvents: 'none' }} onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ pointerEvents: 'auto', maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Domain' : 'Create Domain'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Domain Name *</label>
                <input
                  className="form-input"
                  placeholder="Enter domain name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter domain description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-checkbox-group">
                <input
                  className="form-checkbox"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span className="form-checkbox-label">Active</span>
              </div>

              <div className="form-group">
                <label className="form-label">Sub-Domains</label>
                <div className="subdomain-section">
                  <div className="subdomain-section-header">
                    <span className="subdomain-section-title">Linked Sub-Domains</span>
                    <span className="subdomain-section-count">
                      {formData.sub_domains?.length || 0} selected
                    </span>
                  </div>

                  <div className="subdomain-search">
                    <input
                      type="text"
                      className="subdomain-search-input"
                      placeholder="Search sub-domains..."
                      value={sectionSearchTerm}
                      onChange={(e) => setSectionSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="subdomain-add-row">
                    <select
                      className="subdomain-select"
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                    >
                      <option value="">Select sub-domain</option>
                      {sections
                        .filter(s => {
                          const q = sectionSearchTerm.toLowerCase().trim();
                          if (!q) return true;
                          return (s.name || '').toLowerCase().includes(q);
                        })
                        .map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button type="button" className="subdomain-add-btn" onClick={handleAddSubDomain} disabled={!selectedSectionId}>
                      + Add
                    </button>
                  </div>

                  {formData.sub_domains?.length > 0 ? (
                    <>
                      <div className="subdomain-list">
                        {formData.sub_domains.map((subDomain, idx) => (
                          <div key={`${subDomain.subDomainId}-${idx}`} className="subdomain-item">
                            <div className="subdomain-item-info">
                              <span className="subdomain-item-name">{subDomain.subDomainName}</span>
                              <div className="subdomain-item-weightage">
                                <input
                                  type="number"
                                  className="subdomain-weight-input"
                                  min="0" max="100" step="0.01"
                                  value={subDomain.weightage || 0}
                                  onChange={(e) => {
                                    const updated = [...formData.sub_domains];
                                    updated[idx] = { ...updated[idx], weightage: parseFloat(e.target.value) || 0 };
                                    setFormData({ ...formData, sub_domains: updated });
                                  }}
                                />
                                <span className="subdomain-weight-label">%</span>
                              </div>
                            </div>
                            <button type="button" className="subdomain-remove-btn" onClick={() => handleRemoveSubDomain(idx)} title="Remove">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="subdomain-total">
                        <span>Total Sub-Domain Weightage</span>
                        <span>{Number(formData.sub_domains.reduce((sum, s) => sum + (s.weightage || 0), 0)).toFixed(2)}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="subdomain-empty">
                      No sub-domains linked. Use the search and add button above to link sub-domains.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={handleSave}>
                {editingId ? 'Update Domain' : 'Create Domain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Domains;