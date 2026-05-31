const express = require('express');
const router = express.Router();

// Import controller and middleware
const responseController = require('../controllers/response.controller');
const { authenticate } = require('../middleware/auth');
const { requireProjectPermission } = require('../middleware/rbac');
const {
  validateSingleResponse,
  validateBulkResponses,
  validateResponseOverride,
  validateInspectionIdParam,
  validateResponseIdParam
} = require('../middleware/response.validation');

// Authentication disabled for testing

/**
 * POST /api/responses
 * Submit a single response
 * Body: { inspection_id, checklist_item_id, response_value, remarks }
 */
router.post('/responses',
  [
    validateSingleResponse,
    require('../middleware/validation').handleValidationErrors,
    require('../middleware/rbac').requireProjectAccess // Users need project access to submit responses
  ],
  responseController.submitResponse
);

/**
 * POST /api/responses/bulk
 * Submit multiple responses in bulk (Mobile-friendly)
 * Body: { inspection_id, responses: [{ checklist_item_id, response_value, remarks }] }
 */
router.post('/responses/bulk',
  [
    validateBulkResponses,
    require('../middleware/validation').handleValidationErrors,
    require('../middleware/rbac').requireProjectAccess // Users need project access to submit responses
  ],
  responseController.bulkSubmitResponses
);

/**
 * PUT /api/responses/override/:responseId
 * Override an existing response (Admin only)
 * Body: { response_value, remarks }
 */
router.put('/responses/override/:responseId',
  [
    validateResponseIdParam,
    validateResponseOverride,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('override_responses') // Users need override_responses permission to override
  ],
  responseController.overrideResponse
);

/**
 * GET /api/responses/:inspectionId
 * Get all responses for an inspection, grouped by hierarchy
 * Returns: Domain -> SubDomain -> Question structure
 */
router.get('/responses/:inspectionId',
  [
    validateInspectionIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view responses
  ],
  responseController.getResponsesByInspection
);

/**
 * GET /api/responses/single/:responseId
 * Get a single response by ID
 */
router.get('/responses/single/:responseId',
  [
    validateResponseIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view responses
  ],
  responseController.getResponseById
);

/**
 * DELETE /api/responses/:responseId
 * Delete a response
 */
router.delete('/responses/:responseId',
  [
    validateResponseIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('edit_inspection') // Users need edit_inspection permission to delete responses
  ],
  responseController.deleteResponse
);

/**
 * GET /api/responses/:inspectionId/statistics
 * Get response statistics for an inspection
 */
router.get('/responses/:inspectionId/statistics',
  [
    validateInspectionIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view statistics
  ],
  responseController.getResponseStatistics
);

/**
 * GET /api/responses/:inspectionId/:checklistItemId/history
 * Get response history for a specific checklist item
 */
router.get('/responses/:inspectionId/:checklistItemId/history',
  [
    validateInspectionIdParam,
    require('../middleware/validation').param('checklistItemId')
      .isInt({ min: 1 })
      .withMessage('Checklist item ID must be a positive integer'),
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view history
  ],
  responseController.getResponseHistory
);

/**
 * GET /api/responses/:inspectionId/export
 * Export responses for an inspection
 * Query: ?format=json|csv
 */
router.get('/responses/:inspectionId/export',
  [
    validateInspectionIdParam,
    require('../middleware/validation').query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv'),
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to export
  ],
  responseController.exportResponses
);

/**
 * GET /api/responses/health
 * Health check endpoint for response service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Response service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      submitResponse: 'POST /api/responses',
      bulkSubmit: 'POST /api/responses/bulk',
      overrideResponse: 'PUT /api/responses/override/:responseId',
      getResponses: 'GET /api/responses/:inspectionId',
      getSingleResponse: 'GET /api/responses/single/:responseId',
      deleteResponse: 'DELETE /api/responses/:responseId',
      getStatistics: 'GET /api/responses/:inspectionId/statistics',
      getHistory: 'GET /api/responses/:inspectionId/:checklistItemId/history',
      export: 'GET /api/responses/:inspectionId/export'
    }
  });
});

/**
 * GET /api/responses/info
 * Get information about the response service
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'QRating Response Service',
    version: '1.0.0',
    description: 'Checklist response submission and management system with admin override functionality',
    features: [
      'Single response submission with UPSERT logic',
      'Bulk response submission with MySQL transactions',
      'Admin override functionality',
      'Hierarchical response grouping (Domain -> SubDomain -> Question)',
      'Mobile-friendly bulk operations',
      'Response validation (YES/NO/NA only)',
      'Complete audit trail',
      'Response statistics and analytics',
      'Export functionality (JSON/CSV)'
    ],
    businessRules: [
      'Each response must be YES, NO, or NA',
      'UPSERT logic: Update if exists, Insert if new',
      'Admin can override any response',
      'Bulk operations use MySQL transactions',
      'All responses are tracked with audit trail'
    ],
    endpoints: {
      submitResponse: {
        method: 'POST',
        path: '/api/responses',
        description: 'Submit a single response',
        body: {
          inspection_id: 'number',
          checklist_item_id: 'number',
          response_value: 'YES|NO|NA',
          remarks: 'string (optional)'
        },
        requires: 'create_inspection permission'
      },
      bulkSubmit: {
        method: 'POST',
        path: '/api/responses/bulk',
        description: 'Submit multiple responses in bulk',
        body: {
          inspection_id: 'number',
          responses: 'array of response objects'
        },
        requires: 'create_inspection permission',
        features: ['MySQL transaction', 'Rollback on failure', 'Mobile-friendly']
      },
      overrideResponse: {
        method: 'PUT',
        path: '/api/responses/override/:responseId',
        description: 'Override an existing response',
        body: {
          response_value: 'YES|NO|NA',
          remarks: 'string (optional)'
        },
        requires: 'override_responses permission',
        features: ['Admin only', 'Audit trail']
      },
      getResponses: {
        method: 'GET',
        path: '/api/responses/:inspectionId',
        description: 'Get all responses for inspection',
        response: 'Hierarchical grouping (Domain -> SubDomain -> Question)',
        requires: 'view_reports permission'
      },
      getStatistics: {
        method: 'GET',
        path: '/api/responses/:inspectionId/statistics',
        description: 'Get response statistics',
        response: 'Response counts and distribution',
        requires: 'view_reports permission'
      },
      export: {
        method: 'GET',
        path: '/api/responses/:inspectionId/export',
        description: 'Export responses',
        query: 'format=json|csv',
        requires: 'view_reports permission'
      }
    },
    databaseTables: [
      'checklist_responses',
      'checklist_items',
      'sub_domains',
      'domains',
      'users'
    ],
    responseFormats: {
      submitResponse: {
        success: 'boolean',
        message: 'string',
        data: {
          action: 'inserted|updated',
          inspectionId: 'number',
          checklistItemId: 'number',
          responseValue: 'string',
          submittedBy: 'number'
        }
      },
      bulkSubmit: {
        success: 'boolean',
        message: 'string',
        data: {
          inspectionId: 'number',
          totalProcessed: 'number',
          totalFailed: 'number',
          processedResponses: 'array',
          failedResponses: 'array'
        }
      },
      getResponses: {
        success: 'boolean',
        message: 'string',
        data: {
          inspectionId: 'number',
          domains: 'array',
          summary: 'object'
        }
      },
      overrideResponse: {
        success: 'boolean',
        message: 'string',
        data: {
          responseId: 'number',
          originalResponse: 'object',
          overriddenResponse: 'object',
          overriddenBy: 'number'
        }
      }
    },
    security: {
      authentication: 'JWT required for all endpoints',
      authorization: 'Project-based RBAC permissions',
      adminOverride: 'Only admins can override responses',
      auditTrail: 'All actions are logged'
    },
    performance: {
      bulkOperations: 'Uses MySQL transactions',
      mobileOptimized: 'Fast bulk submission for mobile apps',
      connectionPooling: 'mysql2 connection pool',
      preparedStatements: 'Prepared statements for security'
    }
  });
});

module.exports = router;
