const { body, param, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Handle validation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    throw new ValidationError('Validation failed', errorMessages);
  }
  
  next();
};

/**
 * Validate inspection ID parameter
 */
const validateInspectionIdParam = [
  param('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  handleValidationErrors
];

/**
 * Validate score calculation request body
 */
const validateScoreCalculation = [
  body('forceRecalculate')
    .optional()
    .isBoolean()
    .withMessage('Force recalculate must be a boolean'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters')
    .matches(/^[a-zA-Z0-9\s.,!?-]+$/)
    .withMessage('Reason contains invalid characters'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
  
  body('options.includeSpiderChart')
    .optional()
    .isBoolean()
    .withMessage('Include spider chart must be a boolean'),
  
  body('options.includeChanges')
    .optional()
    .isBoolean()
    .withMessage('Include changes must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validate recalculation request body
 */
const validateRecalculationRequest = [
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters')
    .matches(/^[a-zA-Z0-9\s.,!?-]+$/)
    .withMessage('Reason contains invalid characters'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.includeChanges')
    .optional()
    .isBoolean()
    .withMessage('Include changes must be a boolean'),
  
  body('options.includeDetailedChanges')
    .optional()
    .isBoolean()
    .withMessage('Include detailed changes must be a boolean'),
  
  body('options.bypassCache')
    .optional()
    .isBoolean()
    .withMessage('Bypass cache must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validate spider chart request query parameters
 */
const validateSpiderChartQuery = [
  body('format')
    .optional()
    .isIn(['json', 'chartjs', 'd3'])
    .withMessage('Format must be json, chartjs, or d3'),
  
  body('includeLabels')
    .optional()
    .isBoolean()
    .withMessage('Include labels must be a boolean'),
  
  body('includeGrid')
    .optional()
    .isBoolean()
    .withMessage('Include grid must be a boolean'),
  
  body('maxSubDomains')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Max subDomains must be between 1 and 20'),
  
  body('maxDomains')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max domains must be between 1 and 10'),
  
  handleValidationErrors
];

/**
 * Validate batch score calculation request
 */
const validateBatchCalculation = [
  body('inspectionIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Inspection IDs must be an array with 1-50 items'),
  
  body('inspectionIds.*')
    .isInt({ min: 1 })
    .withMessage('Each inspection ID must be a positive integer'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.parallel')
    .optional()
    .isBoolean()
    .withMessage('Parallel must be a boolean'),
  
  body('options.timeout')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('Timeout must be between 1000ms and 300000ms'),
  
  body('options.continueOnError')
    .optional()
    .isBoolean()
    .withMessage('Continue on error must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validate score comparison request
 */
const validateScoreComparison = [
  body('inspectionId1')
    .isInt({ min: 1 })
    .withMessage('First inspection ID must be a positive integer'),
  
  body('inspectionId2')
    .isInt({ min: 1 })
    .withMessage('Second inspection ID must be a positive integer'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
  
  body('options.includeChanges')
    .optional()
    .isBoolean()
    .withMessage('Include changes must be a boolean'),
  
  body('options.includeSpiderChart')
    .optional()
    .isBoolean()
    .withMessage('Include spider chart must be a boolean'),
  
  // Custom validation: inspection IDs must be different
  body().custom((value) => {
    const { inspectionId1, inspectionId2 } = value;
    
    if (inspectionId1 === inspectionId2) {
      throw new Error('Inspection IDs must be different for comparison');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate score export request
 */
const validateScoreExport = [
  body('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('format')
    .isIn(['json', 'csv', 'xlsx', 'pdf'])
    .withMessage('Format must be json, csv, xlsx, or pdf'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.includeSubDomains')
    .optional()
    .isBoolean()
    .withMessage('Include subDomains must be a boolean'),
  
  body('options.includeDomains')
    .optional()
    .isBoolean()
    .withMessage('Include domains must be a boolean'),
  
  body('options.includeSpiderChart')
    .optional()
    .isBoolean()
    .withMessage('Include spider chart must be a boolean'),
  
  body('options.includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
  
  body('options.includeTimestamp')
    .optional()
    .isBoolean()
    .withMessage('Include timestamp must be a boolean'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateInspectionIdParam,
  validateScoreCalculation,
  validateRecalculationRequest,
  validateSpiderChartQuery,
  validateBatchCalculation,
  validateScoreComparison,
  validateScoreExport
};
