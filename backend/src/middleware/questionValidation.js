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

// Question creation validation
const validateQuestionCreation = [
  body('questionText')
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Question text must be between 5 and 2000 characters'),
  
  body('questionType')
    .isIn(['PRIMARY', 'SECONDARY'])
    .withMessage('Question type must be PRIMARY or SECONDARY'),
  
  body('parentQuestionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent question ID must be a positive integer'),
  
  body('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  body('domainId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Domain ID must be a positive integer'),
  
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  
  body('options.*.optionText')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Option text must be between 1 and 500 characters'),
  
  body('options.*.optionValue')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Option value must be between 1 and 100 characters'),
  
  body('options.*.displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Option display order must be a non-negative integer'),
  
  body('options.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('Option is correct must be a boolean'),
  
  // Custom validation for question hierarchy
  body().custom((value) => {
    const { questionType, parentQuestionId, projectId, domainId } = value;

    // Primary queries should not have parent
    if (questionType === 'PRIMARY' && parentQuestionId) {
      throw new Error('Primary queries cannot have a parent query');
    }

    // Secondary queries must have parent
    if (questionType === 'SECONDARY' && !parentQuestionId) {
      throw new Error('Secondary queries must have a parent query');
    }

    // Queries should belong to either project OR domain, not both
    if (projectId && domainId) {
      throw new Error('Query can belong to either project OR domain, not both');
    }
    
    return true;
  }),
  
  // Custom validation for options
  body().custom((value) => {
    const { options } = value;
    
    if (options && Array.isArray(options)) {
      // Check for duplicate option values
      const optionValues = options.map(o => o.optionValue);
      const uniqueOptionValues = new Set(optionValues);
      
      if (optionValues.length !== uniqueOptionValues.size) {
        throw new Error('Duplicate option values found');
      }
      
      // Check display order consistency
      const displayOrders = options.map(o => o.displayOrder || 0);
      const uniqueDisplayOrders = new Set(displayOrders);
      
      if (displayOrders.length !== uniqueDisplayOrders.size) {
        throw new Error('Duplicate display orders found in options');
      }
    }
    
    return true;
  }),
  
  handleValidationErrors
];

// Question update validation
const validateQuestionUpdate = [
  param('questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID must be a positive integer'),
  
  body('questionText')
    .optional()
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Question text must be between 5 and 2000 characters'),
  
  body('questionType')
    .optional()
    .isIn(['PRIMARY', 'SECONDARY'])
    .withMessage('Question type must be PRIMARY or SECONDARY'),
  
  body('parentQuestionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent question ID must be a positive integer'),
  
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
  
  handleValidationErrors
];

// Question ID parameter validation
const validateQuestionIdParam = [
  param('questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID must be a positive integer'),
  handleValidationErrors
];

// Project ID parameter validation
const validateProjectIdParam = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  handleValidationErrors
];

// Domain ID parameter validation
const validateDomainIdParam = [
  param('domainId')
    .isInt({ min: 1 })
    .withMessage('Domain ID must be a positive integer'),
  handleValidationErrors
];

// Question response validation
const validateQuestionResponse = [
  body('questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID must be a positive integer'),
  
  body('responseValue')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Response value must be between 1 and 1000 characters'),
  
  body('optionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Option ID must be a positive integer'),
  
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

// Bulk question response validation
const validateBulkQuestionResponses = [
  body('responses')
    .isArray({ min: 1 })
    .withMessage('Responses array is required and cannot be empty'),
  
  body('responses.*.questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID must be a positive integer'),
  
  body('responses.*.responseValue')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Response value must be between 1 and 1000 characters'),
  
  body('responses.*.optionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Option ID must be a positive integer'),
  
  body('responses.*.notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  // Custom validation for array items
  body('responses').custom((responses) => {
    if (!Array.isArray(responses)) {
      throw new Error('Responses must be an array');
    }
    
    // Check for duplicate question IDs
    const questionIds = responses.map(r => r.questionId);
    const uniqueQuestionIds = new Set(questionIds);
    
    if (questionIds.length !== uniqueQuestionIds.size) {
      throw new Error('Duplicate question IDs found in responses');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

// Query search/filter validation
const validateQuerySearch = [
  body('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  body('questionType')
    .optional()
    .isIn(['PRIMARY', 'SECONDARY'])
    .withMessage('Question type must be PRIMARY or SECONDARY'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
  
  body('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  body('domainId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Domain ID must be a positive integer'),
  
  body('parentQuestionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent question ID must be a positive integer'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateQuestionCreation,
  validateQuestionUpdate,
  validateQuestionIdParam,
  validateProjectIdParam,
  validateDomainIdParam,
  validateQuestionResponse,
  validateBulkQuestionResponses,
  validateQuerySearch
};
