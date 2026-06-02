const scoringService = require('../services/scoring.service');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

/**
 * Scoring Controller for QRating System
 * Handles HTTP requests for score calculation
 */

class ScoringController {
  /**
   * Calculate score for an inspection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async calculateScore(req, res, next) {
    try {
      // Read inspectionId from params
      const { inspectionId } = req.params;
      
      // Validate inspectionId
      if (!inspectionId || isNaN(inspectionId)) {
        throw new ValidationError('Invalid inspection ID provided');
      }
      
      const inspectionIdNum = parseInt(inspectionId);
      
      logger.info('Starting score calculation request', {
        inspectionId: inspectionIdNum,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Call scoring service to calculate the score
      const scoringResult = await scoringService.calculateInspectionScore(inspectionIdNum);
      
      // Log successful calculation
      logger.info('Score calculation completed successfully', {
        inspectionId: inspectionIdNum,
        overallRating: scoringResult.summary.overallRating,
        validSubDomains: scoringResult.summary.validSubDomains,
        totalSubDomains: scoringResult.summary.totalSubDomains
      });
      
      // Return JSON response with scoring results
      res.json({
        success: true,
        message: 'Score calculated successfully',
        data: scoringResult,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Handle errors properly
      logger.error('Error in calculateScore controller', {
        inspectionId: req.params.inspectionId,
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      // Pass error to error handling middleware
      next(error);
    }
  }

  /**
   * Get existing score for an inspection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getScore(req, res, next) {
    try {
      // Read inspectionId from params
      const { inspectionId } = req.params;
      
      // Validate inspectionId
      if (!inspectionId || isNaN(inspectionId)) {
        throw new ValidationError('Invalid inspection ID provided');
      }
      
      const inspectionIdNum = parseInt(inspectionId);
      
      logger.info('Fetching existing score', {
        inspectionId: inspectionIdNum,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      // Get existing scores from database
      const existingScores = await this.getExistingScores(inspectionIdNum);
      
      if (!existingScores) {
        throw new NotFoundError('No score found for this inspection');
      }
      
      logger.info('Existing score retrieved successfully', {
        inspectionId: inspectionIdNum,
        subDomainCount: existingScores.subDomains.length,
        domainCount: existingScores.domains.length
      });
      
      // Return JSON response with existing scores
      res.json({
        success: true,
        message: 'Score retrieved successfully',
        data: existingScores,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error in getScore controller', {
        inspectionId: req.params.inspectionId,
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      next(error);
    }
  }

  /**
   * Recalculate score for an inspection (admin function)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async recalculateScore(req, res, next) {
    try {
      // Read inspectionId from params
      const { inspectionId } = req.params;
      
      // Validate inspectionId
      if (!inspectionId || isNaN(inspectionId)) {
        throw new ValidationError('Invalid inspection ID provided');
      }
      
      const inspectionIdNum = parseInt(inspectionId);
      
      logger.info('Starting score recalculation', {
        inspectionId: inspectionIdNum,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip,
        reason: req.body.reason || 'Manual recalculation'
      });
      
      // Get existing scores for comparison
      const existingScores = await this.getExistingScores(inspectionIdNum);
      
      // Call scoring service to recalculate the score
      const newScoringResult = await scoringService.calculateInspectionScore(inspectionIdNum);
      
      // Calculate changes
      const changes = this.calculateScoreChanges(existingScores, newScoringResult);
      
      logger.info('Score recalculation completed', {
        inspectionId: inspectionIdNum,
        oldRating: existingScores?.summary?.overallRating || 0,
        newRating: newScoringResult.summary.overallRating,
        changes: changes,
        requestedBy: req.user?.id || 'anonymous'
      });
      
      // Return JSON response with recalculation results
      res.json({
        success: true,
        message: 'Score recalculated successfully',
        data: {
          newScores: newScoringResult,
          oldScores: existingScores,
          changes: changes
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error in recalculateScore controller', {
        inspectionId: req.params.inspectionId,
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      next(error);
    }
  }

  /**
   * Get spider chart data for an inspection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getSpiderChartData(req, res, next) {
    try {
      // Read inspectionId from params
      const { inspectionId } = req.params;
      
      // Validate inspectionId
      if (!inspectionId || isNaN(inspectionId)) {
        throw new ValidationError('Invalid inspection ID provided');
      }
      
      const inspectionIdNum = parseInt(inspectionId);
      
      logger.info('Fetching spider chart data', {
        inspectionId: inspectionIdNum,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      // Get existing scores from database
      const existingScores = await this.getExistingScores(inspectionIdNum);
      
      if (!existingScores) {
        throw new NotFoundError('No score found for this inspection');
      }
      
      // Extract spider chart data
      const spiderChartData = existingScores.spiderChartData;
      
      logger.info('Spider chart data retrieved successfully', {
        inspectionId: inspectionIdNum,
        subDomainCount: spiderChartData.subDomains.length,
        domainCount: spiderChartData.domains.length
      });
      
      // Return JSON response with spider chart data
      res.json({
        success: true,
        message: 'Spider chart data retrieved successfully',
        data: spiderChartData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error in getSpiderChartData controller', {
        inspectionId: req.params.inspectionId,
        error: error.message,
        stack: error.stack,
        requestedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      next(error);
    }
  }

  /**
   * Get existing scores from database
   * @param {number} inspectionId - Inspection ID
   * @returns {Promise<Object>} - Existing scores data
   */
  async getExistingScores(inspectionId) {
    try {
      const db = require('../config/db');
      
      // Get sub_domain scores (with domain_id to distinguish same sub-domain across domains)
      const subDomainScoresQuery = `
        SELECT 
          ss.sub_domain_id,
          ss.domain_id,
          ss.secured_points,
          ss.max_points,
          ss.sub_domain_rating,
          COALESCE(s.sub_domain_name, 'Unknown') as sub_domain_name,
          d.domain_name
        FROM sub_domain_scores ss
        LEFT JOIN sub_domains s ON ss.sub_domain_id = s.id
        LEFT JOIN domains d ON ss.domain_id = d.id
        WHERE ss.inspection_id = ?
        ORDER BY ISNULL(ss.domain_id), d.domain_name, s.sub_domain_name
      `;
      
      const subDomainScores = await db.execute(subDomainScoresQuery, [inspectionId]);
      
      // Get domain scores
      const domainScoresQuery = `
        SELECT 
          dc.domain_id,
          dc.percentage,
          d.domain_name
        FROM domain_scores dc
        JOIN domains d ON dc.domain_id = d.id
        WHERE dc.inspection_id = ?
        ORDER BY d.id ASC
      `;
      
      const domainScores = await db.execute(domainScoresQuery, [inspectionId]);
      
      if (subDomainScores.length === 0 && domainScores.length === 0) {
        return null;
      }
      
      // Format sub_domain scores
      const formattedSubDomainScores = subDomainScores.map(subDomain => ({
        subDomainId: subDomain.sub_domain_id,
        subDomainName: subDomain.sub_domain_name,
        domainId: subDomain.domain_id,
        domainName: subDomain.domain_name,
        securedPoints: subDomain.secured_points,
        maxPoints: subDomain.max_points,
        subDomainRating: parseFloat(subDomain.sub_domain_rating)
      }));
      
      // Format domain scores
      const formattedDomainScores = domainScores.map(domain => ({
        domainId: domain.domain_id,
        domainName: domain.domain_name,
        domainRating: parseFloat(domain.percentage)
      }));
      
      // Generate spider chart data
      const spiderChartData = scoringService.generateSpiderChartData(
        formattedSubDomainScores, 
        formattedDomainScores
      );
      
      return {
        inspectionId,
        subDomains: formattedSubDomainScores,
        domains: formattedDomainScores,
        spiderChartData,
        summary: {
          totalSubDomains: formattedSubDomainScores.length,
          overallRating: scoringService.calculateOverallRating(formattedDomainScores)
        }
      };
      
    } catch (error) {
      logger.error('Error getting existing scores', { inspectionId, error });
      throw error;
    }
  }

  /**
   * Calculate changes between old and new scores
   * @param {Object} oldScores - Old scores data
   * @param {Object} newScores - New scores data
   * @returns {Object} - Changes object
   */
  calculateScoreChanges(oldScores, newScores) {
    if (!oldScores) {
      return {
        type: 'initial_calculation',
        oldRating: 0,
        newRating: newScores.summary.overallRating,
        ratingChange: newScores.summary.overallRating
      };
    }
    
    const oldRating = oldScores.summary.overallRating || 0;
    const newRating = newScores.summary.overallRating;
    const ratingChange = newRating - oldRating;
    
    return {
      type: 'recalculation',
      oldRating,
      newRating,
      ratingChange: Math.round(ratingChange * 100) / 100,
      improved: ratingChange > 0,
      declined: ratingChange < 0,
      unchanged: ratingChange === 0,
      subDomainChanges: this.calculateSubDomainChanges(oldScores.subDomains, newScores.subDomains),
      domainChanges: this.calculateDomainChanges(oldScores.domains, newScores.domains)
    };
  }

  /**
   * Calculate sub_domain changes
   * @param {Array} oldSubDomains - Old sub_domain scores
   * @param {Array} newSubDomains - New sub_domain scores
   * @returns {Array} - SubDomain changes
   */
  calculateSubDomainChanges(oldSubDomains, newSubDomains) {
    return newSubDomains.map(newSubDomain => {
      const oldSubDomain = oldSubDomains.find(s => s.subDomainId === newSubDomain.subDomainId);
      
      if (!oldSubDomain) {
        return {
          subDomainId: newSubDomain.subDomainId,
          subDomainName: newSubDomain.subDomainName,
          type: 'added',
          oldRating: 0,
          newRating: newSubDomain.subDomainRating,
          ratingChange: newSubDomain.subDomainRating
        };
      }
      
      const ratingChange = newSubDomain.subDomainRating - oldSubDomain.subDomainRating;
      
      return {
        subDomainId: newSubDomain.subDomainId,
        subDomainName: newSubDomain.subDomainName,
        type: 'updated',
        oldRating: oldSubDomain.subDomainRating,
        newRating: newSubDomain.subDomainRating,
        ratingChange: Math.round(ratingChange * 100) / 100,
        improved: ratingChange > 0,
        declined: ratingChange < 0,
        unchanged: ratingChange === 0
      };
    });
  }

  /**
   * Calculate domain changes
   * @param {Array} oldDomains - Old domain scores
   * @param {Array} newDomains - New domain scores
   * @returns {Array} - Domain changes
   */
  calculateDomainChanges(oldDomains, newDomains) {
    return newDomains.map(newDomain => {
      const oldDomain = oldDomains.find(s => s.domainId === newDomain.domainId);
      
      if (!oldDomain) {
        return {
          domainId: newDomain.domainId,
          domainName: newDomain.domainName,
          type: 'added',
          oldRating: 0,
          newRating: newDomain.domainRating,
          ratingChange: newDomain.domainRating
        };
      }
      
      const ratingChange = newDomain.domainRating - oldDomain.domainRating;
      
      return {
        domainId: newDomain.domainId,
        domainName: newDomain.domainName,
        type: 'updated',
        oldRating: oldDomain.domainRating,
        newRating: newDomain.domainRating,
        ratingChange: Math.round(ratingChange * 100) / 100,
        improved: ratingChange > 0,
        declined: ratingChange < 0,
        unchanged: ratingChange === 0
      };
    });
  }
}

module.exports = new ScoringController();
