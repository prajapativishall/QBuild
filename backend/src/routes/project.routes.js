const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validatePhaseDomainWeightages } = require('../middleware/weightageManagementMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET all projects
router.get('/', projectController.getAllProjects);

// GET single project by ID
router.get('/:id', projectController.getProjectById);

// POST create new project
router.post('/', requireRole('manager'), projectController.createProject);

// PUT update project
router.put('/:id', requireRole('manager'), projectController.updateProject);

// DELETE project
router.delete('/:id', requireRole('manager'), projectController.deleteProject);

// Import domain routes
router.post('/:projectId/import-domain', projectController.importDomain);
router.get('/:projectId/available-domains', projectController.getAvailableDomains);

// Spider chart routes
router.get('/:projectId/spider-chart', projectController.getProjectSpiderChart);
router.get('/:projectId/domains/:domainId/spider-chart', projectController.getDomainSpiderChart);

// Phase routes - with weightage validation on create and update
router.get('/:projectId/phases', projectController.getProjectPhases);
router.post('/:projectId/phases', requireRole('manager'), validatePhaseDomainWeightages, projectController.createPhase);
router.put('/:projectId/phases/:phaseNumber', requireRole('manager'), validatePhaseDomainWeightages, projectController.updatePhase);
router.get('/:projectId/phases/:phaseNumber/configuration', projectController.getPhaseConfiguration);

module.exports = router;
