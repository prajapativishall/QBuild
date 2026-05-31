const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getReviewerDashboard,
  getInspectionForReview,
  approveInspection,
  rejectInspection,
  editInspection,
  getInspectionRejectionHistory
} = require('../controllers/reviewer.controller');

// All reviewer routes require authentication and reviewer role
router.use(authenticate);
router.use(requireRole('reviewer'));

// Get reviewer dashboard
router.get('/dashboard', getReviewerDashboard);

// Get inspection details for review
router.get('/inspections/:inspectionId/review', getInspectionForReview);

// Approve inspection
router.post('/inspections/:inspectionId/approve', approveInspection);

// Edit inspection
// router.put('/inspections/:inspectionId/edit', editInspection);

// Reject inspection (legacy endpoint for frontend compatibility)
router.post('/inspections/:inspectionId/reject', rejectInspection);

// Granular rejection - reject inspection, domain, sub-domain, or query
router.post('/inspections/:inspectionId/reject-granular', rejectInspection);

// Get inspection rejection history
router.get('/inspections/:inspectionId/rejection-history', getInspectionRejectionHistory);

module.exports = router;
