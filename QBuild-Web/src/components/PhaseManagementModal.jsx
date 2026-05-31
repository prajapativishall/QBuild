import React, { useState, useEffect } from 'react';
import { projectApi } from '../services/api';
import { toast } from 'react-toastify';
import PhaseManagement from './PhaseManagement';
import CreateInspectionForm from './CreateInspectionForm';
import '../styles/PhaseManagement.css';

const PhaseManagementModal = ({ project, onClose, onLoadConfiguration }) => {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedSourcePhase, setSelectedSourcePhase] = useState(null);

  useEffect(() => {
    if (project) {
      loadPhases();
    }
  }, [project]);

  const loadPhases = async () => {
    try {
      setLoading(true);
      const data = await projectApi.getProjectPhases(project.id);
      if (data.success) {
        setPhases(data.data || []);
      } else {
        toast.error(data.message || 'Failed to load phases');
      }
    } catch (err) {
      console.error('Error loading phases:', err);
      toast.error('Failed to load phase history');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewPhase = async (sourcePhaseNumber) => {
    console.log('PhaseManagementModal: handleStartNewPhase called with sourcePhaseNumber:', sourcePhaseNumber);
    // If a specific source phase number is provided (via "Load & Edit"), go directly to form
    if (sourcePhaseNumber) {
      setSelectedSourcePhase({ phase_number: sourcePhaseNumber });
      setShowForm(true);
    } else {
      // If no source phase ("Create New Phase" button), open source phase selection modal
      setShowCreateModal(true);
      setSelectedSourcePhase(null);
    }
  };

  const handleCreateNewPhase = () => {
    setShowCreateModal(true);
    setSelectedSourcePhase(null);
  };

  const handleConfirmCreatePhase = async () => {
    // Transfer selectedSourcePhase from the dropdown to the form
    const phaseNum = selectedSourcePhase?.phase_number || selectedSourcePhase?.phase || null;
    console.log('handleConfirmCreatePhase: selected source phase number:', phaseNum);
    setShowCreateModal(false);
    // Store the phase number explicitly for the form (don't rely on selectedSourcePhase state)
    setShowForm(true);
    // Note: CreateInspectionForm receives sourcePhaseNumber via props
    // which reads selectedSourcePhase?.phase_number from this component's state
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedSourcePhase(null);
    loadPhases();
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedSourcePhase(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content phase-management-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Phase Management - {project?.project_name}</h2>
            <button onClick={onClose} className="modal-close">×</button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="phase-loading">Loading phases...</div>
            ) : (
              <PhaseManagement
                projectId={project?.id}
                project={project}
                onStartNewPhase={handleStartNewPhase}
              />
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Load From Previous Phase</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: '#6b7280' }}>
                Select a previous phase to load its configuration into the form, or create a blank phase.
                You'll be able to edit all fields before creating.
              </p>
              
              {phases.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                    Load Configuration From Phase:
                  </label>
                  <select
                    value={selectedSourcePhase?.id || ''}
                    onChange={(e) => {
                      const phase = phases.find(p => p.id === parseInt(e.target.value));
                      setSelectedSourcePhase(phase || null);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Create Blank Phase --</option>
                    {phases.map(phase => (
                      <option key={phase.id} value={phase.id}>
                        Phase {phase.phase} - {formatDate(phase.created_at)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p style={{ marginBottom: '20px', color: '#6b7280' }}>
                  No previous phases available. Creating a blank phase.
                </p>
              )}

              {selectedSourcePhase && (
                <div style={{
                  padding: '15px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                    Configuration Preview (Phase {selectedSourcePhase.phase})
                  </h4>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    <div>Domains: {selectedSourcePhase.configuration?.domains_sub_domains?.length || 0}</div>
                    <div>Inspector: {selectedSourcePhase.inspector_name || 'Not assigned'}</div>
                    <div>Reviewer: {selectedSourcePhase.reviewer_name || 'Not assigned'}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
                style={{ marginRight: '10px' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmCreatePhase}
              >
                {selectedSourcePhase ? 'Load Configuration & Open Form' : 'Open Blank Form'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={handleFormClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '85vh' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Create New Inspection Phase
                {selectedSourcePhase?.phase_number && ` (from Phase ${selectedSourcePhase.phase_number})`}
              </h2>
              <button onClick={handleFormClose} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <CreateInspectionForm
                project={project}
                sourcePhaseNumber={selectedSourcePhase?.phase_number || null}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhaseManagementModal;