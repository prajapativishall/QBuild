const { validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Handle validation results from express-validator
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
 * Validate pagination parameters
 */
const validatePagination = [
  require('express-validator').query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  require('express-validator').query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

/**
 * Validate search parameters
 */
const validateSearch = [
  require('express-validator').query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  require('express-validator').query('searchBy')
    .optional()
    .isIn(['name', 'description', 'all'])
    .withMessage('Search by must be name, description, or all'),
  
  handleValidationErrors
];

/**
 * Validate ID parameter
 */
const validateIdParam = (paramName = 'id') => [
  require('express-validator').param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a positive integer`),
  
  handleValidationErrors
];

/**
 * Validate date parameter
 */
const validateDateParam = [
  require('express-validator').param('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

/**
 * Validate sort parameters
 */
const validateSort = [
  require('express-validator').query('sortBy')
    .optional()
    .isIn(['name', 'created_at', 'updated_at', 'id'])
    .withMessage('Sort by must be name, created_at, updated_at, or id'),
  
  require('express-validator').query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  handleValidationErrors
];

/**
 * Validate filter parameters
 */
const validateFilters = [
  require('express-validator').query('status')
    .optional()
    .isIn(['active', 'inactive', 'all'])
    .withMessage('Status must be active, inactive, or all'),
  
  require('express-validator').query('type')
    .optional()
    .isAlpha()
    .withMessage('Type must contain only letters'),
  
  handleValidationErrors
];

/**
 * Validate email parameter
 */
const validateEmail = [
  require('express-validator').body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  handleValidationErrors
];

/**
 * Validate password parameter
 */
const validatePassword = [
  require('express-validator').body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  handleValidationErrors
];

/**
 * Validate name parameter
 */
const validateName = [
  require('express-validator').body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  handleValidationErrors
];

/**
 * Validate description parameter
 */
const validateDescription = [
  require('express-validator').body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  handleValidationErrors
];

/**
 * Validate boolean parameter
 */
const validateBoolean = (paramName, location = 'body') => {
  const validator = location === 'query' 
    ? require('express-validator').query(paramName)
    : require('express-validator').body(paramName);
  
  return [
    validator
      .optional()
      .isBoolean()
      .withMessage(`${paramName} must be a boolean`),
    
    handleValidationErrors
  ];
};

/**
 * Validate array parameter
 */
const validateArray = (paramName, min = 0, max = 100) => [
  require('express-validator').body(paramName)
    .optional()
    .isArray({ min, max })
    .withMessage(`${paramName} must be an array with ${min}-${max} items`),
  
  handleValidationErrors
];

/**
 * Validate integer parameter
 */
const validateInteger = (paramName, min = 1, max = 2147483647, location = 'body') => {
  const validator = location === 'query' 
    ? require('express-validator').query(paramName)
    : location === 'param'
    ? require('express-validator').param(paramName)
    : require('express-validator').body(paramName);
  
  return [
    validator
      .isInt({ min, max })
      .withMessage(`${paramName} must be an integer between ${min} and ${max}`),
    
    handleValidationErrors
  ];
};

/**
 * Validate string parameter
 */
const validateString = (paramName, min = 1, max = 255, location = 'body') => {
  const validator = location === 'query' 
    ? require('express-validator').query(paramName)
    : location === 'param'
    ? require('express-validator').param(paramName)
    : require('express-validator').body(paramName);
  
  return [
    validator
      .trim()
      .isLength({ min, max })
      .withMessage(`${paramName} must be between ${min} and ${max} characters`),
    
    handleValidationErrors
  ];
};

/**
 * Validate enum parameter
 */
const validateEnum = (paramName, allowedValues, location = 'body') => {
  const validator = location === 'query' 
    ? require('express-validator').query(paramName)
    : require('express-validator').body(paramName);
  
  return [
    validator
      .optional()
      .isIn(allowedValues)
      .withMessage(`${paramName} must be one of: ${allowedValues.join(', ')}`),
    
    handleValidationErrors
  ];
};

module.exports = {
  handleValidationErrors,
  validatePagination,
  validateSearch,
  validateIdParam,
  validateDateParam,
  validateSort,
  validateFilters,
  validateEmail,
  validatePassword,
  validateName,
  validateDescription,
  validateBoolean,
  validateArray,
  validateInteger,
  validateString,
  validateEnum,
  
  // Legacy exports for backward compatibility
  param: require('express-validator').param,
  body: require('express-validator').body,
  query: require('express-validator').query
};
