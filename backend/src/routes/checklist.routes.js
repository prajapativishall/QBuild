const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { authenticate } = require('../middleware/auth');
const { requireProjectPermission } = require('../middleware/rbac');
const { validateInspectionIdParam } = require('../middleware/scoring.validation');

// Apply authentication middleware to all checklist routes
router.use(authenticate);

/**
 * GET /api/checklist/:inspectionId
 * Get checklist queries for an inspection (Mobile app)
 * Only returns queries in sub_domains assigned through domains
 * Requires: User must be assigned as inspector or viewer for the project
 */
router.get('/:inspectionId',
  [
    validateInspectionIdParam,
    require('../middleware/validation').handleValidationErrors,
    require('../middleware/rbac').requireProjectAccess
  ],
  checklistController.getChecklistByInspection
);

module.exports = router;
