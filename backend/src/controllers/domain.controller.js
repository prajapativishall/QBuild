const domainService = require('../services/domain.service');
const logger = require('../utils/logger');

class DomainController {
  // Get all domains
  async getAllDomains(req, res) {
    try {
      const domains = await domainService.getAllDomains();
      res.json({
        success: true,
        data: domains
      });
    } catch (error) {
      logger.error('Error in getAllDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domains',
        error: error.message
      });
    }
  }

  // Get domain by ID
  async getDomainById(req, res) {
    try {
      const { id } = req.params;
      const domain = await domainService.getDomainById(id);
      
      if (!domain) {
        return res.status(404).json({
          success: false,
          message: 'Domain not found'
        });
      }
      
      res.json({
        success: true,
        data: domain
      });
    } catch (error) {
      logger.error('Error in getDomainById:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domain',
        error: error.message
      });
    }
  }

  // Create new domain
  async createDomain(req, res) {
    try {
      const domain = await domainService.createDomain(req.body);
      res.status(201).json({
        success: true,
        message: 'Domain created successfully',
        data: domain
      });
    } catch (error) {
      logger.error('Error in createDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating domain',
        error: error.message
      });
    }
  }

  // Update domain
  async updateDomain(req, res) {
    try {
      const { id } = req.params;
      const domain = await domainService.updateDomain(id, req.body);
      res.json({
        success: true,
        message: 'Domain updated successfully',
        data: domain
      });
    } catch (error) {
      logger.error('Error in updateDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating domain',
        error: error.message
      });
    }
  }

  // Delete domain
  async deleteDomain(req, res) {
    try {
      const { id } = req.params;
      const result = await domainService.deleteDomain(id);
      res.json({
        success: true,
        message: 'Domain deleted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error in deleteDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting domain',
        error: error.message
      });
    }
  }
}

module.exports = new DomainController();
