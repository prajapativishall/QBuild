import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import { toast } from 'react-toastify';
import PhaseManagementModal from '../components/PhaseManagementModal';
import CreateInspectionForm from '../components/CreateInspectionForm';
import '../styles/Inspections.css';

const Inspections = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phaseModalProject, setPhaseModalProject] = useState(null);
  const [viewingPhase, setViewingPhase] = useState(null);
  const [viewingPhaseConfig, setViewingPhaseConfig] = useState(null);
  const [viewingPhaseLoading, setViewingPhaseLoading] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (projectId) {
      loadProjectAndPhases();
    }
  }, [projectId]);

  const loadProjectAndPhases = async () => {
    try {
      setLoading(true);
      
      // Load project details
      const projectRes = await projectApi.getById(projectId);
      if (projectRes.success) {
        setProject(projectRes.data);
      } else {
        toast.error('Failed to load project');
        navigate('/projects');
        return;
      }

      // Load project phases
      const phasesRes = await projectApi.getProjectPhases(projectId);
      if (phasesRes.success && phasesRes.data) {
        setPhases(phasesRes.data);
      } else {
        setPhases([]);
      }
    } catch (error) {
      console.error('Error loading project and phases:', error);
      toast.error('Failed to load inspections');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewInspection = () => {
    if (!project) return;
    setPhaseModalProject(project);
  };

  const handleClosePhaseModal = () => {
    setPhaseModalProject(null);
    loadProjectAndPhases();
  };

  const handleLoadConfiguration = async () => {
    await loadProjectAndPhases();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInspectionId = (phase) => phase.inspection_id || phase.inspectionId;

  const isInspectionOnInspectorEnd = (phase) => {
    const inspectionStatus = phase.inspection_status || phase.status;
    const approvalStatus = phase.approval_status;

    return (
      ['pending', 'scheduled', 'in_progress'].includes(inspectionStatus) ||
      approvalStatus === 'rejected'
    );
  };

  const handleViewPhase = async (phase) => {
    try {
      setViewingPhase(phase);
      setViewingPhaseConfig(null);
      setViewingPhaseLoading(true);

      const response = await projectApi.getPhaseConfiguration(projectId, phase.phase_number);
      if (response.success) {
        setViewingPhaseConfig(response.data);
      } else {
        toast.error('Failed to load phase details');
      }
    } catch (error) {
      console.error('Error loading phase details:', error);
      toast.error('Failed to load phase details');
    } finally {
      setViewingPhaseLoading(false);
    }
  };

  const handleEditPhase = (phase) => {
    const inspectionId = getInspectionId(phase);

    if (inspectionId && !isInspectionOnInspectorEnd(phase)) {
      toast.info('This inspection is already submitted for review');
      return;
    }

    setEditingPhase(phase);
  };

  const handleEditPhaseClose = () => {
    setEditingPhase(null);
  };

  const handleEditPhaseSuccess = async () => {
    setEditingPhase(null);
    await loadProjectAndPhases();
  };

  // Filter phases based on search and status
  const filteredPhases = phases.filter(phase => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (phase.phase_number?.toString() || '').includes(q) ||
                         (phase.status || '').toLowerCase().includes(q) ||
                         (phase.inspector_name || '').toLowerCase().includes(q) ||
                         (phase.reviewer_name || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || phase.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: phases.length,
    completed: phases.filter(p => p.status === 'completed').length,
    in_progress: phases.filter(p => p.status === 'in_progress').length,
    pending: phases.filter(p => p.status === 'pending').length,
    submitted: phases.filter(p => p.status === 'submitted').length,
    approved: phases.filter(p => p.status === 'approved').length,
    rejected: phases.filter(p => p.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="inspections-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading inspections...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspections-container">
      {/* Header */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            onClick={() => navigate('/projects')}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              marginBottom: '10px',
              fontSize: '14px',
              textDecoration: 'underline'
            }}
          >
            ← Back to Projects
          </button>
          <h1 style={{ margin: '0', fontSize: '28px', fontWeight: '600', color: '#1f2937' }}>
            Inspections - {project?.name || 'Project'}
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Manage and monitor inspection phases
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleCreateNewInspection}
          style={{ fontWeight: 'bold' }}
        >
          + Create New Inspection
        </button>
      </div>

      {/* Statistics Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Total Inspections</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{stats.total}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          border: '1px solid #dcfce7'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Completed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{stats.completed}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fde68a'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>In Progress</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.in_progress}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#fecaca',
          borderRadius: '8px',
          border: '1px solid #fca5a5'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Pending</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{stats.pending}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#dbeafe',
          borderRadius: '8px',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Submitted</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{stats.submitted}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#dcfce7',
          borderRadius: '8px',
          border: '1px solid #bbf7d0'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Approved</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>{stats.approved}</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          border: '1px solid #fca5a5'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Rejected</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#991b1b' }}>{stats.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
        <input
          type="text"
          placeholder="Search inspections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            flex: 1,
            maxWidth: '300px'
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: '#fff'
          }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Inspections Grid */}
      {filteredPhases.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '16px', margin: '0' }}>
            {phases.length === 0 
              ? 'No inspections yet. Create your first inspection to get started.' 
              : 'No inspections match your filters.'}
          </p>
          {phases.length === 0 && (
            <button 
              className="btn btn-primary"
              onClick={handleCreateNewInspection}
              style={{ marginTop: '15px', fontWeight: 'bold' }}
            >
              + Create First Inspection
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Phase</th>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Status</th>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Inspector</th>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Reviewer</th>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Inspection</th>
                <th style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPhases.map((phase) => {
                const inspectionId = getInspectionId(phase);
                return (
                  <tr key={phase.id || phase.phase_number} style={{ backgroundColor: '#fff' }}>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                      <strong>Phase {phase.phase_number}</strong>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                        Created {formatDate(phase.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        backgroundColor: phase.status === 'approved' ? '#dcfce7' : phase.status === 'submitted' ? '#dbeafe' : phase.status === 'rejected' ? '#fee2e2' : phase.status === 'in_progress' ? '#fef3c7' : '#fee2e2',
                        color: phase.status === 'approved' ? '#15803d' : phase.status === 'submitted' ? '#1d4ed8' : phase.status === 'rejected' ? '#991b1b' : phase.status === 'in_progress' ? '#92400e' : '#991b1b',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {phase.status ? phase.status.replace('_', ' ') : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{phase.inspector_name || '-'}</td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{phase.reviewer_name || '-'}</td>
                    
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                      {inspectionId ? `#${inspectionId}` : 'Not created'}
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ minWidth: '95px' }}
                        onClick={() => handleViewPhase(phase)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ minWidth: '95px' }}
                        onClick={() => handleEditPhase(phase)}
                        disabled={!!inspectionId && !isInspectionOnInspectorEnd(phase)}
                      >
                        {inspectionId ? 'Edit' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phase Management Modal */}
      {phaseModalProject && (
        <PhaseManagementModal
          project={phaseModalProject}
          onClose={handleClosePhaseModal}
          onLoadConfiguration={handleLoadConfiguration}
        />
      )}

      {editingPhase && (
        <div className="modal-overlay" onClick={handleEditPhaseClose}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '900px', maxHeight: '85vh' }}
          >
            <div className="modal-header">
              <h2 className="modal-title">Edit Phase {editingPhase.phase_number}</h2>
              <button onClick={handleEditPhaseClose} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <CreateInspectionForm
                project={project}
                phaseNumber={editingPhase.phase_number}
                mode="edit"
                onClose={handleEditPhaseClose}
                onSuccess={handleEditPhaseSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {viewingPhase && (
        <div
          className="modal-overlay"
          onClick={() => setViewingPhase(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(17, 24, 39, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(820px, 100%)',
              maxHeight: '88vh',
              overflow: 'auto',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.22)'
            }}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>
                  Phase {viewingPhase.phase_number}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  Read-only inspection phase details
                </p>
              </div>
              <button
                onClick={() => setViewingPhase(null)}
                style={{
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {viewingPhaseLoading ? (
                <div style={{ padding: '28px', textAlign: 'center', color: '#6b7280' }}>
                  Loading phase details...
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '18px'
                  }}>
                    <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Status</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{viewingPhase.status?.replace('_', ' ') || '-'}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Inspector</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{viewingPhase.inspector_name || viewingPhaseConfig?.inspector_name || '-'}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Reviewer</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{viewingPhase.reviewer_name || viewingPhaseConfig?.reviewer_name || '-'}</div>
                    </div>
                  </div>

                  {viewingPhaseConfig?.domains?.length > 0 ? (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {viewingPhaseConfig.domains.map((domain) => (
                        <div key={domain.domain_id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            backgroundColor: '#eff6ff',
                            color: '#1e3a8a',
                            fontWeight: 600
                          }}>
                            <span>{domain.domain_name}</span>
                            <span>{domain.weightage || 0}%</span>
                          </div>
                          <div style={{ padding: '8px 14px' }}>
                            {domain.sub_domains?.length > 0 ? domain.sub_domains.map((subDomain) => (
                              <div key={subDomain.sub_domain_id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '8px 0',
                                borderBottom: '1px solid #f3f4f6',
                                fontSize: '13px',
                                color: '#374151'
                              }}>
                                <span>{subDomain.sub_domain_name}</span>
                                <span>{subDomain.queries?.length || 0} queries · {subDomain.weightage || 0}%</span>
                              </div>
                            )) : (
                              <div style={{ padding: '8px 0', color: '#9ca3af', fontSize: '13px' }}>No sub-domains</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      No configuration data available
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inspections;
