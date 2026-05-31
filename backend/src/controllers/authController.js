const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../utils/logger');
const { generateToken } = require('../middleware/auth');

// Login controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await db.executeOne(
      `
        SELECT id, name, email, password_hash, role, is_global_admin, is_active
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Logout controller
exports.logout = async (req, res) => {
  try {
    // In a real app, you might want to invalidate the token
    // For now, just return success
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = req.user || null;
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get current user error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const user = req.user || { id: 1, email: 'admin@qrating.com', role: 'admin' };
    const token = generateToken(user);
    
    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    logger.error('Refresh token error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
