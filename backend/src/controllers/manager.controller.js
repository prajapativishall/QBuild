const db = require('../config/db');
const logger = require('../utils/logger');
const scoringService = require('../services/scoring.service');
const reviewWorkflow = require('../workflow/reviewWorkflow');

/**
 * Get manager dashboard with pending, approved, and rejected inspections
 */
const getManagerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    logger.info('Getting manager dashboard', { userId });

    // Get inspections that are approved by reviewer and pending manager approval
      const dashboardQuery = `
        SELECT
          i.id,
          i.project_id,
          p.project_name,
          i.phase,
          i.status,
          i.approval_status,
          i.manager_approval_status,
          i.reviewed_at,
          i.reviewer_notes,
          i.manager_reviewed_at,
          i.manager_notes,
          i.created_at,
          MAX(u_rev.name) as reviewer_name,
          MAX(u_insp.name) as inspector_name,
          COUNT(DISTINCT CONCAT(COALESCE(pdsd.domain_id, ''), '-', COALESCE(pdsd.sub_domain_id, ''))) as total_subdomains,
          COUNT(DISTINCT CASE WHEN iss.id IS NOT NULL THEN CONCAT(COALESCE(iss.domain_id, ''), '-', COALESCE(iss.sub_domain_id, '')) END) as submitted_subdomains
        FROM inspections i
        INNER JOIN projects p ON i.project_id = p.id
        INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
        LEFT JOIN users u_rev ON ph.reviewer_id = u_rev.id
        LEFT JOIN users u_insp ON ph.inspector_id = u_insp.id
        INNER JOIN phase_domain_sub_domains pdsd ON p.id = pdsd.project_id AND pdsd.phase_number = i.phase
        LEFT JOIN inspection_subdomain_submissions iss ON pdsd.sub_domain_id = iss.sub_domain_id
          AND pdsd.domain_id = iss.domain_id
          AND iss.inspection_id = i.id
        WHERE i.manager_id = ?
          AND ((i.approval_status IN ('approved', 'rejected')) OR (i.approval_status = 'pending' AND i.manager_approval_status = 'rejected'))
          AND i.status IN ('completed', 'in_progress')
        GROUP BY i.id, i.project_id, p.project_name, i.phase, i.status, i.approval_status,
                 i.manager_approval_status, i.reviewed_at, i.reviewer_notes, i.manager_reviewed_at,
                 i.manager_notes, i.created_at
        ORDER BY i.created_at DESC
      `;

    const inspections = await db.execute(dashboardQuery, [userId]);

    // Categorize by manager approval status
    const pending = inspections.filter(i => i.manager_approval_status === 'pending');
    const approved = inspections.filter(i => i.manager_approval_status === 'approved');
    const rejected = inspections.filter(i => i.manager_approval_status === 'rejected');

    res.json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        summary: {
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length
        }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Get inspection details for manager review
 */
const getInspectionForManagerReview = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;

    logger.info('Getting inspection for manager review', { inspectionId, userId });

    // Get inspection basic info
    const inspectionQuery = `
      SELECT
        i.id,
        i.project_id,
        i.phase,
        i.status,
        i.approval_status,
        i.manager_approval_status,
        i.reviewer_notes,
        i.manager_notes,
        i.created_at,
        p.project_name,
        u_rev.name as reviewer_name,
        u_rev.email as reviewer_email,
        u_insp.name as inspector_name,
        u_insp.email as inspector_email
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
      LEFT JOIN users u_rev ON ph.reviewer_id = u_rev.id
      LEFT JOIN users u_insp ON ph.inspector_id = u_insp.id
      WHERE i.id = ? AND i.manager_id = ?
    `;

    const inspection = await db.execute(inspectionQuery, [inspectionId, userId]);

    if (inspection.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }

    // Get domains with sub-domains
    const domainsQuery = `
      SELECT
        d.id as domain_id,
        d.domain_name,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'sub_domain_id', sd.id,
            'sub_domain_name', sd.sub_domain_name,
            'submitted', IF(iss.id IS NOT NULL, true, false)
          )
        ) as sub_domains
      FROM domains d
      INNER JOIN phase_domains pd ON d.id = pd.domain_id
      INNER JOIN projects p ON pd.project_id = p.id
      INNER JOIN inspections i ON i.project_id = p.id AND i.id = ? AND i.phase = pd.phase_number
      INNER JOIN phase_domain_sub_domains pdsd ON pd.project_id = pdsd.project_id
        AND pd.phase_number = pdsd.phase_number
        AND pdsd.domain_id = pd.domain_id
      INNER JOIN sub_domains sd ON pdsd.sub_domain_id = sd.id
      LEFT JOIN inspection_subdomain_submissions iss ON sd.id = iss.sub_domain_id
        AND d.id = iss.domain_id
        AND iss.inspection_id = ?
      WHERE p.id = (SELECT project_id FROM inspections WHERE id = ?)
      GROUP BY d.id, d.domain_name
      ORDER BY d.domain_name ASC
    `;

    const domains = await db.execute(domainsQuery, [inspectionId, inspectionId, inspectionId]);

    // Get all queries with responses
    const queriesQuery = `
      SELECT DISTINCT
      q.id as query_id,
      q.question_text,
      COALESCE(prq.query_type, sq.query_type, 'primary') as query_type,
      COALESCE(parent_sq.query_id, NULL) as parent_id,
      COALESCE(sq.item_order, prq.id) as item_order,
      prq.sub_domain_id,
      sd.sub_domain_name,
      prq.domain_id,
      d.domain_name,
      r.response as response,
      r.nc_type as nctype,
      r.inspector_comment as comments,
      r.additional_remarks,
      r.photos as site_photos,
      r.submitted_at
    FROM phase_queries pq
    JOIN project_queries prq ON pq.project_query_id = prq.id
    JOIN queries q ON prq.query_id = q.id
    JOIN sub_domains sd ON prq.sub_domain_id = sd.id
    JOIN domains d ON prq.domain_id = d.id
    LEFT JOIN sub_domain_queries sq ON q.id = sq.query_id AND sq.sub_domain_id = prq.sub_domain_id
    LEFT JOIN sub_domain_queries parent_sq ON parent_sq.id = sq.parent_id
    LEFT JOIN responses r ON r.inspection_id = ?
      AND r.query_id = q.id
      AND r.sub_domain_id = prq.sub_domain_id
      AND (r.domain_id = prq.domain_id OR r.domain_id IS NULL)
    JOIN inspections i ON i.id = ?
      WHERE pq.project_id = (SELECT project_id FROM inspections WHERE id = ?) 
        AND pq.phase_number = i.phase
      ORDER BY d.domain_name ASC, sd.sub_domain_name ASC, COALESCE(sq.item_order, prq.id) ASC
    `;

    const queries = await db.execute(queriesQuery, [inspectionId, inspectionId, inspectionId]);
    logger.debug('Manager queries with photos', { 
      inspectionId, 
      queryCount: queries.length, 
      sampleWithPhotos: queries.filter(q => q.site_photos).slice(0, 2),
      allSitePhotos: queries.map(q => ({ queryId: q.queryId, hasPhotos: !!q.site_photos, photos: q.site_photos }))
    });

    // Format domains with sub-domains
    const formattedDomains = domains.map(domain => ({
      domainId: domain.domain_id,
      domainName: domain.domain_name,
      subDomains: domain.sub_domains ? (typeof domain.sub_domains === 'string' ? JSON.parse(domain.sub_domains) : domain.sub_domains) : []
    }));

    // Format queries
    const formattedQueries = queries.map(q => ({
      queryId: q.query_id,
      questionText: q.question_text,
      queryType: q.query_type,
      parentId: q.parent_id,
      itemOrder: q.item_order,
      subDomainId: q.sub_domain_id,
      subDomainName: q.sub_domain_name,
      domainId: q.domain_id,
      domainName: q.domain_name,
      response: q.response,
      nctype: q.nctype,
      comments: q.comments,
      additionalRemarks: q.additional_remarks,
      sitePhotos: q.site_photos ? (typeof q.site_photos === 'string' ? JSON.parse(q.site_photos) : q.site_photos) : [],
      submittedAt: q.submitted_at,
      isPrimary: q.query_type === 'primary',
      isSecondary: q.query_type === 'secondary'
    }));

    res.json({
      success: true,
      data: {
        inspection: inspection[0],
        domains: formattedDomains,
        queries: formattedQueries
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Approve inspection (manager level)
 * Uses reviewWorkflow.approveInspection with role='manager'
 */
const approveInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    logger.info('Manager approving inspection', { inspectionId, userId, notes });

    // Verify inspection is pending manager review (approval_status can be 'approved' or 'pending')
    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       WHERE i.id = ?
         AND i.approval_status IN ('approved', 'pending')
         AND i.manager_approval_status = 'pending'
         AND i.manager_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(400).json({ success: false, message: 'Inspection not ready for manager approval' });
    }

    // Use the workflow engine to approve the inspection (manager role)
    // This stores history with actor_role='manager', action_type='approved', scope_type='inspection'
    const workflowResult = await reviewWorkflow.approveInspection(inspectionId, userId, notes, 'manager');

    // Note: Project status is updated manually by manager/admin, not auto-completed
    // Only trigger scoring if all sub-domains are submitted
    const totalSubdomainsResult = await db.execute(
      `SELECT COUNT(*) as totalSubdomains
       FROM phase_domain_sub_domains pdsd
       INNER JOIN inspections i ON pdsd.project_id = i.project_id AND pdsd.phase_number = i.phase
       WHERE i.id = ?`,
      [inspectionId]
    );
    const totalSubdomains = totalSubdomainsResult[0]?.totalSubdomains || 0;

    const submittedSubdomainsResult = await db.execute(
      `SELECT COUNT(DISTINCT sub_domain_id) as submittedSubdomains
       FROM inspection_subdomain_submissions
       WHERE inspection_id = ?`,
      [inspectionId]
    );
    const submittedSubdomains = submittedSubdomainsResult[0]?.submittedSubdomains || 0;

    // Trigger spider chart generation only if all sub-domains are submitted
    if (totalSubdomains > 0 && submittedSubdomains >= totalSubdomains) {
      try {
        await scoringService.calculateInspectionScore(inspectionId);
        logger.info('Spider chart generated successfully', { inspectionId, submittedSubdomains, totalSubdomains });
      } catch (scoringError) {
        logger.error('Failed to generate spider chart', { inspectionId, error: scoringError.message });
        // Don't fail the approval if spider chart generation fails
      }
    } else {
      logger.warn('Spider chart generation skipped - not all sub-domains submitted', {
        inspectionId,
        submittedSubdomains,
        totalSubdomains
      });
    }

    res.json({
      success: true,
      message: workflowResult.message || 'Inspection approved successfully'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Reject inspection (manager level) - sends back to reviewer
 * Uses reviewWorkflow.rejectInspection with role='manager'
 */
const rejectInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    if (!notes || notes.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection notes are required' });
    }

    logger.info('Manager rejecting inspection', { inspectionId, userId, notes });

    // Verify inspection is pending manager review (approval_status can be 'approved' or 'pending')
    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       WHERE i.id = ?
         AND i.approval_status IN ('approved', 'pending')
         AND i.manager_approval_status = 'pending'
         AND i.manager_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(400).json({ success: false, message: 'Inspection not ready for manager review' });
    }

    // Managers always reject the whole inspection (no granular rejection)
    const workflowResult = await reviewWorkflow.rejectInspection(
      inspectionId, userId, notes, 'inspection', null, null, null, null, 'manager'
    );

    res.json({
      success: true,
      message: 'Inspection rejected and sent back to reviewer'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Get inspection history (both approvals and rejections) for a given inspection.
 * Returns normalized fields:
 *   - actor_role ('reviewer' | 'manager')
 *   - action_type ('approved' | 'rejected')
 *   - scope_type ('inspection' | 'domain' | 'subdomain' | 'query')
 */
const getInspectionRejectionHistory = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;

    logger.info('Getting inspection history', { inspectionId, userId });

    // Get history for this inspection (both approvals and rejections)
    const history = await db.execute(
      `SELECT 
        irh.id,
        irh.inspection_id,
        COALESCE(irh.actor_role, 'reviewer') as actor_role,
        COALESCE(irh.action_type, 'rejected') as action_type,
        COALESCE(irh.scope_type, 'inspection') as scope_type,
        COALESCE(irh.domain_id, NULL) as domain_id,
        COALESCE(irh.sub_domain_id, NULL) as sub_domain_id,
        COALESCE(irh.query_id, NULL) as query_id,
        irh.rejection_reason,
        irh.rejection_notes,
        irh.responses,
        irh.rejection_date,
        u.name as rejected_by_name,
        u.email as rejected_by_email
      FROM inspection_rejection_history irh
      INNER JOIN users u ON irh.rejected_by = u.id
      WHERE irh.inspection_id = ?
      ORDER BY irh.rejection_date DESC`,
      [inspectionId]
    );

    // Parse responses JSON field
    const parsedHistory = history.map(item => ({
      ...item,
      responses: item.responses ? (typeof item.responses === 'string' ? JSON.parse(item.responses) : item.responses) : null
    }));

    res.json({
      success: true,
      data: parsedHistory
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Edit project - updates project and all related inspection data
 */
const editProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const {
      projectName,
      projectType,
      location,
      description: projectDescription,
      siteAddress: projectSiteAddress,
      city,
      state,
      inspectorId,
      reviewerId,
      managerId,
      phases,
      domains,
      queries
    } = req.body;

    const description = projectDescription || projectType || null;
    const siteAddress = projectSiteAddress || location || null;

    logger.info('Editing project', { projectId, userId, updates: Object.keys(req.body) });

    // Verify user is the assigned manager or admin
    const accessCheck = await db.execute(
      `SELECT p.id FROM projects p
       LEFT JOIN inspections i ON i.project_id = p.id
       WHERE p.id = ? AND (i.manager_id = ? OR ? IN (SELECT user_id FROM users WHERE role = 'admin'))`,
      [projectId, userId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied' });
    }

    // Start transaction for atomic updates
    await db.beginTransaction();

    try {
      // 1. Update project basic info
      await db.execute(
        `UPDATE projects 
         SET project_name = COALESCE(?, project_name),
             description = COALESCE(?, description),
             site_address = COALESCE(?, site_address),
             city = COALESCE(?, city),
             state = COALESCE(?, state),
             updated_at = NOW()
         WHERE id = ?`,
        [projectName, description, siteAddress, city, state, projectId]
      );

      if (inspectorId) {
        await db.execute(
          `UPDATE inspections i
           INNER JOIN projects p ON i.project_id = p.id
           SET i.inspector_id = ?,
               i.status = CASE WHEN i.inspector_id != ? THEN 'pending' ELSE i.status END,
               i.updated_at = NOW()
           WHERE p.id = ?`,
          [inspectorId, inspectorId, projectId]
        );
      }

      if (managerId) {
        await db.execute(
          `UPDATE inspections i
           INNER JOIN projects p ON i.project_id = p.id
           SET i.manager_id = ?,
               i.updated_at = NOW()
           WHERE p.id = ?`,
          [managerId, projectId]
        );
      }

      if (reviewerId) {
        await db.execute(
          `UPDATE phases
           SET reviewer_id = ?
           WHERE project_id = ?`,
          [reviewerId, projectId]
        );
      }

      // 2. Update phases if provided
      if (phases && Array.isArray(phases)) {
        for (const phase of phases) {
          const { phaseId, description, status, inspectorId: phaseInspectorId, start_date, end_date } = phase;
          
          await db.execute(
            `UPDATE phases 
             SET description = COALESCE(?, description),
                 status = COALESCE(?, status),
                 inspector_id = COALESCE(?, inspector_id),
                 start_date = COALESCE(?, start_date),
                 end_date = COALESCE(?, end_date),
                 updated_at = NOW()
             WHERE id = ? AND project_id = ?`,
            [description, status, phaseInspectorId, start_date, end_date, phaseId, projectId]
          );
        }
      }

      // 3. Update phase domains if provided
      if (domains && Array.isArray(domains)) {
        for (const domain of domains) {
          const { domainId, weightage, isActive } = domain;
          
          await db.execute(
            `UPDATE phase_domains 
             SET weightage = COALESCE(?, weightage),
                 updated_at = NOW()
             WHERE id = ? AND project_id = ?`,
            [weightage, domainId, projectId]
          );
        }
      }

      // 4. Update project queries if provided
      if (queries && Array.isArray(queries)) {
        for (const query of queries) {
          const { queryId, queryText, queryType, weightage, isActive } = query;
          
          await db.execute(
            `UPDATE project_queries 
             SET query_text = COALESCE(?, query_text),
                 query_type = COALESCE(?, query_type),
                 weightage = COALESCE(?, weightage),
                 is_active = COALESCE(?, is_active),
                 updated_at = NOW()
             WHERE id = ? AND EXISTS (
                   SELECT 1 FROM phase_domains pd 
                   WHERE pd.project_id = ? AND pd.domain_id = project_queries.domain_id
                 )`,
            [queryText, queryType, weightage, isActive, queryId, projectId]
          );
        }
      }

      // 5. Update related inspections to reflect changes
      await db.execute(
        `UPDATE inspections i
         INNER JOIN projects p ON i.project_id = p.id
         SET i.updated_at = NOW(),
             i.status = CASE 
               WHEN ? IS NOT NULL AND i.inspector_id != ? THEN 'pending'
               ELSE i.status
             END
         WHERE p.id = ?`,
        [inspectorId, inspectorId, projectId]
      );

      // 6. Record edit history for audit trail using new normalized columns
      await db.execute(
        `INSERT INTO inspection_rejection_history 
         (inspection_id, actor_role, action_type, scope_type, rejected_by, rejection_reason, rejection_notes, rejection_date, responses)
         SELECT i.id, 'manager', 'project_edit', 'inspection', ?, ?, ?, NOW(), ?
         FROM inspections i
         WHERE i.project_id = ?`,
        [userId, 'Project edited by manager', 'Project configuration updated', 
         JSON.stringify({ projectName, projectType, location, inspectorId, phases, domains, queries }), projectId]
      );

      // Commit transaction
      await db.commit();

      logger.info('Project edited successfully', { projectId, userId });

      res.json({
        success: true,
        message: 'Project edited successfully. Changes will reflect in inspector app.'
      });

    } catch (innerError) {
      // Rollback on error
      await db.rollback();
      throw innerError;
    }

  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

module.exports = {
  getManagerDashboard,
  getInspectionForManagerReview,
  approveInspection,
  rejectInspection,
  getInspectionRejectionHistory,
  editProject
};
