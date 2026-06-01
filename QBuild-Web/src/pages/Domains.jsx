import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { domainApi, subDomainApi } from '../services/api';
import '../styles/Domains.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

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
    weightage: 0,
    sections: []
  });

  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const [sections, setSections] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading domains and sub_domains...');
      const [domainRes, subDomainRes] = await Promise.all([domainApi.getAll(), subDomainApi.getAll()]);
      console.log('API responses:', { domainRes, subDomainRes });
      
      const domainsData = domainRes?.data || [];
      const sectionsData = subDomainRes?.data || [];
      
      // Fetch domain-sub-domain relationships from junction table
      const domainSubDomainsRes = await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const domainSubDomainsData = await domainSubDomainsRes.json();
      console.log('Domain-sub-domain relationships:', domainSubDomainsData);
      
      // Enrich domains with their associated sub-domains from junction table
      // Backend returns: domain_id, sub_domain_id, sub_domain_name (snake_case)
      const enrichedDomains = domainsData.map(domain => {
        const domainSubDomains = (domainSubDomainsData.data || [])
          .filter(dsd => dsd.domain_id === domain.id)
          .map(dsd => ({
            subDomainId: dsd.sub_domain_id,
            subDomainName: dsd.sub_domain_name,
            weightage: dsd.weightage || 0
          }));
        
        console.log(`Domain ${domain.id} (${domain.name}) has ${domainSubDomains.length} sub-domains:`, domainSubDomains);
        
        return {
          ...domain,
          sub_domains: domainSubDomains
        };
      });
      
      console.log('Enriched domains:', enrichedDomains);
      setDomains(enrichedDomains);
      setSections(sectionsData);
    } catch (e) {
      console.error('Error in loadData:', e);
      setError(e.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      weightage: 0,
      sections: []
    });
    setSelectedSectionId('');
    setShowForm(true);
  };

  const handleEdit = (domain) => {
    console.log('Editing domain:', domain);
    console.log('Domain sub_domains with weightage:', domain.sub_domains);
    setEditingId(domain.id);
    setFormData({
      name: domain.name || '',
      description: domain.description || '',
      isActive: domain.isActive !== false,
      weightage: domain.weightage || 0,
      sub_domains: domain.sub_domains || []
    });
    setSelectedSectionId('');
    setShowForm(true);
  };

  const handleAddSubDomain = () => {
    if (!selectedSectionId) return;
    const subDomain = sections.find((s) => s.id === parseInt(selectedSectionId));
    if (!subDomain) return;

    const next = {
      subDomainId: subDomain.id,
      subDomainName: subDomain.name,
      weightage: 0 // Default weightage since sub-domains don't have weightage in their own table
    };

    setFormData((prev) => ({
      ...prev,
      sub_domains: [...(prev.sub_domains || []), next]
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
          isActive: formData.isActive,
          weightage: formData.weightage
        });
        domainId = editingId;
      } else {
        const response = await domainApi.create({
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          weightage: formData.weightage
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
        
        // Get existing sub-domains for this domain
        const existingRes = await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains/${domainId}`, {
          headers
        });
        const existingData = await existingRes.json();
        const existingSubDomains = (existingData.data || []).map(dsd => ({
          subDomainId: dsd.sub_domain_id || dsd.subDomainId,
          subDomainName: dsd.sub_domain_name || dsd.subDomainName
        }));
        
        // Add new sub-domains
        for (const subDomain of formData.sub_domains) {
          const exists = existingSubDomains.find(esd => esd.subDomainId === subDomain.subDomainId);
          if (!exists) {
            console.log('Adding sub-domain to domain:', { domainId, subDomainId: subDomain.subDomainId, weightage: subDomain.weightage });
            const response = await fetch(`${API_BASE_URL}/weightage-management/domain-sub-domains/${domainId}/${subDomain.subDomainId}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ weightage: parseFloat(subDomain.weightage) || 0 })
            });
            console.log('Add sub-domain response:', response.status, await response.clone().text());
          }
        }
        
        // Remove sub-domains that are no longer in the list
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
              {filteredDomains.map((domain) => (
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
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Domain' : 'Create Domain'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>

            <div className="stage-form">
              <div className="form-group">
                <label className="form-label">Domain Name</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Weightage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="form-input"
                  value={formData.weightage}
                  onChange={(e) => setFormData({ ...formData, weightage: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter weightage percentage (0-100)"
                />
                <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Weightage percentage for this domain (0-100). Total of all domains should equal 100%.
                </small>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search sub-domains..."
                    value={sectionSearchTerm}
                    onChange={(e) => setSectionSearchTerm(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      width: '100%'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      className="form-select"
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select sub-domain</option>
                      {sections
                        .filter(s => {
                          const q = sectionSearchTerm.toLowerCase().trim();
                          if (!q) return true;
                          return (s.name || '').toLowerCase().includes(q);
                        })
                        .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={handleAddSubDomain}>
                      Add
                    </button>
                  </div>
                </div>

                {formData.sub_domains?.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {formData.sub_domains.map((subDomain, idx) => (
                      <div
                        key={`${subDomain.subDomainId}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.8)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <span style={{ flex: 1 }}>
                            {subDomain.subDomainName}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              style={{
                                width: '70px',
                                padding: '4px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                fontSize: '12px',
                                textAlign: 'right'
                              }}
                              value={subDomain.weightage || 0}
                              onChange={(e) => {
                                const updatedSubDomains = [...formData.sub_domains];
                                updatedSubDomains[idx] = {
                                  ...updatedSubDomains[idx],
                                  weightage: parseFloat(e.target.value) || 0
                                };
                                setFormData({ ...formData, sub_domains: updatedSubDomains });
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>%</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleRemoveSubDomain(idx)}
                          style={{ padding: '6px 10px', marginLeft: '8px' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px', 
                      background: '#f0f9ff', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      color: '#0369a1' 
                    }}>
                      Total Sub-Domain Weightage: {Number(formData.sub_domains.reduce((sum, subDomain) => sum + (subDomain.weightage || 0), 0)).toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={handleSave}>
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Domains;
