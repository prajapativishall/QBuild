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
 * Validate single response submission
 */
const validateSingleResponse = [
  body('inspection_id')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('checklist_item_id')
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('response_value')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks cannot exceed 1000 characters')
    .matches(/^[a-zA-Z0-9\s.,!?-]+$/)
    .withMessage('Remarks contains invalid characters'),
  
  handleValidationErrors
];

/**
 * Validate bulk response submission
 */
const validateBulkResponses = [
  body('inspection_id')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('responses')
    .isArray({ min: 1, max: 100 })
    .withMessage('Responses must be an array with 1-100 items'),
  
  body('responses.*.question_id')
    .isInt({ min: 1 })
    .withMessage('Each response must have a valid question_id'),
  
  body('responses.*.responseValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Each response value must be YES, NO, or NA'),
  
  body('responses.*.remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks cannot exceed 1000 characters'),
  
  // Custom validation: check for duplicate question_id
  body().custom((value) => {
    const { responses } = value;
    
    if (!Array.isArray(responses)) {
      throw new Error('Responses must be an array');
    }
    
    const questionIds = responses.map(r => r.question_id);
    const uniqueQuestionIds = new Set(questionIds);
    
    if (questionIds.length !== uniqueQuestionIds.size) {
      throw new Error('Duplicate question_id found in bulk responses');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate response override
 */
const validateResponseOverride = [
  body('response_value')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('remarks')
    .optional()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Override remarks must be between 5 and 1000 characters')
    .matches(/^[a-zA-Z0-9\s.,!?-]+$/)
    .withMessage('Override remarks contains invalid characters'),
  
  handleValidationErrors
];

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
 * Validate response ID parameter
 */
const validateResponseIdParam = [
  param('responseId')
    .isInt({ min: 1 })
    .withMessage('Response ID must be a positive integer'),
  handleValidationErrors
];

/**
 * Validate response update
 */
const validateResponseUpdate = [
  param('responseId')
    .isInt({ min: 1 })
    .withMessage('Response ID must be a positive integer'),
  
  body('response_value')
    .optional()
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks cannot exceed 1000 characters'),
  
  handleValidationErrors
];

/**
 * Validate response search/filter
 */
const validateResponseSearch = [
  body('inspection_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('checklist_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('response_value')
    .optional()
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('submitted_by')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Submitted by must be a positive integer'),
  
  body('is_overridden')
    .optional()
    .isBoolean()
    .withMessage('Is overridden must be a boolean'),
  
  body('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),
  
  body('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

/**
 * Validate response export
 */
const validateResponseExport = [
  param('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  
  body('include_overridden')
    .optional()
    .isBoolean()
    .withMessage('Include overridden must be a boolean'),
  
  body('include_remarks')
    .optional()
    .isBoolean()
    .withMessage('Include remarks must be a boolean'),
  
  body('include_audit')
    .optional()
    .isBoolean()
    .withMessage('Include audit must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validate response statistics
 */
const validateResponseStatistics = [
  param('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('group_by')
    .optional()
    .isIn(['domain', 'sub_domain', 'user', 'date'])
    .withMessage('Group by must be domain, sub_domain, user, or date'),
  
  body('include_details')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateSingleResponse,
  validateBulkResponses,
  validateResponseOverride,
  validateInspectionIdParam,
  validateResponseIdParam,
  validateResponseUpdate,
  validateResponseSearch,
  validateResponseExport,
  validateResponseStatistics
};
