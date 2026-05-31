/**
 * SERVICE LAYER EXAMPLES
 *
 * This demonstrates how to implement the service layer
 * containing all business logic and orchestration.
 *
 * Services:
 * - Contains business logic
 * - Orchestrates repositories
 * - Manages workflows and state transitions
 * - Handles cross-concern logic (audit, notifications, events)
 * - Returns DTOs (not raw DB models)
 */

const {
  INSPECTION_STATES,
  QUERY_STATES,
  REJECTION_LEVELS,
  WorkflowEngine,
  RejectionManager,
  EditabilityValidator,
  ValidationError,
  StateTransitionError
} = require('./workflow/workflowEngine');

// ============================================================================
// INSPECTION SERVICE
// ============================================================================

/**
 * Core service handling inspection lifecycle
 * - Create, submit, access control
 * - State management
 * - Validation at business logic level
 */
class InspectionService {
  constructor(repositories, workflowEngine, auditService, notificationService = null) {
    this.inspectionRepo = repositories.inspection;
    this.responseRepo = repositories.response;
    this.rejectionRepo = repositories.rejection;
    this.auditRepo = repositories.audit;
    this.workflow = workflowEngine;
    this.auditService = auditService;
    this.notificationService = notificationService;
  }

  /**
   * Create new inspection draft
   */
  async createDraft(projectId, userId, metadata = {}) {
    // Verify user has access to project (delegated to auth middleware)
    
    const inspection = await this.inspectionRepo.create({
      project_id: projectId,
      created_by: userId,
      state: INSPECTION_STATES.DRAFT,
      created_at: new Date(),
      updated_at: new Date(),
      ...metadata
    });

    // Audit log
    await this.auditService.log({
      entity_type: 'INSPECTION',
      entity_id: inspection.id,
      action: 'CREATED',
      actor_id: userId,
      details: { project_id: projectId }
    });

    return this._toDTO(inspection);
  }

  /**
   * Get inspection with current editability state
   */
  async getInspection(inspectionId, userId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      throw new Error('Inspection not found');
    }

    // Check access (user owns it or is reviewer)
    // Delegated to auth middleware in practice
    if (inspection.created_by !== userId) {
      // Check if user is reviewer for this project
      // ...
    }

    // Get full hierarchy
    const hierarchy = await this.inspectionRepo.findWithHierarchy(inspectionId);
    const stats = await this.inspectionRepo.getStats(inspectionId);

    return {
      ...this._toDTO(inspection),
      hierarchy: hierarchy.hierarchy,
      stats
    };
  }

  /**
   * Submit inspection for review
   * Validates all required fields are filled
   */
  async submitForReview(inspectionId, userId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    // Verify ownership
    if (inspection.created_by !== userId) {
      throw new Error('Not authorized');
    }

    // Validate state transition
    if (!this.workflow.canTransition(inspection.state, INSPECTION_STATES.SUBMITTED)) {
      throw new StateTransitionError(
        `Cannot submit inspection in ${inspection.state} state`
      );
    }

    // Validate all required responses are filled
    const unanswered = await this.responseRepo.findUnanswered(inspectionId);
    if (unanswered.length > 0) {
      throw new ValidationError(
        `Cannot submit: ${unanswered.length} queries still unfilled`
      );
    }

    // Update state
    const updated = await this.inspectionRepo.update(inspectionId, {
      state: INSPECTION_STATES.SUBMITTED,
      submitted_at: new Date(),
      submitted_by: userId,
      updated_at: new Date()
    });

    await this.auditService.log({
      entity_type: 'INSPECTION',
      entity_id: inspectionId,
      action: 'SUBMITTED',
      actor_id: userId
    });

    // Notify reviewers
    if (this.notificationService) {
      await this.notificationService.notifyNewSubmission(updated);
    }

    return this._toDTO(updated);
  }

  /**
   * Resubmit after rejection
   * Only allowed for PARTIALLY_REJECTED or FULLY_REJECTED
   */
  async resubmitAfterRejection(inspectionId, userId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (inspection.created_by !== userId) {
      throw new Error('Not authorized');
    }

    // Can only resubmit PARTIALLY_REJECTED
    if (inspection.state !== INSPECTION_STATES.PARTIALLY_REJECTED) {
      throw new StateTransitionError(
        `Can only resubmit from PARTIALLY_REJECTED state. Current: ${inspection.state}`
      );
    }

    // Check all rejected items are now fixed
    const rejection = await this.rejectionRepo.findLatest(inspectionId);
    const rejectedIds = JSON.parse(rejection.affected_item_ids);

    // For now simplified - in real code would check per rejection type
    const stillRejected = await this.responseRepo.findRejected(inspectionId);
    if (stillRejected.length > 0) {
      throw new ValidationError(
        `Cannot resubmit: still ${stillRejected.length} rejected items unfixed`
      );
    }

    // Transition to UNDER_REVIEW
    const updated = await this.inspectionRepo.update(inspectionId, {
      state: INSPECTION_STATES.UNDER_REVIEW,
      resubmitted_at: new Date(),
      resubmitted_by: userId,
      updated_at: new Date()
    });

    await this.auditService.log({
      entity_type: 'INSPECTION',
      entity_id: inspectionId,
      action: 'RESUBMITTED',
      actor_id: userId,
      details: { previous_state: inspection.state }
    });

    return this._toDTO(updated);
  }

  /**
   * Get what the inspector can currently edit
   * This is sent to frontend to control UI
   */
  async getEditableState(inspectionId, userId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (inspection.created_by !== userId) {
      throw new Error('Not authorized');
    }

    const editableState = {
      editable: false,
      reason: null,
      editableLevels: {
        inspection: false,
        domains: {},
        subdomains: {},
        queries: {}
      }
    };

    // Determine editability based on state
    switch (inspection.state) {
      case INSPECTION_STATES.DRAFT:
      case INSPECTION_STATES.SUBMITTED:
        editableState.editable = true;
        editableState.editableLevels.inspection = true;
        editableState.reason = 'FULL_EDIT';
        break;

      case INSPECTION_STATES.PARTIALLY_REJECTED:
        editableState.editable = true;
        editableState.reason = 'PARTIAL_EDIT_REJECTED_ONLY';
        
        const rejection = await this.rejectionRepo.findLatest(inspectionId);
        const affectedIds = JSON.parse(rejection.affected_item_ids);

        // Based on rejection level, mark what's editable
        if (rejection.rejection_level === REJECTION_LEVELS.QUERY) {
          affectedIds.forEach(queryId => {
            editableState.editableLevels.queries[queryId] = {
              editable: true,
              reason: 'REJECTED_QUERY'
            };
          });
        } else if (rejection.rejection_level === REJECTION_LEVELS.SUBDOMAIN) {
          // Make rejections subdomains editable
          // And all queries within them
          // ... detailed logic
        }
        break;

      case INSPECTION_STATES.FULLY_REJECTED:
        editableState.editable = true;
        editableState.editableLevels.inspection = true;
        editableState.reason = 'FULL_RESTART';
        break;

      case INSPECTION_STATES.UNDER_REVIEW:
      case INSPECTION_STATES.APPROVED:
      case INSPECTION_STATES.COMPLETED:
      default:
        editableState.editable = false;
        editableState.reason = inspection.state;
    }

    return editableState;
  }

  /**
   * DTO conversion - returns clean response without sensitive data
   */
  _toDTO(inspection) {
    return {
      id: inspection.id,
      projectId: inspection.project_id,
      createdBy: inspection.created_by,
      state: inspection.state,
      createdAt: inspection.created_at,
      submittedAt: inspection.submitted_at,
      completedAt: inspection.completed_at
    };
  }
}

// ============================================================================
// REVIEW SERVICE
// ============================================================================

/**
 * Service handling reviewer operations
 * - Reviews, approvals, rejections
 * - Managing partial rejections
 * - Review state tracking
 */
class ReviewService {
  constructor(repositories, workflowEngine, rejectionManager, auditService) {
    this.inspectionRepo = repositories.inspection;
    this.responseRepo = repositories.response;
    this.rejectionRepo = repositories.rejection;
    this.auditRepo = repositories.audit;
    this.workflow = workflowEngine;
    this.rejectionManager = rejectionManager;
    this.auditService = auditService;
  }

  /**
   * Start reviewing an inspection
   */
  async startReview(inspectionId, reviewerId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (inspection.state !== INSPECTION_STATES.SUBMITTED) {
      throw new StateTransitionError(
        `Cannot start review from ${inspection.state} state`
      );
    }

    const updated = await this.inspectionRepo.update(inspectionId, {
      state: INSPECTION_STATES.UNDER_REVIEW,
      reviewed_by: reviewerId,
      review_started_at: new Date()
    });

    await this.auditService.log({
      entity_type: 'INSPECTION',
      entity_id: inspectionId,
      action: 'REVIEW_STARTED',
      actor_id: reviewerId
    });

    return updated;
  }

  /**
   * Approve entire inspection
   */
  async approveInspection(inspectionId, reviewerId, comments = '') {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (!this.workflow.canTransition(inspection.state, INSPECTION_STATES.APPROVED)) {
      throw new StateTransitionError(
        `Cannot approve from ${inspection.state} state`
      );
    }

    const updated = await this.inspectionRepo.update(inspectionId, {
      state: INSPECTION_STATES.APPROVED,
      approved_by: reviewerId,
      approved_at: new Date()
    });

    // Mark all responses as approved
    const responses = await this.responseRepo.findByInspection(inspectionId);
    for (const response of responses) {
      await this.responseRepo.update(response.id, {
        state: QUERY_STATES.APPROVED
      });
    }

    await this.auditService.log({
      entity_type: 'INSPECTION',
      entity_id: inspectionId,
      action: 'APPROVED',
      actor_id: reviewerId,
      details: { comments }
    });

    return updated;
  }

  /**
   * Reject items at specified level with detailed feedback
   * 
   * @param {number} inspectionId
   * @param {object} rejectionData {
   *   level: 'QUERY' | 'SUBDOMAIN' | 'DOMAIN' | 'INSPECTION',
   *   affectedIds: [],
   *   comments: '',
   *   details: [{itemId, reason, feedback}, ...]
   * }
   * @param {number} reviewerId
   */
  async rejectItems(inspectionId, rejectionData, reviewerId) {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    if (!this.workflow.canReject(inspection.state)) {
      throw new StateTransitionError(
        `Cannot reject from ${inspection.state} state`
      );
    }

    // Execute rejection via rejection manager (handles cascading)
    const rejection = await this.rejectionManager.rejectItems(
      inspectionId,
      {
        level: rejectionData.level,
        affectedIds: rejectionData.affectedIds,
        comments: rejectionData.comments,
        reviewerId
      }
    );

    // Store detailed rejection info
    if (rejectionData.details && rejectionData.details.length > 0) {
      for (const detail of rejectionData.details) {
        // Store in rejection_details table for granular feedback
        // await this.db.execute(
        //   `INSERT INTO rejection_details (rejection_id, item_id, reason, feedback) VALUES (?, ?, ?, ?)`,
        //   [rejection.id, detail.itemId, detail.reason, detail.feedback]
        // );
      }
    }

    return rejection;
  }

  /**
   * Get inspection ready for review
   * Includes responses, audit history, current rejections
   */
  async getReviewData(inspectionId) {
    const inspection = await this.inspectionRepo.findByIdWithHierarchy(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    const [responses, auditTrail, rejectionHistory] = await Promise.all([
      this.responseRepo.findByInspection(inspectionId),
      this.auditRepo.getTrail('INSPECTION', inspectionId),
      this.rejectionRepo.findHistory(inspectionId)
    ]);

    return {
      inspection: this._toDTO(inspection),
      hierarchy: inspection.hierarchy,
      responses,
      auditTrail,
      rejectionHistory,
      editableState: {
        // What the reviewer can edit/comment on
        // This is different from inspector editability
      }
    };
  }

  /**
   * Get queue of inspections awaiting review
   */
  async getReviewQueue(projectId = null, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;
    let inspections;

    if (projectId) {
      inspections = await this.inspectionRepo.findByProject(
        projectId,
        { state: INSPECTION_STATES.SUBMITTED },
        { limit, offset }
      );
    } else {
      inspections = await this.inspectionRepo.findByState(
        INSPECTION_STATES.SUBMITTED,
        { limit, offset }
      );
    }

    // Enrich with stats
    const enriched = await Promise.all(
      inspections.map(async (i) => ({
        ...this._toDTO(i),
        stats: await this.inspectionRepo.getStats(i.id),
        creatorName: i.creator_name || 'Unknown'
      }))
    );

    return enriched;
  }

  /**
   * Get reviewer's dashboard stats
   */
  async getReviewerStats(reviewerId) {
    const reviewed = await this.rejectionRepo.findByReviewer(reviewerId, { limit: 1000 });
    const submitted = await this.inspectionRepo.findByState(
      INSPECTION_STATES.SUBMITTED,
      { limit: 1000 }
    );

    return {
      totalToReview: submitted.length,
      totalReviewed: reviewed.length,
      approvalRate: this._calcApprovalRate(reviewed),
      avgReviewTime: this._calcAvgReviewTime(reviewed),
      recentRejections: reviewed.slice(0, 5)
    };
  }

  _calcApprovalRate(rejections) {
    // Logic to calculate approval rate
    return 0;
  }

  _calcAvgReviewTime(rejections) {
    // Logic to calculate average time spent
    return 0;
  }

  _toDTO(inspection) {
    return {
      id: inspection.id,
      projectId: inspection.project_id,
      createdBy: inspection.created_by,
      state: inspection.state,
      createdAt: inspection.created_at,
      submittedAt: inspection.submitted_at
    };
  }
}

// ============================================================================
// RESPONSE SERVICE
// ============================================================================

/**
 * Service handling query responses
 * - Submit responses
 * - Update responses
 * - Manage response state
 */
class ResponseService {
  constructor(repositories, auditService) {
    this.responseRepo = repositories.response;
    this.inspectionRepo = repositories.inspection;
    this.auditService = auditService;
    this.fileService = null;  // Injected if file handling needed
  }

  /**
   * Submit a response to a query
   */
  async submitResponse(inspectionId, queryId, responseData, userId) {
    // responseData = { value, confidence, comments, photos: [{fileId, caption}] }

    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) throw new Error('Inspection not found');

    // Only owner can submit
    if (inspection.created_by !== userId) {
      throw new Error('Not authorized');
    }

    // Check inspection is in editable state (delegated to earlier middleware)
    // Check query is editable for this user/inspection

    const response = await this.responseRepo.create({
      inspection_id: inspectionId,
      query_id: queryId,
      response_value: responseData.value,
      confidence: responseData.confidence || null,
      comments: responseData.comments || null,
      state: QUERY_STATES.PENDING,
      submitted_by: userId,
      submitted_at: new Date(),
      updated_at: new Date()
    });

    // Handle photo uploads if any
    if (responseData.photos && responseData.photos.length > 0) {
      // Delegate to file service
      // await this.fileService.attachPhotos(response.id, responseData.photos);
    }

    await this.auditService.log({
      entity_type: 'RESPONSE',
      entity_id: response.id,
      action: 'CREATED',
      actor_id: userId,
      details: {
        inspection_id: inspectionId,
        query_id: queryId,
        value: responseData.value
      }
    });

    return response;
  }

  /**
   * Update a response (before review)
   */
  async updateResponse(responseId, updates, userId) {
    const response = await this.responseRepo.findById(responseId);
    if (!response) throw new Error('Response not found');

    // Verify ownership
    if (response.submitted_by !== userId) {
      throw new Error('Not authorized');
    }

    const updated = await this.responseRepo.update(responseId, {
      ...updates,
      updated_at: new Date()
    });

    await this.auditService.log({
      entity_type: 'RESPONSE',
      entity_id: responseId,
      action: 'UPDATED',
      actor_id: userId,
      details: updates
    });

    return updated;
  }
}

// ============================================================================
// AUDIT SERVICE
// ============================================================================

/**
 * Service handling audit trail
 * - Log all state changes
 * - Track who did what
 * - Generate audit reports
 */
class AuditService {
  constructor(auditRepository) {
    this.auditRepo = auditRepository;
  }

  /**
   * Log an action
   */
  async log(auditEntry) {
    return this.auditRepo.create(auditEntry);
  }

  /**
   * Get audit trail for an entity
   */
  async getTrail(entityType, entityId) {
    return this.auditRepo.getTrail(entityType, entityId);
  }

  /**
   * Get all actions by a user
   */
  async getUserActivity(userId, pagination = {}) {
    return this.auditRepo.findByActor(userId, pagination);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(inspectionId) {
    const trail = await this.getTrail('INSPECTION', inspectionId);
    
    return {
      inspectionId,
      timeline: trail.map(entry => ({
        action: entry.action,
        actor: entry.actor_name,
        timestamp: entry.created_at,
        details: entry.details
      })),
      completeness: this._checkCompleteness(trail),
      compliance: this._checkCompliance(trail)
    };
  }

  _checkCompleteness(trail) {
    // Check all required actions are present
    return {
      hasCreation: trail.some(t => t.action === 'CREATED'),
      hasSubmission: trail.some(t => t.action === 'SUBMITTED'),
      hasReview: trail.some(t => t.action.includes('REVIEW')),
      hasClosure: trail.some(t => t.action === 'COMPLETED')
    };
  }

  _checkCompliance(trail) {
    // Check for compliance violations
    return {
      allActorsAuthorized: true,  // Simplified
      stateTransitionsValid: true,
      noGaps: trail.length > 2
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  InspectionService,
  ReviewService,
  ResponseService,
  AuditService
};
