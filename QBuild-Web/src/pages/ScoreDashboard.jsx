import React, { useState, useEffect } from 'react';
import '../styles/Reports.css';

const ScoreDashboard = () => {
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInspections();
  }, []);

  useEffect(() => {
    if (selectedInspection) {
      fetchScoreData(selectedInspection);
    }
  }, [selectedInspection]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      setTimeout(() => {
        setInspections([
          { id: 1, name: 'Building A Foundation', date: '2024-01-15', status: 'completed' },
          { id: 2, name: 'Tower B Structure', date: '2024-01-14', status: 'in_progress' },
          { id: 3, name: 'Parking Lot C', date: '2024-01-13', status: 'pending' },
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching inspections:', error);
      setLoading(false);
    }
  };

  const fetchScoreData = async (inspectionId) => {
    void inspectionId;
    try {
      // Mock data - replace with actual API calls
      setTimeout(() => {
        setMasterData([
          { name: 'Foundation', rating: 85 },
          { name: 'Structure', rating: 92 },
          { name: 'Safety', rating: 78 },
          { name: 'Quality', rating: 88 },
          { name: 'Documentation', rating: 95 },
          { name: 'Electrical', rating: 82 },
          { name: 'Plumbing', rating: 90 },
          { name: 'HVAC', rating: 76 },
        ]);
      }, 500);
    } catch (error) {
      console.error('Error fetching score data:', error);
    }
  };

  if (loading) {
    return (
      <div className="reports-loading">
        <div className="reports-charts">
          <div className="chart-card loading">
            <div className="chart-content">
              <div className="chart-placeholder">
                <div className="chart-placeholder-text">Loading Reports...</div>
                <div className="chart-placeholder-subtext">Please wait while we fetch your data</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div className="reports-title-section">
          <h1 className="reports-title">Score Dashboard</h1>
          <p className="reports-subtitle">Visualize inspection scores and performance metrics</p>
        </div>
        <div className="reports-actions">
          <button className="btn btn-secondary">
            Export
          </button>
          <button className="btn btn-primary">
            Generate Report
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="report-type-selector">
        <div className="report-type-header">
          <h3 className="report-type-title">Report Type</h3>
        </div>
        <div className="report-type-grid">
          <div className="report-type-card active">
            <div className="report-type-name">Score Analysis</div>
            <div className="report-type-description">Detailed score breakdown and trends</div>
          </div>
          <div className="report-type-card">
            <div className="report-type-name">Comparison</div>
            <div className="report-type-description">Compare multiple inspections</div>
          </div>
          <div className="report-type-card">
            <div className="report-type-name">Trends</div>
            <div className="report-type-description">Historical performance analysis</div>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="date-range-selector">
        <div className="date-range-header">
          <h3 className="date-range-title">Date Range</h3>
        </div>
        <div className="date-range-options">
          <button className="date-range-btn">Last 7 Days</button>
          <button className="date-range-btn active">Last 30 Days</button>
          <button className="date-range-btn">Last 3 Months</button>
          <button className="date-range-btn">Last Year</button>
          <button className="date-range-btn">All Time</button>
        </div>
      </div>

      {/* Inspection Selector */}
      <div className="report-type-selector">
        <div className="report-type-header">
          <h3 className="report-type-title">Select Inspection</h3>
        </div>
        <select
          className="filter-select-inspections"
          value={selectedInspection || ''}
          onChange={(e) => setSelectedInspection(parseInt(e.target.value))}
        >
          <option value="">Choose an inspection...</option>
          {inspections.map((inspection) => (
            <option key={inspection.id} value={inspection.id}>
              {inspection.name} - {inspection.date}
            </option>
          ))}
        </select>
      </div>

      {/* Report Summary */}
      <div className="report-summary">
        <div className="summary-header">
          <h3 className="summary-title">Performance Overview</h3>
          <div className="summary-actions">
            <button className="btn btn-secondary">
              Refresh
            </button>
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">87.5%</div>
            <div className="summary-label">Average Score</div>
            <div className="summary-change positive">
              <span className="dropdown-icon">+</span>
              <span>2.3% from last month</span>
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-value">8</div>
            <div className="summary-label">Total Stages</div>
            <div className="summary-change neutral">
              <span className="dropdown-icon">=</span>
              <span>All stages evaluated</span>
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-value">94%</div>
            <div className="summary-label">Compliance Rate</div>
            <div className="summary-change positive">
              <span className="dropdown-icon">+</span>
              <span>Above industry standard</span>
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-value">3</div>
            <div className="summary-label">Active Issues</div>
            <div className="summary-change negative">
              <span className="dropdown-icon">!</span>
              <span>Requires attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      {selectedInspection ? (
        <div className="reports-charts">
          {/* Stage Performance Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Stage Performance</h3>
            </div>
            <div className="chart-content">
              <div className="chart-placeholder">
                <div className="chart-placeholder-text">Spider Chart</div>
                <div className="chart-placeholder-subtext">Stage performance visualization</div>
              </div>
            </div>
          </div>

          {/* Overall Performance Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Overall Performance</h3>
            </div>
            <div className="chart-content">
              <div className="chart-placeholder">
                <div className="chart-placeholder-text">Spider Chart</div>
                <div className="chart-placeholder-subtext">Overall performance metrics</div>
              </div>
            </div>
          </div>

          {/* Trends Chart */}
          <div className="chart-card full-width">
            <div className="chart-header">
              <h3 className="chart-title">Performance Trends</h3>
            </div>
            <div className="chart-content">
              <div className="chart-placeholder">
                <div className="chart-placeholder-text">Line Chart</div>
                <div className="chart-placeholder-subtext">Performance trends over time</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="reports-charts">
          <div className="chart-card full-width">
            <div className="chart-content">
              <div className="chart-placeholder">
                <div className="chart-placeholder-text">No Inspection Selected</div>
                <div className="chart-placeholder-subtext">Select an inspection from the dropdown above to view score charts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Breakdown Table */}
      {selectedInspection && (
        <div className="inspections-table-container">
          <div className="chart-header">
            <h3 className="chart-title">Score Breakdown</h3>
          </div>
          <table className="inspections-table">
            <thead>
              <tr>
                <th>Stage/Section</th>
                <th>Score</th>
                <th>Status</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {masterData.map((item, index) => (
                <tr key={index}>
                  <td className="inspection-project">{item.name}</td>
                  <td>
                    <div className="project-progress">
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill ${
                            item.rating >= 80 ? 'bg-success-500' : 
                            item.rating >= 60 ? 'bg-warning-500' : 'bg-error-500'
                          }`}
                          style={{ width: `${item.rating}%` }}
                        ></div>
                      </div>
                      <div className="progress-text">{item.rating}%</div>
                    </div>
                  </td>
                  <td>
                    <span className={`inspection-status ${
                      item.rating >= 80 ? 'completed' : 
                      item.rating >= 60 ? 'in-progress' : 'pending'
                    }`}>
                      {item.rating >= 80 ? 'Excellent' : item.rating >= 60 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </td>
                  <td>
                    {item.rating < 80 ? (
                      <span className="text-error-600 font-medium">{Math.floor((80 - item.rating) / 10)}</span>
                    ) : (
                      <span className="text-success-600 font-medium">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScoreDashboard;
