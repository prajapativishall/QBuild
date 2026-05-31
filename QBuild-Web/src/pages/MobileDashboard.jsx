import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inspectionApi } from '../services/api';
import useAuthHook from '../hooks/useAuth';
import '../styles/MobileDashboard.css';

const MobileDashboard = () => {
  const [assignedInspections, setAssignedInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, handleLogout } = useAuthHook();

  useEffect(() => {
    loadAssignedInspections();
  }, []);

  const loadAssignedInspections = async () => {
    try {
      setLoading(true);
      const response = await inspectionApi.getUserInspections();
      setAssignedInspections(response.data || []);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistClick = (inspection) => {
    if (inspection.inspectionId) {
      // If inspection is rejected, allow editing
      if (inspection.approval_status === 'rejected') {
        navigate(`/mobile-inspection/${inspection.inspectionId}`);
      } else {
        navigate(`/mobile-checklist/${inspection.inspectionId}`);
      }
    } else {
      // Project without inspection - create new inspection flow
      navigate(`/mobile-new-inspection/${inspection.projectId}`);
    }
  };

  const handleProfileToggle = () => {
    setProfileMenuOpen(!profileMenuOpen);
  };

  const handleLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  return (
    <div className="mobile-dashboard">
      {/* Header */}
      <div className="mobile-header">
        <div className="mobile-header-left">
          <div className="mobile-logo">Q</div>
          <h1 className="mobile-title">QBuild</h1>
        </div>
        <div className="mobile-header-right">
          <button 
            className="mobile-icon-btn"
            onClick={() => navigate('/web-dashboard')}
            title="Switch to Web View"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
          </button>
          <div className="mobile-profile-container">
            <button 
              className="mobile-profile-btn"
              onClick={handleProfileToggle}
            >
              <div className="mobile-profile-avatar">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </button>
            {profileMenuOpen && (
              <div className="mobile-profile-menu">
                <div className="mobile-profile-header">
                  <div className="mobile-profile-name">{user?.name || 'User'}</div>
                  <div className="mobile-profile-email">{user?.email || ''}</div>
                </div>
                <button 
                  className="mobile-profile-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate('/profile');
                  }}
                >
                  Profile
                </button>
                <button 
                  className="mobile-profile-item logout"
                  onClick={handleLogoutClick}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Icon (Top Right Corner) */}
      <button 
        className="mobile-checklist-fab"
        onClick={() => navigate('/mobile-checklist-list')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="mobile-checklist-badge">
          {assignedInspections.length}
        </span>
      </button>

      {/* Main Content */}
      <div className="mobile-content">
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : assignedInspections.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty-icon">📋</div>
            <h2 className="mobile-empty-title">No Inspections Assigned</h2>
            <p className="mobile-empty-description">
              You don't have any inspections assigned yet.
            </p>
          </div>
        ) : (
          <div className="mobile-inspection-list">
            <h2 className="mobile-section-title">Assigned Inspections</h2>
            {assignedInspections.map((inspection) => (
              <div 
                key={inspection.projectId}
                className="mobile-inspection-card"
                onClick={() => handleChecklistClick(inspection)}
              >
                <div className="mobile-inspection-header">
                  <h3 className="mobile-inspection-project">
                    {inspection.projectName}
                  </h3>
                  <span className={`mobile-inspection-status ${inspection.status}`}>
                    {inspection.status}
                  </span>
                </div>
                <div className="mobile-inspection-details">
                  <div className="mobile-inspection-detail">
                    <span className="mobile-inspection-label">Location:</span>
                    <span className="mobile-inspection-value">
                      {inspection.city}, {inspection.state}
                    </span>
                  </div>
                  {inspection.inspectionDate && (
                    <div className="mobile-inspection-detail">
                      <span className="mobile-inspection-label">Date:</span>
                      <span className="mobile-inspection-value">
                        {new Date(inspection.inspectionDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mobile-inspection-action">
                  {inspection.inspectionId ? (
                    <span className="mobile-action-text">Continue Inspection →</span>
                  ) : (
                    <span className="mobile-action-text">Start Inspection →</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <button 
          className="mobile-nav-item active"
          onClick={() => navigate('/mobile-dashboard')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </button>
        <button 
          className="mobile-nav-item"
          onClick={() => navigate('/mobile-checklist-list')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span>Checklists</span>
        </button>
        <button 
          className="mobile-nav-item"
          onClick={() => navigate('/mobile-history')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>History</span>
        </button>
        <button 
          className="mobile-nav-item"
          onClick={handleProfileToggle}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
};

export default MobileDashboard;
