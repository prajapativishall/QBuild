import React, { useState, useEffect } from 'react';
import { projectApi } from '../services/api';
import '../styles/PhaseManagement.css';

const PhaseManagement = ({ projectId, project, onStartNewPhase }) => {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      loadPhases();
    }
  }, [projectId]);

  const loadPhases = async () => {
    try {
      setLoading(true);
      const data = await projectApi.getProjectPhases(projectId);
      if (data.success) {
        setPhases(data.data || []);
      } else {
        setError(data.message || 'Failed to load phase history');
      }
    } catch (err) {
      console.error('Error loading phases:', err);
      setError('Failed to load phase history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { class: 'status-draft', label: 'Draft' },
      'in_progress': { class: 'status-progress', label: 'In Progress' },
      'submitted': { class: 'status-submitted', label: 'Submitted' },
      'approved': { class: 'status-approved', label: 'Approved' },
      'rejected': { class: 'status-rejected', label: 'Rejected' },
      'completed': { class: 'status-completed', label: 'Completed' }
    };
    const statusInfo = statusMap[status] || { class: 'status-draft', label: status };
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <div className="phase-loading">Loading phases...</div>;

  return (
    <div className="phase-management">
      <div className="phase-header">
        <h3>Inspection Phases</h3>
        <button className="btn btn-primary" onClick={() => onStartNewPhase && onStartNewPhase()}>
          Create New Phase
        </button>
      </div>

      {/* Phase Status Legend */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px',
        padding: '12px 16px', background: 'white', borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginRight: '8px' }}>Status:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#999' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Draft</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#3498db' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>In Progress</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f39c12' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Submitted</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#27ae60' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Approved</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#e74c3c' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Rejected</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#2ecc71' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Completed</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }}></span>
          <span style={{ fontSize: '12px', color: '#666' }}>Pending</span>
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {phases.length === 0 ? (
        <div className="phase-empty">
          <p>No inspection phases yet.</p>
          <button className="btn btn-primary" onClick={() => onStartNewPhase && onStartNewPhase()}>
            Create First Phase
          </button>
        </div>
      ) : (
        <div className="phase-list">
          {phases.map((phase, index) => {
            const phaseNum = phase.phase_number || phase.phase;
            const isLatest = index === phases.length - 1;
            const status = phase.status || phase.inspection_status || 'draft';
            return (
              <div key={phase.id} className={`phase-card ${status}`}>
                <div className="phase-card-header">
                  <div className="phase-number">
                    <span className="phase-badge">Phase {phaseNum}</span>
                    {isLatest && <span className="current-badge">Current</span>}
                  </div>
                  <div className="phase-info-row">
                    {getStatusBadge(status)}
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '12px' }}>
                      {formatDate(phase.created_at)}
                    </span>
                  </div>
                </div>
                {phase.inspector_name && (
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280' }}>
                    Inspector: {phase.inspector_name}
                    {phase.reviewer_name && <> | Reviewer: {phase.reviewer_name}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhaseManagement;
