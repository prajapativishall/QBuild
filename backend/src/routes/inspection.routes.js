const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Apply authentication middleware to all inspection routes
router.use(authenticate);

/**
 * GET /api/inspections/user
 * Get all inspections for the logged-in user
 * Returns inspections for active projects, and also projects without inspections
 */
router.get('/user',
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      logger.info('Fetching inspections for user', { userId });

      // Get inspections for active projects
      const inspectionsQuery = `
        SELECT
          i.id as inspectionId,
          i.project_id as projectId,
          i.status,
          i.inspection_date as inspectionDate,
          i.created_at as createdAt,
          p.project_name as projectName,
          p.description as projectDescription,
          p.site_address as siteAddress,
          p.city,
          p.state,
          p.status as projectStatus
        FROM inspections i
        JOIN projects p ON i.project_id = p.id
        JOIN phases ph ON i.project_id = ph.project_id AND i.phase = ph.phase_number
        WHERE p.status = 'active'
          AND (ph.inspector_id = ? OR ph.viewer_id = ?)
        ORDER BY i.created_at DESC
      `;

      const inspections = await db.execute(inspectionsQuery, [userId, userId]);
      logger.info('Inspections found:', { count: inspections.length, userId });

      // Get projects without inspections (assigned but not yet inspected)
      const projectsWithoutInspectionsQuery = `
        SELECT
          NULL as inspectionId,
          p.id as projectId,
          'pending' as status,
          NULL as inspectionDate,
          p.created_at as createdAt,
          p.project_name as projectName,
          p.description as projectDescription,
          p.site_address as siteAddress,
          p.city,
          p.state,
          p.status as projectStatus
        FROM projects p
        INNER JOIN phases ph ON ph.project_id = p.id AND ph.phase_number = 1
        WHERE p.status = 'active'
          AND (ph.inspector_id = ? OR ph.viewer_id = ?)
          AND p.id NOT IN (SELECT DISTINCT project_id FROM inspections)
        ORDER BY p.created_at DESC
      `;

      const projectsWithoutInspections = await db.execute(projectsWithoutInspectionsQuery, [userId, userId]);
      logger.info('Projects without inspections found:', { count: projectsWithoutInspections.length, userId });

      // Combine both results
      const allItems = [...inspections, ...projectsWithoutInspections];

      res.json({
        success: true,
        data: allItems
      });
    } catch (error) {
      logger.error('Error fetching user inspections', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/inspections/debug/:userId
 * Debug endpoint to check user's project assignments
 */
router.get('/debug/:userId',
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId);

      logger.info('Debug: Checking user assignments', { userId });

      // Check user exists
      const userQuery = 'SELECT id, name, email, role FROM users WHERE id = ?';
      const user = await db.execute(userQuery, [userId]);
      logger.info('User found:', user);

      // Check projects where user is inspector or viewer
      const projectsQuery = `
        SELECT 
          p.id,
          p.project_name,
          p.status,
          ph.inspector_id,
          p.viewer_id
        FROM projects p
        INNER JOIN phases ph ON ph.project_id = p.id AND ph.phase_number = 1
        WHERE ph.inspector_id = ? OR p.viewer_id = ?
      `;
      const projects = await db.execute(projectsQuery, [userId, userId]);
      logger.info('Projects assigned:', projects);

      // Check all inspections
      const inspectionsQuery = 'SELECT id, project_id, status, inspection_date FROM inspections';
      const inspections = await db.execute(inspectionsQuery);
      logger.info('All inspections:', inspections);

      res.json({
        success: true,
        data: {
          user,
          projects,
          allInspections: inspections
        }
      });
    } catch (error) {
      logger.error('Debug error', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/inspections/:projectId/configurations
 * Get all inspection configurations for a project (previous phases)
 */
router.get('/:projectId/configurations',
  authenticate,
  async (req, res, next) => {
    try {
      const projectId = parseInt(req.params.projectId);

      logger.info('Fetching inspection configurations for project', { projectId });

      const configurationsQuery = `
        SELECT 
          ic.id,
          ic.inspection_id,
          ic.inspector_id,
          ic.reviewer_id,
          ic.created_at,
          i.phase,
          i.status as inspection_status,
          i.inspection_date,
          u_insp.name as inspector_name,
          u_insp.email as inspector_email,
          u_rev.name as reviewer_name,
          u_rev.email as reviewer_email
        FROM inspection_configurations ic
        LEFT JOIN inspections i ON ic.inspection_id = i.id
        LEFT JOIN users u_insp ON ic.inspector_id = u_insp.id
        LEFT JOIN users u_rev ON ic.reviewer_id = u_rev.id
        WHERE i.project_id = ?
        ORDER BY i.phase ASC, ic.created_at DESC
      `;

      const configurations = await db.execute(configurationsQuery, [projectId]);

      const formattedConfigurations = configurations.map(config => ({
        ...config
      }));

      res.json({
        success: true,
        data: {
          projectId,
          phases: formattedConfigurations
        }
      });
    } catch (error) {
      logger.error('Error fetching inspection configurations', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /api/inspections/pending
 * Get all pending inspections for reviewer approval
 */
router.get('/pending',
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Only reviewers and admins can view pending inspections
      if (userRole !== 'reviewer' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only reviewers and admins can view pending inspections'
        });
      }

      logger.info('Fetching pending inspections for reviewer', { userId, userRole });

      const query = `
        SELECT
          i.id as inspectionId,
          i.project_id as projectId,
          i.status,
          i.inspection_date as inspectionDate,
          i.created_at as createdAt,
          i.approval_status as approvalStatus,
          i.reviewer_id as reviewerId,
          i.reviewed_at as reviewedAt,
          i.reviewer_notes as reviewerNotes,
          p.project_name as projectName,
          p.description as projectDescription,
          p.site_address as siteAddress,
          p.city,
          p.state,
          u.name as inspectorName,
          u.email as inspectorEmail,
          r.name as reviewerName
        FROM inspections i
        JOIN projects p ON i.project_id = p.id
        JOIN phases ph ON i.project_id = ph.project_id AND i.phase = ph.phase_number
        LEFT JOIN users u ON ph.inspector_id = u.id
        LEFT JOIN users r ON i.reviewer_id = r.id
        WHERE i.approval_status = 'pending'
          AND i.status = 'completed'
        ORDER BY i.created_at DESC
      `;

      const inspections = await db.execute(query);

      logger.info('Pending inspections found:', { count: inspections.length });

      res.json({
        success: true,
        data: inspections
      });
    } catch (error) {
      logger.error('Error fetching pending inspections', { error: error.message });
      next(error);
    }
  }
);

/**
 * PUT /api/inspections/:inspectionId/approve
 * Approve an inspection (reviewer only)
 */
router.put('/:inspectionId/approve',
  async (req, res, next) => {
    try {
      const { inspectionId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Only reviewers and admins can approve inspections
      if (userRole !== 'reviewer' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only reviewers and admins can approve inspections'
        });
      }

      logger.info('Approving inspection', { inspectionId, userId, userRole });

      // Check if inspection exists and is pending
      const inspectionCheck = await db.execute(
        'SELECT id, approval_status, status FROM inspections WHERE id = ?',
        [inspectionId]
      );

      if (inspectionCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Inspection not found'
        });
      }

      const inspection = inspectionCheck[0];

      if (inspection.approval_status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Inspection has already been reviewed'
        });
      }

      if (inspection.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Inspection must be completed before approval'
        });
      }

      // Update inspection approval status
      await db.execute(
        `UPDATE inspections 
         SET approval_status = 'approved',
             reviewer_id = ?,
             reviewed_at = CURRENT_TIMESTAMP,
             reviewer_notes = ?
         WHERE id = ?`,
        [userId, notes || null, inspectionId]
      );

      await db.execute(
        `UPDATE phases ph
         INNER JOIN inspections i ON ph.project_id = i.project_id AND ph.phase_number = i.phase
         SET ph.status = 'approved', ph.updated_at = NOW()
         WHERE i.id = ?`,
        [inspectionId]
      );

      logger.info('Inspection approved successfully', { inspectionId, userId });

      res.json({
        success: true,
        message: 'Inspection approved successfully',
        data: {
          inspectionId,
          approvalStatus: 'approved',
          reviewerId: userId
        }
      });
    } catch (error) {
      logger.error('Error approving inspection', { error: error.message });
      next(error);
    }
  }
);

/**
 * PUT /api/inspections/:inspectionId/reject
 * Reject an inspection (reviewer only)
 */
router.put('/:inspectionId/reject',
  async (req, res, next) => {
    try {
      const { inspectionId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Only reviewers and admins can reject inspections
      if (userRole !== 'reviewer' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only reviewers and admins can reject inspections'
        });
      }

      logger.info('Rejecting inspection', { inspectionId, userId, userRole });

      // Check if inspection exists and is pending
      const inspectionCheck = await db.execute(
        'SELECT id, approval_status FROM inspections WHERE id = ?',
        [inspectionId]
      );

      if (inspectionCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Inspection not found'
        });
      }

      const inspection = inspectionCheck[0];

      if (inspection.approval_status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Inspection has already been reviewed'
        });
      }

      // Update inspection approval status
      await db.execute(
        `UPDATE inspections 
         SET approval_status = 'rejected',
             reviewer_id = ?,
             reviewed_at = CURRENT_TIMESTAMP,
             reviewer_notes = ?
         WHERE id = ?`,
        [userId, notes || null, inspectionId]
      );

      await db.execute(
        `UPDATE phases ph
         INNER JOIN inspections i ON ph.project_id = i.project_id AND ph.phase_number = i.phase
         SET ph.status = 'rejected', ph.updated_at = NOW()
         WHERE i.id = ?`,
        [inspectionId]
      );

      logger.info('Inspection rejected successfully', { inspectionId, userId });

      res.json({
        success: true,
        message: 'Inspection rejected successfully',
        data: {
          inspectionId,
          approvalStatus: 'rejected',
          reviewerId: userId
        }
      });
    } catch (error) {
      logger.error('Error rejecting inspection', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;
