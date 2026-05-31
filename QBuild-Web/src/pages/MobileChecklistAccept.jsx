import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionApi, projectApi } from '../services/api';
import '../styles/MobileChecklistAccept.css';

const MobileChecklistAccept = () => {
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadInspectionDetails();
  }, [inspectionId]);

  const loadInspectionDetails = async () => {
    try {
      setLoading(true);
      
      // Load inspection responses to get project info
      const response = await inspectionApi.getResponses(inspectionId);
      
      if (response.data && response.data.length > 0) {
        // Get project details
        const projectId = response.data[0].project_id;
        const projectResponse = await projectApi.getById(projectId);
        setProject(projectResponse.data);
        setInspection({
          id: inspectionId,
          ...response.data[0]
        });
      }
    } catch (err) {
      console.error('Failed to load inspection details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    // Simulate acceptance delay
    await new Promise(resolve => setTimeout(resolve, 500));
    navigate(`/mobile-inspection/${inspectionId}`);
  };

  const handleReject = () => {
    navigate('/mobile-dashboard');
  };

  if (loading) {
    return (
      <div className="mobile-checklist-accept">
        <div className="mobile-checklist-loading">
          <div className="mobile-spinner"></div>
          <p>Loading inspection details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-checklist-accept">
      {/* Header */}
      <div className="mobile-checklist-header">
        <button 
          className="mobile-back-btn"
          onClick={() => navigate('/mobile-dashboard')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="mobile-checklist-title">Inspection Details</h1>
        <div className="mobile-checklist-spacer"></div>
      </div>

      {/* Content */}
      <div className="mobile-checklist-content">
        <div className="mobile-checklist-card">
          <div className="mobile-checklist-icon">📋</div>
          
          <h2 className="mobile-checklist-project-name">
            {project?.project_name || 'Project Name'}
          </h2>
          
          <div className="mobile-checklist-info">
            <div className="mobile-checklist-info-item">
              <span className="mobile-checklist-label">Location:</span>
              <span className="mobile-checklist-value">
                {project?.city}, {project?.state}
              </span>
            </div>
            <div className="mobile-checklist-info-item">
              <span className="mobile-checklist-label">Address:</span>
              <span className="mobile-checklist-value">
                {project?.site_address || 'N/A'}
              </span>
            </div>
            <div className="mobile-checklist-info-item">
              <span className="mobile-checklist-label">Description:</span>
              <span className="mobile-checklist-value">
                {project?.description || 'No description available'}
              </span>
            </div>
          </div>

          <div className="mobile-checklist-sections">
            <h3 className="mobile-checklist-sections-title">
              Inspection Sections
            </h3>
            <div className="mobile-checklist-sections-list">
              <div className="mobile-checklist-section-item">
                <span className="mobile-checklist-section-icon">🏗️</span>
                <span className="mobile-checklist-section-name">Structural</span>
              </div>
              <div className="mobile-checklist-section-item">
                <span className="mobile-checklist-section-icon">⚡</span>
                <span className="mobile-checklist-section-name">Electrical</span>
              </div>
              <div className="mobile-checklist-section-item">
                <span className="mobile-checklist-section-icon">💧</span>
                <span className="mobile-checklist-section-name">Plumbing</span>
              </div>
              <div className="mobile-checklist-section-item">
                <span className="mobile-checklist-section-icon">🔥</span>
                <span className="mobile-checklist-section-name">Safety</span>
              </div>
            </div>
          </div>

          <div className="mobile-checklist-instructions">
            <h3 className="mobile-checklist-instructions-title">
              Instructions
            </h3>
            <ul className="mobile-checklist-instructions-list">
              <li>Review all domains and sub-domains</li>
              <li>Answer all queries with YES, NO, or NA</li>
              <li>Add comments for any issues found</li>
              <li>Submit responses for reviewer approval</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mobile-checklist-actions">
          <button 
            className="mobile-checklist-btn secondary"
            onClick={handleReject}
          >
            Reject
          </button>
          <button 
            className="mobile-checklist-btn primary"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? 'Accepting...' : 'Accept & Start'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileChecklistAccept;
