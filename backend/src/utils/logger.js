const winston = require('winston');

// Simple logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Simple helper methods
logger.logError = (error, req = null) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  if (req) {
    errorData.request = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    };
  }
  
  logger.error('Application Error', errorData);
};

logger.logAuth = (message, userId, additionalData = {}) => {
  logger.info(`Auth: ${message}`, {
    userId,
    timestamp: new Date().toISOString(),
    ...additionalData
  });
};

logger.logAPI = (method, url, statusCode, responseTime, userId = null) => {
  logger.info(`API: ${method} ${url} - ${statusCode}`, {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    userId,
    timestamp: new Date().toISOString()
  });
};

logger.logDB = (query, params, executionTime) => {
  logger.debug('Database Query', {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    paramsCount: params ? params.length : 0,
    executionTime: `${executionTime}ms`,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
