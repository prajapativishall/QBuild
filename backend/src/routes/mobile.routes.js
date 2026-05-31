const express = require('express');
const multer = require('multer');
const router = express.Router();
const mobileController = require('../controllers/mobile.controller');
const { authenticate } = require('../middleware/auth');
const { ForbiddenError } = require('../middleware/errorHandler');

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Strict middleware: Only allow users with role 'inspector' to access mobile routes.
// Unlike requireRole, this does NOT bypass for global admins.
const requireInspectorOnly = (req, res, next) => {
  if (!req.user) {
    return next(new ForbiddenError('Authentication required'));
  }
  if (req.user.role !== 'inspector') {
    return next(new ForbiddenError('Only inspectors can access mobile endpoints'));
  }
  next();
};

// All routes require authentication and inspector-only role
router.use(authenticate);
router.use(requireInspectorOnly);

// Dashboard
router.get('/dashboard', mobileController.getDashboard);

// Inbox
router.get('/inbox', mobileController.getInbox);
router.post('/inbox/:inspectionId/accept', mobileController.acceptInspection);

// Rejected inspections inbox
router.get('/rejected-inspections', mobileController.getRejectedInspections);
router.post('/rejected-inspections/:inspectionId/accept', mobileController.acceptRejection);

// Inspection flow
router.get('/inspections/:inspectionId/domains', mobileController.getInspectionDomains);
router.get('/inspections/:inspectionId/subdomains/:subDomainId/queries', mobileController.getSubDomainQueries);
router.get('/inspections/:inspectionId/domains/:domainId/subdomains/:subDomainId/queries', mobileController.getSubDomainQueries);

// Hierarchical data with responses for spider charts
router.get('/inspections/:inspectionId/hierarchy', mobileController.getInspectionHierarchy);

// Project hierarchy with all phases (project->phases->domains->subdomains->queries->responses)
router.get('/projects/:projectId/hierarchy', mobileController.getProjectHierarchy);

// Submit query response
router.post('/inspections/:inspectionId/queries/:queryId/response', mobileController.submitQueryResponse);

// Submit sub-domain
router.post('/inspections/:inspectionId/subdomains/:subDomainId/submit', mobileController.submitSubDomain);

// Final inspection submission from domains screen
router.post('/inspections/:inspectionId/final-submit', mobileController.submitFinalInspection);

// Upload inspection photo
router.post('/inspections/:inspectionId/upload-photo', upload.single('photo'), mobileController.uploadInspectionPhoto);

module.exports = router;
