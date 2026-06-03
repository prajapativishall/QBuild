import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';
import { toast } from 'react-toastify';
import PhaseChartModal from '../components/PhaseChartModal';
import '../styles/Projects.css';

const PAGE_SIZE = 25;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="projects-pagination">
      <button className="pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} title="First">&laquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>&lsaquo;</button>
      {start > 1 && <span className="pagination-ellipsis">...</span>}
      {pages.map(p => (
        <button key={p} className={`pagination-btn ${p === currentPage ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
      ))}
      {end < totalPages && <span className="pagination-ellipsis">...</span>}
      <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>&rsaquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} title="Last">&raquo;</button>
      <span className="pagination-info">Page {currentPage} of {totalPages}</span>
    </div>
  );
};

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartModalProject, setChartModalProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', location: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'active',
    clientName: '', clientDesignation: '', clientMobileNo: '', clientEmail: '',
    alternateClientName: '', alternateDesignation: '', alternateEmail: '', alternateMobileNo: ''
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projectApi.getAll();
      if (response.success) {
        setProjects(response.data || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  // Filter + search
  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return projects.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getProjectCardClass = (status) => {
    switch (status) {
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'pending': return 'pending';
      default: return '';
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '', description: '', location: '', startDate: new Date().toISOString().split('T')[0],
      status: 'active', clientName: '', clientDesignation: '', clientMobileNo: '', clientEmail: '',
      alternateClientName: '', alternateDesignation: '', alternateEmail: '', alternateMobileNo: ''
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
      const payload = { ...formData };
      if (!editingId) {
        const response = await projectApi.create(payload);
        if (response.success) {
          setProjects([...projects, response.data]);
          toast.success('Project created successfully!');
        } else {
          toast.error(response.message || 'Failed to create project');
        }
      } else {
        const response = await projectApi.update(editingId, payload);
        if (response.success) {
          setProjects(projects.map(p => p.id === editingId ? { ...p, ...response.data } : p));
          toast.success('Project updated successfully!');
        } else {
          toast.error(response.message || 'Failed to update project');
        }
      }
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      toast.error(error.message || 'Failed to save');
    }
  };

  const handleEdit = async (project) => {
    try {
      const response = await projectApi.getById(project.id);
      const full = response?.data || project;
      setFormData({
        name: full.name, description: full.description || '', location: full.location || '',
        startDate: full.startDate, status: full.status,
        clientName: full.clientName || '', clientDesignation: full.clientDesignation || '',
        clientMobileNo: full.clientMobileNo || '', clientEmail: full.clientEmail || '',
        alternateClientName: full.alternateClientName || '', alternateDesignation: full.alternateDesignation || '',
        alternateEmail: full.alternateEmail || '', alternateMobileNo: full.alternateMobileNo || ''
      });
      setEditingId(project.id);
      setShowForm(true);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project?')) return;
    try {
      const response = await projectApi.delete(id);
      if (response.success) {
        setProjects(projects.filter(p => p.id !== id));
        toast.success('Project deleted successfully!');
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleNewPhase = (project) => {
    if (!project?.id) { toast.error('Unable to navigate'); return; }
    navigate(`/projects/${project.id}/inspections`);
  };

  const handleViewChart = (project) => setChartModalProject(project);
  const handleCloseChartModal = () => setChartModalProject(null);

  if (loading) {
    return <div className="projects-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
      <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading projects...</div>
    </div>;
  }

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={handleCreate}>+ Create New Project</button>
      </div>

      <div className="projects-filters">
        <div className="search-box">
          <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="projects-empty">
          <p>No projects found.</p>
          <button className="btn btn-primary" onClick={handleCreate}>Create Project</button>
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
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className={getProjectCardClass(project.status)}>
                    <td className="table-id"><span className="project-id-badge">Q{String(project.id).padStart(5, '0')}</span></td>
                    <td className="table-name">{project.name}</td>
                    <td className="table-description">{project.description || '-'}</td>
                    <td className="table-status">
                      <span className={`status-badge ${getProjectCardClass(project.status)}`}>{project.status || 'Active'}</span>
                    </td>
                    <td className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(project)}>View / Edit</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleNewPhase(project)}>Inspection +</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(project.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Project' : 'Create New Project'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input type="text" className="form-input" placeholder="Enter project name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" rows={3} placeholder="Enter project description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <input type="text" className="form-input" placeholder="Enter project location" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Client Contact</h3>
                <div className="form-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Name</label>
                    <input type="text" className="form-input" placeholder="Name" value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Designation</label>
                    <input type="text" className="form-input" placeholder="Designation" value={formData.clientDesignation} onChange={(e) => setFormData({...formData, clientDesignation: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Mobile</label>
                    <input type="text" className="form-input" placeholder="Mobile" value={formData.clientMobileNo} onChange={(e) => setFormData({...formData, clientMobileNo: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" placeholder="Email" value={formData.clientEmail} onChange={(e) => setFormData({...formData, clientEmail: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Close</button>
                <button className="btn btn-primary" onClick={handleSave}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {chartModalProject && (
        <PhaseChartModal project={chartModalProject} onClose={handleCloseChartModal} />
      )}
    </div>
  );
};

export default Projects;
