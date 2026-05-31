const express = require('express');
const router = express.Router();
const subDomainController = require('../controllers/sub_domain.controller');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET all sub_domains
router.get('/', subDomainController.getAllSubDomains);

// GET single sub_domain by ID
router.get('/:id', subDomainController.getSubDomainById);

// POST create new sub_domain
router.post('/', subDomainController.createSubDomain);

// PUT update sub_domain
router.put('/:id', subDomainController.updateSubDomain);

// DELETE sub_domain
router.delete('/:id', subDomainController.deleteSubDomain);

module.exports = router;
