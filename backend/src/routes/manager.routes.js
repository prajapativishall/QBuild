const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getManagerDashboard,
  getInspectionForManagerReview,
  approveInspection,
  rejectInspection,
  getInspectionRejectionHistory,
  editProject
} = require('../controllers/manager.controller');

// All manager routes require authentication and manager role
router.use(authenticate);
router.use(requireRole('manager'));

// Get manager dashboard
router.get('/dashboard', getManagerDashboard);

// Get inspection details for manager review
router.get('/inspections/:inspectionId/review', getInspectionForManagerReview);

// Approve inspection
router.post('/inspections/:inspectionId/approve', approveInspection);

// Reject inspection
router.post('/inspections/:inspectionId/reject', rejectInspection);

// Get inspection rejection history
router.get('/inspections/:inspectionId/rejection-history', getInspectionRejectionHistory);

// Edit project
router.put('/projects/:projectId/edit', editProject);

module.exports = router;
