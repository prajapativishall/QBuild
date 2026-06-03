import React, { useState, useEffect, useMemo } from 'react';
import { userApi } from '../services/api';
import '../styles/UserManagement.css';

const PAGE_SIZE = 10;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '24px 16px', borderTop: '1px solid #e5e7eb' }}>
      <button className="pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} style={{ minWidth: '36px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>&laquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={{ minWidth: '36px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>&lsaquo;</button>
      {start > 1 && <span style={{ padding: '0 4px', color: '#9ca3af' }}>...</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)} style={{ minWidth: '36px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '6px', background: p === currentPage ? '#2563eb' : '#fff', color: p === currentPage ? '#fff' : '#374151', fontWeight: p === currentPage ? 600 : 500, cursor: 'pointer' }}>{p}</button>
      ))}
      {end < totalPages && <span style={{ padding: '0 4px', color: '#9ca3af' }}>...</span>}
      <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ minWidth: '36px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>&rsaquo;</button>
      <button className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} style={{ minWidth: '36px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>&raquo;</button>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inspector',
    phone: '',
    department: '',
    isActive: true,
    employeeId: '',
    emergencyContact: '',
    bloodGroup: '',
    dateOfBirth: '',
    educationalQualification: '',
    specialization: '',
    currentAddress: '',
    permanentAddress: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userApi.getAll();
      setUsers(response?.data || []);
    } catch (e) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter(user => {
      const matchesSearch = (user.name || '').toLowerCase().includes(q) ||
                           (user.email || '').toLowerCase().includes(q) ||
                           (user.department || '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'role-admin';
      case 'inspector': return 'role-inspector';
      case 'viewer': return 'role-viewer';
      case 'reviewer': return 'role-reviewer';
      case 'manager': return 'role-manager';
      default: return 'role-default';
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'inspector',
      phone: '',
      department: '',
      isActive: true,
      employeeId: '',
      emergencyContact: '',
      bloodGroup: '',
      dateOfBirth: '',
      educationalQualification: '',
      specialization: '',
      currentAddress: '',
      permanentAddress: ''
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      alert('Please fill in name and email');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email');
      return;
    }

    // Password validation (only for new users or if password is provided)
    if (!editingId && !formData.password) {
      alert('Password is required for new users');
      return;
    }
    if (formData.password && formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingId) {
        const updateData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          isActive: formData.isActive,
          phone: formData.phone,
          department: formData.department,
          employeeId: formData.employeeId,
          emergencyContact: formData.emergencyContact,
          bloodGroup: formData.bloodGroup,
          dateOfBirth: formData.dateOfBirth,
          educationalQualification: formData.educationalQualification,
          specialization: formData.specialization,
          currentAddress: formData.currentAddress,
          permanentAddress: formData.permanentAddress
        };
        // Only include password if it's provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        await userApi.update(editingId, updateData);
      } else {
        await userApi.create({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          phone: formData.phone,
          department: formData.department,
          employeeId: formData.employeeId,
          emergencyContact: formData.emergencyContact,
          bloodGroup: formData.bloodGroup,
          dateOfBirth: formData.dateOfBirth,
          educationalQualification: formData.educationalQualification,
          specialization: formData.specialization,
          currentAddress: formData.currentAddress,
          permanentAddress: formData.permanentAddress
        });
      }

      setShowForm(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'inspector',
        phone: '',
        department: '',
        isActive: true,
        employeeId: '',
        emergencyContact: '',
        bloodGroup: '',
        dateOfBirth: '',
        educationalQualification: '',
        specialization: '',
        currentAddress: '',
        permanentAddress: ''
      });
      setEditingId(null);
      await loadUsers();
    } catch (e) {
      setError(e.message || 'Failed to save user');
      alert(e.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't show existing password, let user enter new one if needed
      role: user.role,
      phone: user.phone || '',
      department: user.department || '',
      isActive: user.isActive,
      employeeId: user.employeeId || '',
      emergencyContact: user.emergencyContact || '',
      bloodGroup: user.bloodGroup || '',
      dateOfBirth: user.dateOfBirth || '',
      educationalQualification: user.educationalQualification || '',
      specialization: user.specialization || '',
      currentAddress: user.currentAddress || '',
      permanentAddress: user.permanentAddress || ''
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await userApi.delete(id);
        await loadUsers();
      } catch (e) {
        setError(e.message || 'Failed to delete user');
        alert(e.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    })();
  };

  const toggleUserStatus = (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        await userApi.update(id, { isActive: !user.isActive });
        await loadUsers();
      } catch (e) {
        setError(e.message || 'Failed to update status');
        alert(e.message || 'Failed to update status');
      } finally {
        setLoading(false);
      }
    })();
  };

  const getRoleDisplayName = (role) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="users-container">
      <div className="users-header">
        <div className="users-title-section">
          <h1 className="users-title">User Management</h1>
          <p className="users-subtitle">Manage inspectors, viewers, and administrators</p>
        </div>
        <div className="users-actions">
          <button className="btn btn-primary" onClick={handleCreate}>
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', color: 'var(--error-700)' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="users-filters">
        <div className="filter-group search-group">
          <span className="filter-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            className="filter-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="inspector">Inspector</option>
            <option value="viewer">Viewer</option>
            <option value="reviewer">Reviewer</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'inspector').length}</div>
          <div className="stat-label">Inspectors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'viewer').length}</div>
          <div className="stat-label">Viewers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'reviewer').length}</div>
          <div className="stat-label">Reviewers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'manager').length}</div>
          <div className="stat-label">Managers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.isActive).length}</div>
          <div className="stat-label">Active</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map(user => (
              <tr key={user.id} className={!user.isActive ? 'inactive' : ''}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-small">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-info-cell">
                      <div className="user-name-cell">{user.name}</div>
                      <div className="user-email-cell">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                    {getRoleDisplayName(user.role)}
                  </span>
                </td>
                <td>{user.department || '-'}</td>
                <td>{user.phone || '-'}</td>
                <td>
                  <button
                    className={`status-toggle ${user.isActive ? 'active' : 'inactive'}`}
                    onClick={() => toggleUserStatus(user.id)}
                    disabled={loading}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>{user.createdAt}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn edit"
                      onClick={() => handleEdit(user)}
                      title="Edit User"
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(user.id)}
                      title="Delete User"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="no-results">
            <p>No users found matching your criteria</p>
          </div>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Edit User' : 'Create New User'}</h2>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name" className="form-label">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="form-input"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="employeeId" className="form-label">
                    Employee ID / ER ID
                  </label>
                  <input
                    type="text"
                    id="employeeId"
                    name="employeeId"
                    className="form-input"
                    placeholder="Enter employee ID"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="form-input"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone" className="form-label">
                    Mobile No. (10 digits)
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="form-input"
                    placeholder="Enter 10-digit mobile number"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emergencyContact" className="form-label">
                    Emergency Contact No.
                  </label>
                  <input
                    type="tel"
                    id="emergencyContact"
                    name="emergencyContact"
                    className="form-input"
                    placeholder="Enter emergency contact number"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bloodGroup" className="form-label">
                    Blood Group
                  </label>
                  <select
                    id="bloodGroup"
                    name="bloodGroup"
                    className="form-select"
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dateOfBirth" className="form-label">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    className="form-input"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password * {editingId && <span className="form-hint">(Leave empty to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required={!editingId}
                    minLength="6"
                    className="form-input"
                    placeholder={editingId ? "Enter new password (min 6 chars)" : "Enter password (min 6 chars)"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="educationalQualification" className="form-label">
                    Highest Educational Qualification
                  </label>
                  <input
                    type="text"
                    id="educationalQualification"
                    name="educationalQualification"
                    className="form-input"
                    placeholder="Enter highest qualification"
                    value={formData.educationalQualification}
                    onChange={(e) => setFormData({...formData, educationalQualification: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="specialization" className="form-label">
                    Audit Specialization
                  </label>
                  <input
                    type="text"
                    id="specialization"
                    name="specialization"
                    className="form-input"
                    placeholder="Enter specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="department" className="form-label">
                    Department
                  </label>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    className="form-input"
                    placeholder="Enter department"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role" className="form-label">
                    Role *
                  </label>
                  <select
                    id="role"
                    name="role"
                    required
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="inspector">Inspector</option>
                    <option value="viewer">Viewer</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="currentAddress" className="form-label">
                    Current Address
                  </label>
                  <textarea
                    id="currentAddress"
                    name="currentAddress"
                    className="form-input"
                    placeholder="Enter current address"
                    value={formData.currentAddress}
                    onChange={(e) => setFormData({...formData, currentAddress: e.target.value})}
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="permanentAddress" className="form-label">
                    Permanent Address
                  </label>
                  <textarea
                    id="permanentAddress"
                    name="permanentAddress"
                    className="form-input"
                    placeholder="Enter permanent address"
                    value={formData.permanentAddress}
                    onChange={(e) => setFormData({...formData, permanentAddress: e.target.value})}
                    rows="2"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <div className="status-checkbox">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    <label htmlFor="isActive">Active</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary"
              >
                {editingId ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
