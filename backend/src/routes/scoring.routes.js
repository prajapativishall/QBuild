const express = require('express');
const router = express.Router();

// Import controller and middleware
const scoringController = require('../controllers/scoring.controller');
const { authenticate } = require('../middleware/auth');
const { requireProjectPermission } = require('../middleware/rbac');
const {
  validateInspectionIdParam,
  validateScoreCalculation
} = require('../middleware/scoring.validation');

// Apply authentication middleware to all scoring routes
router.use(authenticate);

/**
 * POST /api/calculate-score/:inspectionId
 * Calculate score for an inspection
 * Requires: view_reports permission
 */
router.post('/calculate-score/:inspectionId',
  [
    validateInspectionIdParam,
    validateScoreCalculation,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to calculate scores
  ],
  scoringController.calculateScore
);

/**
 * GET /api/score/:inspectionId
 * Get existing score for an inspection
 * Requires: view_reports permission
 */
router.get('/score/:inspectionId',
  [
    validateInspectionIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view scores
  ],
  scoringController.getScore
);

/**
 * POST /api/recalculate-score/:inspectionId
 * Recalculate score for an inspection (admin function)
 * Requires: edit_inspection permission
 */
router.post('/recalculate-score/:inspectionId',
  [
    validateInspectionIdParam,
    validateScoreCalculation,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('edit_inspection') // Users need edit_inspection permission to recalculate scores
  ],
  scoringController.recalculateScore
);

/**
 * GET /api/spider-chart/:inspectionId
 * Get spider chart data for an inspection
 * Requires: view_reports permission
 */
router.get('/spider-chart/:inspectionId',
  [
    validateInspectionIdParam,
    require('../middleware/validation').handleValidationErrors,
    requireProjectPermission('view_reports') // Users need view_reports permission to view spider chart data
  ],
  scoringController.getSpiderChartData
);

/**
 * GET /api/scoring/health
 * Health check endpoint for scoring service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Scoring service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      calculateScore: 'POST /api/calculate-score/:inspectionId',
      getScore: 'GET /api/score/:inspectionId',
      recalculateScore: 'POST /api/recalculate-score/:inspectionId',
      spiderChart: 'GET /api/spider-chart/:inspectionId'
    }
  });
});

/**
 * GET /api/scoring/info
 * Get information about the scoring service
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'QRating Scoring Service',
    version: '1.0.0',
    description: 'Advanced scoring engine with sub_domain weight redistribution and hierarchical question scoring',
    features: [
      'SubDomain weight redistribution',
      'Primary/Secondary question hierarchy',
      'YES/NO/NA response handling',
      'MySQL transaction support',
      'Spider chart data generation',
      'Comprehensive error handling',
      'Audit logging'
    ],
    businessRules: [
      'Each query has 1 mark',
      'PRIMARY = NO/NA: Ignore all SECONDARY queries',
      'Invalid subDomains: Redistribute weightage equally',
      'SubDomain rating: secured_points / max_points',
      'Domain rating: sum(sub_domain_rating × sub_domain_weight)'
    ],
    endpoints: {
      calculateScore: {
        method: 'POST',
        path: '/api/calculate-score/:inspectionId',
        description: 'Calculate score for an inspection',
        requires: 'view_reports permission'
      },
      getScore: {
        method: 'GET',
        path: '/api/score/:inspectionId',
        description: 'Get existing score for an inspection',
        requires: 'view_reports permission'
      },
      recalculateScore: {
        method: 'POST',
        path: '/api/recalculate-score/:inspectionId',
        description: 'Recalculate score for an inspection',
        requires: 'edit_inspection permission'
      },
      spiderChart: {
        method: 'GET',
        path: '/api/spider-chart/:inspectionId',
        description: 'Get spider chart data for visualization',
        requires: 'view_reports permission'
      }
    },
    databaseTables: [
      'sub_domains',
      'checklist_items',
      'checklist_responses',
      'sub_domain_scores',
      'domain_scores'
    ],
    responseFormats: {
      calculateScore: {
        subDomains: 'Array of sub_domain scores with weightage redistribution',
        domains: 'Array of domain scores',
        spiderChartData: 'Object with sub_domain and domain ratings for visualization',
        summary: 'Overall scoring summary'
      },
      getScore: {
        subDomains: 'Existing sub_domain scores from database',
        domains: 'Existing domain scores from database',
        spiderChartData: 'Spider chart data for visualization'
      },
      spiderChart: {
        subDomains: 'SubDomain ratings for spider chart',
        domains: 'Domain ratings for spider chart',
        overall: 'Overall statistics'
      }
    }
  });
});

module.exports = router;
