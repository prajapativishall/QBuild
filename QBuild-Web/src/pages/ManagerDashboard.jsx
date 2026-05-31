import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { managerApi } from '../services/api';
import { reviewerApi } from '../services/api';
import '../styles/ManagerDashboard.css';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState({ pending: [], approved: [], rejected: [] });
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await managerApi.getDashboard();
      setInspections(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading manager dashboard:', error);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedInspection) return;

    try {
      setActionLoading(true);
      await managerApi.approve(selectedInspection, notes);
      setNotes('');
      setSelectedInspection(null);
      await loadDashboard();
      setActionLoading(false);
    } catch (error) {
      console.error('Error approving inspection:', error);
      setError('Failed to approve inspection');
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedInspection) return;

    if (!notes || notes.trim() === '') {
      setError('Rejection notes are required');
      return;
    }

    try {
      setActionLoading(true);
      await managerApi.reject(selectedInspection, notes);
      setNotes('');
      setSelectedInspection(null);
      await loadDashboard();
      setActionLoading(false);
    } catch (error) {
      console.error('Error rejecting inspection:', error);
      setError('Failed to reject inspection');
      setActionLoading(false);
    }
  };

  const handleViewInspection = async (inspectionId) => {
    try {
      const response = await managerApi.getInspectionForReview(inspectionId);
      navigate(`/manager-dashboard/review/${inspectionId}`, { state: { inspectionData: response.data } });
    } catch (error) {
      console.error("Error fetching inspection for review:", error);
      setError("Failed to load inspection details.");
    }
  };

  if (loading) {
    return (
      <div className="manager-dashboard">
        <div className="manager-loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      <div className="manager-header">
        <div className="manager-title-section">
          <h1 className="manager-title">Manager Dashboard</h1>
          <p className="manager-subtitle">Review and approve inspections from reviewers</p>
        </div>
        <div className="manager-stats">
          <div className="manager-stat-card pending" onClick={() => setSelectedTab('pending')}>
            <div className="manager-stat-value">{inspections.pending.length}</div>
            <div className="manager-stat-label">Pending</div>
          </div>
          <div className="manager-stat-card approved" onClick={() => setSelectedTab('approved')}>
            <div className="manager-stat-value">{inspections.approved.length}</div>
            <div className="manager-stat-label">Approved</div>
          </div>
          <div className="manager-stat-card rejected" onClick={() => setSelectedTab('rejected')}>
            <div className="manager-stat-value">{inspections.rejected.length}</div>
            <div className="manager-stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="manager-error">
          {error}
        </div>
      )}

      <div className="manager-tabs">
        <button
          className={`manager-tab ${selectedTab === 'pending' ? 'active' : ''}`}
          onClick={() => setSelectedTab('pending')}
        >
          Pending ({inspections.pending.length})
        </button>
        <button
          className={`manager-tab ${selectedTab === 'approved' ? 'active' : ''}`}
          onClick={() => setSelectedTab('approved')}
        >
          Approved ({inspections.approved.length})
        </button>
        <button
          className={`manager-tab ${selectedTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setSelectedTab('rejected')}
        >
          Rejected ({inspections.rejected.length})
        </button>
      </div>

      {inspections[selectedTab].length === 0 ? (
        <div className="manager-empty">
          <div className="manager-empty-icon">✓</div>
          <h2 className="manager-empty-title">No {selectedTab} inspections</h2>
          <p className="manager-empty-description">
            {selectedTab === 'pending' && 'No inspections waiting for your approval'}
            {selectedTab === 'approved' && 'No inspections have been approved yet'}
            {selectedTab === 'rejected' && 'No inspections have been rejected yet'}
          </p>
        </div>
      ) : (
        <div className="manager-table-container">
          <table className="manager-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Phase</th>
                <th>Reviewer</th>
                <th>Inspector</th>
                <th>Submitted</th>
                <th>Reviewer Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inspections[selectedTab].map((inspection) => (
                <tr key={inspection.id}>
                  <td>{inspection.project_name}</td>
                  <td>Phase {inspection.phase}</td>
                  <td>{inspection.reviewer_name || 'Not assigned'}</td>
                  <td>{inspection.inspector_name || 'Not assigned'}</td>
                  <td>{new Date(inspection.created_at).toLocaleDateString()}</td>
                  <td>{inspection.reviewer_notes || '-'}</td>
                  <td>
                    <div className="manager-actions">
                      <button
                        onClick={() => handleViewInspection(inspection.id)}
                        className="manager-btn manager-btn-view"
                      >
                        View
                      </button>
                      {selectedTab === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedInspection(inspection.id);
                              setNotes('');
                            }}
                            className="manager-btn manager-btn-approve"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInspection(inspection.id);
                              setNotes('');
                            }}
                            className="manager-btn manager-btn-reject"
                          >
                            Reject
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

      {selectedInspection && (
        <div className="manager-modal-overlay">
          <div className="manager-modal">
            <div className="manager-modal-header">
              <h3>Review Inspection</h3>
              <button onClick={() => setSelectedInspection(null)} className="manager-modal-close">×</button>
            </div>
            <div className="manager-modal-body">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes (required for rejection)"
                className="manager-modal-textarea"
              />
            </div>
            <div className="manager-modal-footer">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="manager-btn manager-btn-approve"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="manager-btn manager-btn-reject"
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => setSelectedInspection(null)}
                className="manager-btn manager-btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
