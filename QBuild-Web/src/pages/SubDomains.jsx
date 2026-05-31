import React, { useState, useEffect } from 'react';
import { subDomainApi, queryApi } from '../services/api';
import '../styles/SubDomains.css';

const SubDomains = () => {
  const [subDomains, setSubDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Query import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSubDomainId, setSelectedSubDomainId] = useState(null);
  const [availableQueries, setAvailableQueries] = useState([]);
  const [selectedQueries, setSelectedQueries] = useState(new Set());
  const [queryConfig, setQueryConfig] = useState({}); // { queryId: { type: 'primary', parentId: null } }
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
      
      // Workaround: Add weightage manually since backend is not returning it
      const storedWeightages = JSON.parse(localStorage.getItem('subDomainWeightages') || '{}');
      const subDomainsWithWeightage = (response?.data || []).map(subDomain => {
        return {
          ...subDomain,
          weightage: subDomain.weightage || storedWeightages[subDomain.id] || 10.00
        };
      });
      setSubDomains(subDomainsWithWeightage);
    } catch (e) {
      console.error('Error loading sub_domains:', e);
      setError(e.message || 'Failed to load sub_domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadSubDomains();
  }, []);

  // Filtered subDomains based on search
  const filteredSubDomains = subDomains.filter(subDomain => {
    const q = searchTerm.toLowerCase();
    return (
      (subDomain.name || '').toLowerCase().includes(q) ||
      (subDomain.description || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    setFormData({ name: '', description: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description) return;

    try {
      setLoading(true);
      setError(null);
      if (editingId) {
        const current = subDomains.find(s => s.id === editingId);
        const updateData = {
          name: formData.name,
          description: formData.description,
          isActive: current?.is_active !== false,
          queries: current?.queries || []
        };
        await subDomainApi.update(editingId, updateData);
      } else {
        const createData = {
          name: formData.name,
          description: formData.description,
          isActive: true,
          queries: []
        };
        await subDomainApi.create(createData);
      }
      setShowForm(false);
      setFormData({ name: '', description: '' });
      setEditingId(null);
      await reloadSubDomains();
    } catch (e) {
      console.error('Error saving sub_domain:', e);
      setError(e.message || 'Failed to save sub_domain');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subDomain) => {
    setFormData({
      name: subDomain.name,
      description: subDomain.description
    });
    setEditingId(subDomain.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sub_domain?')) return;
    try {
      setLoading(true);
      setError(null);
      await subDomainApi.delete(id);
      await reloadSubDomains();
    } catch (e) {
      setError(e.message || 'Failed to delete sub_domain');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubDomainExpansion = (subDomainId) => {
    setExpandedSubDomains(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(subDomainId)) {
        newExpanded.delete(subDomainId);
      } else {
        newExpanded.add(subDomainId);
      }
      return newExpanded;
    });
  };

  const handleImportQueries = async (subDomainId) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedSubDomainId(subDomainId);
      const response = await queryApi.getAvailableForSubDomain(subDomainId);
      setAvailableQueries(response?.data || []);
      setSelectedQueries(new Set());
      setQueryConfig({});
      setShowImportModal(true);
    } catch (e) {
      setError(e.message || 'Failed to load available queries');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQuerySelection = (queryId) => {
    setSelectedQueries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
        setQueryConfig(prevConfig => {
          const newConfig = { ...prevConfig };
          delete newConfig[queryId];
          return newConfig;
        });
      } else {
        newSet.add(queryId);
        setQueryConfig(prevConfig => ({
          ...prevConfig,
          [queryId]: { type: 'primary', parentId: null }
        }));
      }
      return newSet;
    });
  };

  const handleQueryTypeChange = (queryId, type) => {
    setQueryConfig(prev => ({
      ...prev,
      [queryId]: { ...prev[queryId], type, parentId: type === 'secondary' ? null : null }
    }));
  };

  const handleQueryParentChange = (queryId, parentId) => {
    setQueryConfig(prev => ({
      ...prev,
      [queryId]: { ...prev[queryId], parentId: parentId ? parseInt(parentId) : null }
    }));
  };

  const handleSelectAllQueries = () => {
    if (selectedQueries.size === availableQueries.length) {
      // Deselect all
      setSelectedQueries(new Set());
      setQueryConfig({});
    } else {
      // Select all
      const allQueryIds = new Set(availableQueries.map(q => q.id));
      setSelectedQueries(allQueryIds);
      const allConfig = {};
      availableQueries.forEach(q => {
        allConfig[q.id] = { type: 'primary', parentId: null };
      });
      setQueryConfig(allConfig);
    }
  };

  const handleImportSelectedQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      let order = 0;
      
      // Sort queries: link primary queries first, then secondary
      // This ensures parent queries exist before children are linked
      const sortedQueryIds = Array.from(selectedQueries).sort((a, b) => {
        const configA = queryConfig[a] || { type: 'primary' };
        const configB = queryConfig[b] || { type: 'primary' };
        // Primary comes before secondary
        if (configA.type === 'primary' && configB.type !== 'primary') return -1;
        if (configA.type !== 'primary' && configB.type === 'primary') return 1;
        return 0;
      });
      
      for (const queryId of sortedQueryIds) {
        const config = queryConfig[queryId] || { type: 'primary', parentId: null };
        await queryApi.linkToSubDomain(selectedSubDomainId, queryId, config.type, config.parentId, order++);
      }
      setShowImportModal(false);
      setSelectedQueries(new Set());
      setQueryConfig({});
      setSelectedSubDomainId(null);
      await reloadSubDomains();
    } catch (e) {
      setError(e.message || 'Failed to import queries');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkQuery = async (subDomainId, queryId) => {
    if (!confirm('Remove this query from the sub-domain?')) return;
    try {
      setLoading(true);
      setError(null);
      await queryApi.unlinkFromSubDomain(subDomainId, queryId);
      await reloadSubDomains();
    } catch (e) {
      setError(e.message || 'Failed to remove query');
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuery = (subDomainId, query) => {
    setSelectedSubDomainId(subDomainId);
    setEditingQueryId(query.id);
    setEditQueryConfig({
      type: query.type,
      parentId: query.parentId
    });
    setShowEditQueryModal(true);
  };

  const handleSaveQueryEdit = async () => {
    try {
      setLoading(true);
      setError(null);
      await queryApi.updateSubDomainQuery(selectedSubDomainId, editingQueryId, editQueryConfig.type, editQueryConfig.parentId);
      setShowEditQueryModal(false);
      setEditingQueryId(null);
      setEditQueryConfig({ type: 'primary', parentId: null });
      setSelectedSubDomainId(null);
      await reloadSubDomains();
    } catch (e) {
      setError(e.message || 'Failed to update query configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sections-container">
      <div className="sections-header">
        <div className="sections-title-section">
          <h1 className="sections-title">Sub-Domains Management</h1>
          <p className="sections-subtitle">Manage inspection sub-domains and their queries</p>
        </div>
        <div className="sections-actions">
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Sub-Domain
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', color: 'var(--error-700)' }}>
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="sections-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search sub-domains by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <span className="sections-count">
          Showing {filteredSubDomains.length} of {subDomains.length} sub-domains
        </span>
      </div>

      {filteredSubDomains.length === 0 ? (
        <div className="sections-empty">
          <h2 className="sections-empty-title">
            {subDomains.length > 0 ? 'No sub-domains match your search' : 'No sub-domains yet'}
          </h2>
          <p className="sections-empty-description">
            {subDomains.length > 0 
              ? 'Try a different search term.' 
              : 'Create your first sub-domain and start adding queries.'}
          </p>
          {subDomains.length === 0 && (
            <button className="sections-empty-action" onClick={handleCreate} disabled={loading}>
              + Create Sub-Domain
            </button>
          )}
        </div>
      ) : (
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
              {filteredSubDomains.map(subDomain => (
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
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(subDomain)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(subDomain.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" style={{ pointerEvents: 'none' }}>
          <div className="modal-content" style={{ pointerEvents: 'auto', maxWidth: '800px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Edit Sub-Domain' : 'Create New Sub-Domain'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Sub-Domain Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="form-input"
                  placeholder="Enter sub-domain name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  className="form-textarea"
                  placeholder="Enter sub-domain description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {editingId && (
                <>
                  <div className="form-group">
                    <div className="modal-section-header">
                      <label className="form-label">Queries</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          handleImportQueries(editingId);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        + Import Queries
                      </button>
                    </div>
                    {subDomains.find(s => s.id === editingId)?.queries?.length > 0 ? (
                      <div className="queries-list">
                        {subDomains.find(s => s.id === editingId)?.queries.map(query => (
                          <div key={query.id} className="query-item-edit">
                            <div className="query-item-content">
                              <span className="query-type-badge">{query.type || 'PRIMARY'}</span>
                              <span className="query-text-edit">{query.text}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnlinkQuery(editingId, query.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="queries-empty">
                        <p>No queries added yet. Click "Import Queries" to add queries.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary"
              >
                {editingId ? 'Update Sub-Domain' : 'Create Sub-Domain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Queries Modal */}
      {showImportModal && (
        <div className="modal-overlay" style={{ pointerEvents: 'none' }}>
          <div className="modal-content" style={{ pointerEvents: 'auto', maxWidth: '800px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Import Queries</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedQueries(new Set());
                  setSelectedSubDomainId(null);
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {availableQueries.length === 0 ? (
                <div className="queries-empty">
                  <p>No queries available to import. Create queries in the Queries page first.</p>
                </div>
              ) : (
                <>
                  <div className="import-queries-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllQueries}
                        className="btn btn-secondary btn-sm"
                      >
                        {selectedQueries.size === availableQueries.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="selected-count">
                        {selectedQueries.size} of {availableQueries.length} selected
                      </span>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Search queries..."
                        value={importSearchTerm}
                        onChange={(e) => setImportSearchTerm(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          width: '240px'
                        }}
                      />
                    </div>
                  </div>
                  <div className="import-queries-list">
                    {availableQueries
                      .filter(query => {
                        const q = importSearchTerm.toLowerCase().trim();
                        if (!q) return true;
                        return (query.text || '').toLowerCase().includes(q);
                      })
                      .map(query => {
                    const isSelected = selectedQueries.has(query.id);
                    const config = queryConfig[query.id] || { type: 'primary', parentId: null };
                    const selectedSubDomain = subDomains.find(s => s.id === selectedSubDomainId);
                    const primaryQueriesInSubDomain = selectedSubDomain?.queries?.filter(q => q.type === 'primary' || q.type === 'PRIMARY') || [];
                    const primaryQueriesBeingImported = Array.from(selectedQueries)
                      .filter(id => queryConfig[id]?.type === 'primary')
                      .map(id => availableQueries.find(q => q.id === id));
                    
                    return (
                      <div key={query.id} className="import-query-item">
                        <div className="import-query-header">
                          <label className="import-query-label">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleQuerySelection(query.id)}
                            />
                            <span className="query-text">{query.text}</span>
                          </label>
                        </div>
                        {isSelected && (
                          <div className="import-query-config">
                            <div className="form-group">
                              <label className="form-label">Type:</label>
                              <select
                                value={config.type}
                                onChange={(e) => handleQueryTypeChange(query.id, e.target.value)}
                                className="form-select"
                              >
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                                <option value="optional">Optional</option>
                              </select>
                            </div>
                            {config.type === 'secondary' && (
                              <div className="form-group">
                                <label className="form-label">Link to Primary Query:</label>
                                <select
                                  value={config.parentId || ''}
                                  onChange={(e) => handleQueryParentChange(query.id, e.target.value)}
                                  className="form-select"
                                >
                                  <option value="">Select primary query</option>
                                  {primaryQueriesInSubDomain.map(q => (
                                    <option key={q.id} value={q.id}>
                                      {q.text}
                                    </option>
                                  ))}
                                  {primaryQueriesBeingImported.map(q => (
                                    <option key={q.id} value={q.id}>
                                      {q.text} (being imported)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedQueries(new Set());
                  setQueryConfig({});
                  setSelectedSubDomainId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSelectedQueries}
                className="btn btn-primary"
                disabled={selectedQueries.size === 0 || loading}
              >
                {loading ? 'Importing...' : `Import ${selectedQueries.size} Query${selectedQueries.size !== 1 ? 'ies' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Query Configuration Modal */}
      {showEditQueryModal && (
        <div className="modal-overlay" style={{ pointerEvents: 'none' }}>
          <div className="modal-content" style={{ pointerEvents: 'auto', maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Query Configuration</h2>
              <button
                onClick={() => {
                  setShowEditQueryModal(false);
                  setEditingQueryId(null);
                  setEditQueryConfig({ type: 'primary', parentId: null });
                  setSelectedSubDomainId(null);
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Type:</label>
                <select
                  value={editQueryConfig.type}
                  onChange={(e) => setEditQueryConfig({ ...editQueryConfig, type: e.target.value, parentId: e.target.value === 'secondary' ? null : null })}
                  className="form-select"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              {editQueryConfig.type === 'secondary' && (
                <div className="form-group">
                  <label className="form-label">Link to Primary Query:</label>
                  <select
                    value={editQueryConfig.parentId || ''}
                    onChange={(e) => setEditQueryConfig({ ...editQueryConfig, parentId: e.target.value ? parseInt(e.target.value) : null })}
                    className="form-select"
                  >
                    <option value="">Select primary query</option>
                    {selectedSubDomainId && subDomains.find(s => s.id === selectedSubDomainId)?.queries
                      .filter(q => (q.type === 'primary' || q.type === 'PRIMARY') && q.id !== editingQueryId)
                      .map(q => (
                        <option key={q.id} value={q.id}>
                          {q.text}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowEditQueryModal(false);
                  setEditingQueryId(null);
                  setEditQueryConfig({ type: 'primary', parentId: null });
                  setSelectedSubDomainId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQueryEdit}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubDomains;