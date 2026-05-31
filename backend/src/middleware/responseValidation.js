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

// Single response validation
const validateSingleResponse = [
  body('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('checklistItemId')
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('responseValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('submittedFrom')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Submitted from cannot exceed 50 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Submitted from can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  handleValidationErrors
];

// Bulk response validation
const validateBulkResponses = [
  body('responses')
    .isArray({ min: 1 })
    .withMessage('Responses must be a non-empty array'),
  
  body('responses.*.inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('responses.*.checklistItemId')
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('responses.*.responseValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('responses.*.notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('responses.*.submittedFrom')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Submitted from cannot exceed 50 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Submitted from can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  // Custom validation for array items
  body('responses').custom((responses) => {
    if (!Array.isArray(responses)) {
      throw new Error('Responses must be an array');
    }
    
    // Check for duplicate inspection-item combinations
    const combinations = responses.map(r => `${r.inspectionId}-${r.checklistItemId}`);
    const uniqueCombinations = new Set(combinations);
    
    if (combinations.length !== uniqueCombinations.size) {
      throw new Error('Duplicate inspection-item combinations found in responses');
    }
    
    return true;
  }),
  
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

// Mobile-specific validation (for mobile app responses)
const validateMobileResponse = [
  body('inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('checklistItemId')
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('responseValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),
  
  body('deviceInfo.platform')
    .optional()
    .isIn(['ios', 'android', 'web'])
    .withMessage('Platform must be ios, android, or web'),
  
  body('deviceInfo.appVersion')
    .optional()
    .matches(/^\d+\.\d+\.\d+$/)
    .withMessage('App version must be in format x.y.z'),
  
  body('deviceInfo.deviceId')
    .optional()
    .isLength({ min: 10, max: 100 })
    .withMessage('Device ID must be between 10 and 100 characters'),
  
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('location.accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Location accuracy must be a positive number'),
  
  body('photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array'),
  
  body('photos.*.url')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  
  body('photos.*.caption')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Photo caption cannot exceed 200 characters'),
  
  body('photos.*.takenAt')
    .optional()
    .isISO8601()
    .withMessage('Photo timestamp must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

// Bulk mobile response validation
const validateBulkMobileResponses = [
  body('responses')
    .isArray({ min: 1 })
    .withMessage('Responses must be a non-empty array'),
  
  body('responses.*.inspectionId')
    .isInt({ min: 1 })
    .withMessage('Inspection ID must be a positive integer'),
  
  body('responses.*.checklistItemId')
    .isInt({ min: 1 })
    .withMessage('Checklist item ID must be a positive integer'),
  
  body('responses.*.responseValue')
    .isIn(['YES', 'NO', 'NA'])
    .withMessage('Response value must be YES, NO, or NA'),
  
  body('responses.*.deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),
  
  body('responses.*.location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  
  body('responses.*.photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array'),
  
  // Apply same custom validations as bulk responses
  body('responses').custom((responses) => {
    if (!Array.isArray(responses)) {
      throw new Error('Responses must be an array');
    }
    
    const combinations = responses.map(r => `${r.inspectionId}-${r.checklistItemId}`);
    const uniqueCombinations = new Set(combinations);
    
    if (combinations.length !== uniqueCombinations.size) {
      throw new Error('Duplicate inspection-item combinations found in responses');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateSingleResponse,
  validateBulkResponses,
  validateResponseIdParam,
  validateInspectionIdParam,
  validateMobileResponse,
  validateBulkMobileResponses
};
