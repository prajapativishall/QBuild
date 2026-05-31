const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domain.controller');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET all domains
router.get('/', domainController.getAllDomains);

// GET single domain by ID
router.get('/:id', domainController.getDomainById);

// POST create new domain
router.post('/', domainController.createDomain);

// PUT update domain
router.put('/:id', domainController.updateDomain);

// DELETE domain
router.delete('/:id', domainController.deleteDomain);

module.exports = router;
