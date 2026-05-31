const express = require('express');
const router = express.Router();
const weightageManagementController = require('../controllers/weightageManagement.controller');
const { authenticate } = require('../middleware/auth');

// Domain management endpoints
router.get('/domains', authenticate, weightageManagementController.getDomains);
router.put('/domains/batch-update', authenticate, weightageManagementController.batchUpdateDomainWeightages);
router.put('/domains/:domainId', authenticate, weightageManagementController.updateDomainWeightage);
router.post('/domains/normalize', authenticate, weightageManagementController.normalizeDomainWeightages);

// SubDomain management endpoints
router.get('/sub-domains', authenticate, weightageManagementController.getSubDomains);

// Domain-sub_domain relationship endpoints
router.get('/domain-sub-domains', authenticate, weightageManagementController.getDomainSubDomains);
router.get('/domain-sub-domains/:domainId', authenticate, weightageManagementController.getDomainSubDomains);
router.put('/domain-sub-domains/:domainId/batch-update', authenticate, weightageManagementController.batchUpdateDomainSubDomainWeightages);
router.put('/domain-sub-domains/:domainId/:subDomainId', authenticate, weightageManagementController.updateDomainSubDomainWeightage);
router.post('/domain-sub-domains/:domainId/:subDomainId', authenticate, weightageManagementController.addSubDomainToDomain);
router.delete('/domain-sub-domains/:domainId/:subDomainId', authenticate, weightageManagementController.removeSubDomainFromDomain);
router.post('/domain-sub-domains/:domainId/normalize', authenticate, weightageManagementController.normalizeDomainSubDomains);

// Complete weightage summary
router.get('/summary', authenticate, weightageManagementController.getWeightageSummary);

// Project-specific weightage management
router.put('/projects/:projectId/domains/:domainId/sub-domains/:subDomainId/manual', authenticate, weightageManagementController.updateProjectSubDomainManualFlag);
router.put('/projects/:projectId/domains/:domainId/sub-domains/batch-update', authenticate, weightageManagementController.batchUpdateProjectSubDomainWeightages);

module.exports = router;
