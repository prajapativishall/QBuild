import React, { useState, useEffect } from 'react';
import { projectApi } from '../services/api';
import SpiderChart from './SpiderChart';
import '../styles/PhaseManagement.css';

const PhaseChartModal = ({ project, onClose }) => {
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [spiderChartData, setSpiderChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [projectRating, setProjectRating] = useState(null);

  useEffect(() => {
    if (project) {
      loadPhasesAndChart();
    }
  }, [project]);

  const loadPhasesAndChart = async () => {
    setChartLoading(true);
    try {
      const phasesResponse = await projectApi.getProjectPhases(project.id);
      if (phasesResponse.success) {
        setPhases(phasesResponse.data || []);
        // Load chart for latest phase
        await loadSpiderChartData(project.id, null);
      }
    } catch (error) {
      console.error('Error loading phases:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const loadSpiderChartData = async (projectId, phaseNumber) => {
    try {
      const response = await projectApi.getProjectSpiderChart(projectId, phaseNumber);
      if (response.success) {
        const { rating, spiderChartData: chartData } = response.data;
        setProjectRating(rating);
        setSpiderChartData(chartData);
        if (phaseNumber) {
          setSelectedPhase(phases.find(p => p.phase === phaseNumber));
        }
      }
    } catch (error) {
      console.error('Error loading spider chart:', error);
    }
  };

  const handlePhaseChange = async (e) => {
    const phaseNum = e.target.value ? parseInt(e.target.value) : null;
    await loadSpiderChartData(project.id, phaseNum);
  };

  const handleDomainClick = (domainName) => {
    console.log('Selected domain:', domainName);
    // Could navigate to domain detail or expand domain view
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content chart-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Project Quality Rating - {project?.project_name}</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {phases.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                Select Phase:
              </label>
              <select
                value={selectedPhase?.phase || ''}
                onChange={handlePhaseChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Phases (Latest)</option>
                {phases.map(phase => (
                  <option key={phase.id} value={phase.phase}>
                    Phase {phase.phase} - {new Date(phase.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {chartLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading-spinner"></div>
              <p style={{ color: '#6b7280', marginTop: '10px' }}>Loading chart data...</p>
            </div>
          ) : spiderChartData ? (
            <SpiderChart 
              data={spiderChartData}
              rating={projectRating}
              maxRating={10}
              onDomainClick={handleDomainClick}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p>No chart data available</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhaseChartModal;
