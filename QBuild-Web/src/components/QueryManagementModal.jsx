import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { queryApi } from '../services/api';
import { toast } from 'react-toastify';
import '../styles/PhaseManagement.css';

const QueryManagementModal = ({ 
  isOpen, 
  onClose, 
  projectId, 
  stageIndex, 
  sectionIndex, 
  stages,
  onSave 
}) => {
  const [availableQueries, setAvailableQueries] = useState([]);
  const [selectedQueries, setSelectedQueries] = useState(new Set());
  const [queryConfig, setQueryConfig] = useState({});
  const [querySearchTerm, setQuerySearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialSelectedIds, setInitialSelectedIds] = useState(new Set()); // Track pre-loaded queries

  const section = stages?.[stageIndex]?.sections?.[sectionIndex];

  useEffect(() => {
    if (isOpen && section) {
      loadQueries();
    }
  }, [isOpen, section]);

  const loadQueries = async () => {
    try {
      setLoading(true);
      // Load all available queries (high limit to get everything)
      const response = await queryApi.getAll(1, 1000);
      const queriesData = response.data || [];
      console.log(`Loaded ${queriesData.length} queries`);
      setAvailableQueries(queriesData || []);
      
      // Initialize selected queries from backend (linked to sub-domain)
      const initialSelected = new Set();
      const initialConfig = {};
      
      if (section?.sectionId) {
        try {
          const linkedResponse = await queryApi.getLinkedToSubDomain(section.sectionId);
          const linkedQueries = linkedResponse?.data || [];
          linkedQueries.forEach(q => {
            initialSelected.add(q.id);
            initialConfig[q.id] = { type: q.type || 'primary' };
          });
        } catch (err) {
          console.error('Error loading linked queries:', err);
        }
      }
      
      // Fallback to section's local queries if no backend data
      if (initialSelected.size === 0 && section?.queries) {
        section.queries.forEach(q => {
          initialSelected.add(q.id);
          initialConfig[q.id] = { type: q.type || 'primary' };
        });
      }
      
      setSelectedQueries(initialSelected);
      setQueryConfig(initialConfig);
      setInitialSelectedIds(initialSelected); // Store for stable sorting
    } catch (error) {
      console.error('Error loading queries:', error);
      toast.error('Failed to load queries');
    } finally {
      setLoading(false);
    }
  };

  // Reset initial selected IDs when modal closes/reopens
  useEffect(() => {
    if (!isOpen) {
      setInitialSelectedIds(new Set());
    }
  }, [isOpen]);

  const handleToggleQuerySelection = (queryId) => {
    setSelectedQueries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
        // Set default type if not set
        setQueryConfig(configPrev => ({
          ...configPrev,
          [queryId]: { type: 'primary' }
        }));
      }
      return newSet;
    });
  };

  const handleQueryTypeChange = (queryId, type) => {
    setQueryConfig(prev => ({
      ...prev,
      [queryId]: { 
        type,
        // Clear parentId if not secondary, keep existing or set null if changing to secondary
        parentId: type === 'secondary' ? prev[queryId]?.parentId || null : null
      }
    }));
  };

  const handleParentChange = (queryId, parentId) => {
    setQueryConfig(prev => ({
      ...prev,
      [queryId]: { 
        ...prev[queryId],
        parentId: parentId ? parseInt(parentId) : null
      }
    }));
  };

  const handleSave = () => {
    const selectedQueryObjects = Array.from(selectedQueries).map(queryId => {
      const query = availableQueries.find(q => q.id === queryId);
      const config = queryConfig[queryId] || { type: 'primary' };
      return {
        id: queryId,
        text: query?.question_text || query?.text || '',
        type: config.type || 'primary',
        parentId: config.parentId || null
      };
    });

    onSave(stageIndex, sectionIndex, selectedQueryObjects);
    onClose();
  };

  if (!isOpen || !section) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  // Get selected primary queries for parent selection dropdown
  const selectedPrimaryQueries = Array.from(selectedQueries)
    .map(id => availableQueries.find(q => q.id === id))
    .filter(q => q && queryConfig[q.id]?.type === 'primary');

  // Filter and sort - pre-loaded queries first (stable), newly clicked stay in place
  const filteredQueries = availableQueries
    .filter(query => 
      (query.text || query.question_text || '')
        .toLowerCase()
        .includes(querySearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort only by initially pre-loaded queries, not by new clicks
      const aPreloaded = initialSelectedIds.has(a.id);
      const bPreloaded = initialSelectedIds.has(b.id);
      if (aPreloaded && !bPreloaded) return -1;
      if (!aPreloaded && bPreloaded) return 1;
      return 0;
    });

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '85vh', zIndex: 2001 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            Manage Queries - {section.sectionName}
          </h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="phase-loading">Loading queries...</div>
          ) : (
            <>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '6px' }}>
                <strong style={{ color: '#0369a1' }}>Selected Queries ({selectedQueries.size})</strong>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  These queries are currently linked to this sub-domain. Uncheck to remove.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search queries..."
                  value={querySearchTerm}
                  onChange={(e) => setQuerySearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredQueries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    No queries found matching your search.
                  </div>
                ) : (
                  filteredQueries.map(query => {
                    const isSelected = selectedQueries.has(query.id);
                    const config = queryConfig[query.id] || { type: 'primary' };
                    
                    return (
                      <div key={query.id} style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        background: isSelected ? '#f9fafb' : 'white'
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleQuerySelection(query.id)}
                          style={{ marginTop: '4px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', display: 'block' }}>
                            {query.text || query.question_text}
                          </span>
                          {isSelected && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                  value={config.type}
                                  onChange={(e) => handleQueryTypeChange(query.id, e.target.value)}
                                  style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '12px', 
                                    borderRadius: '4px', 
                                    border: '1px solid #d1d5db' 
                                  }}
                                >
                                  <option value="primary">Primary</option>
                                  <option value="secondary">Secondary</option>
                                  <option value="optional">Optional</option>
                                </select>
                              </div>
                              
                              {/* Show parent selection when type is secondary */}
                              {config.type === 'secondary' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Link to:</span>
                                  <select
                                    value={config.parentId || ''}
                                    onChange={(e) => handleParentChange(query.id, e.target.value)}
                                    style={{ 
                                      padding: '4px 8px', 
                                      fontSize: '12px', 
                                      borderRadius: '4px', 
                                      border: '1px solid #d1d5db',
                                      flex: 1
                                    }}
                                  >
                                    <option value="">Select primary query...</option>
                                    {selectedPrimaryQueries.map(primary => (
                                      <option key={primary.id} value={primary.id}>
                                        {primary.text || primary.question_text}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save ({selectedQueries.size} selected)
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default QueryManagementModal;
