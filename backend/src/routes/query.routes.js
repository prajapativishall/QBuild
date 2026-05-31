const express = require('express');
const router = express.Router();
const queryController = require('../controllers/query.controller');

// NO AUTHENTICATION - Public routes for testing

// Query import/export routes for sub-domains (specific routes first)
router.get('/sub-domain/:subDomainId/available', queryController.getQueriesNotInSubDomain);
router.get('/sub-domain/:subDomainId/linked', queryController.getQueriesBySubDomain);
router.post('/sub-domain/:subDomainId/query/:queryId/link', queryController.linkQueryToSubDomain);
router.put('/sub-domain/:subDomainId/query/:queryId', queryController.updateSubDomainQuery);
router.delete('/sub-domain/:subDomainId/query/:queryId/unlink', queryController.unlinkQueryFromSubDomain);

// Query CRUD routes (parameterized routes last)
router.get('/', queryController.getAllQueries);
router.get('/:id', queryController.getQueryById);
router.post('/', queryController.createQuery);
router.put('/:id', queryController.updateQuery);
router.delete('/:id', queryController.deleteQuery);

module.exports = router;
