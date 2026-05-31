/**
 * WORKFLOW STATE ENGINE FOR QRating
 * 
 * This file demonstrates the core workflow engine that manages state transitions
 * and validates business rules for inspections, domains, and queries.
 * 
 * Key Features:
 * - Explicit state machines for all entities
 * - Transition validation with business rule enforcement
 * - Event emission for state changes
 * - Audit trail integration
 * - Support for partial rejections
 */

// ============================================================================
// STATE DEFINITIONS & CONSTANTS
// ============================================================================

const INSPECTION_STATES = Object.freeze({
  DRAFT: 'DRAFT',                          // Initial creation - can edit everything
  SUBMITTED: 'SUBMITTED',                  // Sent for review - awaiting reviewer
  UNDER_REVIEW: 'UNDER_REVIEW',           // Reviewer actively reviewing
  PARTIALLY_REJECTED: 'PARTIALLY_REJECTED', // Some parts rejected - can resubmit rejected
  FULLY_REJECTED: 'FULLY_REJECTED',        // Entire inspection rejected - restart needed
  APPROVED: 'APPROVED',                    // Fully approved
  COMPLETED: 'COMPLETED'                   // Archived/closed
});

const QUERY_STATES = Object.freeze({
  PENDING: 'PENDING',        // Awaiting response from inspector
  APPROVED: 'APPROVED',      // Reviewer approved (no change needed)
  REJECTED: 'REJECTED',      // Reviewer rejected (needs resubmission)
  RESUBMITTED: 'RESUBMITTED' // Inspector resubmitted after rejection
});

const DOMAIN_STATES = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',      // Inspector is filling
  UNDER_REVIEW: 'UNDER_REVIEW',    // Reviewer is reviewing
  APPROVED: 'APPROVED',            // Fully approved
  PARTIALLY_APPROVED: 'PARTIALLY_APPROVED'  // Some subdomains approved, others rejected
});

const SUBDOMAIN_STATES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESUBMITTED: 'RESUBMITTED'
});

// Rejection levels for granular control
const REJECTION_LEVELS = Object.freeze({
  QUERY: 'QUERY',              // Single query response
  SUBDOMAIN: 'SUBDOMAIN',      // All queries in a subdomain
  DOMAIN: 'DOMAIN',            // All subdomains and queries in a domain
  INSPECTION: 'INSPECTION'     // Entire inspection
});

// ============================================================================
// TRANSITION RULES
// ============================================================================

/**
 * Define which transitions are allowed between states
 * This is the single source of truth for legal state changes
 */
const INSPECTION_TRANSITIONS = Object.freeze({
  [INSPECTION_STATES.DRAFT]: [
    INSPECTION_STATES.SUBMITTED,
  ],
  [INSPECTION_STATES.SUBMITTED]: [
    INSPECTION_STATES.UNDER_REVIEW,
    INSPECTION_STATES.DRAFT  // Allow inspector to pull back before review starts
  ],
  [INSPECTION_STATES.UNDER_REVIEW]: [
    INSPECTION_STATES.PARTIALLY_REJECTED,
    INSPECTION_STATES.FULLY_REJECTED,
    INSPECTION_STATES.APPROVED
  ],
  [INSPECTION_STATES.PARTIALLY_REJECTED]: [
    INSPECTION_STATES.UNDER_REVIEW    // After inspector resubmits rejected items
  ],
  [INSPECTION_STATES.FULLY_REJECTED]: [
    INSPECTION_STATES.DRAFT            // Restart from scratch
  ],
  [INSPECTION_STATES.APPROVED]: [
    INSPECTION_STATES.COMPLETED
  ],
  [INSPECTION_STATES.COMPLETED]: []  // Terminal state
});

const QUERY_TRANSITIONS = Object.freeze({
  [QUERY_STATES.PENDING]: [
    QUERY_STATES.APPROVED,
    QUERY_STATES.REJECTED
  ],
  [QUERY_STATES.APPROVED]: [],                          // Terminal
  [QUERY_STATES.REJECTED]: [
    QUERY_STATES.RESUBMITTED,
    QUERY_STATES.PENDING   // If inspection resubmitted
  ],
  [QUERY_STATES.RESUBMITTED]: [
    QUERY_STATES.APPROVED,
    QUERY_STATES.REJECTED   // Rejected again
  ]
});

// ============================================================================
// WORKFLOW STATE ENGINE
// ============================================================================

class WorkflowEngine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.stateTransitions = {
      inspection: INSPECTION_TRANSITIONS,
      query: QUERY_TRANSITIONS,
      domain: DOMAIN_STATES,
      subdomain: SUBDOMAIN_STATES
    };
  }

  /**
   * Validate if a transition is allowed
   * @param {string} currentState - Current state
   * @param {string} targetState - Desired target state
   * @param {string} entityType - 'inspection', 'query', 'domain', 'subdomain'
   * @returns {object} { valid: boolean, errors: string[] }
   */
  validateTransition(currentState, targetState, entityType = 'inspection') {
    const result = {
      valid: false,
      currentState,
      targetState,
      errors: []
    };

    const transitions = this.stateTransitions[entityType];
    if (!transitions) {
      result.errors.push(`Unknown entity type: ${entityType}`);
      return result;
    }

    if (!transitions[currentState]) {
      result.errors.push(
        `Unknown ${entityType} state: ${currentState}`
      );
      return result;
    }

    const allowedTransitions = transitions[currentState];
    if (!allowedTransitions.includes(targetState)) {
      result.errors.push(
        `Cannot transition from ${currentState} to ${targetState}. ` +
        `Allowed states: ${allowedTransitions.join(', ')}`
      );
      return result;
    }

    result.valid = true;
    return result;
  }

  /**
   * Get allowed next states from current state
   */
  getAllowedTransitions(currentState, entityType = 'inspection') {
    const transitions = this.stateTransitions[entityType];
    return transitions[currentState] || [];
  }

  /**
   * Check if an entity can transition
   */
  canTransition(currentState, targetState, entityType = 'inspection') {
    return this.validateTransition(currentState, targetState, entityType).valid;
  }

  /**
   * Execute a state transition with validation
   * Emits events for state changes
   */
  async executeTransition(
    currentState,
    targetState,
    entityType,
    entityId,
    metadata = {}
  ) {
    // Validate transition is legal
    const validation = this.validateTransition(currentState, targetState, entityType);
    if (!validation.valid) {
      throw new StateTransitionError(validation.errors.join('; '));
    }

    // Create transition event
    const transitionEvent = {
      entityType,
      entityId,
      fromState: currentState,
      toState: targetState,
      timestamp: new Date(),
      metadata
    };

    // Emit event if event bus is available
    if (this.eventBus) {
      await this.eventBus.emit(`${entityType}.stateChanged`, transitionEvent);
    }

    return transitionEvent;
  }

  /**
   * Determine if rejection is possible from current state
   */
  canReject(inspectionState) {
    return [
      INSPECTION_STATES.SUBMITTED,
      INSPECTION_STATES.UNDER_REVIEW,
      INSPECTION_STATES.PARTIALLY_REJECTED
    ].includes(inspectionState);
  }

  /**
   * Determine if resubmission is possible
   */
  canResubmit(inspectionState) {
    return [
      INSPECTION_STATES.FULLY_REJECTED,
      INSPECTION_STATES.PARTIALLY_REJECTED
    ].includes(inspectionState);
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(state, entityType = 'inspection') {
    const descriptions = {
      inspection: {
        [INSPECTION_STATES.DRAFT]: 'Creating inspection - can edit everything',
        [INSPECTION_STATES.SUBMITTED]: 'Submitted for review - awaiting reviewer',
        [INSPECTION_STATES.UNDER_REVIEW]: 'Reviewer is reviewing - cannot edit',
        [INSPECTION_STATES.PARTIALLY_REJECTED]: 'Some items rejected - resubmit rejected items',
        [INSPECTION_STATES.FULLY_REJECTED]: 'Fully rejected - restart from beginning',
        [INSPECTION_STATES.APPROVED]: 'Approved by reviewer',
        [INSPECTION_STATES.COMPLETED]: 'Completed and archived'
      },
      query: {
        [QUERY_STATES.PENDING]: 'Awaiting response',
        [QUERY_STATES.APPROVED]: 'Approved by reviewer',
        [QUERY_STATES.REJECTED]: 'Rejected - needs resubmission',
        [QUERY_STATES.RESUBMITTED]: 'Resubmitted after rejection'
      }
    };

    return (descriptions[entityType] || {})[state] || state;
  }
}

// ============================================================================
// REJECTION LOGIC & CASCADING STATE CHANGES
// ============================================================================

class RejectionManager {
  constructor(workflowEngine, repositories) {
    this.workflow = workflowEngine;
    this.repositories = repositories; // { inspection, query, rejection, audit }
  }

  /**
   * Execute a rejection at any level with proper cascading
   * 
   * Rejection levels:
   * - QUERY: Single query response
   * - SUBDOMAIN: All queries in subdomain
   * - DOMAIN: All queries in domain
   * - INSPECTION: Entire inspection
   */
  async rejectItems(inspectionId, rejectionData) {
    const {
      level,          // QUERY, SUBDOMAIN, DOMAIN, INSPECTION
      affectedIds,    // Array of IDs at the rejection level
      comments,
      reviewerId
    } = rejectionData;

    // Get inspection
    const inspection = await this.repositories.inspection.findById(inspectionId);
    if (!inspection) {
      throw new NotFoundError(`Inspection ${inspectionId} not found`);
    }

    // Validate rejection is allowed from current state
    if (!this.workflow.canReject(inspection.state)) {
      throw new InvalidStateError(
        `Cannot reject inspection in ${inspection.state} state`
      );
    }

    // Determine new inspection state based on rejection level
    let newInspectionState;
    let allAffectedQueryIds = [];

    switch (level) {
      case REJECTION_LEVELS.QUERY:
        newInspectionState = INSPECTION_STATES.PARTIALLY_REJECTED;
        allAffectedQueryIds = affectedIds;
        break;

      case REJECTION_LEVELS.SUBDOMAIN:
        newInspectionState = INSPECTION_STATES.PARTIALLY_REJECTED;
        // Find all queries in these subdomains
        for (const subdomainId of affectedIds) {
          const queries = await this.repositories.query.findBySubdomain(subdomainId);
          allAffectedQueryIds.push(...queries.map(q => q.id));
        }
        break;

      case REJECTION_LEVELS.DOMAIN:
        newInspectionState = INSPECTION_STATES.PARTIALLY_REJECTED;
        // Find all queries in these domains
        for (const domainId of affectedIds) {
          const queries = await this.repositories.query.findByDomain(domainId);
          allAffectedQueryIds.push(...queries.map(q => q.id));
        }
        break;

      case REJECTION_LEVELS.INSPECTION:
        newInspectionState = INSPECTION_STATES.FULLY_REJECTED;
        // Find ALL queries in this inspection
        const allQueries = await this.repositories.query.findByInspection(inspectionId);
        allAffectedQueryIds = allQueries.map(q => q.id);
        break;

      default:
        throw new ValidationError(`Unknown rejection level: ${level}`);
    }

    // Execute within transaction
    const transaction = await this.repositories.db.beginTransaction();

    try {
      // 1. Update inspection state
      await this.repositories.inspection.update(
        inspectionId,
        {
          state: newInspectionState,
          last_reviewed_by: reviewerId,
          updated_at: new Date()
        },
        transaction
      );

      // 2. Mark all affected queries as rejected
      for (const queryId of allAffectedQueryIds) {
        await this.repositories.query.update(
          queryId,
          {
            state: QUERY_STATES.REJECTED,
            rejected_at: new Date(),
            reviewed_by: reviewerId
          },
          transaction
        );
      }

      // 3. Create rejection record
      const rejection = await this.repositories.rejection.create(
        {
          inspection_id: inspectionId,
          rejection_level: level,
          affected_item_ids: JSON.stringify(affectedIds),
          comments,
          reviewed_by: reviewerId,
          created_at: new Date()
        },
        transaction
      );

      // 4. Create audit log entry
      await this.repositories.audit.log(
        {
          entity_type: 'INSPECTION',
          entity_id: inspectionId,
          action: 'REJECTED',
          actor_id: reviewerId,
          details: {
            rejection_level: level,
            affected_count: allAffectedQueryIds.length,
            affected_ids: affectedIds,
            comments
          },
          created_at: new Date()
        },
        transaction
      );

      await transaction.commit();
      return rejection;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get what items the inspector needs to resubmit
   */
  async getRejectionDetails(inspectionId) {
    const rejection = await this.repositories.rejection.findLatest(inspectionId);
    if (!rejection) return null;

    const details = {
      level: rejection.rejection_level,
      comments: rejection.comments,
      rejectedAt: rejection.created_at,
      rejectedBy: rejection.reviewed_by,
      affectedItems: []
    };

    // Get affected items with context
    const affectedIds = JSON.parse(rejection.affected_item_ids);

    if (rejection.rejection_level === REJECTION_LEVELS.QUERY) {
      for (const queryId of affectedIds) {
        const query = await this.repositories.query.findById(queryId);
        details.affectedItems.push({
          type: 'QUERY',
          id: queryId,
          question: query.question,
          needsResubmission: true
        });
      }
    } else if (rejection.rejection_level === REJECTION_LEVELS.SUBDOMAIN) {
      for (const subdomainId of affectedIds) {
        const subdomain = await this.repositories.subdomain.findById(subdomainId);
        const queries = await this.repositories.query.findBySubdomain(subdomainId);
        details.affectedItems.push({
          type: 'SUBDOMAIN',
          id: subdomainId,
          name: subdomain.name,
          queries: queries.length,
          needsResubmission: true
        });
      }
    } else if (rejection.rejection_level === REJECTION_LEVELS.INSPECTION) {
      details.affectedItems.push({
        type: 'INSPECTION',
        id: inspectionId,
        message: 'Entire inspection needs to be restarted',
        needsResubmission: true
      });
    }

    return details;
  }
}

// ============================================================================
// EDITABILITY VALIDATOR
// ============================================================================

/**
 * Determine what an inspector can edit in their inspection
 * This is computed on the backend and sent to frontend
 * Frontend should ONLY render what backend permits
 */
class EditabilityValidator {
  constructor(repositories) {
    this.repositories = repositories;
  }

  /**
   * Get complete editable state for an inspection
   * Returns which queries/domains/subdomains can be edited
   */
  async getEditableState(inspectionId, userId) {
    const inspection = await this.repositories.inspection.findById(inspectionId);

    // Only owner can edit
    if (inspection.created_by !== userId) {
      return {
        editable: false,
        reason: 'NOT_OWNER',
        editableLevels: {
          inspection: false,
          domains: {},
          subdomains: {},
          queries: {}
        }
      };
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

    switch (inspection.state) {
      case INSPECTION_STATES.DRAFT:
      case INSPECTION_STATES.SUBMITTED:
        // Can edit everything
        editableState.editable = true;
        editableState.editableLevels.inspection = true;
        editableState.reason = 'FULL_EDIT_ALLOWED';
        break;

      case INSPECTION_STATES.PARTIALLY_REJECTED:
        // Can only edit rejected items
        editableState.editable = true;
        editableState.reason = 'PARTIAL_EDIT_REJECTED_ONLY';

        const rejection = await this.repositories.rejection.findLatest(inspectionId);
        const affectedIds = JSON.parse(rejection.affected_item_ids);

        if (rejection.rejection_level === REJECTION_LEVELS.QUERY) {
          // Mark rejected queries as editable
          for (const queryId of affectedIds) {
            editableState.editableLevels.queries[queryId] = {
              editable: true,
              reason: 'REJECTED_QUERY'
            };
          }
        } else if (rejection.rejection_level === REJECTION_LEVELS.SUBDOMAIN) {
          // Make rejectedsubdomains and all their queries editable
          for (const subdomainId of affectedIds) {
            editableState.editableLevels.subdomains[subdomainId] = {
              editable: true,
              reason: 'REJECTED_SUBDOMAIN'
            };
            // Also make all queries in this subdomain editable
            const queries = await this.repositories.query.findBySubdomain(subdomainId);
            queries.forEach(q => {
              editableState.editableLevels.queries[q.id] = {
                editable: true,
                reason: 'REJECTED_SUBDOMAIN'
              };
            });
          }
        } else if (rejection.rejection_level === REJECTION_LEVELS.DOMAIN) {
          // Make all subdomains and queries in domain editable
          for (const domainId of affectedIds) {
            const subdomains = await this.repositories.subdomain.findByDomain(domainId);
            for (const subdomain of subdomains) {
              editableState.editableLevels.subdomains[subdomain.id] = {
                editable: true,
                reason: 'REJECTED_DOMAIN'
              };
              const queries = await this.repositories.query.findBySubdomain(subdomain.id);
              queries.forEach(q => {
                editableState.editableLevels.queries[q.id] = {
                  editable: true,
                  reason: 'REJECTED_DOMAIN'
                };
              });
            }
          }
        }
        break;

      case INSPECTION_STATES.FULLY_REJECTED:
        // Can restart (essentially edit everything)
        editableState.editable = true;
        editableState.editableLevels.inspection = true;
        editableState.reason = 'FULL_RESTART_ALLOWED';
        break;

      case INSPECTION_STATES.UNDER_REVIEW:
      case INSPECTION_STATES.APPROVED:
      case INSPECTION_STATES.COMPLETED:
      default:
        // Cannot edit
        editableState.editable = false;
        editableState.reason = inspection.state;
    }

    return editableState;
  }

  /**
   * Quick check: can this specific query be edited?
   */
  async canEditQuery(inspectionId, queryId, userId) {
    const state = await this.getEditableState(inspectionId, userId);
    return state.editableLevels.queries[queryId]?.editable || false;
  }
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

class StateTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateTransitionError';
    this.code = 'INVALID_TRANSITION';
  }
}

class InvalidStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidStateError';
    this.code = 'INVALID_STATE';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // States
  INSPECTION_STATES,
  QUERY_STATES,
  DOMAIN_STATES,
  SUBDOMAIN_STATES,
  REJECTION_LEVELS,

  // Transitions
  INSPECTION_TRANSITIONS,
  QUERY_TRANSITIONS,

  // Classes
  WorkflowEngine,
  RejectionManager,
  EditabilityValidator,

  // Errors
  StateTransitionError,
  InvalidStateError,
  NotFoundError,
  ValidationError
};
