const db = require("../config/db");
const logger = require("../utils/logger");

/**
 * reviewWorkflow.js
 * 
 * Handles inspection approval and rejection workflows.
 * Uses normalized history columns:
 *   - actor_role ('reviewer' | 'manager')  => WHO performed the action
 *   - action_type ('approved' | 'rejected') => WHAT action happened
 *   - scope_type ('inspection' | 'domain' | 'subdomain' | 'query') => WHICH scope was affected
 *   - domain_id, sub_domain_id, query_id   => Granular target IDs
 */

const reviewWorkflow = {
  // Helper function to capture current inspection state before workflow changes
  captureInspectionState: async (inspectionId, connection) => {
    logger.info("Capturing current inspection state", { inspectionId });

    try {
      // Get inspection details
      const inspectionResult = await connection.execute(
        `SELECT id, project_id, phase, status, approval_status, manager_approval_status, 
                reviewer_id, reviewer_notes, manager_id, manager_notes, 
                reviewed_at, manager_reviewed_at, created_at, updated_at
         FROM inspections WHERE id = ?`,
        [inspectionId]
      );

      // Get all responses
      const responsesResult = await connection.execute(
        `SELECT id, inspection_id, query_id as question_id, response as response_value, nc_type, 
                inspector_comment, additional_remarks, photos as site_photos, domain_id, 
                sub_domain_id, editable_by_inspector, rejection_notes, rejected_at, rejected_by,
                submitted_by, submitted_at
         FROM responses WHERE inspection_id = ?`,
        [inspectionId]
      );

      // Parse site_photos from JSON string to array for each response
      const parsedResponses = (responsesResult || []).map(r => ({
        ...r,
        site_photos: r.site_photos ? (typeof r.site_photos === 'string' ? JSON.parse(r.site_photos) : r.site_photos) : []
      }));

      // Get all sub-domain submissions
      const submissionsResult = await connection.execute(
        `SELECT id, inspection_id, sub_domain_id, domain_id, submitted_by, 
                submitted_at, is_rejected, rejected_at, rejected_by
         FROM inspection_subdomain_submissions WHERE inspection_id = ?`,
        [inspectionId]
      );

      // Get next version number for this inspection
      const versionResult = await connection.execute(
        `SELECT COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(responses, '$.version')) AS UNSIGNED)), 0) + 1 as next_version
         FROM inspection_rejection_history 
         WHERE inspection_id = ?`,
        [inspectionId]
      );

      const nextVersion = versionResult[0]?.next_version || 1;

      const state = {
        inspection: inspectionResult[0] || null,
        responses: parsedResponses || [],
        submissions: submissionsResult || [],
        version: nextVersion,
        captured_at: new Date().toISOString()
      };

      logger.info("Inspection state captured successfully", { 
        inspectionId, 
        version: nextVersion,
        responsesCount: state.responses.length,
        submissionsCount: state.submissions.length
      });

      return state;
    } catch (error) {
      logger.error("Failed to capture inspection state", { error: error.message, inspectionId });
      throw error;
    }
  },

  /** 
   * Approve an inspection (by reviewer or manager).
   * Inserts history with:
   *   actor_role = 'reviewer' or 'manager'
   *   action_type = 'approved'
   *   scope_type = 'inspection'
   */
  approveInspection: async (inspectionId, userId, notes, role = 'reviewer') => {
    logger.info("Workflow: Approving inspection", { inspectionId, userId, notes, role });

    await db.transaction(async (connection) => {
      // Get project/phase info for phase status update
      const inspectionResult = await connection.execute(
        `SELECT project_id, phase FROM inspections WHERE id = ?`,
        [inspectionId]
      );
      
      const inspectionProjectId = inspectionResult[0]?.project_id || null;
      const inspectionPhase = inspectionResult[0]?.phase || null;

      // Now make the workflow changes (no history record for approvals)
      if (role === 'manager') {
        // Manager approval flow: update manager_approval_status
        await connection.execute(
          `UPDATE inspections
           SET manager_approval_status = 'approved',
               manager_id = ?,
               manager_reviewed_at = NOW(),
               manager_notes = ?
           WHERE id = ?`,
          [userId, notes || null, inspectionId]
        );

        // Also update phase status to 'approved' so it doesn't stay 'submitted'
        await connection.execute(
          `UPDATE phases
           SET status = 'approved', updated_at = NOW()
           WHERE project_id = ? AND phase_number = ?`,
          [inspectionProjectId, inspectionPhase]
        );
      } else {
        // Reviewer approval flow: update approval_status
        await connection.execute(
          `UPDATE inspections
           SET approval_status = ?, manager_approval_status = ?, status = ?, reviewer_id = ?, reviewed_at = NOW(), reviewer_notes = ?
           WHERE id = ?`,
          ["approved", "pending", "completed", userId, notes || null, inspectionId]
        );

        await connection.execute(
          `UPDATE phases
           SET status = 'approved', updated_at = NOW()
           WHERE project_id = ? AND phase_number = ?`,
          [inspectionProjectId, inspectionPhase]
        );
      }
    });

    logger.info("Workflow: Inspection approved", { inspectionId, userId, role });
    return { message: `Inspection approved by ${role} successfully.` };
  },

  /** 
   * Reject an inspection (or part of it) by reviewer or manager.
   * Inserts history with:
   *   actor_role = 'reviewer' or 'manager'
   *   action_type = 'rejected'
   *   scope_type = 'inspection' | 'domain' | 'subdomain' | 'query'
   *   domain_id, sub_domain_id, query_id set when applicable
   */
  rejectInspection: async (inspectionId, userId, notes, rejectionType, domainId, subDomainId, queryId, rejectedItems, role = 'reviewer') => {
    logger.info("Workflow: Rejecting inspection", { inspectionId, userId, rejectionType, notes, role });

    // Normalize potentially undefined values to null to avoid bind parameter errors
    const normalizedDomainId = domainId || null;
    const normalizedSubDomainId = subDomainId || null;
    const normalizedQueryId = queryId || null;

    await db.transaction(async (connection) => {
      // Capture current state before workflow changes
      const previousState = await reviewWorkflow.captureInspectionState(inspectionId, connection);
      
      // Ensure previousState.inspection fields are safe
      const inspectionProjectId = previousState?.inspection?.project_id || null;
      const inspectionPhase = previousState?.inspection?.phase || null;

      // Build safe rejection history data (avoid undefined values in JSON)
      // Include the full previous state for historical snapshot viewing
      const rejectionHistoryData = {
        action: "reject",
        actor_role: role,
        action_type: 'rejected',
        scope_type: rejectionType,
        domainId: normalizedDomainId,
        subDomainId: normalizedSubDomainId,
        queryId: normalizedQueryId,
        rejectedItems: rejectedItems || null,
        version: previousState.version,
        timestamp: new Date().toISOString(),
        notes: notes,
        previousState: previousState
      };

      // Store rejection history using new normalized columns
      const safeHistoryJson = JSON.stringify(rejectionHistoryData);
      
      await connection.execute(
        `INSERT INTO inspection_rejection_history 
         (inspection_id, actor_role, action_type, scope_type, domain_id, sub_domain_id, query_id,
          rejected_by, rejection_reason, rejection_notes, rejection_date, responses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          inspectionId,
          role,                              // actor_role: 'reviewer' or 'manager'
          'rejected',                        // action_type: 'rejected'
          rejectionType,                     // scope_type: 'inspection', 'domain', 'subdomain', 'query'
          normalizedDomainId,                // domain_id for domain/subdomain/query scope
          normalizedSubDomainId,             // sub_domain_id for subdomain/query scope
          normalizedQueryId,                 // query_id for query scope
          userId,
          `Rejected ${rejectionType} by ${role}`,
          notes,
          safeHistoryJson
        ]
      );

      // Now make the workflow changes
      if (role === 'manager') {
        // Manager rejection: send back to reviewer (NOT inspector)
        // Preserve reviewer_id so reviewer can still act with granular rejection
        await connection.execute(
          `UPDATE inspections
           SET manager_approval_status = 'rejected',
               approval_status = 'pending',
               status = 'completed',
               reviewed_at = NULL,
               reviewer_notes = NULL,
               manager_id = ?,
               manager_reviewed_at = NOW(),
               manager_notes = ?
           WHERE id = ?`,
          [userId, notes, inspectionId]
        );
      } else {
        // Reviewer rejection
        if (rejectionType === "inspection") {
          // Whole inspection rejection: update all statuses
          await connection.execute(
            `UPDATE inspections
             SET approval_status = ?, manager_approval_status = ?, status = ?, reviewer_id = ?, reviewed_at = NOW(), reviewer_notes = ?
             WHERE id = ?`,
            ["rejected", "pending", "in_progress", userId, notes, inspectionId]
          );

          await connection.execute(
            `UPDATE phases
             SET status = 'rejected', updated_at = NOW()
             WHERE project_id = ? AND phase_number = ?`,
            [inspectionProjectId, inspectionPhase]
          );
        } else {
          // Granular rejection (domain/subdomain): only mark the specific scope as rejected
          // Do NOT change the inspection-level approval_status for granular rejection
          // Preserve manager_approval_status if manager already rejected
          await connection.execute(
            `UPDATE inspections
             SET approval_status = ?,
                 manager_approval_status = CASE WHEN manager_approval_status = 'rejected' THEN 'rejected' ELSE 'pending' END,
                 status = ?,
                 reviewer_id = ?, reviewed_at = NOW(), reviewer_notes = ?
             WHERE id = ?`,
            ["rejected", "in_progress", userId, notes, inspectionId]
          );

          await connection.execute(
            `UPDATE phases
             SET status = 'rejected', updated_at = NOW()
             WHERE project_id = ? AND phase_number = ?`,
            [inspectionProjectId, inspectionPhase]
          );
        }
      }

      // Mark responses as editable based on rejection scope
      if (role === 'manager') {
        await connection.execute(
          `UPDATE responses 
           SET editable_by_inspector = 1, rejection_notes = ?, rejected_at = NOW(), rejected_by = ?
           WHERE inspection_id = ?`,
          [notes, userId, inspectionId]
        );
      } else {
        if (rejectionType === "domain") {
          await connection.execute(
            `UPDATE inspection_subdomain_submissions 
             SET is_rejected = 1, rejected_at = NOW(), rejected_by = ?
             WHERE inspection_id = ? AND domain_id = ?`,
            [userId, inspectionId, normalizedDomainId]
          );
          await connection.execute(
            `UPDATE responses 
             SET editable_by_inspector = 1, rejection_notes = ?, rejected_at = NOW(), rejected_by = ?
             WHERE inspection_id = ? AND domain_id = ?`,
            [notes, userId, inspectionId, normalizedDomainId]
          );
        } else if (rejectionType === "subdomain") {
          await connection.execute(
            `UPDATE inspection_subdomain_submissions 
             SET is_rejected = 1, rejected_at = NOW(), rejected_by = ?
             WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
            [userId, inspectionId, normalizedSubDomainId, normalizedDomainId]
          );
          await connection.execute(
            `UPDATE responses 
             SET editable_by_inspector = 1, rejection_notes = ?, rejected_at = NOW(), rejected_by = ?
             WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
            [notes, userId, inspectionId, normalizedSubDomainId, normalizedDomainId]
          );
        } else if (rejectionType === "inspection") {
          await connection.execute(
            `UPDATE responses 
             SET editable_by_inspector = 1, rejection_notes = ?, rejected_at = NOW(), rejected_by = ?
             WHERE inspection_id = ?`,
            [notes, userId, inspectionId]
          );
        }
      }
    });

    logger.info("Workflow: Inspection rejected", { inspectionId, userId, role, rejectionType });
    return {
      message: `${rejectionType.charAt(0).toUpperCase() + rejectionType.slice(1)} rejected successfully and workflow updated.`,
      data: {
        rejectionType,
        editableItems: rejectedItems || []
      }
    };
  },
};

module.exports = reviewWorkflow;