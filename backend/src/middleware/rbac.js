const db = require('../config/db');
const logger = require('../utils/logger');
const { ForbiddenError, NotFoundError } = require('./errorHandler');

/**
 * Check if user has specific permission for a project
 * @param {number} userId - User ID
 * @param {number} projectId - Project ID
 * @param {string} permissionName - Permission name
 * @returns {Promise<boolean>} - Whether user has permission
 */
const hasProjectPermission = async (userId, projectId, permissionName) => {
  try {
    const query = `
      SELECT DISTINCT 1 as has_permission
      FROM project_user_roles pur
      JOIN roles r ON pur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE pur.user_id = ? 
        AND pur.project_id = ? 
        AND pur.is_active = 1
        AND p.permission_name = ?
      LIMIT 1
    `;
    
    const results = await db.execute(query, [userId, projectId, permissionName]);
    return results.length > 0;
  } catch (error) {
    logger.logError(error);
    return false;
  }
};

/**
 * Get user roles for a project
 * @param {number} userId - User ID
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} - Array of user roles
 */
const getUserProjectRoles = async (userId, projectId) => {
  try {
    const query = `
      SELECT r.id, r.role_name, r.description, pur.assigned_at, pur.is_active
      FROM project_user_roles pur
      JOIN roles r ON pur.role_id = r.id
      WHERE pur.user_id = ? 
        AND pur.project_id = ? 
        AND pur.is_active = 1
      ORDER BY pur.assigned_at DESC
    `;
    
    return await db.execute(query, [userId, projectId]);
  } catch (error) {
    logger.logError(error);
    return [];
  }
};

/**
 * Get user permissions for a project
 * @param {number} userId - User ID
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} - Array of user permissions
 */
const getUserProjectPermissions = async (userId, projectId) => {
  try {
    const query = `
      SELECT DISTINCT p.id, p.permission_name, p.description
      FROM project_user_roles pur
      JOIN roles r ON pur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE pur.user_id = ? 
        AND pur.project_id = ? 
        AND pur.is_active = 1
      ORDER BY p.permission_name ASC
    `;
    
    return await db.execute(query, [userId, projectId]);
  } catch (error) {
    logger.logError(error);
    return [];
  }
};

/**
 * Check if user has any access to a project
 * @param {number} userId - User ID
 * @param {number} projectId - Project ID
 * @returns {Promise<boolean>} - Whether user has any project access
 */
const hasProjectAccess = async (userId, projectId) => {
  try {
    // Check project_user_roles table
    const query = `
      SELECT 1 as has_access
      FROM project_user_roles pur
      WHERE pur.user_id = ?
        AND pur.project_id = ?
        AND pur.is_active = 1
      LIMIT 1
    `;

    const results = await db.execute(query, [userId, projectId]);
    if (results.length > 0) return true;

    // Check if user is assigned as inspector or viewer in phases table
    const projectQuery = `
      SELECT 1 as has_access
      FROM phases ph
      WHERE ph.project_id = ?
        AND (ph.inspector_id = ? OR ph.viewer_id = ?)
      LIMIT 1
    `;

    const projectResults = await db.execute(projectQuery, [projectId, userId, userId]);
    return projectResults.length > 0;
  } catch (error) {
    logger.logError(error);
    return false;
  }
};

/**
 * Middleware to check project access
 * Verifies user has any role in the project
 */
const requireProjectAccess = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Global admins have access to all projects
    if (req.user.isGlobalAdmin) {
      req.hasProjectAccess = true;
      return next();
    }

    // Get project ID from request parameters
    const projectId = await extractProjectId(req);
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID required',
        code: 'PROJECT_ID_REQUIRED'
      });
    }

    // Check if user has access to the project
    const hasAccess = await hasProjectAccess(req.user.id, projectId);
    
    if (!hasAccess) {
      logger.logAuth('Unauthorized project access attempt', req.user.id, {
        projectId,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'Access to this project is required',
        code: 'PROJECT_ACCESS_REQUIRED'
      });
    }

    // Attach project info to request
    req.projectId = projectId;
    req.hasProjectAccess = true;
    
    logger.logAuth('Project access granted', req.user.id, {
      projectId,
      ip: req.ip,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.logError(error, req);
    
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Middleware factory to check specific permission for a project
 * @param {string} permissionName - Required permission name
 * @returns {Function} - Express middleware function
 */
const requireProjectPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Global admins have all permissions
      if (req.user.isGlobalAdmin) {
        req.projectId = extractProjectId(req);
        req.permission = permissionName;
        req.hasPermission = true;
        return next();
      }

      // Get project ID from request parameters
      const projectId = extractProjectId(req);
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID required',
          code: 'PROJECT_ID_REQUIRED'
        });
      }

      // Check if user has the required permission
      const hasPermission = await hasProjectPermission(req.user.id, projectId, permissionName);
      
      if (!hasPermission) {
        logger.logAuth('Insufficient permissions for project', req.user.id, {
          projectId,
          permission: permissionName,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          message: `Permission '${permissionName}' is required for this action`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermission: permissionName
        });
      }

      // Attach project info to request
      req.projectId = projectId;
      req.permission = permissionName;
      req.hasPermission = true;
      
      logger.logAuth('Project permission granted', req.user.id, {
        projectId,
        permission: permissionName,
        ip: req.ip,
        url: req.originalUrl
      });

      next();
    } catch (error) {
      logger.logError(error, req);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Middleware factory to check multiple permissions (user needs at least one)
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Function} - Express middleware function
 */
const requireAnyProjectPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Global admins have all permissions
      if (req.user.isGlobalAdmin) {
        req.projectId = extractProjectId(req);
        req.permission = permissionNames[0]; // Use first permission as primary
        req.hasPermission = true;
        return next();
      }

      // Get project ID from request parameters
      const projectId = extractProjectId(req);
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID required',
          code: 'PROJECT_ID_REQUIRED'
        });
      }

      // Check if user has any of the required permissions
      let hasAnyPermission = false;
      let grantedPermission = null;

      for (const permissionName of permissionNames) {
        const hasPermission = await hasProjectPermission(req.user.id, projectId, permissionName);
        if (hasPermission) {
          hasAnyPermission = true;
          grantedPermission = permissionName;
          break;
        }
      }
      
      if (!hasAnyPermission) {
        logger.logAuth('Insufficient permissions for project', req.user.id, {
          projectId,
          requiredPermissions: permissionNames,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          message: `One of these permissions is required: ${permissionNames.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions: permissionNames
        });
      }

      // Attach project info to request
      req.projectId = projectId;
      req.permission = grantedPermission;
      req.hasPermission = true;
      
      logger.logAuth('Project permission granted', req.user.id, {
        projectId,
        permission: grantedPermission,
        ip: req.ip,
        url: req.originalUrl
      });

      next();
    } catch (error) {
      logger.logError(error, req);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Middleware factory to check multiple permissions (user needs all)
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Function} - Express middleware function
 */
const requireAllProjectPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Global admins have all permissions
      if (req.user.isGlobalAdmin) {
        req.projectId = extractProjectId(req);
        req.permission = permissionNames[0]; // Use first permission as primary
        req.hasPermission = true;
        return next();
      }

      // Get project ID from request parameters
      const projectId = extractProjectId(req);
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID required',
          code: 'PROJECT_ID_REQUIRED'
        });
      }

      // Check if user has all required permissions
      const permissionChecks = await Promise.all(
        permissionNames.map(permissionName => 
          hasProjectPermission(req.user.id, projectId, permissionName)
        )
      );
      
      const hasAllPermissions = permissionChecks.every(hasPermission => hasPermission);
      
      if (!hasAllPermissions) {
        const missingPermissions = permissionNames.filter((_, index) => !permissionChecks[index]);
        
        logger.logAuth('Insufficient permissions for project', req.user.id, {
          projectId,
          requiredPermissions: permissionNames,
          missingPermissions,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          message: `All these permissions are required: ${permissionNames.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions: permissionNames,
          missingPermissions
        });
      }

      // Attach project info to request
      req.projectId = projectId;
      req.permission = permissionNames[0]; // Use first permission as primary
      req.hasPermission = true;
      
      logger.logAuth('Project permissions granted', req.user.id, {
        projectId,
        permissions: permissionNames,
        ip: req.ip,
        url: req.originalUrl
      });

      next();
    } catch (error) {
      logger.logError(error, req);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to attach user project info to request
 * Does not block access, just provides context
 */
const attachProjectInfo = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const projectId = extractProjectId(req);
    
    if (!projectId) {
      return next();
    }

    // Get user roles and permissions for the project
    const roles = await getUserProjectRoles(req.user.id, projectId);
    const permissions = await getUserProjectPermissions(req.user.id, projectId);
    const hasAccess = await hasProjectAccess(req.user.id, projectId);

    req.projectInfo = {
      projectId,
      roles,
      permissions,
      hasAccess: hasAccess || req.user.isGlobalAdmin
    };

    next();
  } catch (error) {
    logger.logError(error, req);
    next();
  }
};

/**
 * Helper function to extract project ID from request
 * @param {Object} req - Express request object
 * @returns {Promise<number|null>} - Project ID or null
 */
const extractProjectId = async (req) => {
  if (!req) return null;
  const params = req.params || {};
  const body = req.body || {};
  const query = req.query || {};
  
  // Check direct project ID parameters
  const directProjectId = parseInt(params.projectId) ||
                           parseInt(params.id) ||
                           parseInt(params.inspectionId) ||
                           parseInt(body.projectId) ||
                           parseInt(query.projectId);
  
  if (directProjectId) {
    // Check if this is actually a project ID by looking it up
    const projectCheck = await db.execute('SELECT id FROM projects WHERE id = ?', [directProjectId]);
    if (projectCheck.length > 0) {
      return directProjectId;
    }
    
    // If not a project ID, check if it's an inspection ID and get the project ID
    const inspectionCheck = await db.execute('SELECT project_id FROM inspections WHERE id = ?', [directProjectId]);
    if (inspectionCheck.length > 0) {
      return inspectionCheck[0].project_id;
    }
  }
  
  // Check for inspection_id in body
  if (body.inspection_id) {
    const inspectionId = parseInt(body.inspection_id);
    
    // First check if it's actually a project ID (mobile app sends project ID as inspection_id when no inspection exists)
    const projectCheck = await db.execute('SELECT id FROM projects WHERE id = ?', [inspectionId]);
    if (projectCheck.length > 0) {
      return inspectionId;
    }
    
    // If not a project ID, check if it's an inspection ID and get the project ID
    const inspectionCheck = await db.execute('SELECT project_id FROM inspections WHERE id = ?', [inspectionId]);
    if (inspectionCheck.length > 0) {
      return inspectionCheck[0].project_id;
    }
  }
  
  return null;
};

/**
 * Middleware to check if user is project owner
 * @returns {Function} - Express middleware function
 */
const requireProjectOwner = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Global admins can access any project
    if (req.user.isGlobalAdmin) {
      req.projectId = extractProjectId(req);
      req.isProjectOwner = true;
      return next();
    }

    const projectId = extractProjectId(req);
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID required',
        code: 'PROJECT_ID_REQUIRED'
      });
    }

    // Check if user is the project owner
    const query = `
      SELECT 1 as is_owner
      FROM projects
      WHERE id = ? AND created_by = ?
      LIMIT 1
    `;
    
    const results = await db.execute(query, [projectId, req.user.id]);
    const isOwner = results.length > 0;

    if (!isOwner) {
      logger.logAuth('Unauthorized project owner access attempt', req.user.id, {
        projectId,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'Project owner access required',
        code: 'PROJECT_OWNER_REQUIRED'
      });
    }

    req.projectId = projectId;
    req.isProjectOwner = true;
    
    next();
  } catch (error) {
    logger.logError(error, req);
    
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

module.exports = {
  hasProjectPermission,
  getUserProjectRoles,
  getUserProjectPermissions,
  hasProjectAccess,
  requireProjectAccess,
  requireProjectPermission,
  requireAnyProjectPermission,
  requireAllProjectPermissions,
  attachProjectInfo,
  requireProjectOwner,
  extractProjectId
};
