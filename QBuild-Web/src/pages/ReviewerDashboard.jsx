import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reviewerApi } from '../services/api';
import '../styles/ReviewerDashboard.css';

const ReviewerDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    pending: [],
    approved: [],
    rejected: [],
    summary: { pending: 0, approved: 0, rejected: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState(null); // 'approve' or 'reject'
  const [submitting, setSubmitting] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await reviewerApi.getDashboard();
      setDashboardData(response.data || {
        pending: [],
        approved: [],
        rejected: [],
        summary: { pending: 0, approved: 0, rejected: 0 }
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (inspectionId) => {
    setSelectedInspection(inspectionId);
    setAction('approve');
    setNotes('');
  };

  const handleReject = async (inspectionId) => {
    setSelectedInspection(inspectionId);
    setAction('reject');
    setNotes('');
  };

  const confirmAction = async () => {
    if (!selectedInspection || !action) return;

    try {
      setSubmitting(true);
      setError(null);

      if (action === 'approve') {
        await reviewerApi.approve(selectedInspection, notes);
      } else {
        await reviewerApi.reject(selectedInspection, notes);
      }

      // Reload dashboard
      await loadDashboard();
      setSelectedInspection(null);
      setAction(null);
      setNotes('');
    } catch (err) {
      setError(err.message || 'Failed to process action');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAction = () => {
    setSelectedInspection(null);
    setAction(null);
    setNotes('');
  };

  const toggleProjectExpansion = (projectId) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const groupInspectionsByProject = (inspections) => {
    const grouped = {};
    inspections.forEach((inspection) => {
      const projectKey = `${inspection.project_id}-${inspection.project_name}`;
      if (!grouped[projectKey]) {
        grouped[projectKey] = {
          projectId: inspection.project_id,
          projectName: inspection.project_name,
          inspections: []
        };
      }
      grouped[projectKey].inspections.push(inspection);
    });
    return Object.values(grouped).sort((a, b) => a.projectName.localeCompare(b.projectName));
  };

  const getApprovalStatusClass = (status) => {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      case 'pending':
      default:
        return 'status-pending';
    }
  };

  if (loading) {
    return (
      <div className="reviewer-dashboard">
        <div className="reviewer-loading">
          <div className="spinner"></div>
          <p>Loading pending inspections...</p>
        </div>
      </div>
    );
  }

  const getCurrentInspections = () => {
    switch (selectedTab) {
      case 'pending':
        return dashboardData.pending;
      case 'approved':
        return dashboardData.approved;
      case 'rejected':
        return dashboardData.rejected;
      default:
        return dashboardData.pending;
    }
  };

  return (
    <div className="reviewer-dashboard">
      <div className="reviewer-header">
        <div className="reviewer-title-section">
          <h1 className="reviewer-title">Dashboard</h1>
          <p className="reviewer-subtitle">Review and approve inspection submissions</p>
        </div>
        <div className="reviewer-stats">
          <div className="reviewer-stat-card pending" onClick={() => setSelectedTab('pending')}>
            <div className="stat-value">{dashboardData.summary.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="reviewer-stat-card approved" onClick={() => setSelectedTab('approved')}>
            <div className="stat-value">{dashboardData.summary.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="reviewer-stat-card rejected" onClick={() => setSelectedTab('rejected')}>
            <div className="stat-value">{dashboardData.summary.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="reviewer-error">
          {error}
        </div>
      )}

      <div className="reviewer-tabs">
        <button
          className={`tab-btn ${selectedTab === 'pending' ? 'active' : ''}`}
          onClick={() => setSelectedTab('pending')}
        >
          Pending ({dashboardData.summary.pending})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'approved' ? 'active' : ''}`}
          onClick={() => setSelectedTab('approved')}
        >
          Approved ({dashboardData.summary.approved})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setSelectedTab('rejected')}
        >
          Rejected ({dashboardData.summary.rejected})
        </button>
      </div>

      {getCurrentInspections().length === 0 ? (
        <div className="reviewer-empty">
          <div className="reviewer-empty-icon">✓</div>
          <h2 className="reviewer-empty-title">No {selectedTab} inspections</h2>
          <p className="reviewer-empty-description">
            There are no {selectedTab} inspections to display.
          </p>
        </div>
      ) : (
        <div className="reviewer-table-container">
          <table className="reviewer-table">
            <thead>
              <tr>
                <th>Inspection ID</th>
                <th>Project</th>
                <th>Phase</th>
                <th>Inspector</th>
                <th>Manager</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getCurrentInspections().map((inspection) => (
                <tr key={inspection.id}>
                  <td className="inspection-id">#{inspection.id}</td>
                  <td className="inspection-project">{inspection.project_name}</td>
                  <td className="inspection-phase">Phase {inspection.phase}</td>
                  <td className="inspection-inspector">
                    {inspection.inspector_name || 'Not assigned'}
                  </td>
                  <td className="inspection-manager">
                    {inspection.manager_name || 'Not assigned'}
                  </td>
                  <td className="inspection-progress">
                    {inspection.submitted_subdomains}/{inspection.total_subdomains}
                  </td>
                  <td>
                    <span className={`approval-status ${getApprovalStatusClass(inspection.approval_status)}`}>
                      {inspection.approval_status}
                    </span>
                  </td>
                  <td>
                    <div className="reviewer-actions">
                      <button
                        onClick={() => navigate(`/reviewer-dashboard/review/${inspection.id}`)}
                        className="action-btn view"
                        title="View Details"
                      >
                        👁 View
                      </button>
                      {selectedTab === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(inspection.id)}
                            className="action-btn approve"
                            title="Approve"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReject(inspection.id)}
                            className="action-btn reject"
                            title="Reject"
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {selectedInspection && (
        <div className="modal-overlay" onClick={cancelAction}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {action === 'approve' ? 'Approve Inspection' : 'Reject Inspection'}
              </h2>
              <button
                onClick={cancelAction}
                className="modal-close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-info">
                <p className="modal-info-text">
                  You are about to <strong>{action}</strong> inspection #{selectedInspection}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="notes" className="form-label">
                  Notes {action === 'reject' && '(Required for rejection)'}
                </label>
                <textarea
                  id="notes"
                  className="form-textarea"
                  placeholder={action === 'approve' 
                    ? 'Add any optional notes for this approval...' 
                    : 'Please provide a reason for rejection...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button
                  onClick={cancelAction}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                  disabled={submitting || (action === 'reject' && !notes.trim())}
                >
                  {submitting ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerDashboard;
