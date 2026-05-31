const queryService = require('../services/query.service');
const logger = require('../utils/logger');

const queryController = {
  async getAllQueries(req, res) {
    try {
      console.log('========================================');
      console.log('getAllQueries controller called');
      console.log('Method:', req.method);
      console.log('URL:', req.url);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Query params:', req.query);
      console.log('========================================');
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;
      const result = await queryService.getAllQueries(page, limit);
      console.log('getAllQueries controller success, rows:', result.data.length);
      res.json(result);
    } catch (error) {
      console.error('========================================');
      console.error('getAllQueries controller error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('========================================');
      logger.error('Error in getAllQueries:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getQueryById(req, res) {
    try {
      const { id } = req.params;
      const query = await queryService.getQueryById(id);
      if (!query) {
        return res.status(404).json({ error: 'Query not found' });
      }
      res.json({ data: query });
    } catch (error) {
      logger.error('Error in getQueryById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async createQuery(req, res) {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'text is required' });
      }

      const newQuery = await queryService.createQuery({ text });
      res.status(201).json({ data: newQuery });
    } catch (error) {
      logger.error('Error in createQuery:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateQuery(req, res) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'text is required' });
      }

      const updatedQuery = await queryService.updateQuery(id, { text });
      res.json({ data: updatedQuery });
    } catch (error) {
      logger.error('Error in updateQuery:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async deleteQuery(req, res) {
    try {
      const { id } = req.params;
      const result = await queryService.deleteQuery(id);
      res.json(result);
    } catch (error) {
      logger.error('Error in deleteQuery:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getQueriesNotInSubDomain(req, res) {
    try {
      const { subDomainId } = req.params;
      const queries = await queryService.getQueriesNotInSubDomain(subDomainId);
      res.json({ data: queries });
    } catch (error) {
      logger.error('Error in getQueriesNotInSubDomain:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async linkQueryToSubDomain(req, res) {
    try {
      const { subDomainId, queryId } = req.params;
      const { queryType, parentId, itemOrder } = req.body;
      
      const result = await queryService.linkQueryToSubDomain(subDomainId, queryId, queryType || 'primary', parentId || null, itemOrder || 0);
      res.json(result);
    } catch (error) {
      logger.error('Error in linkQueryToSubDomain:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async unlinkQueryFromSubDomain(req, res) {
    try {
      const { subDomainId, queryId } = req.params;
      
      const result = await queryService.unlinkQueryFromSubDomain(subDomainId, queryId);
      res.json(result);
    } catch (error) {
      logger.error('Error in unlinkQueryFromSubDomain:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateSubDomainQuery(req, res) {
    try {
      const { subDomainId, queryId } = req.params;
      const { queryType, parentId, itemOrder } = req.body;
      
      if (!queryType) {
        return res.status(400).json({ error: 'queryType is required' });
      }

      const validTypes = ['primary', 'secondary', 'optional'];
      if (!validTypes.includes(queryType)) {
        return res.status(400).json({ error: 'Invalid query type. Must be primary, secondary, or optional' });
      }

      const result = await queryService.updateSubDomainQuery(subDomainId, queryId, queryType, parentId, itemOrder);
      res.json(result);
    } catch (error) {
      logger.error('Error in updateSubDomainQuery:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getQueriesBySubDomain(req, res) {
    try {
      const { subDomainId } = req.params;
      const queries = await queryService.getQueriesBySubDomain(subDomainId);
      res.json({ success: true, data: queries });
    } catch (error) {
      logger.error('Error in getQueriesBySubDomain:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = queryController;
