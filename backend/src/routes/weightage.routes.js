const express = require('express');
const router = express.Router();
const weightageController = require('../controllers/weightage.controller');
const { authenticate } = require('../middleware/auth');

// Get default weightages for project creation
router.get('/default', authenticate, weightageController.getDefaultWeightages);

// Get all domains with their default weightage and sub_domains
router.get('/domains-with-sub-domains', authenticate, weightageController.getDomainsWithSubDomains);

// Get project-specific weightage for a domain
router.get('/projects/:projectId/domains/:domainId', authenticate, weightageController.getProjectDomainWeightage);

// Update project domain weightage
router.put('/projects/:projectId/domains/:domainId', authenticate, weightageController.updateProjectDomainWeightage);

// Add sub_domains to a project domain
router.post('/projects/:projectId/domains/:domainId/sub-domains', authenticate, weightageController.addSubDomainsToProjectDomain);

// Remove sub_domains from a project domain
router.delete('/projects/:projectId/domains/:domainId/sub-domains', authenticate, weightageController.removeSubDomainsFromProjectDomain);

// Update project domain sub_domain weightage
router.put('/projects/:projectId/domains/:domainId/sub-domains/:subDomainId', authenticate, weightageController.updateProjectSubDomainWeightage);

// Normalize weightage for a project domain
router.post('/projects/:projectId/domains/:domainId/normalize', authenticate, weightageController.normalizeProjectDomainWeightage);

module.exports = router;
