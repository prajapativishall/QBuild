import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import { toast } from 'react-toastify';
import PhaseChartModal from '../components/PhaseChartModal';
import '../styles/Projects.css';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    status: 'active',
    clientName: '',
    clientDesignation: '',
    clientMobileNo: '',
    clientEmail: '',
    alternateClientName: '',
    alternateDesignation: '',
    alternateEmail: '',
    alternateMobileNo: ''
  });

  // Chart modal for viewing spider charts
  const [chartModalProject, setChartModalProject] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // Load projects from API
  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projectApi.getAll();
      if (response.success) {
        setProjects(response.data || []);
      } else {
        if (response.code === 'UnauthorizedError') {
          alert('Please log in to view projects');
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      if (error.message?.includes('token') || error.message?.includes('Unauthorized')) {
        alert('Authentication required. Please log in.');
      } else {
        alert(`Error: ${error.message || 'Failed to load projects'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (project.name || '').toLowerCase().includes(q) ||
                         (project.description || '').toLowerCase().includes(q) ||
                         (project.location || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getProjectCardClass = (status) => {
    switch (status) {
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'pending': return 'pending';
      default: return '';
    }
  };

  // CRUD functions
  const handleCreate = () => {
    setFormData({ 
      name: '', 
      description: '', 
      location: '', 
      startDate: new Date().toISOString().split('T')[0], 
      status: 'active',
      clientName: '',
      clientDesignation: '',
      clientMobileNo: '',
      clientEmail: '',
      alternateClientName: '',
      alternateDesignation: '',
      alternateEmail: '',
      alternateMobileNo: ''
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.location) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      let payload = { ...formData };

      if (!editingId) {
        const response = await projectApi.create(payload);
        if (response.success) {
          setProjects([...projects, response.data]);
          toast.success('Project created successfully!');
          setShowForm(false);
          setFormData({ name: '', description: '', location: '', startDate: '', status: 'active',
            clientName: '', clientDesignation: '', clientMobileNo: '', clientEmail: '',
            alternateClientName: '', alternateDesignation: '', alternateEmail: '', alternateMobileNo: '' });
          setEditingId(null);
        } else {
          toast.error(response.message || 'Failed to create project');
        }
      } else {
        const response = await projectApi.update(editingId, payload);
        if (response.success) {
          setProjects(projects.map(p =>
            p.id === editingId ? { ...p, ...response.data } : p
          ));
          toast.success('Project updated successfully!');
          setShowForm(false);
          setFormData({ name: '', description: '', location: '', startDate: '', status: 'active',
            clientName: '', clientDesignation: '', clientMobileNo: '', clientEmail: '',
            alternateClientName: '', alternateDesignation: '', alternateEmail: '', alternateMobileNo: '' });
          setEditingId(null);
        } else {
          toast.error(response.message || 'Failed to update project');
        }
      }
    } catch (error) {
      console.error('Error saving project:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Error: ${errorMsg}`);
      // The project may have been created despite the error - reload projects list
      try {
            await loadProjects();
          } catch (e) {
            console.error('Reload failed:', e);
          }
      // Close the form anyway since the project was created
      setShowForm(false);
      setFormData({ name: '', description: '', location: '', startDate: '', status: 'active',
        clientName: '', clientDesignation: '', clientMobileNo: '', clientEmail: '',
        alternateClientName: '', alternateDesignation: '', alternateEmail: '', alternateMobileNo: '' });
      setEditingId(null);
    }
  };

  const handleEdit = async (project) => {
    try {
      const response = await projectApi.getById(project.id);
      const full = response?.data || project;
      
      setFormData({ 
        name: full.name, 
        description: full.description || '', 
        location: full.location || '', 
        startDate: full.startDate, 
        status: full.status,
        clientName: full.clientName || '',
        clientDesignation: full.clientDesignation || '',
        clientMobileNo: full.clientMobileNo || '',
        clientEmail: full.clientEmail || '',
        alternateClientName: full.alternateClientName || '',
        alternateDesignation: full.alternateDesignation || '',
        alternateEmail: full.alternateEmail || '',
        alternateMobileNo: full.alternateMobileNo || ''
      });
      setEditingId(project.id);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading project details:', error);
      alert(`Error: ${error.message || 'Failed to load project'}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project? This action cannot be undone.')) return;
    try {
      const response = await projectApi.delete(id);
      if (response.success) {
        setProjects(projects.filter(p => p.id !== id));
        toast.success('Project deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle navigation to inspection/phase management
  const handleNewPhase = (project) => {
    if (!project || !project.id) {
      toast.error('Unable to navigate to inspections');
      return;
    }
    navigate(`/projects/${project.id}/inspections`);
  };

  // Handle viewing chart for a project
  const handleViewChart = (project) => {
    setChartModalProject(project);
  };

  const handleCloseChartModal = () => {
    setChartModalProject(null);
  };

  if (loading) {
    return (
      <div className="projects-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-container">
      {/* Header with Create Button, Search and Filters */}
      <div className="projects-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Create New Project
        </button>
      </div>
      
      <div className="projects-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="projects-empty">
          <p>No projects found. {projects.length > 0 ? '(Filtered out)' : 'Create your first project!'}</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            Create Project
          </button>
        </div>
      ) : (
        <>
          <div className="projects-list">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className={getProjectCardClass(project.status)}>
                    <td className="table-id">
                      <span className="project-id-badge">Q{String(project.id).padStart(5, '0')}</span>
                    </td>
                    <td className="table-name">{project.name}</td>
                    <td className="table-description">{project.description || '-'}</td>
                    <td className="table-status">
                      <span className={`status-badge ${getProjectCardClass(project.status)}`}>
                        {project.status || 'Active'}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(project)}>
                        View / Edit
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleNewPhase(project)} style={{ fontWeight: 'bold' }}>
                        Inspection +
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(project.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {/* Basic Info */}
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter project description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter project location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Client Contact Information */}
              <div style={{ marginTop: '20px', borderTop: '1px solid #e0e0e0', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>Client Contact Information</h3>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter client name"
                    value={formData.clientName}
                    onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter client designation"
                    value={formData.clientDesignation}
                    onChange={(e) => setFormData({...formData, clientDesignation: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile No</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter client mobile number"
                    value={formData.clientMobileNo}
                    onChange={(e) => setFormData({...formData, clientMobileNo: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Enter client email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                  />
                </div>
                <div style={{ marginTop: '15px', borderTop: '1px solid #e0e0e0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#666' }}>Alternate Contact</h4>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter alternate client name"
                      value={formData.alternateClientName}
                      onChange={(e) => setFormData({...formData, alternateClientName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter alternate designation"
                      value={formData.alternateDesignation}
                      onChange={(e) => setFormData({...formData, alternateDesignation: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="Enter alternate email"
                      value={formData.alternateEmail}
                      onChange={(e) => setFormData({...formData, alternateEmail: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile No</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter alternate mobile number"
                      value={formData.alternateMobileNo}
                      onChange={(e) => setFormData({...formData, alternateMobileNo: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '13px', marginTop: '16px' }}>
                Note: Inspector, Reviewer, domain/sub-domain, and query assignments are configured during phase/inspection setup.
              </p>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Close</button>
                <button className="btn btn-primary" onClick={handleSave}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase Chart Modal */}
      {chartModalProject && (
        <PhaseChartModal
          project={chartModalProject}
          onClose={handleCloseChartModal}
        />
      )}
    </div>
  );
};

export default Projects;