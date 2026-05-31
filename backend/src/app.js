console.log('=== APP.JS STARTING ===');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const db = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const scoringRoutes = require("./routes/scoring.routes");
const responseRoutes = require("./routes/response.routes");
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const domainRoutes = require("./routes/domain.routes");
const subDomainRoutes = require("./routes/sub_domain.routes");
const userRoutes = require('./routes/user.routes');
const weightageRoutes = require('./routes/weightage.routes');
const weightageManagementRoutes = require('./routes/weightageManagement.routes');
const checklistRoutes = require('./routes/checklist.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const queryRoutes = require('./routes/query.routes');
const mobileRoutes = require('./routes/mobile.routes');
const reviewerRoutes = require('./routes/reviewer.routes');
const managerRoutes = require('./routes/manager.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Request logging - MUST be before other middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Security middleware (temporarily disabled for CORS debugging)
// app.use(helmet());

// CORS configuration driven by environment
// CORS_ORIGIN can be a comma-separated list of allowed origins, patterns with '*' wildcards, or '*' to allow all
const rawOrigins = process.env.CORS_ORIGIN || '';
const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isOriginAllowed = (origin) => {
  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes('*')) {
      const regex = new RegExp('^' + escapeRegex(allowedOrigin).replace(/\\\*/g, '.*') + '$');
      return regex.test(origin);
    }

    return allowedOrigin.toLowerCase() === origin.toLowerCase();
  });
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.length === 0) {
      // No origins configured => allow all
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: (process.env.CORS_CREDENTIALS || 'false').toLowerCase() === 'true'
}));

// Test endpoint - placed early to ensure it works
app.get('/test', (req, res) => {
  console.log('/test endpoint called');
  res.json({ success: true, message: 'Test endpoint works' });
});

// Rate limiting (temporarily disabled for CORS debugging)
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.',
//     code: 'RATE_LIMIT_EXCEEDED'
//   },
//   standardHeaders: true,
//   legacyHeaders: false
// });
// app.use(limiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    }
  }
}));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve uploaded files statically
// Serve uploaded files statically
const uploadsPath = path.join(__dirname, '../uploads');

console.log('UPLOADS PATH:', uploadsPath);

app.use('/uploads', express.static(uploadsPath));

// Test endpoint for queries - mount BEFORE other routes
app.get('/api/test-queries', async (req, res) => {
  try {
    console.log('Test-queries endpoint called');
    const queries = await db.execute('SELECT id, question_text as text, created_at FROM queries ORDER BY id ASC LIMIT 10');
    console.log('Test-queries success, rows:', queries.length);
    res.json({ success: true, data: queries, count: queries.length });
  } catch (error) {
    console.error('Test-queries error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Routes - Order matters! More specific routes should come before generic ones
app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/sub_domains", subDomainRoutes);
app.use("/api/weightage", weightageRoutes);
app.use("/api/weightage-management", weightageManagementRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/mobile", mobileRoutes);
app.use("/api/reviewer", reviewerRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api", responseRoutes);
app.use("/api", scoringRoutes);

// Log registered routes for debugging
logger.info('Mobile routes registered at /api/mobile');
logger.info('Reviewer routes registered at /api/reviewer');
logger.info('Manager routes registered at /api/manager');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.testConnection();
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: dbHealth,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'QRating Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      users: '/api/users (coming soon)',
      projects: '/api/projects (coming soon)',
      checklist: '/api/checklist (coming soon)',
      responses: '/api/responses (coming soon)',
      overrides: '/api/overrides (coming soon)',
      queries: '/api/queries'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'QRating Backend Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

// DEBUG: Catch-all route to see what URLs are being requested
app.use((req, res, next) => {
  console.log(`[CATCH-ALL] ${req.method} ${req.url} - No route matched`);
  next();
});

app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection (required)
    try {
      await db.initialize();
      if (process.env.DB_AUTO_MIGRATE === 'true' || process.env.NODE_ENV === 'development') {
        await db.ensureSchema();
      }
      logger.info('Database initialized successfully');
    } catch (dbError) {
      logger.error('Database connection failed - server cannot start', { error: dbError.message });
      console.error('ERROR: Database connection failed. Server cannot start without database.');
      console.error('Please check your database configuration in .env file');
      process.exit(1);
    }

    // Start server (bind to HOST from env if provided)
    app.listen(PORT, HOST, () => {
      logger.info(`Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      });
      
      console.log(`
========================================
QRating Backend Server Started Successfully
========================================
Port: ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
Database: ${process.env.DB_NAME || 'qrating'} (required)
    Health Check: http://${HOST}:${PORT}/health
    API Info: http://${HOST}:${PORT}/api
========================================
      `);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
