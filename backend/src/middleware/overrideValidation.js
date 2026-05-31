const { body, param } = require('express-validator');
const { ValidationError } = require('./errorHandler');

// Handle validation results
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

// Override creation validation
const validateOverrideCreation = [
  body('responseId')
    .isInt({ min: 1 })
    .withMessage('Response ID must be a positive integer'),
  
  body('overriddenValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Overridden value must be YES, NO, or NA'),
  
  body('overrideReason')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Override reason must be between 5 and 1000 characters')
    .matches(/^[a-zA-Z0-9\s.,!?-]+$/)
    .withMessage('Override reason contains invalid characters'),
  
  // Custom validation to ensure override reason is meaningful
  body('overrideReason').custom((reason) => {
    if (!reason) {
      throw new Error('Override reason is required');
    }
    
    // Check for common placeholder text
    const placeholders = ['test', 'asdf', '123', 'reason', 'override'];
    const lowerReason = reason.toLowerCase();
    
    if (placeholders.some(placeholder => lowerReason.includes(placeholder))) {
      throw new Error('Override reason must be more descriptive');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

// Override ID parameter validation
const validateOverrideIdParam = [
  param('overrideId')
    .isInt({ min: 1 })
    .withMessage('Override ID must be a positive integer'),
  handleValidationErrors
];

// Response ID parameter validation
const validateResponseIdParam = [
  param('responseId')
    .isInt({ min: 1 })
    .withMessage('Response ID must be a positive integer'),
  handleValidationErrors
];

// Inspection ID parameter validation
const validateInspectionIdParam = [
  param('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  handleValidationErrors
];

// Bulk override validation (for future use)
const validateBulkOverrides = [
  body('overrides')
    .isArray({ min: 1 })
    .withMessage('Overrides must be a non-empty array'),
  
  body('overrides.*.responseId')
    .isInt({ min: 1 })
    .withMessage('Response ID must be a positive integer'),
  
  body('overrides.*.overriddenValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Overridden value must be YES, NO, or NA'),
  
  body('overrides.*.overrideReason')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Override reason must be between 5 and 1000 characters'),
  
  // Custom validation for array items
  body('overrides').custom((overrides) => {
    if (!Array.isArray(overrides)) {
      throw new Error('Overrides must be an array');
    }
    
    // Check for duplicate response IDs
    const responseIds = overrides.map(o => o.responseId);
    const uniqueResponseIds = new Set(responseIds);
    
    if (responseIds.length !== uniqueResponseIds.size) {
      throw new Error('Duplicate response IDs found in overrides');
    }
    
    // Validate each override has proper reason
    for (let i = 0; i < overrides.length; i++) {
      const override = overrides[i];
      
      if (!override.overrideReason || override.overrideReason.trim().length < 5) {
        throw new Error(`Override at index ${i + 1} has insufficient reason`);
      }
    }
    
    return true;
  }),
  
  handleValidationErrors
];

// Override search/filter validation
const validateOverrideSearch = [
  body('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  body('overriddenBy')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Overridden by must be a positive integer'),
  
  body('overriddenFromDate')
    .optional()
    .isISO8601()
    .withMessage('Overridden from date must be a valid ISO 8601 date'),
  
  body('overriddenToDate')
    .optional()
    .isISO8601()
    .withMessage('Overridden to date must be a valid ISO 8601 date'),
  
  body('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  body('inspectionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  // Custom validation for date range
  body().custom((value) => {
    const { overriddenFromDate, overriddenToDate } = value;
    
    if (overriddenFromDate && overriddenToDate) {
      const from = new Date(overriddenFromDate);
      const to = new Date(overriddenToDate);
      
      if (from > to) {
        throw new Error('From date cannot be after to date');
      }
    }
    
    return true;
  }),
  
  handleValidationErrors
];

// Override update validation (for future use)
const validateOverrideUpdate = [
  param('overrideId')
    .isInt({ min: 1 })
    .withMessage('Override ID must be a positive integer'),
  
  body('overriddenValue')
    .optional()
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Overridden value must be YES, NO, or NA'),
  
  body('overrideReason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Override reason must be between 5 and 1000 characters'),
  
  handleValidationErrors
];

// Override approval validation (for future workflow)
const validateOverrideApproval = [
  param('overrideId')
    .isInt({ min: 1 })
    .withMessage('Override ID must be a positive integer'),
  
  body('approved')
    .isBoolean()
    .withMessage('Approved must be a boolean'),
  
  body('approvalNotes')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Approval notes must be between 5 and 500 characters'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateOverrideCreation,
  validateBulkOverrides,
  validateOverrideIdParam,
  validateResponseIdParam,
  validateInspectionIdParam,
  validateOverrideSearch,
  validateOverrideUpdate,
  validateOverrideApproval
};
