// API Service - Connects Frontend to Backend

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Export the base URL for use in components (e.g., for image URLs)
export const getBaseUrl = () => {
  return API_BASE_URL.replace('/api', '') || 'http://localhost:3000';
};

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    cache: 'no-store',
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      // Handle auth errors
      if (response.status === 401 || data?.code === 'UnauthorizedError') {
        console.error('Authentication required. Please log in.');
        // Optionally redirect to login
        // window.location.href = '/login';
      }
      // Use the most descriptive error available: data.error (string) > data.message > data.error?.message
      const errorMsg = typeof data?.error === 'string' 
        ? data.error 
        : (data?.message || data?.error?.message || `API Error: ${response.status}`);
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Create axios instance with default config
import axios from 'axios';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== PROJECTS API ====================
export const projectApi = {
  // Get all projects
  getAll: async () => {
    return apiCall('/projects');
  },
  
  // Get single project
  getById: async (id) => {
    return apiCall(`/projects/${id}`);
  },
  
  // Create project
  create: async (projectData) => {
    return apiCall('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },
  
  // Update project
  update: async (id, projectData) => {
    return apiCall(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  },
  
  // Delete project
  delete: async (id) => {
    return apiCall(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  importDomain: async (projectId, domainName) => {
    return apiCall(`/projects/${projectId}/import-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName }),
    });
  },

  getAvailableDomains: async (projectId) => {
    return apiCall(`/projects/${projectId}/available-domains`);
  },

  getProjectSpiderChart: async (projectId, phase = null) => {
    const url = phase
      ? `/projects/${projectId}/spider-chart?phase=${phase}`
      : `/projects/${projectId}/spider-chart`;
    return apiCall(url);
  },

  getProjectPhases: async (projectId) => {
    return apiCall(`/projects/${projectId}/phases`);
  },

  // Create new phase with configuration
  createPhase: async (projectId, phaseData) => {
    return apiCall(`/projects/${projectId}/phases`, {
      method: 'POST',
      body: JSON.stringify(phaseData),
    });
  },

  updatePhase: async (projectId, phaseNumber, phaseData) => {
    return apiCall(`/projects/${projectId}/phases/${phaseNumber}`, {
      method: 'PUT',
      body: JSON.stringify(phaseData),
    });
  },

  // Get phase configuration from phase tables
  getPhaseConfiguration: async (projectId, phaseNumber) => {
    return apiCall(`/projects/${projectId}/phases/${phaseNumber}/configuration`);
  },

  getDomainSpiderChart: async (projectId, domainId) => {
    return apiCall(`/projects/${projectId}/domains/${domainId}/spider-chart`);
  },
};

// ==================== DOMAINS API ====================
export const domainApi = {
  // Get all domains
  getAll: async () => {
    return apiCall('/domains');
  },

  // Get single domain
  getById: async (id) => {
    return apiCall(`/domains/${id}`);
  },

  // Get sub-domains for a domain with weightages
  getSubDomains: async (domainId) => {
    return apiCall(`/weightage-management/domain-sub-domains/${domainId}`);
  },

  // Create domain
  create: async (domainData) => {
    return apiCall('/domains', {
      method: 'POST',
      body: JSON.stringify(domainData),
    });
  },

  // Update domain
  update: async (id, domainData) => {
    return apiCall(`/domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(domainData),
    });
  },

  // Delete domain
  delete: async (id) => {
    return apiCall(`/domains/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== SUB_DOMAINS API ====================
export const subDomainApi = {
  // Get all sub_domains
  getAll: async () => {
    return apiCall('/sub_domains');
  },

  // Get single sub_domain
  getById: async (id) => {
    return apiCall(`/sub_domains/${id}`);
  },

  // Get sub_domains by domain ID
  getByDomainId: async (domainId) => {
    return apiCall(`/weightage-management/domain-sub-domains/${domainId}`);
  },

  // Create sub_domain
  create: async (subDomainData) => {
    return apiCall('/sub_domains', {
      method: 'POST',
      body: JSON.stringify(subDomainData),
    });
  },

  // Update sub_domain
  update: async (id, subDomainData) => {
    return apiCall(`/sub_domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subDomainData),
    });
  },

  // Delete sub_domain
  delete: async (id) => {
    return apiCall(`/sub_domains/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== QUERIES API ====================
export const queryApi = {
  // Get all queries with pagination
  getAll: async (page = 1, limit = 25) => {
    return apiCall(`/queries?page=${page}&limit=${limit}`);
  },

  // Get single query
  getById: async (id) => {
    return apiCall(`/queries/${id}`);
  },

  // Create query
  create: async (queryData) => {
    return apiCall('/queries', {
      method: 'POST',
      body: JSON.stringify(queryData),
    });
  },

  // Update query
  update: async (id, queryData) => {
    return apiCall(`/queries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(queryData),
    });
  },

  // Delete query
  delete: async (id) => {
    return apiCall(`/queries/${id}`, {
      method: 'DELETE',
    });
  },

  // Get queries not in sub-domain (for import)
  getAvailableForSubDomain: async (subDomainId) => {
    return apiCall(`/queries/sub-domain/${subDomainId}/available`);
  },

  // Get queries linked to sub-domain
  getLinkedToSubDomain: async (subDomainId) => {
    return apiCall(`/queries/sub-domain/${subDomainId}/linked`);
  },

  // Link query to sub-domain
  linkToSubDomain: async (subDomainId, queryId, queryType = 'primary', parentId = null, itemOrder = 0) => {
    return apiCall(`/queries/sub-domain/${subDomainId}/query/${queryId}/link`, {
      method: 'POST',
      body: JSON.stringify({ queryType, parentId, itemOrder }),
    });
  },

  // Update sub-domain query configuration
  updateSubDomainQuery: async (subDomainId, queryId, queryType, parentId = null, itemOrder = null) => {
    return apiCall(`/queries/sub-domain/${subDomainId}/query/${queryId}`, {
      method: 'PUT',
      body: JSON.stringify({ queryType, parentId, itemOrder }),
    });
  },

  // Unlink query from sub-domain
  unlinkFromSubDomain: async (subDomainId, queryId) => {
    return apiCall(`/queries/sub-domain/${subDomainId}/query/${queryId}/unlink`, {
      method: 'DELETE',
    });
  },
};

// ==================== USERS API ====================
export const userApi = {
  // Get all users
  getAll: async () => {
    return apiCall('/users');
  },
  
  // Create user
  create: async (userData) => {
    return apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  
  // Update user
  update: async (id, userData) => {
    return apiCall(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },
  
  // Delete user
  delete: async (id) => {
    return apiCall(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== INSPECTIONS API ====================
export const inspectionApi = {
  // Get pending inspections for reviewer approval
  getPending: async () => {
    return apiCall('/inspections/pending');
  },

  // Get user inspections
  getUserInspections: async () => {
    return apiCall('/inspections/user');
  },

  // Approve inspection
  approve: async (inspectionId, notes) => {
    return apiCall(`/inspections/${inspectionId}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  },

  // Reject inspection
  reject: async (inspectionId, notes) => {
    return apiCall(`/inspections/${inspectionId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  },

  // Get inspection responses
  getResponses: async (inspectionId) => {
    return apiCall(`/responses/inspection/${inspectionId}`);
  },

  // Submit responses for inspection
  submitResponses: async (inspectionId, responses) => {
    return apiCall(`/responses/inspection/${inspectionId}`, {
      method: 'POST',
      body: JSON.stringify({ responses }),
    });
  },

  // Get inspection configurations for a project (phases)
  getConfigurations: async (projectId) => {
    return apiCall(`/inspections/${projectId}/configurations`);
  },
};

// ==================== REVIEWER API ====================
export const reviewerApi = {
  // Get reviewer dashboard with pending, approved, rejected inspections
  getDashboard: async () => {
    return apiCall('/reviewer/dashboard');
  },

  // Get inspection details for review
  getInspectionForReview: async (inspectionId) => {
    return apiCall(`/reviewer/inspections/${inspectionId}/review`);
  },

  // Approve inspection
  approve: async (inspectionId, notes) => {
    return apiCall(`/reviewer/inspections/${inspectionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  // Reject inspection (supports both legacy notes format and granular rejection format)
  reject: async (inspectionId, rejectionData) => {
    // Handle legacy format (string notes) and new format (object)
    const body = typeof rejectionData === 'string' 
      ? JSON.stringify({ notes: rejectionData })
      : JSON.stringify(rejectionData);
    
    return apiCall(`/reviewer/inspections/${inspectionId}/reject`, {
      method: 'POST',
      body,
    });
  },

  // Get inspection rejection history
  getRejectionHistory: async (inspectionId) => {
    return apiCall(`/reviewer/inspections/${inspectionId}/rejection-history`);
  },
};

// ==================== MANAGER API ====================
export const managerApi = {
  // Get manager dashboard with pending, approved, rejected inspections
  getDashboard: async () => {
    return apiCall('/manager/dashboard');
  },

  // Get inspection details for manager review
  getInspectionForReview: async (inspectionId) => {
    return apiCall(`/manager/inspections/${inspectionId}/review`);
  },

  // Alias for backward compatibility
  getInspectionForManagerReview: async (inspectionId) => {
    return apiCall(`/manager/inspections/${inspectionId}/review`);
  },

  // Approve inspection
  approve: async (inspectionId, notes) => {
    return apiCall(`/manager/inspections/${inspectionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  // Reject inspection
  reject: async (inspectionId, rejectionData) => {
    const body = typeof rejectionData === 'string'
      ? JSON.stringify({ notes: rejectionData })
      : JSON.stringify(rejectionData);
    
    return apiCall(`/manager/inspections/${inspectionId}/reject`, {
      method: 'POST',
      body,
    });
  },

  // Get inspection rejection history
  getInspectionRejectionHistory: async (inspectionId) => {
    return apiCall(`/manager/inspections/${inspectionId}/rejection-history`);
  },

  // Edit project
  editProject: async (projectId, projectData) => {
    return apiCall(`/manager/projects/${projectId}/edit`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  },
};

// Export all APIs
export default {
  project: projectApi,
  domain: domainApi,
  subDomain: subDomainApi,
  query: queryApi,
  userApi,
  inspectionApi,
  managerApi
};