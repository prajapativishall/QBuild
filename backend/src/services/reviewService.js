const db = require("../config/db");
const logger = require("../utils/logger");
const reviewWorkflow = require("../workflow/reviewWorkflow");

exports.getReviewerDashboard = async (userId) => {
  logger.info("Getting reviewer dashboard", { userId });

  const dashboardQuery = `
    SELECT 
      i.id,
      i.project_id,
      p.project_name,
      i.phase,
      i.status,
      i.approval_status,
      i.reviewed_at,
      i.reviewer_notes,
      i.created_at,
      MAX(u_insp.name) as inspector_name,
      MAX(u_mgr.name) as manager_name,
      COUNT(DISTINCT CONCAT(COALESCE(pdsd.domain_id, ''), '-', COALESCE(pdsd.sub_domain_id, ''))) as total_subdomains,
      COUNT(DISTINCT CASE WHEN iss.id IS NOT NULL THEN CONCAT(COALESCE(iss.domain_id, ''), '-', COALESCE(iss.sub_domain_id, '')) END) as submitted_subdomains
    FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
      LEFT JOIN users u_insp ON ph.inspector_id = u_insp.id
      LEFT JOIN users u_mgr ON i.manager_id = u_mgr.id
      INNER JOIN phase_domain_sub_domains pdsd ON p.id = pdsd.project_id AND pdsd.phase_number = i.phase
      LEFT JOIN inspection_subdomain_submissions iss ON pdsd.sub_domain_id = iss.sub_domain_id 
        AND pdsd.domain_id = iss.domain_id 
        AND iss.inspection_id = i.id
    WHERE (i.reviewer_id = ? OR ph.reviewer_id = ?)
      AND i.status IN ('completed', 'in_progress')
    GROUP BY i.id, i.project_id, p.project_name, i.phase, i.status, i.approval_status, 
             i.reviewed_at, i.reviewer_notes, i.created_at
    ORDER BY i.created_at DESC
  `;

  const rows = await db.execute(dashboardQuery, [userId, userId]);

  const pending = rows.filter((row) => row.approval_status === 'pending');
  const approved = rows.filter((row) => row.approval_status === 'approved');
  const rejected = rows.filter((row) => row.approval_status === 'rejected');

  return {
    pending,
    approved,
    rejected,
    summary: {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length
    }
  };
};

exports.getInspectionForReview = async (inspectionId, userId) => {
  logger.info("Getting inspection for review", { inspectionId, userId });

  const accessCheck = await db.execute(
    `SELECT i.id FROM inspections i
     INNER JOIN projects p ON i.project_id = p.id
     INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
     WHERE i.id = ? AND (i.reviewer_id = ? OR ph.reviewer_id = ?)`,
    [inspectionId, userId, userId]
  );

  if (accessCheck.length === 0) {
    return null; 
  }

  const inspectionQuery = `
    SELECT
      i.id,
      i.project_id,
      i.phase,
      i.status,
      i.approval_status,
      i.reviewer_notes,
      i.created_at,
      p.project_name,
      u_insp.name as inspector_name,
      u_insp.email as inspector_email,
      u_mgr.name as manager_name,
      u_mgr.email as manager_email
    FROM inspections i
    INNER JOIN projects p ON i.project_id = p.id
    INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
    LEFT JOIN users u_insp ON ph.inspector_id = u_insp.id
    LEFT JOIN users u_mgr ON i.manager_id = u_mgr.id
    WHERE i.id = ?
  `;

  const inspection = await db.execute(inspectionQuery, [inspectionId]);

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
    JOIN inspections i ON i.id = ?
    WHERE pq.project_id = (SELECT project_id FROM inspections WHERE id = ?) 
      AND pq.phase_number = i.phase
    ORDER BY d.domain_name ASC, sd.sub_domain_name ASC, COALESCE(sq.item_order, prq.id) ASC
  `;

  const queries = await db.execute(queriesQuery, [inspectionId, inspectionId, inspectionId]);
  logger.debug("Reviewer queries with photos", { inspectionId, queryCount: queries.length, sampleWithPhotos: queries.filter(q => q.site_photos).slice(0, 2) });

  const formattedDomains = domains.map(domain => ({
    domainId: domain.domain_id,
    domainName: domain.domain_name,
    subDomains: domain.sub_domains ? (typeof domain.sub_domains === 'string' ? JSON.parse(domain.sub_domains) : domain.sub_domains) : []
  }));

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

  return {
    inspection: inspection[0],
    domains: formattedDomains,
    queries: formattedQueries
  };
};

exports.approveInspection = async (inspectionId, userId, notes) => {
  logger.info("Approving inspection", { inspectionId, userId, notes });

  if (!userId) {
    logger.error("User not authenticated in approve inspection", { user: userId });
    throw new Error("User not authenticated");
  }

  if (process.env.NODE_ENV !== "development") {
    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       INNER JOIN projects p ON i.project_id = p.id
       INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
       WHERE i.id = ? AND (i.reviewer_id = ? OR ph.reviewer_id = ?)
         AND i.status IN ('completed', 'in_progress')`,
      [inspectionId, userId, userId]
    );

    if (accessCheck.length === 0) {
      throw new Error("Inspection not found, access denied");
    }
  }

  const responseResult = await db.execute(
    `SELECT COUNT(*) as responseCount
     FROM responses
     WHERE inspection_id = ?`,
    [inspectionId]
  );
  const responseCount = responseResult[0]?.responseCount || 0;

  logger.info("Approval validation", {
    inspectionId,
    userId,
    responseCount,
    canApprove: responseCount > 0
  });

  if (responseCount === 0) {
    throw new Error("Cannot approve - no responses found for this inspection");
  }

  // Use the workflow engine to approve the inspection (reviewer role)
  const workflowResult = await reviewWorkflow.approveInspection(inspectionId, userId, notes, 'reviewer');
  return workflowResult;
};

exports.rejectInspection = async (inspectionId, userId, notes, rejectionType, domainId, subDomainId, queryId, rejectedItems) => {
  if (!notes || notes.trim() === '') {
    throw new Error('Rejection notes are required');
  }

  if (rejectionType === 'domain' && !domainId) {
    throw new Error('Domain ID is required for domain rejection');
  }
  if (rejectionType === 'subdomain' && (!subDomainId || !domainId)) {
    throw new Error('Sub-domain ID and Domain ID are required for sub-domain rejection');
  }
  if (rejectionType === 'query' && (!queryId || !subDomainId || !domainId)) {
    throw new Error('Query ID, Sub-domain ID and Domain ID are required for query rejection');
  }

  logger.info('Rejecting inspection', { inspectionId, userId, rejectionType, notes, domainId, subDomainId, queryId });

  const accessCheck = await db.execute(
    `SELECT i.id FROM inspections i
     INNER JOIN projects p ON i.project_id = p.id
     INNER JOIN phases ph ON p.id = ph.project_id AND i.phase = ph.phase_number
     WHERE i.id = ? AND (i.reviewer_id = ? OR ph.reviewer_id = ?)
       AND i.status IN ('completed', 'in_progress')`,
    [inspectionId, userId, userId]
  );

  if (accessCheck.length === 0) {
    throw new Error('Inspection not found, access denied');
  }

  const workflowResult = await reviewWorkflow.rejectInspection(inspectionId, userId, notes, rejectionType, domainId, subDomainId, queryId, rejectedItems, 'reviewer');
  return workflowResult;
};

/**
 * Get inspection history (both approvals and rejections in chronological order).
 * Returns normalized fields:
 *   - actor_role ('reviewer' | 'manager')
 *   - action_type ('approved' | 'rejected')
 *   - scope_type ('inspection' | 'domain' | 'subdomain' | 'query')
 *   - domain_id, sub_domain_id, query_id
 */
exports.getInspectionRejectionHistory = async (inspectionId, userId) => {
  logger.info('Getting inspection history', { inspectionId, userId });

  let history;
  try {
    // Query with newer schema columns if available
    history = await db.execute(
      `SELECT 
        irh.id,
        irh.inspection_id,
        irh.actor_role,
        irh.action_type,
        irh.scope_type,
        irh.domain_id,
        irh.sub_domain_id,
        irh.query_id,
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
  } catch (error) {
    if (error.message && error.message.includes('Unknown column')) {
      logger.info('Falling back to legacy inspection_rejection_history schema', {
        inspectionId,
        error: error.message
      });
      history = await db.execute(
        `SELECT 
          irh.id,
          irh.inspection_id,
          IF(irh.rejection_type = 'reviewer', 'reviewer', 'manager') as actor_role,
          'rejected' as action_type,
          'inspection' as scope_type,
          NULL as domain_id,
          NULL as sub_domain_id,
          NULL as query_id,
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
    } else {
      throw error;
    }
  }

  // Parse responses JSON field
  const parsedHistory = history.map(item => {
    let parsedResponses = null;
    if (item.responses) {
      if (typeof item.responses === 'string') {
        try {
          parsedResponses = JSON.parse(item.responses);
        } catch (error) {
          logger.warn('Unable to parse inspection history responses JSON', {
            id: item.id,
            inspectionId,
            error: error.message
          });
          parsedResponses = null;
        }
      } else if (typeof item.responses === 'object') {
        parsedResponses = item.responses;
      }
    }

    return {
      ...item,
      responses: parsedResponses
    };
  });

  logger.info('Inspection history data', {
    inspectionId,
    historyCount: parsedHistory.length,
    sampleItem: parsedHistory[0] ? {
      id: parsedHistory[0].id,
      actor_role: parsedHistory[0].actor_role,
      action_type: parsedHistory[0].action_type,
      scope_type: parsedHistory[0].scope_type,
      hasResponses: !!parsedHistory[0].responses
    } : null
  });

  return parsedHistory;
};