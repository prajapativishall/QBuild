import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managerApi, getBaseUrl } from '../services/api';
import '../styles/ManagerInspectionReview.css';

const ManagerInspectionReview = () => {
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const [inspectionData, setInspectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDomains, setExpandedDomains] = useState({});
  const [expandedSubDomains, setExpandedSubDomains] = useState({});
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectionType, setRejectionType] = useState('inspection');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedSubDomain, setSelectedSubDomain] = useState(null);
  const [selectedQueries, setSelectedQueries] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectionHistory, setInspectionHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState({});

  useEffect(() => {
    loadInspectionData();
    loadInspectionHistory();
  }, [inspectionId]);

  const loadInspectionHistory = async () => {
    try {
      const response = await managerApi.getInspectionRejectionHistory(inspectionId);
      if (response?.success) {
        setInspectionHistory(response.data || []);
      }
    } catch (error) {
      console.error('Error loading inspection history:', error);
    }
  };

  const loadInspectionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await managerApi.getInspectionForReview(inspectionId);
      console.log('Manager inspection data:', response.data);
      console.log('All queries with photo data:', response.data.queries?.map(q => ({ 
        queryId: q.queryId, 
        hasPhotos: q.sitePhotos && q.sitePhotos.length > 0, 
        photos: q.sitePhotos,
        response: q.response,
        comments: q.comments,
        additionalRemarks: q.additionalRemarks
      })));
      console.log('Sample queries with photos:', response.data.queries?.filter(q => q.sitePhotos && q.sitePhotos.length > 0).slice(0, 2));
      setInspectionData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load inspection data');
    } finally {
      setLoading(false);
    }
  };

  const toggleDomain = (domainId) => {
    setExpandedDomains(prev => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  };

  const toggleSubDomain = (subDomainId) => {
    setExpandedSubDomains(prev => ({
      ...prev,
      [subDomainId]: !prev[subDomainId]
    }));
  };

  const toggleHistoryItem = (historyId) => {
    setExpandedHistoryIds(prev => ({
      ...prev,
      [historyId]: !prev[historyId]
    }));
  };

  const getQueriesForSubDomain = (subDomainId, domainId) => {
    if (!inspectionData?.queries) return [];
    return inspectionData.queries.filter(
      q => q.subDomainId === subDomainId && q.domainId === domainId
    );
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const response = await managerApi.approve(inspectionId, '');
      if (response.success) {
        setShowApproveDialog(false);
        await loadInspectionData();
        await loadInspectionHistory();
      }
    } catch (error) {
      console.error('Error approving inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    // Validate granular rejection selections for manager
    if (rejectionType === 'domain' && !selectedDomain) {
      alert('Please select a domain to reject');
      return;
    }
    if (rejectionType === 'subdomain' && (!selectedDomain || !selectedSubDomain)) {
      alert('Please select both domain and sub-domain to reject');
      return;
    }
    if (rejectionType === 'query' && selectedQueries.length === 0) {
      alert('Please select at least one query to reject');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const rejectionData = {
        notes: rejectReason,
        rejectionType: rejectionType,
        domainId: rejectionType === 'domain' || rejectionType === 'subdomain' ? selectedDomain : null,
        subDomainId: rejectionType === 'subdomain' ? selectedSubDomain : null,
        rejectedItems: rejectionType === 'query' ? selectedQueries.map(id => ({ queryId: id })) : null
      };

      const response = await managerApi.reject(inspectionId, rejectionData);
      if (response.success) {
        setShowRejectDialog(false);
        setRejectReason('');
        setRejectionType('inspection');
        setSelectedDomain(null);
        setSelectedSubDomain(null);
        setSelectedQueries([]);
        await loadInspectionData();
        await loadInspectionHistory();
      }
    } catch (error) {
      console.error('Error rejecting inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResponseTypeClass = (response) => {
    switch (response) {
      case 'YES':
        return 'response-yes';
      case 'NO':
        return 'response-no';
      case 'NA':
        return 'response-na';
      default:
        return 'response-none';
    }
  };

  const normalizeSnapshotResponses = (responseData) => {
    try {
      if (!responseData) return [];
      
      // If it's already a flat array of response objects (has domain_id, question_id keys directly)
      if (Array.isArray(responseData)) {
        if (responseData.length === 0) return responseData;
        // Check if first item is a proper response object or a wrapper object with numeric keys
        const firstItem = responseData[0];
        if (firstItem && typeof firstItem === 'object') {
          const keys = Object.keys(firstItem);
          // If all keys are numeric strings like "0", "1", "2", this is a legacy wrapper format
          if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            // The items are nested under numeric keys, extract them
            const flattened = [];
            for (const item of responseData) {
              for (const key of Object.keys(item)) {
                const nestedItem = item[key];
                if (nestedItem && typeof nestedItem === 'object' && !Array.isArray(nestedItem)) {
                  flattened.push(nestedItem);
                }
              }
            }
            return flattened;
          }
          // First item has response-specific fields, just return the array as-is
          if (firstItem.question_id !== undefined || firstItem.id !== undefined) {
            return responseData;
          }
          // Wrap single response object into array
          if (firstItem.response_value !== undefined || firstItem.site_photos !== undefined) {
            return responseData;
          }
        }
        return responseData;
      }

      // Handle the case where responseData itself has the shape { ...response fields }
      if (responseData.question_id !== undefined || responseData.response_value !== undefined) {
        return [responseData];
      }

      const prevState = responseData.previousState || responseData;
      let responsesSource = null;

      // Try multiple paths to find the responses data
      if (prevState?.responses) {
        responsesSource = prevState.responses;
      } else if (responseData.responses) {
        responsesSource = responseData.responses;
      } else if (prevState?.submissions) {
        return [];
      } else {
        responsesSource = responseData;
      }

      if (!responsesSource) return [];

      // Recurse if responsesSource is an object (not array) with its own responses field
      if (!Array.isArray(responsesSource) && responsesSource.responses) {
        return normalizeSnapshotResponses(responsesSource);
      }

      // If we reached this point with an array, do final processing
      if (Array.isArray(responsesSource)) {
        // Handle deeply nested legacy format: [{ "0": {actualData}, "1": {actualData} }]
        if (responsesSource.length > 0) {
          const firstItem = responsesSource[0];
          if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
            const keys = Object.keys(firstItem);
            if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
              const flattened = [];
              for (const item of responsesSource) {
                for (const key of Object.keys(item)) {
                  const nestedItem = item[key];
                  if (nestedItem && typeof nestedItem === 'object' && !Array.isArray(nestedItem)) {
                    flattened.push(nestedItem);
                  }
                }
              }
              return flattened;
            }
          }
        }
        return responsesSource;
      }

      return [];
    } catch (e) {
      console.error('Error normalizing snapshot responses:', e);
      return [];
    }
  };

  const matchId = (a, b) => {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  };

  const getHistoryActionType = (responses) => {
    if (!responses) return 'rejected';
    let responseData = null;
    if (typeof responses === 'string') {
      try {
        responseData = JSON.parse(responses);
      } catch {
        return 'rejected';
      }
    } else if (typeof responses === 'object') {
      responseData = responses;
    }

    if (responseData?.action === 'approve') return 'approved';
    if (responseData?.action_type === 'approved') return 'approved';
    return 'rejected';
  };

  // ====================
  // Actor/Action/Scope badge rendering
  // ====================
  const getHistoryBadge = (item) => {
    const actorRole = item.actor_role || (item.rejection_type === 'reviewer' ? 'reviewer' : item.rejection_type === 'manager' ? 'manager' : 'reviewer');
    const actionType = item.action_type || getHistoryActionType(item.responses);
    const scopeType = item.scope_type || 'inspection';
    
    let displayScope = scopeType.charAt(0).toUpperCase() + scopeType.slice(1);
    let badgeClass = `history-badge history-${actionType}`;
    
    return (
      <span className={badgeClass}>
        {actorRole === 'reviewer' ? 'Reviewer' : 'Manager'} {actionType === 'approved' ? 'Approved' : 'Rejected'} {displayScope}
      </span>
    );
  };

  const getActorBadgeClass = (actorRole) => {
    return actorRole === 'manager' ? 'badge-manager' : 'badge-reviewer';
  };

  if (loading) {
    return (
      <div className="manager-inspection-review">
        <div className="manager-loading">
          <div className="spinner"></div>
          <p>Loading inspection data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="manager-inspection-review">
        <div className="manager-error">
          {error}
        </div>
      </div>
    );
  }

  if (!inspectionData) {
    return (
      <div className="manager-inspection-review">
        <div className="manager-empty">
          <h2>Inspection not found</h2>
        </div>
      </div>
    );
  }

  const { inspection, domains, queries } = inspectionData;

  return (
    <div className="manager-inspection-review">
      <div className="review-header">
        <button onClick={() => navigate('/manager-dashboard')} className="back-btn">
          ← Back to Dashboard
        </button>
        <div className="review-title-section">
          <h1 className="review-title">Inspection Review</h1>
          <p className="review-subtitle">
            {inspection.project_name} - Phase {inspection.phase}
          </p>
        </div>
        <div className="review-actions">
          {/* Only show approve/reject buttons when reviewer has approved the inspection first */}
          {inspection.approval_status === 'approved' && inspection.manager_approval_status === 'pending' ? (
            <div className="action-buttons">
              <button
                onClick={() => setShowApproveDialog(true)}
                className="btn btn-approve"
                disabled={isSubmitting}
              >
                <svg className="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {isSubmitting ? 'Processing...' : 'Final Approval'}
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                className="btn btn-reject"
                disabled={isSubmitting}
              >
                <svg className="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                {isSubmitting ? 'Processing...' : 'Reject'}
              </button>
            </div>
          ) : (
            <div className="status-container">
              <span className={`status-badge ${inspection.manager_approval_status}`}>
                {inspection.manager_approval_status === 'approved' ? (
                  <>
                    <svg className="status-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Finally Approved
                  </>
                ) : (
                  <>
                    <svg className="status-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Rejected
                  </>
                )}
              </span>
            </div>
          )}

          {/* History Button */}
          {inspectionHistory.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="btn btn-secondary"
              style={{ marginLeft: 'var(--spacing-3)' }}
            >
              <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              History ({inspectionHistory.length})
            </button>
          )}
        </div>

        {/* Approve Confirmation Dialog */}
        {showApproveDialog && (
          <div className="modal-overlay">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3>Confirm Final Approval</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowApproveDialog(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to give final approval to this inspection? This action will complete the inspection process and the project will be marked as completed.</p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowApproveDialog(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-approve"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="btn-icon animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Approving...
                    </>
                  ) : (
                    <>
                      <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      Confirm Final Approval
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Dialog */}
        {showRejectDialog && (
          <div className="modal-overlay">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3>Confirm Rejection</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowRejectDialog(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to reject this inspection? This will send it back to the reviewer.</p>

                {/* Rejection scope selector */}

                <div className="rejection-reason-section">
                  <label className="form-label">Rejection Reason:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Enter rejection reason..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows="4"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectReason('');
                    setRejectionType('inspection');
                    setSelectedDomain(null);
                    setSelectedSubDomain(null);
                    setSelectedQueries([]);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-reject"
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectReason.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="btn-icon animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <svg className="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                      Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="review-content">
        <div className="inspection-info">
          <div className="info-card">
            <div className="info-label">Reviewer</div>
            <div className="info-value">{inspection.reviewer_name || 'Not assigned'}</div>
          </div>
          <div className="info-card">
            <div className="info-label">Inspector</div>
            <div className="info-value">{inspection.inspector_name || 'Not assigned'}</div>
          </div>
          <div className="info-card">
            <div className="info-label">Inspection Date</div>
            <div className="info-value">
              {new Date(inspection.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="info-card">
            <div className="info-label">Reviewer Status</div>
            <div className="info-value">
              <span className={`status-badge ${inspection.approval_status}`}>
                {inspection.approval_status}
              </span>
            </div>
          </div>
          <div className="info-card">
            <div className="info-label">Manager Status</div>
            <div className="info-value">
              <span className={`status-badge ${inspection.manager_approval_status}`}>
                {inspection.manager_approval_status}
              </span>
            </div>
          </div>
          {inspection.reviewer_notes && (
            <div className="info-card full-width">
              <div className="info-label">Reviewer Notes</div>
              <div className="info-value">{inspection.reviewer_notes}</div>
            </div>
          )}
        </div>

        <div className="domains-container">
          {domains.map((domain) => (
            <div key={domain.domainId} className="domain-card">
              <div
                className="domain-header"
                onClick={() => toggleDomain(domain.domainId)}
              >
                <div className="domain-title">
                  <span className="expand-icon">
                    {expandedDomains[domain.domainId] ? '▼' : '▶'}
                  </span>
                  <h3>{domain.domainName}</h3>
                </div>
                <div className="domain-stats">
                  {domain.subDomains.filter(sd => sd.submitted).length}/{domain.subDomains.length} submitted
                </div>
              </div>

              {expandedDomains[domain.domainId] && (
                <div className="domain-content">
                  {domain.subDomains.map((subDomain) => (
                    <div key={subDomain.sub_domain_id} className="subdomain-card">
                      <div
                        className="subdomain-header"
                        onClick={() => toggleSubDomain(subDomain.sub_domain_id)}
                      >
                        <div className="subdomain-title">
                          <span className="expand-icon">
                            {expandedSubDomains[subDomain.sub_domain_id] ? '▼' : '▶'}
                          </span>
                          <h4>{subDomain.sub_domain_name}</h4>
                        </div>
                        <div className={`submission-status ${subDomain.submitted ? 'submitted' : 'pending'}`}>
                          {subDomain.submitted ? '✓ Submitted' : '○ Pending'}
                        </div>
                      </div>

                      {expandedSubDomains[subDomain.sub_domain_id] && (
                        <div className="subdomain-content">
                          {getQueriesForSubDomain(subDomain.sub_domain_id, domain.domainId).map((query) => (
                            <div key={query.queryId} className="query-card">
                              <div className="query-header">
                                <div className="query-type-badge">
                                  {query.isPrimary ? 'Primary' : 'Secondary'}
                                </div>
                                <div className="query-id">#{query.queryId}</div>
                              </div>
                              <div className="question-text">
                                {query.questionText}
                              </div>
                              <div className="response-section">
                                <div className="response-label">Response:</div>
                                <div className={`response-value ${getResponseTypeClass(query.response)}`}>
                                  {query.response || 'Not answered'}
                                </div>
                              </div>
                              {query.comments && (
                                <div className="comments-section">
                                  <div className="comments-label">Comments:</div>
                                  <div className="comments-text">{query.comments}</div>
                                </div>
                              )}
                              {query.nctype && (
                                <div className="nc-type-section">
                                  <div className="nc-type-label">NC Type:</div>
                                  <div className="nc-type-value">{query.nctype}</div>
                                </div>
                              )}
                              {query.additionalRemarks && (
                                <div className="additional-remarks-section">
                                  <div className="additional-remarks-label">Additional Remarks:</div>
                                  <div className="additional-remarks-text">{query.additionalRemarks}</div>
                                </div>
                              )}
                              {/* Only show site photos when response is NO (photos are evidence for non-conformances) */}
                              {query.response === 'NO' && query.sitePhotos && query.sitePhotos.length > 0 && (
                                <div className="photos-section">
                                  <div className="photos-label">Site Photos:</div>
                                  <div className="photos-gallery">
                                    {query.sitePhotos.map((photo, index) => (
                                      <div key={index} className="photo-item">
                                        <img 
                                          src={`${getBaseUrl()}${photo}`} 
                                          alt={`Site photo ${index + 1}`}
                                          className="photo-thumbnail"
                                          onClick={() => window.open(`${getBaseUrl()}${photo}`, '_blank')}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {query.submittedAt && (
                                <div className="submitted-at">
                                  Submitted: {new Date(query.submittedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Inspection History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>Inspection History</h3>
              <button 
                className="modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {inspectionHistory.length === 0 ? (
                <p>No history found for this inspection.</p>
              ) : (
                <div className="history-timeline">
                  {inspectionHistory.map((historyItem, index) => {
                    const actorRole = historyItem.actor_role || 'reviewer';
                    const actionType = historyItem.action_type || 'rejected';
                    const scopeType = historyItem.scope_type || 'inspection';
                    const isLast = index === inspectionHistory.length - 1;

                    return (
                      <div key={index} className={`timeline-item ${actionType === 'approved' ? 'timeline-approved' : 'timeline-rejected'}`}>
                        {/* Timeline connector */}
                        <div className="timeline-marker">
                          <div className={`timeline-dot ${actionType === 'approved' ? 'dot-approved' : 'dot-rejected'}`}>
                            {actionType === 'approved' ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M18 6L6 18M6 6l12 12"/>
                              </svg>
                            )}
                          </div>
                          {!isLast && <div className="timeline-line" />}
                        </div>

                        {/* Timeline card */}
                        <div className="timeline-card">
                          <div className="timeline-card-header">
                            <div className="timeline-badges">
                              {getHistoryBadge(historyItem)}
                            </div>
                            <span className="timeline-date">
                              {new Date(historyItem.rejection_date).toLocaleString()}
                            </span>
                          </div>

                          {/* Actor info */}
                          <div className="timeline-actor-section">
                            <span className={`actor-badge ${getActorBadgeClass(actorRole)}`}>
                              {actorRole === 'reviewer' ? 'Reviewer' : 'Manager'}
                            </span>
                            <span className="actor-name">
                              {historyItem.rejected_by_name}
                            </span>
                          </div>

                          {/* Scope details */}
                          {scopeType === 'domain' && historyItem.domain_id && (
                            <div className="timeline-scope-detail">
                              <strong>Domain ID:</strong> {historyItem.domain_id}
                            </div>
                          )}
                          {scopeType === 'subdomain' && historyItem.sub_domain_id && (
                            <div className="timeline-scope-detail">
                              <strong>Sub-domain ID:</strong> {historyItem.sub_domain_id}
                              {historyItem.domain_id && <span> (Domain: {historyItem.domain_id})</span>}
                            </div>
                          )}
                          {scopeType === 'query' && historyItem.query_id && (
                            <div className="timeline-scope-detail">
                              <strong>Query ID:</strong> {historyItem.query_id}
                              {historyItem.sub_domain_id && <span> (Sub-domain: {historyItem.sub_domain_id})</span>}
                            </div>
                          )}

                          {/* Notes */}
                          {historyItem.rejection_notes && (
                            <div className="timeline-notes">
                              <strong>Notes:</strong>
                              <p>{historyItem.rejection_notes}</p>
                            </div>
                          )}

                          {/* Reason */}
                          {historyItem.rejection_reason && (
                            <div className="timeline-reason">
                              <strong>Reason:</strong>
                              <p>{historyItem.rejection_reason}</p>
                            </div>
                          )}

                          {/* Historical snapshot */}
                          {historyItem.responses && (
                            <div className="timeline-snapshot">
                              <button
                                className="btn btn-link"
                                onClick={() => toggleHistoryItem(historyItem.id)}
                              >
                                {expandedHistoryIds[historyItem.id] ? '▼' : '▶'} View Historical Snapshot
                              </button>
                              
                              {expandedHistoryIds[historyItem.id] && (
                                <div className="timeline-snapshot-content">
                                  {(() => {
                                    try {
                                      let responseData = null;
                                      if (typeof historyItem.responses === 'string') {
                                        try {
                                          responseData = JSON.parse(historyItem.responses);
                                        } catch (e) {
                                          return <p className="snapshot-error">Unable to parse historical data</p>;
                                        }
                                      } else if (typeof historyItem.responses === 'object') {
                                        responseData = historyItem.responses;
                                      }

                                      if (!responseData) return null;

                                      let rawResponsesArray = normalizeSnapshotResponses(responseData);
                                      
                                      // Flatten responses from legacy format: [{ "0": {data}, "1": {data} }]
                                      // where objects have numeric string keys wrapping the actual response objects
                                      let responsesArray = [];
                                      for (const item of rawResponsesArray) {
                                        if (item && typeof item === 'object') {
                                          const keys = Object.keys(item);
                                          let foundNested = false;
                                          for (const key of keys) {
                                            const val = item[key];
                                            if (val && typeof val === 'object' && !Array.isArray(val)) {
                                              if (val.id !== undefined || val.domain_id !== undefined || val.question_id !== undefined) {
                                                responsesArray.push(val);
                                                foundNested = true;
                                              }
                                            }
                                          }
                                          if (!foundNested) {
                                            responsesArray.push(item);
                                          }
                                        } else {
                                          responsesArray.push(item);
                                        }
                                      }

                                      if (responsesArray.length === 0) {
                                        return <p className="snapshot-error">No historical snapshot data available</p>;
                                      }

                                      // Pre-process snapshot responses: normalize site_photos to always be an array
                                      const normalizePhotos = (r) => {
                                        const photos = r.site_photos ?? r.sitePhotos;
                                        if (Array.isArray(photos)) return photos;
                                        if (typeof photos === 'string') {
                                          try {
                                            return JSON.parse(photos);
                                          } catch { return []; }
                                        }
                                        return [];
                                      };

                                      const renderedDomains = domains
                                        .map((domain) => {
                                          const domainResponses = responsesArray.filter(
                                            r => matchId(r.domain_id ?? r.domainId, domain.domainId)
                                          );
                                          if (domainResponses.length === 0) return null;

                                          return (
                                            <div key={domain.domainId} className="domain-card snapshot-domain">
                                              <div className="domain-header">
                                                <h4>{domain.domainName}</h4>
                                                <span className="domain-stats">{domainResponses.length} responses</span>
                                              </div>
                                              <div className="domain-content">
                                                {domain.subDomains.map((subDomain) => {
                                                  const subDomainResponses = domainResponses.filter(
                                                    r => matchId(r.sub_domain_id ?? r.subDomainId, subDomain.sub_domain_id)
                                                  );
                                                  if (subDomainResponses.length === 0) return null;

                                                  return (
                                                    <div key={subDomain.sub_domain_id} className="subdomain-card snapshot-subdomain">
                                                      <div className="subdomain-header">
                                                        <h5>{subDomain.sub_domain_name}</h5>
                                                        <span className="domain-stats">{subDomainResponses.length} responses</span>
                                                      </div>
                                                      <div className="subdomain-content">
                                                        {subDomainResponses.map((response) => {
                                                          const questionId = response.question_id ?? response.questionId;
                                                          const query = inspectionData.queries?.find(q => matchId(q.queryId, questionId));
                                                          const snapshotPhotos = normalizePhotos(response);
                                                          return (
                                                            <div key={questionId || response.id} className="query-card snapshot-query">
                                                              <div className="query-header">
                                                                <div className="query-type-badge">
                                                                  {query?.isPrimary ? 'Primary' : 'Secondary'}
                                                                </div>
                                                                <div className="query-id">#{questionId}</div>
                                                              </div>
                                                              <div className="question-text">
                                                                {query?.questionText || 'Question not found'}
                                                              </div>
                                                              <div className="response-section">
                                                                <div className="response-label">Response:</div>
                                                                <div className={`response-value ${getResponseTypeClass(response.response_value)}`}>
                                                                  {response.response_value || 'Not answered'}
                                                                </div>
                                                              </div>
                                                              {response.inspector_comment && (
                                                                <div className="comments-section">
                                                                  <div className="comments-label">Comments:</div>
                                                                  <div className="comments-text">{response.inspector_comment}</div>
                                                                </div>
                                                              )}
                                                              {response.nc_type && (
                                                                <div className="nc-type-section">
                                                                  <div className="nc-type-label">NC Type:</div>
                                                                  <div className="nc-type-value">{response.nc_type}</div>
                                                                </div>
                                                              )}
                                                              {response.additional_remarks && (
                                                                <div className="additional-remarks-section">
                                                                  <div className="additional-remarks-label">Additional Remarks:</div>
                                                                  <div className="additional-remarks-text">{response.additional_remarks}</div>
                                                                </div>
                                                              )}
                                                              {snapshotPhotos.length > 0 && (
                                                                <div className="photos-section">
                                                                  <div className="photos-label">Site Photos:</div>
                                                                  <div className="photos-gallery">
                                                                    {snapshotPhotos.map((photo, index) => (
                                                                      <div key={index} className="photo-item">
                                                                        <img 
                                                                          src={`${getBaseUrl()}${photo}`} 
                                                                          alt={`Site photo ${index + 1}`}
                                                                          className="photo-thumbnail"
                                                                          onClick={() => window.open(`${getBaseUrl()}${photo}`, '_blank')}
                                                                        />
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })
                                        .filter(Boolean);

                                      if (renderedDomains.length === 0) {
                                        return <p className="snapshot-error">No matching domains found in snapshot data.</p>;
                                      }

                                      return <div className="domains-container">{renderedDomains}</div>;
                                    } catch (err) {
                                      console.error('Error rendering historical snapshot:', err);
                                      return <p className="snapshot-error">Failed to render historical snapshot data. See console for details.</p>;
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerInspectionReview;