const responseService = require('../services/response.service');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

/**
 * Response Controller for QRating System
 * Handles HTTP requests for checklist response submission and management
 */

class ResponseController {
  /**
   * Submit a single response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async submitResponse(req, res, next) {
    try {
      // Extract user from JWT middleware
      const userId = req.user.id;
      const { inspection_id, checklist_item_id, response_value, remarks } = req.body;

      logger.info('Single response submission request', {
        inspectionId: inspection_id,
        checklistItemId: checklist_item_id,
        responseValue: response_value,
        submittedBy: userId,
        ip: req.ip
      });

      // Call service to submit response
      const result = await responseService.submitResponse(
        inspection_id,
        checklist_item_id,
        response_value,
        remarks,
        userId
      );

      logger.info('Single response submitted successfully', {
        inspectionId: inspection_id,
        checklistItemId: checklist_item_id,
        action: result.action,
        submittedBy: userId
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: `Response ${result.action} successfully`,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in submitResponse controller', {
        inspectionId: req.body.inspection_id,
        checklistItemId: req.body.checklist_item_id,
        responseValue: req.body.response_value,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Submit multiple responses in bulk
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async bulkSubmitResponses(req, res, next) {
    try {
      // Extract user from JWT middleware
      const userId = req.user.id;
      const { inspection_id, responses, phase, source_phase } = req.body;

      logger.info('Bulk response submission request', {
        inspectionId: inspection_id,
        responseCount: responses.length,
        submittedBy: userId,
        phase: phase,
        sourcePhase: source_phase,
        ip: req.ip
      });

      // Call service to submit bulk responses
      const result = await responseService.bulkSubmitResponses(
        inspection_id,
        responses,
        userId,
        phase,
        source_phase
      );

      // Determine appropriate HTTP status code
      const statusCode = result.totalFailed > 0 ? 207 : 201; // 207 Multi-Status for partial success

      logger.info('Bulk response submission completed', {
        inspectionId: inspection_id,
        totalProcessed: result.totalProcessed,
        totalFailed: result.totalFailed,
        submittedBy: userId
      });

      // Return success response with detailed results
      res.status(statusCode).json({
        success: result.totalFailed === 0,
        message: result.totalFailed === 0 
          ? 'All responses submitted successfully' 
          : `Bulk submission completed with ${result.totalFailed} failures`,
        data: {
          inspectionId: inspection_id,
          submittedBy: userId,
          totalProcessed: result.totalProcessed,
          totalFailed: result.totalFailed,
          processedResponses: result.processedResponses,
          failedResponses: result.failedResponses
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in bulkSubmitResponses controller', {
        inspectionId: req.body.inspection_id,
        responseCount: req.body.responses?.length,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Override an existing response (Admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async overrideResponse(req, res, next) {
    try {
      // Extract user from JWT middleware
      const userId = req.user.id;
      const { responseId } = req.params;
      const { response_value, remarks } = req.body;

      // Check if user is admin (or has override permissions)
      if (!req.user.isGlobalAdmin && !req.user.permissions?.includes('override_responses')) {
        throw new ForbiddenError('Only administrators can override responses');
      }

      logger.info('Response override request', {
        responseId,
        responseValue: response_value,
        overriddenBy: userId,
        ip: req.ip
      });

      // Call service to override response
      const result = await responseService.overrideResponse(
        parseInt(responseId),
        response_value,
        remarks,
        userId
      );

      logger.info('Response overridden successfully', {
        responseId,
        originalValue: result.originalResponse.responseValue,
        newValue: result.overriddenResponse.responseValue,
        overriddenBy: userId
      });

      // Return success response
      res.json({
        success: true,
        message: 'Response overridden successfully',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in overrideResponse controller', {
        responseId: req.params.responseId,
        responseValue: req.body.response_value,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get all responses for an inspection, grouped by hierarchy
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getResponsesByInspection(req, res, next) {
    try {
      const { inspectionId } = req.params;

      logger.info('Fetching responses by inspection', {
        inspectionId,
        requestedBy: req.user?.id,
        ip: req.ip
      });

      // Call service to get responses
      const result = await responseService.getResponsesByInspection(parseInt(inspectionId));

      logger.info('Responses retrieved successfully', {
        inspectionId,
        totalResponses: result.summary.totalResponses,
        domainsCount: result.summary.domainsCount,
        requestedBy: req.user?.id
      });

      // Return success response
      res.json({
        success: true,
        message: 'Responses retrieved successfully',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getResponsesByInspection controller', {
        inspectionId: req.params.inspectionId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get a single response by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getResponseById(req, res, next) {
    try {
      const { responseId } = req.params;

      logger.info('Fetching response by ID', {
        responseId,
        requestedBy: req.user?.id,
        ip: req.ip
      });

      // Call service to get response
      const result = await responseService.getResponseById(parseInt(responseId));

      logger.info('Response retrieved successfully', {
        responseId,
        checklistItemId: result.checklistItemId,
        responseValue: result.responseValue,
        requestedBy: req.user?.id
      });

      // Return success response
      res.json({
        success: true,
        message: 'Response retrieved successfully',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getResponseById controller', {
        responseId: req.params.responseId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Delete a response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async deleteResponse(req, res, next) {
    try {
      // Extract user from JWT middleware
      const userId = req.user.id;
      const { responseId } = req.params;

      logger.info('Deleting response', {
        responseId,
        deletedBy: userId,
        ip: req.ip
      });

      // Call service to delete response
      const result = await responseService.deleteResponse(parseInt(responseId), userId);

      logger.info('Response deleted successfully', {
        responseId,
        deletedBy: userId
      });

      // Return success response
      res.json({
        success: true,
        message: 'Response deleted successfully',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in deleteResponse controller', {
        responseId: req.params.responseId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get response statistics for an inspection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getResponseStatistics(req, res, next) {
    try {
      const { inspectionId } = req.params;

      logger.info('Fetching response statistics', {
        inspectionId,
        requestedBy: req.user?.id,
        ip: req.ip
      });

      // Call service to get statistics
      const result = await responseService.getResponseStatistics(parseInt(inspectionId));

      logger.info('Response statistics retrieved successfully', {
        inspectionId,
        totalResponses: result.totalResponses,
        overriddenCount: result.overriddenCount,
        requestedBy: req.user?.id
      });

      // Return success response
      res.json({
        success: true,
        message: 'Response statistics retrieved successfully',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getResponseStatistics controller', {
        inspectionId: req.params.inspectionId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get response history for a specific checklist item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getResponseHistory(req, res, next) {
    try {
      const { inspectionId, checklistItemId } = req.params;

      logger.info('Fetching response history', {
        inspectionId,
        checklistItemId,
        requestedBy: req.user?.id,
        ip: req.ip
      });

      // This would require additional database queries to get history
      // For now, we'll return a placeholder response
      const history = {
        inspectionId: parseInt(inspectionId),
        checklistItemId: parseInt(checklistItemId),
        history: [],
        message: 'Response history feature not yet implemented'
      };

      // Return success response
      res.json({
        success: true,
        message: 'Response history retrieved successfully',
        data: history,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getResponseHistory controller', {
        inspectionId: req.params.inspectionId,
        checklistItemId: req.params.checklistItemId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Export responses for an inspection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async exportResponses(req, res, next) {
    try {
      const { inspectionId } = req.params;
      const { format = 'json' } = req.query;

      logger.info('Exporting responses', {
        inspectionId,
        format,
        requestedBy: req.user?.id,
        ip: req.ip
      });

      // Get responses for export
      const responses = await responseService.getResponsesByInspection(parseInt(inspectionId));

      // Format based on requested format
      let exportData;
      let contentType;
      let filename;

      switch (format.toLowerCase()) {
        case 'json':
          exportData = responses;
          contentType = 'application/json';
          filename = `responses_${inspectionId}.json`;
          break;
        case 'csv':
          // CSV export would require additional formatting logic
          exportData = this.formatResponsesAsCSV(responses);
          contentType = 'text/csv';
          filename = `responses_${inspectionId}.csv`;
          break;
        default:
          throw new ValidationError(`Unsupported export format: ${format}`);
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      logger.info('Responses exported successfully', {
        inspectionId,
        format,
        filename,
        requestedBy: req.user?.id
      });

      // Send the file
      res.send(exportData);

    } catch (error) {
      logger.error('Error in exportResponses controller', {
        inspectionId: req.params.inspectionId,
        format: req.query.format,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Format responses as CSV (helper method)
   * @param {Object} responses - Responses data
   * @returns {string} - CSV formatted string
   */
  formatResponsesAsCSV(responses) {
    const headers = [
      'Response ID',
      'Inspection ID',
      'Domain Name',
      'SubDomain Name',
      'Question Description',
      'Question Type',
      'Response Value',
      'Remarks',
      'Submitted By',
      'Is Overridden',
      'Overridden By',
      'Created At',
      'Updated At'
    ];

    const csvRows = [headers.join(',')];

    responses.domains.forEach(domain => {
      domain.subDomains.forEach(subDomain => {
        subDomain.queries.forEach(query => {
          const row = [
            query.id,
            query.inspectionId,
            domain.domainName,
            subDomain.subDomainName,
            query.itemDescription,
            query.itemType,
            query.responseValue,
            query.remarks || '',
            query.submittedBy?.name || '',
            query.isOverridden,
            query.overriddenBy?.name || '',
            query.createdAt,
            query.updatedAt
          ];
          csvRows.push(row.join(','));
        });
      });
    });

    return csvRows.join('\n');
  }
}

module.exports = new ResponseController();
