import React, { useState, useEffect } from 'react';
import { projectApi, userApi, inspectionApi } from '../services/api';
import SpiderChart from '../components/SpiderChart';
import { useAuth } from '../context/AuthContext';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, isViewer } = useAuth();
  const [totalProjects, setTotalProjects] = useState(0);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectName, setSelectedProjectName] = useState(null);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [spiderChartData, setSpiderChartData] = useState(null);
  const [spiderChartLoading, setSpiderChartLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [domainSpiderChartData, setDomainSpiderChartData] = useState(null);
  const [domainSpiderChartLoading, setDomainSpiderChartLoading] = useState(false);
  const [spiderChartError, setSpiderChartError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadPhasesForProject(selectedProject);
    }
  }, [selectedProject]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const projectsRes = await projectApi.getAll();
      let projectsList = projectsRes?.data || [];

      // Filter projects for viewers - only show projects where they are assigned as viewer
      if (isViewer && user?.id) {
        projectsList = projectsList.filter(project => project.viewerId === user.id);
      }

      setTotalProjects(projectsList.length);
      setProjects(projectsList);
      setFilteredProjects(projectsList);

      // Auto-select first project for spider chart
      if (projectsList.length > 0 && !selectedProject) {
        setSelectedProject(projectsList[0].id);
        setSelectedProjectName(projectsList[0].name || projectsList[0].project_name || `Project ${projectsList[0].id}`);
        loadSpiderChartData(projectsList[0].id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const loadPhasesForProject = async (projectId) => {
    try {
      setPhasesLoading(true);
      const response = await projectApi.getProjectPhases(projectId);
      if (response.success) {
        const phasesList = response.data || [];
        setPhases(phasesList);
        // Auto-select the latest manager-approved phase instead of the latest phase
        if (phasesList.length > 0 && !selectedPhase) {
          // Find the latest phase that has manager_approval_status = 'approved'
          const approvedPhases = phasesList.filter(
            phase => phase.manager_approval_status === 'approved'
          );
          if (approvedPhases.length > 0) {
            // Select the most recent approved phase
            setSelectedPhase(approvedPhases[approvedPhases.length - 1].phase_number);
          } else {
            // Fall back to latest phase if none approved
            setSelectedPhase(phasesList[phasesList.length - 1].phase_number);
          }
        }
      }
      setPhasesLoading(false);
    } catch (error) {
      console.error('Error loading phases:', error);
      setPhasesLoading(false);
    }
  };

  const [projectRating, setProjectRating] = useState(null);
  const [domainRating, setDomainRating] = useState(null);

  // Get a human-readable status message explaining what's happening with the inspection
  const getPhaseStatusMessage = (phase) => {
    const inspStatus = phase.inspection_status || phase.status;
    const approvalStatus = phase.approval_status;
    const managerApprovalStatus = phase.manager_approval_status;
    const inspectorName = phase.inspector_name || 'Inspector';
    const reviewerName = phase.reviewer_name || 'Reviewer';

    if (!phase.inspection_id) {
      return { message: 'Waiting for inspector assignment', type: 'pending' };
    }

    // Inspector hasn't submitted yet
    if (inspStatus === 'pending' || inspStatus === 'in_progress' || approvalStatus === 'rejected') {
      if (approvalStatus === 'rejected') {
        return { message: `Rejected - ${inspectorName} needs to resubmit`, type: 'rejected' };
      }
      return { message: `Waiting for ${inspectorName} (Inspector) to submit`, type: 'pending' };
    }

    // Submitted to reviewer
    if (approvalStatus === 'pending' && managerApprovalStatus === 'pending') {
      if (reviewerName !== 'Reviewer') {
        return { message: `Waiting for ${reviewerName} (Reviewer) to approve`, type: 'review' };
      }
      return { message: 'Waiting for Reviewer approval', type: 'review' };
    }

    // Reviewer approved - waiting for manager
    if (approvalStatus === 'approved' && managerApprovalStatus === 'pending') {
      const managerName = phase.manager_name || 'Manager';
      return { message: `Waiting for ${managerName} (Manager) to approve`, type: 'review' };
    }

    // Manager approved
    if (managerApprovalStatus === 'approved') {
      return { message: 'Approved - Spider chart available', type: 'approved' };
    }

    return { message: `Status: ${inspStatus || 'Unknown'}`, type: 'pending' };
  };

  const loadSpiderChartData = async (projectId, phase = null) => {
    try {
      setSpiderChartLoading(true);
      setSpiderChartError(null);
      setSpiderChartData(null);
      const response = await projectApi.getProjectSpiderChart(projectId, phase);
      setSpiderChartData(response.data);
      setProjectRating(response.overallRating || null);
      setSpiderChartLoading(false);
    } catch (error) {
      // Store the error message for status display, but don't log expected "not approved" errors to console
      setSpiderChartError(error.message);
      setSpiderChartData(null);
      setProjectRating(null);
      setSpiderChartLoading(false);
    }
  };

  const handleProjectChange = (e) => {
    const projectId = parseInt(e.target.value);
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(projectId);
    setSelectedProjectName(project?.name || project?.project_name || `Project ${projectId}`);
    setSelectedPhase(null);
    setSelectedDomain(null);
    setDomainSpiderChartData(null);
    loadSpiderChartData(projectId);
  };

  const handlePhaseChange = (e) => {
    const phase = parseInt(e.target.value);
    setSelectedPhase(phase);
    setSelectedDomain(null);
    setDomainSpiderChartData(null);
    // Only call API if the selected phase is manager-approved (otherwise show status message instead)
    if (selectedProject) {
      const selectedPhaseData = phases.find(p => p.phase_number === phase);
      if (selectedPhaseData && selectedPhaseData.manager_approval_status === 'approved') {
        loadSpiderChartData(selectedProject, phase);
      } else {
        // Clear chart data so component shows status message instead of making an API call
        setSpiderChartData(null);
        setProjectRating(null);
        setSpiderChartLoading(false);
      }
    }
  };

  // Get status message for the currently selected phase
  const getSelectedPhaseStatusMessage = () => {
    const phase = phases.find(p => p.phase_number === selectedPhase);
    if (!phase) return null;
    return getPhaseStatusMessage(phase);
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const filtered = projects.filter(project => 
      (project.project_name || `Project ${project.id}`).toLowerCase().includes(term)
    );
    setFilteredProjects(filtered);
  };

  const handleDomainClick = async (domainName) => {
    try {
      setSelectedDomain(domainName);
      setDomainSpiderChartLoading(true);

      // Find domain ID from spider chart data
      const domainData = spiderChartData.find(d => d.domain === domainName);
      if (!domainData) return;

      const response = await projectApi.getDomainSpiderChart(selectedProject, domainData.domain_id, selectedPhase);
      setDomainSpiderChartData(response.data);
      setDomainRating(response.domainRating || null);
      setDomainSpiderChartLoading(false);
    } catch (error) {
      console.error('Error loading domain QBuild chart data:', error);
      setDomainSpiderChartLoading(false);
    }
  };

  const handleBackToProject = () => {
    setSelectedDomain(null);
    setDomainSpiderChartData(null);
    setDomainRating(null);
  };


  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-empty">
          <h2 className="dashboard-empty-title">Loading Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Page Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Project overview and QBuild charts</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-primary" onClick={loadDashboardData}>
            Refresh
          </button>
        </div>
      </div>

      {/* Total Projects Card */}
      <div className="dashboard-total-projects">
        <div className="total-projects-card">
          <div className="total-projects-header">
            <span className="total-projects-title">Total Projects</span>
          </div>
          <div className="total-projects-value">{totalProjects}</div>
        </div>

        {/* Search and Filter */}
        <div className="dashboard-search-filter">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
          <select
            value={selectedProject || ''}
            onChange={handleProjectChange}
            className="project-select"
          >
            <option value="">Select a project</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name || project.project_name || `Project ${project.id}`}
              </option>
            ))}
          </select>
          {selectedProject && phases.length > 0 && (
            <select
              value={selectedPhase || ''}
              onChange={handlePhaseChange}
              className="phase-select"
              disabled={phasesLoading}
            >
              <option value="">All phases</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.phase_number}>
                  Phase {phase.phase_number} - {phase.status || phase.inspection_status || 'N/A'}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Spider Chart Section */}
      <div className="dashboard-spider-charts">
        {/* Project Spider Chart */}
        <div className="spider-chart-card">
          <div className="card-header-dashboard">
            <h3 className="card-title-dashboard">
              {selectedProjectName ? `Project: ${selectedProjectName}` : 'Project Spider Chart'}
            </h3>
          </div>
          <div className="card-content-dashboard">
            {spiderChartLoading ? (
              <div className="chart-loading">Loading QBuild chart...</div>
            ) : spiderChartData && spiderChartData.length > 0 ? (
              <SpiderChart 
                data={spiderChartData} 
                height={400} 
                maxRating={10} 
                onDomainClick={handleDomainClick}
                rating={projectRating}
                ratingLabel={selectedProjectName || 'Project'}
              />
            ) : (
              <div className="chart-empty">
                {selectedProject && phases.length > 0 && selectedPhase ? (
                  (() => {
                    const status = getSelectedPhaseStatusMessage();
                    if (status) {
                      const statusColors = {
                        pending: { bg: '#fef3c7', color: '#92400e' },
                        rejected: { bg: '#fee2e2', color: '#991b1b' },
                        review: { bg: '#dbeafe', color: '#1d4ed8' },
                        approved: { bg: '#dcfce7', color: '#15803d' }
                      };
                      const colors = statusColors[status.type] || statusColors.pending;
                      return (
                        <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: colors.bg, color: colors.color, fontSize: '13px', fontWeight: 500 }}>
                          {status.message}
                        </div>
                      );
                    }
                    return 'No data available';
                  })()
                ) : selectedProject ? 'No data available' : 'Select a project to view QBuild chart'}
              </div>
            )}
          </div>
        </div>

        {/* Domain QBuild Chart */}
        <div className="spider-chart-card">
          <div className="card-header-dashboard">
            <h3 className="card-title-dashboard">
              {selectedDomain ? `Domain: ${selectedDomain}` : 'Domain QBuild Chart'}
            </h3>
          </div>
          <div className="card-content-dashboard">
            {selectedDomain && (
              <div className="domain-back-button">
                <button
                  onClick={handleBackToProject}
                  className="btn btn-secondary"
                >
                  ← Clear Selection
                </button>
              </div>
            )}
            {domainSpiderChartLoading ? (
              <div className="chart-loading">Loading domain QBuild chart...</div>
            ) : selectedDomain && domainSpiderChartData && domainSpiderChartData.length > 0 ? (
              <SpiderChart 
                data={domainSpiderChartData} 
                height={400} 
                maxRating={10}
                rating={domainRating}
                ratingLabel={selectedDomain || 'Domain'}
              />
            ) : (
              <div className="chart-empty">
                {selectedDomain ? 'No data available for this domain' : 'Click on a domain in the project chart to view details'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
