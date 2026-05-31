const { body, param, validationResult } = require('express-validator');
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

// Domain validation
const validateDomainCreate = [
  body('domainName')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Domain name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Domain name can only contain letters, numbers, and spaces'),
  
  body('domainOrder')
    .isInt({ min: 1 })
    .withMessage('Domain order must be a positive integer'),
  
  body('weightage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Weightage must be a number between 0 and 100'),
  
  handleValidationErrors
];

// Checklist item validation
const validateChecklistItemCreate = [
  body('domainId')
    .isInt({ min: 1 })
    .withMessage('Domain ID must be a positive integer'),
  
  body('itemDescription')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Item description must be between 5 and 1000 characters'),
  
  body('maxScore')
    .isFloat({ min: 0 })
    .withMessage('Max score must be a positive number'),
  
  body('yesScore')
    .isFloat({ min: 0 })
    .withMessage('Yes score must be a positive number'),
  
  body('noScore')
    .isFloat({ min: 0 })
    .withMessage('No score must be a positive number'),
  
  body('naScore')
    .isFloat({ min: 0 })
    .withMessage('NA score must be a positive number'),
  
  body('itemOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Item order must be a non-negative integer'),
  
  handleValidationErrors
];

// ID parameter validation
const validateDomainIdParam = [
  param('domain_id')
    .isInt({ min: 1 })
    .withMessage('Domain ID must be a positive integer'),
  handleValidationErrors
];

const validateItemIdParam = [
  param('item_id')
    .isInt({ min: 1 })
    .withMessage('Item ID must be a positive integer'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateDomainCreate,
  validateChecklistItemCreate,
  validateDomainIdParam,
  validateItemIdParam
};
