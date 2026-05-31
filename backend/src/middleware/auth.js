const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

/**
 * Extract JWT token from request
 * @param {Object} req - Express request object
 * @returns {string|null} - JWT token or null
 */
const extractToken = (req) => {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Check query parameter
  if (!token && req.query.token) {
    token = req.query.token;
  }

  return token;
};

/**
 * Authenticate user using JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Access token is required');
    }

    // Development bypass for demo token
    logger.info('Checking auth', { env: process.env.NODE_ENV, tokenPresent: !!token, tokenValue: token });
    
    if (process.env.NODE_ENV === 'development' && token.startsWith('demo-jwt-token')) {
      req.user = {
        id: 1,
        name: 'Admin User',
        email: 'admin@qrating.com',
        role: 'admin',
        isGlobalAdmin: true,
        permissions: [],
        is_active: true,
        is_global_admin: true
      };
      req.token = token;
      logger.info('Development auth bypass - demo user accepted');
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    // Get user from database
    const user = await db.executeOne(
      `
        SELECT id, name, email, role, is_global_admin, is_active, created_at, updated_at
        FROM users
        WHERE id = ? AND is_active = TRUE
        LIMIT 1
      `,
      [decoded.userId]
    );

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    user.permissions = [];
    user.isGlobalAdmin = !!user.is_global_admin || user.role === 'admin';

    // Attach user to request
    req.user = user;
    req.token = token;

    logger.debug('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip
    });

    next();

  } catch (error) {
    logger.error('Authentication failed', {
      error: error.message,
      token: extractToken(req) ? 'present' : 'missing',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token, continue without user
      req.user = null;
      return next();
    }

    // Token present, authenticate user
    return authenticate(req, res, next);

  } catch (error) {
    // If authentication fails, continue without user
    req.user = null;
    next();
  }
};

/**
 * Check if user has specific role
 * @param {string} role - Required role
 * @returns {Function} - Middleware function
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role !== role && !req.user.isGlobalAdmin) {
      return next(new ForbiddenError(`User role '${req.user.role}' is not authorized`));
    }

    next();
  };
};

/**
 * Check if user has specific permission
 * @param {string} permission - Required permission
 * @returns {Function} - Middleware function
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!req.user.isGlobalAdmin && !req.user.permissions.includes(permission)) {
      return next(new ForbiddenError(`User does not have '${permission}' permission`));
    }

    next();
  };
};

/**
 * Check if user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isGlobalAdmin) {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - JWT token
 */
const generateToken = (user, expiresIn = '24h') => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'fallback-secret-key',
    {
      expiresIn,
      issuer: 'qrating-api',
      audience: 'qrating-client'
    }
  );
};

/**
 * Refresh JWT token
 * @param {Object} user - User object
 * @returns {string} - New JWT token
 */
const refreshToken = (user) => {
  return generateToken(user, '7d');
};

/**
 * Verify JWT token without database lookup
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.optionalAuth = optionalAuth;
module.exports.requireRole = requireRole;
module.exports.requirePermission = requirePermission;
module.exports.requireAdmin = requireAdmin;
module.exports.generateToken = generateToken;
module.exports.refreshToken = refreshToken;
module.exports.verifyToken = verifyToken;
module.exports.extractToken = extractToken;
