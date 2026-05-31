const subDomainService = require('../services/sub_domain.service');
const logger = require('../utils/logger');

class SubDomainController {
  // Get all sub_domains
  async getAllSubDomains(req, res) {
    try {
      logger.info('getAllSubDomains called');
      const subDomains = await subDomainService.getAllSubDomains();
      logger.info('SubDomains returned from service:', subDomains.length);
      res.json({
        success: true,
        data: subDomains
      });
    } catch (error) {
      logger.error('Error in getAllSubDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sub_domains',
        error: error.message
      });
    }
  }

  // Get sub_domain by ID
  async getSubDomainById(req, res) {
    try {
      const { id } = req.params;
      const subDomain = await subDomainService.getSubDomainById(id);
      
      if (!subDomain) {
        return res.status(404).json({
          success: false,
          message: 'SubDomain not found'
        });
      }
      
      res.json({
        success: true,
        data: subDomain
      });
    } catch (error) {
      logger.error('Error in getSubDomainById:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sub_domain',
        error: error.message
      });
    }
  }

  // Create new sub_domain
  async createSubDomain(req, res) {
    try {
      const subDomain = await subDomainService.createSubDomain(req.body);
      res.status(201).json({
        success: true,
        message: 'SubDomain created successfully',
        data: subDomain
      });
    } catch (error) {
      logger.error('Error in createSubDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating sub_domain',
        error: error.message
      });
    }
  }

  // Update sub_domain
  async updateSubDomain(req, res) {
    try {
      const { id } = req.params;
      const subDomain = await subDomainService.updateSubDomain(id, req.body);
      res.json({
        success: true,
        message: 'SubDomain updated successfully',
        data: subDomain
      });
    } catch (error) {
      logger.error('Error in updateSubDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sub_domain',
        error: error.message
      });
    }
  }

  // Delete sub_domain
  async deleteSubDomain(req, res) {
    try {
      const { id } = req.params;
      const result = await subDomainService.deleteSubDomain(id);
      res.json({
        success: true,
        message: 'SubDomain deleted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error in deleteSubDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting sub_domain',
        error: error.message
      });
    }
  }
}

module.exports = new SubDomainController();
