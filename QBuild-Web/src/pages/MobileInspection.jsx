import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionApi, domainApi, subDomainApi, queryApi } from '../services/api';
import '../styles/MobileInspection.css';

const MobileInspection = () => {
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState('domains'); // 'domains', 'subdomains', 'queries'
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedSubDomain, setSelectedSubDomain] = useState(null);
  const [domains, setDomains] = useState([]);
  const [subDomains, setSubDomains] = useState([]);
  const [queries, setQueries] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInspectionData();
  }, [inspectionId]);

  const loadInspectionData = async () => {
    try {
      setLoading(true);
      
      // Load inspection responses first
      const response = await inspectionApi.getResponses(inspectionId);
      const responsesData = response.data || [];
      
      // Build responses map
      const responsesMap = {};
      responsesData.forEach(r => {
        responsesMap[r.checklist_item_id] = r.response_value;
      });
      setResponses(responsesMap);
      
      // Load domains
      const domainsResponse = await domainApi.getAll();
      setDomains(domainsResponse.data || []);
      
    } catch (err) {
      console.error('Failed to load inspection data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubDomains = async (domainId) => {
    try {
      const response = await subDomainApi.getByDomainId(domainId);
      setSubDomains(response.data || []);
      setSelectedDomain(domains.find(d => d.id === domainId));
      setView('subdomains');
    } catch (err) {
      console.error('Failed to load sub-domains:', err);
    }
  };

  const loadQueries = async (subDomainId) => {
    try {
      const response = await queryApi.getLinkedToSubDomain(subDomainId);
      setQueries(response.data || []);
      setSelectedSubDomain(subDomains.find(s => s.id === subDomainId));
      setView('queries');
    } catch (err) {
      console.error('Failed to load queries:', err);
    }
  };

  const handleResponseChange = (queryId, value) => {
    setResponses(prev => ({
      ...prev,
      [queryId]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Prepare response data
      const responseArray = Object.entries(responses).map(([checklistItemId, responseValue]) => ({
        checklist_item_id: parseInt(checklistItemId),
        response_value: responseValue
      }));
      
      // Submit responses
      await inspectionApi.submitResponses(inspectionId, responseArray);
      
      // Navigate back to dashboard
      navigate('/mobile-dashboard');
    } catch (err) {
      console.error('Failed to submit responses:', err);
      alert('Failed to submit responses. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (view === 'queries') {
      setView('subdomains');
      setSelectedSubDomain(null);
    } else if (view === 'subdomains') {
      setView('domains');
      setSelectedDomain(null);
    } else {
      navigate('/mobile-dashboard');
    }
  };

  const getProgress = () => {
    if (view === 'domains') {
      return 0;
    } else if (view === 'subdomains') {
      const completed = domains.filter(d => d.completed).length;
      return Math.round((completed / domains.length) * 100);
    } else {
      const answered = Object.values(responses).filter(v => v).length;
      return Math.round((answered / queries.length) * 100);
    }
  };

  if (loading) {
    return (
      <div className="mobile-inspection">
        <div className="mobile-inspection-loading">
          <div className="mobile-spinner"></div>
          <p>Loading inspection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-inspection">
      {/* Header */}
      <div className="mobile-inspection-header">
        <button 
          className="mobile-back-btn"
          onClick={handleBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="mobile-inspection-header-content">
          <h1 className="mobile-inspection-title">
            {view === 'domains' ? 'Select Domain' :
             view === 'subdomains' ? selectedDomain?.domain_name : 
             selectedSubDomain?.sub_domain_name}
          </h1>
          <div className="mobile-inspection-progress">
            <div className="mobile-inspection-progress-bar">
              <div 
                className="mobile-inspection-progress-fill"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
            <span className="mobile-inspection-progress-text">{getProgress()}%</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-inspection-content">
        {view === 'domains' && (
          <div className="mobile-domains-list">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="mobile-domain-card"
                onClick={() => loadSubDomains(domain.id)}
              >
                <div className="mobile-domain-icon">🏗️</div>
                <div className="mobile-domain-info">
                  <h3 className="mobile-domain-name">{domain.domain_name}</h3>
                  {domain.description && (
                    <p className="mobile-domain-description">{domain.description}</p>
                  )}
                </div>
                <div className="mobile-domain-arrow">→</div>
              </div>
            ))}

            <button
              className="mobile-submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Inspection'}
            </button>
          </div>
        )}

        {view === 'subdomains' && (
          <div className="mobile-subdomains-list">
            {subDomains.map((subDomain) => (
              <div 
                key={subDomain.id}
                className="mobile-subdomain-card"
                onClick={() => loadQueries(subDomain.id)}
              >
                <div className="mobile-subdomain-icon">📋</div>
                <div className="mobile-subdomain-info">
                  <h3 className="mobile-subdomain-name">{subDomain.sub_domain_name}</h3>
                  {subDomain.description && (
                    <p className="mobile-subdomain-description">{subDomain.description}</p>
                  )}
                </div>
                <div className="mobile-subdomain-arrow">→</div>
              </div>
            ))}
          </div>
        )}

        {view === 'queries' && (
          <div className="mobile-queries-list">
            {queries.map((query) => (
              <div key={query.id} className="mobile-query-card">
                <div className="mobile-query-question">
                  <span className="mobile-query-number">
                    {queries.indexOf(query) + 1}.
                  </span>
                  <p className="mobile-query-text">
                    {query.question_text || query.query_text}
                  </p>
                </div>
                <div className="mobile-query-options">
                  <button 
                    className={`mobile-query-option ${responses[query.id] === 'YES' ? 'active' : ''}`}
                    onClick={() => handleResponseChange(query.id, 'YES')}
                  >
                    <span className="mobile-query-option-icon">✓</span>
                    YES
                  </button>
                  <button 
                    className={`mobile-query-option ${responses[query.id] === 'NO' ? 'active' : ''}`}
                    onClick={() => handleResponseChange(query.id, 'NO')}
                  >
                    <span className="mobile-query-option-icon">✗</span>
                    NO
                  </button>
                  <button 
                    className={`mobile-query-option ${responses[query.id] === 'NA' ? 'active' : ''}`}
                    onClick={() => handleResponseChange(query.id, 'NA')}
                  >
                    <span className="mobile-query-option-icon">—</span>
                    NA
                  </button>
                </div>
              </div>
            ))}
            
            <button 
              className="mobile-submit-btn"
              onClick={handleSubmit}
              disabled={submitting || Object.values(responses).filter(v => v).length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Responses'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileInspection;
