require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * MySQL Connection Pool using mysql2
 * Provides connection pooling, error handling, and connection testing
 */

class DatabaseConnection {
  constructor() {
    // Set Node.js to Asia/Kolkata timezone for consistent timestamp handling
    if (!process.env.TZ) {
      process.env.TZ = 'Asia/Kolkata';
    }
    this.pool = null;
 console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('TZ:', process.env.TZ);
    this.config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      timezone: '+05:30',
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
      queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
      connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 60000,
      charset: 'utf8mb4',
      multipleStatements: false,
      namedPlaceholders: false,
      typeCast: function (field, next) {
        if (field.type === 'TINY' && field.length === 1) {
          return (field.string() === '1'); // Convert TINY(1) to boolean
        }
        if (field.type === 'DATE') {
          return field.string(); // Return DATE as string
        }
        if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
          return field.string(); // Return datetime as string
        }
        return next();
      },
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      // Connection retry settings
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  /**
   * Initialize database connection pool
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      logger.info('Initializing MySQL connection pool...', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit
      });

      this.pool = mysql.createPool(this.config);

      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      logger.info('Database connection pool initialized successfully', {
        host: this.config.host,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit,
        threadId: connection.threadId
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize database connection pool', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        host: this.config.host,
        database: this.config.database
      });
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Get a connection from the pool
   * @returns {Promise<Connection>} - MySQL connection
   */
  async getConnection() {
    try {
      if (!this.pool) {
        throw new Error('Database pool not initialized. Call initialize() first.');
      }

      const connection = await this.pool.getConnection();
      
      // mysql2/promise pool doesn't expose internal connection arrays
      // Log basic connection info only
      logger.debug('Database connection acquired from pool', {
        threadId: connection.threadId
      });

      return connection;
    } catch (error) {
      logger.error('Failed to get database connection', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      });
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async execute(query, params = []) {
    const startTime = Date.now();
    
    try {
      const connection = await this.getConnection();
      
      try {
        const executeResult = await connection.execute(query, params);
        const executionTime = Date.now() - startTime;
        
        // mysql2/promise returns [rows, fields] for SELECT or [result, fields] for INSERT
        // But sometimes it might return just the result directly
        let result;
        if (Array.isArray(executeResult)) {
          result = executeResult[0]; // First element is rows/result
        } else {
          result = executeResult; // Direct return
        }
        
        // Handle both SELECT (returns array) and INSERT/UPDATE/DELETE (returns ResultSetHeader)
        const isSelect = query.trim().toLowerCase().startsWith('select');
        const affectedRows = isSelect ? (result?.length || 0) : (result?.affectedRows || 0);
        
        logger.debug('Query executed successfully', {
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
          paramsCount: params.length,
          executionTime: `${executionTime}ms`,
          affectedRows: affectedRows,
          isSelect: isSelect
        });
        
        connection.release();
        
        return result;
      } catch (queryError) {
        connection.release();
        throw queryError;
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Database execute error', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        paramsCount: params.length,
        executionTime: `${executionTime}ms`
      });
      
      throw error;
    }
  }

  /**
   * Execute a query and return the first result
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>} - First row or null
   */
  async executeOne(query, params = []) {
    const rows = await this.execute(query, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a query and return affected row count
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Result with affectedRows and insertId
   */
  async executeWithResult(query, params = []) {
    const startTime = Date.now();
    
    try {
      const connection = await this.getConnection();
      
      try {
        const [result] = await connection.execute(query, params);
        const executionTime = Date.now() - startTime;
        
        logger.debug('Query executed successfully', {
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
          paramsCount: params.length,
          executionTime: `${executionTime}ms`,
          affectedRows: result.affectedRows,
          insertId: result.insertId
        });
        
        connection.release();
        
        return {
          affectedRows: result.affectedRows || 0,
          insertId: result.insertId || null,
          changedRows: result.changedRows || 0
        };
      } catch (queryError) {
        connection.release();
        throw queryError;
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Database execute error', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        paramsCount: params.length,
        executionTime: `${executionTime}ms`
      });
      
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<any>} - Transaction result
   */
  async transaction(callback) {
    const startTime = Date.now();
    let connection = null;
    
    try {
      connection = await this.getConnection();
      await connection.query('START TRANSACTION');
      
      logger.debug('Transaction started', {
        threadId: connection.threadId
      });
      
      const result = await callback(connection);
      
      await connection.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      
      logger.debug('Transaction committed successfully', {
        threadId: connection.threadId,
        executionTime: `${executionTime}ms`
      });
      
      return result;
    } catch (error) {
      if (connection) {
        try {
          await connection.query('ROLLBACK');
          
          logger.debug('Transaction rolled back', {
            threadId: connection.threadId,
            error: error.message
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', {
            originalError: error.message,
            rollbackError: rollbackError.message,
            threadId: connection.threadId
          });
        } finally {
          connection.release();
        }
      }
      
      const executionTime = Date.now() - startTime;
      
      logger.error('Transaction failed', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        executionTime: `${executionTime}ms`
      });
      
      throw error;
    }
  }

  async ensureSchema() {
    const tableExists = async (tableName) => {
      const row = await this.executeOne(
        `
          SELECT 1 as ok
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
            AND table_name = ?
          LIMIT 1
        `,
        [tableName]
      );
      return !!row;
    };

    const columnExists = async (tableName, columnName) => {
      const row = await this.executeOne(
        `
          SELECT 1 as ok
          FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
          LIMIT 1
        `,
        [tableName, columnName]
      );
      return !!row;
    };

    const indexOnColumnExists = async (tableName, columnName) => {
      const row = await this.executeOne(
        `
          SELECT 1 as ok
          FROM information_schema.statistics
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
          LIMIT 1
        `,
        [tableName, columnName]
      );
      return !!row;
    };

    const fkOnColumnExists = async (tableName, columnName) => {
      const row = await this.executeOne(
        `
          SELECT 1 as ok
          FROM information_schema.key_column_usage
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
            AND referenced_table_name IS NOT NULL
          LIMIT 1
        `,
        [tableName, columnName]
      );
      return !!row;
    };

    const fkByNameExists = async (tableName, constraintName) => {
      const row = await this.executeOne(
        `
          SELECT 1 as ok
          FROM information_schema.table_constraints
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND constraint_name = ?
            AND constraint_type = 'FOREIGN KEY'
          LIMIT 1
        `,
        [tableName, constraintName]
      );
      return !!row;
    };

    const getFkNamesOnColumn = async (tableName, columnName) => {
      const rows = await this.execute(
        `
          SELECT constraint_name
          FROM information_schema.key_column_usage
          WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
            AND referenced_table_name IS NOT NULL
        `,
        [tableName, columnName]
      );
      return rows.map(row => row.constraint_name);
    };

    const ensureColumn = async (tableName, columnName, ddl) => {
      if (await columnExists(tableName, columnName)) return;
      await this.execute(ddl);
    };

    const ensureIndex = async (tableName, columnName, ddl) => {
      if (await indexOnColumnExists(tableName, columnName)) return;
      await this.execute(ddl);
    };

    const ensureFk = async (tableName, columnName, ddl) => {
      if (await fkOnColumnExists(tableName, columnName)) return;
      await this.execute(ddl);
    };

    const dropColumnIfExists = async (tableName, columnName) => {
      if (!(await columnExists(tableName, columnName))) return;
      await this.execute(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
    };

    const dropFksOnColumnIfExists = async (tableName, columnName) => {
      const fkNames = await getFkNamesOnColumn(tableName, columnName);
      for (const fkName of fkNames) {
        await this.execute(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${fkName}`);
      }
    };

    logger.info('Ensuring database schema is up to date...');

    if (await tableExists('users')) {
      await ensureColumn(
        'users',
        'role',
        "ALTER TABLE users ADD COLUMN role ENUM('admin','inspector','viewer','manager') NOT NULL DEFAULT 'viewer' AFTER password_hash"
      );
      await ensureIndex('users', 'role', 'ALTER TABLE users ADD INDEX idx_role (role)');

      // Update role ENUM to include 'reviewer'
      if (await columnExists('users', 'role')) {
        try {
          await this.execute(`
            ALTER TABLE users
            MODIFY COLUMN role ENUM('admin','inspector','viewer','manager','reviewer') NOT NULL DEFAULT 'viewer'
          `);
          logger.info('Updated role ENUM to include reviewer');
        } catch (error) {
          // Column might already have the updated enum, ignore error
          logger.debug('Role ENUM update skipped:', error.message);
        }

        await this.execute(`
          UPDATE users
          SET role =
            CASE
              WHEN is_global_admin = 1 THEN 'admin'
              WHEN email LIKE '%inspector%' THEN 'inspector'
              WHEN email LIKE '%viewer%' THEN 'viewer'
              ELSE role
            END
          WHERE role = 'viewer'
        `);
      }
    }

    if (await tableExists('projects')) {
      await ensureColumn('projects', 'description', 'ALTER TABLE projects ADD COLUMN description TEXT AFTER project_name');
      await ensureColumn(
        'projects',
        'status',
        "ALTER TABLE projects ADD COLUMN status ENUM('active','pending','completed') NOT NULL DEFAULT 'active' AFTER state"
      );
      await ensureColumn('projects', 'start_date', 'ALTER TABLE projects ADD COLUMN start_date DATE AFTER status');
      await ensureColumn('projects', 'end_date', 'ALTER TABLE projects ADD COLUMN end_date DATE AFTER start_date');
      await ensureColumn('projects', 'client_name', 'ALTER TABLE projects ADD COLUMN client_name VARCHAR(255) NULL AFTER end_date');
      await ensureColumn('projects', 'client_designation', 'ALTER TABLE projects ADD COLUMN client_designation VARCHAR(100) NULL AFTER client_name');
      await ensureColumn('projects', 'client_mobile_no', 'ALTER TABLE projects ADD COLUMN client_mobile_no VARCHAR(20) NULL AFTER client_designation');
      await ensureColumn('projects', 'client_email', 'ALTER TABLE projects ADD COLUMN client_email VARCHAR(255) NULL AFTER client_mobile_no');
      await ensureColumn('projects', 'alternate_client_name', 'ALTER TABLE projects ADD COLUMN alternate_client_name VARCHAR(255) NULL AFTER client_email');
      await ensureColumn('projects', 'alternate_designation', 'ALTER TABLE projects ADD COLUMN alternate_designation VARCHAR(100) NULL AFTER alternate_client_name');
      await ensureColumn('projects', 'alternate_email', 'ALTER TABLE projects ADD COLUMN alternate_email VARCHAR(255) NULL AFTER alternate_designation');
      await ensureColumn('projects', 'alternate_mobile_no', 'ALTER TABLE projects ADD COLUMN alternate_mobile_no VARCHAR(20) NULL AFTER alternate_email');
      await ensureColumn('projects', 'current_phase_id', 'ALTER TABLE projects ADD COLUMN current_phase_id INT NULL AFTER alternate_mobile_no');

      await ensureIndex('projects', 'status', 'ALTER TABLE projects ADD INDEX idx_status (status)');
      await ensureIndex('projects', 'current_phase_id', 'ALTER TABLE projects ADD INDEX idx_current_phase_id (current_phase_id)');
    }

    if (await tableExists('inspections')) {
      await ensureColumn(
        'inspections',
        'approval_status',
        "ALTER TABLE inspections ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER status"
      );
      await ensureColumn('inspections', 'reviewer_id', 'ALTER TABLE inspections ADD COLUMN reviewer_id INT NULL AFTER approval_status');
      await ensureColumn('inspections', 'reviewed_at', 'ALTER TABLE inspections ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewer_id');
      await ensureColumn('inspections', 'reviewer_notes', 'ALTER TABLE inspections ADD COLUMN reviewer_notes TEXT NULL AFTER reviewed_at');
      await ensureColumn('inspections', 'phase', 'ALTER TABLE inspections ADD COLUMN phase INT NOT NULL DEFAULT 1 AFTER project_id');
      await ensureColumn('inspections', 'manager_approval_status', "ALTER TABLE inspections ADD COLUMN manager_approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER approval_status");
      await ensureColumn('inspections', 'manager_id', 'ALTER TABLE inspections ADD COLUMN manager_id INT NULL AFTER manager_approval_status');
      await ensureColumn('inspections', 'manager_reviewed_at', 'ALTER TABLE inspections ADD COLUMN manager_reviewed_at TIMESTAMP NULL AFTER manager_id');
      await ensureColumn('inspections', 'manager_notes', 'ALTER TABLE inspections ADD COLUMN manager_notes TEXT NULL AFTER manager_reviewed_at');

      await ensureIndex('inspections', 'approval_status', 'ALTER TABLE inspections ADD INDEX idx_approval_status (approval_status)');
      await ensureIndex('inspections', 'reviewer_id', 'ALTER TABLE inspections ADD INDEX idx_reviewer_id (reviewer_id)');
      await ensureIndex('inspections', 'phase', 'ALTER TABLE inspections ADD INDEX idx_phase (phase)');
      await ensureIndex('inspections', 'manager_approval_status', 'ALTER TABLE inspections ADD INDEX idx_manager_approval_status (manager_approval_status)');
      await ensureIndex('inspections', 'manager_id', 'ALTER TABLE inspections ADD INDEX idx_manager_id (manager_id)');

      await ensureFk(
        'inspections',
        'reviewer_id',
        'ALTER TABLE inspections ADD CONSTRAINT fk_inspections_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL'
      );
      await ensureFk(
        'inspections',
        'manager_id',
        'ALTER TABLE inspections ADD CONSTRAINT fk_inspections_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL'
      );
    }

    // Create phases table if it doesn't exist
    if (!(await tableExists('phases'))) {
      await this.execute(`
        CREATE TABLE phases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          phase_number INT NOT NULL,
          description TEXT NULL,
          status ENUM('pending', 'in_progress', 'submitted', 'rejected', 'approved') NOT NULL DEFAULT 'pending',
          start_date DATE NULL,
          end_date DATE NULL,
          engineers JSON NULL,
          inspector_id INT NULL,
          reviewer_id INT NULL,
          viewer_id INT NULL,
          inspection_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE SET NULL,
          FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE KEY unique_project_phase (project_id, phase_number),
          INDEX idx_project_id (project_id),
          INDEX idx_phase_number (phase_number),
          INDEX idx_status (status),
          INDEX idx_inspector_id (inspector_id)
        )
      `);
      logger.info('Created phases table');
    }

    // Create project_queries table if it doesn't exist
    if (!(await tableExists('project_queries'))) {
      await this.execute(`
        CREATE TABLE project_queries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          phase_number INT NOT NULL,
          query_id INT NOT NULL,
          domain_id INT NOT NULL,
          sub_domain_id INT NOT NULL,
          query_type ENUM('primary', 'secondary', 'optional') NOT NULL DEFAULT 'primary',
          parent_id INT NULL,
          weightage DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
          FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
          FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
          UNIQUE KEY unique_project_phase_query (project_id, phase_number, query_id),
          INDEX idx_project_id (project_id),
          INDEX idx_phase_number (phase_number),
          INDEX idx_query_id (query_id),
          INDEX idx_domain_id (domain_id),
          INDEX idx_sub_domain_id (sub_domain_id),
          INDEX idx_query_type (query_type),
          INDEX idx_parent_id (parent_id)
        )
      `);
      logger.info('Created project_queries table');
    }

    if (await tableExists('project_queries')) {
      await ensureColumn('project_queries', 'query_type', `ALTER TABLE project_queries ADD COLUMN query_type ENUM('primary', 'secondary', 'optional') NOT NULL DEFAULT 'primary' AFTER sub_domain_id`);
      await ensureColumn('project_queries', 'parent_id', 'ALTER TABLE project_queries ADD COLUMN parent_id INT NULL AFTER query_type');
      await ensureIndex('project_queries', 'query_type', 'ALTER TABLE project_queries ADD INDEX idx_query_type (query_type)');
      await ensureIndex('project_queries', 'parent_id', 'ALTER TABLE project_queries ADD INDEX idx_parent_id (parent_id)');
    }

    // Create phase_domains table if it doesn't exist
    if (!(await tableExists('phase_domains'))) {
      await this.execute(`
        CREATE TABLE phase_domains (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          phase_number INT NOT NULL,
          domain_id INT NOT NULL,
          weightage DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
          UNIQUE KEY unique_project_phase_domain (project_id, phase_number, domain_id),
          INDEX idx_project_id (project_id),
          INDEX idx_phase_number (phase_number),
          INDEX idx_domain_id (domain_id)
        )
      `);
      logger.info('Created phase_domains table');
    }

    // Create phase_domain_sub_domains table if it doesn't exist
    if (!(await tableExists('phase_domain_sub_domains'))) {
      await this.execute(`
        CREATE TABLE phase_domain_sub_domains (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          phase_number INT NOT NULL,
          domain_id INT NOT NULL,
          sub_domain_id INT NOT NULL,
          weightage DECIMAL(5,2) DEFAULT 0,
          is_manual TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
          FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
          UNIQUE KEY unique_project_phase_domain_sub (project_id, phase_number, domain_id, sub_domain_id),
          INDEX idx_project_id (project_id),
          INDEX idx_phase_number (phase_number),
          INDEX idx_domain_id (domain_id),
          INDEX idx_sub_domain_id (sub_domain_id)
        )
      `);
      logger.info('Created phase_domain_sub_domains table');
    }

    // Create phase_queries table if it doesn't exist
    if (!(await tableExists('phase_queries'))) {
      await this.execute(`
        CREATE TABLE phase_queries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          phase_number INT NOT NULL,
          project_query_id INT NOT NULL,
          weightage DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (project_query_id) REFERENCES project_queries(id) ON DELETE CASCADE,
          UNIQUE KEY unique_project_phase_query (project_id, phase_number, project_query_id),
          INDEX idx_project_id (project_id),
          INDEX idx_phase_number (phase_number),
          INDEX idx_project_query_id (project_query_id)
        )
      `);
      logger.info('Created phase_queries table');
    }

    if (await tableExists('domains')) {
      await ensureColumn('domains', 'description', 'ALTER TABLE domains ADD COLUMN description TEXT AFTER domain_name');
      await ensureColumn('domains', 'is_active', 'ALTER TABLE domains ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER description');
      await ensureColumn('domains', 'weightage', 'ALTER TABLE domains ADD COLUMN weightage DECIMAL(5,2) DEFAULT 0.00 AFTER is_active');
      await ensureIndex('domains', 'is_active', 'ALTER TABLE domains ADD INDEX idx_domain_active (is_active)');
    }

    await this.execute(`
      CREATE TABLE IF NOT EXISTS sub_domains (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sub_domain_name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sub_domain_active (is_active),
        INDEX idx_sub_domain_name (sub_domain_name)
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS domain_sub_domains (
        id INT AUTO_INCREMENT PRIMARY KEY,
        domain_id INT NOT NULL,
        sub_domain_id INT NOT NULL,
        weightage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
        FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
        UNIQUE KEY unique_domain_sub_domain (domain_id, sub_domain_id),
        INDEX idx_domain_id (domain_id),
        INDEX idx_sub_domain_id (sub_domain_id)
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS inspection_configurations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id INT NOT NULL,
        inspector_id INT NULL,
        reviewer_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_inspection_id (inspection_id),
        INDEX idx_inspector_id (inspector_id),
        INDEX idx_reviewer_id (reviewer_id)
      )
    `);

    // Create responses table if not exists
    // IMPORTANT: sub_domain_id and domain_id columns are needed because the same query_id
    // can be used in different domains with the same sub_domain. Without domain_id in the
    // unique key, UPSERT queries would overwrite one domain's response with another's.
    await this.execute(`
      CREATE TABLE IF NOT EXISTS responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id INT NOT NULL,
        query_id INT NOT NULL,
        sub_domain_id INT NULL,
        domain_id INT NULL,
        response VARCHAR(255) NOT NULL,
        nc_type VARCHAR(50), -- Non-Conformance type: Critical, Major, Minor, OFI
        inspector_comment TEXT, -- Inspector comment/observation
        additional_remarks TEXT, -- Additional remarks/special instructions
        photos JSON, -- Site photos array of URLs/paths
        comments TEXT,
        submitted_by INT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
        FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_inspection_query_domain (inspection_id, query_id, domain_id),
        INDEX idx_inspection_id (inspection_id),
        INDEX idx_query_id (query_id),
        INDEX idx_sub_domain_id (sub_domain_id),
        INDEX idx_domain_id (domain_id),
        INDEX idx_response_value (response),
        INDEX idx_nc_type (nc_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure sub_domain_id and domain_id exist on responses table (for existing installations)
    if (await tableExists('responses')) {
      await ensureColumn('responses', 'sub_domain_id', 'ALTER TABLE responses ADD COLUMN sub_domain_id INT NULL AFTER query_id');
      await ensureColumn('responses', 'domain_id', 'ALTER TABLE responses ADD COLUMN domain_id INT NULL AFTER sub_domain_id');
      
      // Migrate unique key to include domain_id if it still uses the old unique_inspection_query
      try {
        const oldKeyExists = await this.executeOne(`
          SELECT 1 as ok FROM information_schema.table_constraints
          WHERE table_schema = DATABASE()
            AND table_name = 'responses'
            AND constraint_name = 'unique_inspection_query'
            AND constraint_type = 'UNIQUE'
        `);
        if (oldKeyExists) {
          await this.execute('ALTER TABLE responses DROP INDEX unique_inspection_query');
          logger.info('Migrated responses unique key: dropped unique_inspection_query');
        }
      } catch (e) {
        logger.debug('Unique key migration for responses:', e.message);
      }
      
      // Add new composite unique key if it doesn't exist
      try {
        const newKeyExists = await this.executeOne(`
          SELECT 1 as ok FROM information_schema.table_constraints
          WHERE table_schema = DATABASE()
            AND table_name = 'responses'
            AND constraint_name = 'unique_inspection_query_domain'
            AND constraint_type = 'UNIQUE'
        `);
        if (!newKeyExists) {
          await this.execute('ALTER TABLE responses ADD UNIQUE KEY unique_inspection_query_domain (inspection_id, query_id, domain_id)');
          logger.info('Migrated responses unique key: added unique_inspection_query_domain');
        }
      } catch (e) {
        logger.debug('Unique key migration for responses:', e.message);
      }

      await ensureIndex('responses', 'sub_domain_id', 'ALTER TABLE responses ADD INDEX idx_sub_domain_id (sub_domain_id)');
      await ensureIndex('responses', 'domain_id', 'ALTER TABLE responses ADD INDEX idx_domain_id (domain_id)');
    }


    await this.execute(`
      CREATE TABLE IF NOT EXISTS queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sub_domain_id INT NULL,
        question_text TEXT NOT NULL,
        question_type ENUM('primary', 'secondary', 'optional') NOT NULL DEFAULT 'primary',
        parent_id INT NULL,
        item_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES queries(id) ON DELETE CASCADE,
        INDEX idx_query_sub_domain_id (sub_domain_id),
        INDEX idx_query_parent_id (parent_id),
        INDEX idx_query_type (question_type),
        INDEX idx_query_order (item_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS sub_domain_queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sub_domain_id INT NOT NULL,
        query_id INT NOT NULL,
        query_type ENUM('primary', 'secondary', 'optional') NOT NULL DEFAULT 'primary',
        parent_id INT NULL,
        item_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
        FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES sub_domain_queries(id) ON DELETE CASCADE,
        UNIQUE KEY unique_sub_domain_query (sub_domain_id, query_id),
        INDEX idx_sub_domain_id (sub_domain_id),
        INDEX idx_query_id (query_id),
        INDEX idx_parent_id (parent_id),
        INDEX idx_item_order (item_order),
        INDEX idx_query_type (query_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      const triggers = await this.execute(
        `
          SELECT trigger_name as triggerName, action_statement as actionStatement
          FROM information_schema.triggers
          WHERE trigger_schema = DATABASE()
            AND action_statement LIKE '%transaction_isolation_level%'
        `
      );

      if (Array.isArray(triggers) && triggers.length > 0) {
        for (const t of triggers) {
          const triggerName = String(t.triggerName || '').replace(/`/g, '');
          if (!triggerName) continue;
          await this.execute(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
        }
      }
    } catch (e) {
      logger.warn('Failed to clean up invalid triggers', { error: e.message });
    }

    if (await tableExists('checklist_items')) {
      await ensureColumn('checklist_items', 'question_id', 'ALTER TABLE checklist_items ADD COLUMN question_id INT AFTER domain_id');
      await ensureIndex('checklist_items', 'question_id', 'ALTER TABLE checklist_items ADD INDEX idx_question_id (question_id)');
      await ensureFk(
        'checklist_items',
        'question_id',
        'ALTER TABLE checklist_items ADD CONSTRAINT fk_checklist_items_question FOREIGN KEY (question_id) REFERENCES queries(id) ON DELETE CASCADE'
      );
    }

    // Add editable_by_inspector column to checklist_responses for granular rejection
    if (await tableExists('checklist_responses')) {
      await ensureColumn('checklist_responses', 'editable_by_inspector', 'ALTER TABLE checklist_responses ADD COLUMN editable_by_inspector BOOLEAN NOT NULL DEFAULT TRUE AFTER response_value');
      await ensureIndex('checklist_responses', 'editable_by_inspector', 'ALTER TABLE checklist_responses ADD INDEX idx_editable_by_inspector (editable_by_inspector)');
      
      // Add rejection tracking columns
      await ensureColumn('checklist_responses', 'rejection_notes', 'ALTER TABLE checklist_responses ADD COLUMN rejection_notes TEXT AFTER editable_by_inspector');
      await ensureColumn('checklist_responses', 'rejected_at', 'ALTER TABLE checklist_responses ADD COLUMN rejected_at TIMESTAMP NULL AFTER rejection_notes');
      await ensureColumn('checklist_responses', 'rejected_by', 'ALTER TABLE checklist_responses ADD COLUMN rejected_by INT NULL AFTER rejected_at');
      
      // Add foreign key for rejected_by
      await ensureFk(
        'checklist_responses',
        'rejected_by',
        'ALTER TABLE checklist_responses ADD CONSTRAINT fk_checklist_responses_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL'
      );
    }

    // Migration for queries table - remove sub_domain_id and linkage columns
    if (await tableExists('queries')) {
      // Remove linkage columns that belong in sub_domain_queries table
      if (await columnExists('queries', 'question_type')) {
        await dropColumnIfExists('queries', 'question_type');
        logger.info('Removed question_type from queries table');
      }

      if (await columnExists('queries', 'parent_id')) {
        await dropFksOnColumnIfExists('queries', 'parent_id');
        await dropColumnIfExists('queries', 'parent_id');
        logger.info('Removed parent_id from queries table');
      }

      if (await columnExists('queries', 'item_order')) {
        await dropColumnIfExists('queries', 'item_order');
        logger.info('Removed item_order from queries table');
      }

      // Remove sub_domain_id column - queries should be independent
      if (await columnExists('queries', 'sub_domain_id')) {
        await dropFksOnColumnIfExists('queries', 'sub_domain_id');
        await dropColumnIfExists('queries', 'sub_domain_id');
        logger.info('Removed sub_domain_id from queries table');
      }
    }

    // Migration for sub_domain_queries table - add query_type and parent_id columns
    if (await tableExists('sub_domain_queries')) {
      await ensureColumn('sub_domain_queries', 'query_type', `ALTER TABLE sub_domain_queries ADD COLUMN query_type ENUM('primary', 'secondary', 'optional') NOT NULL DEFAULT 'primary' AFTER query_id`);
      await ensureColumn('sub_domain_queries', 'parent_id', `ALTER TABLE sub_domain_queries ADD COLUMN parent_id INT NULL AFTER query_type`);
      await ensureIndex('sub_domain_queries', 'parent_id', `ALTER TABLE sub_domain_queries ADD INDEX idx_parent_id (parent_id)`);
      await ensureIndex('sub_domain_queries', 'query_type', `ALTER TABLE sub_domain_queries ADD INDEX idx_query_type (query_type)`);
      
      if (!(await fkByNameExists('sub_domain_queries', 'fk_sub_domain_queries_parent'))) {
        await this.execute(`
          ALTER TABLE sub_domain_queries 
          ADD CONSTRAINT fk_sub_domain_queries_parent 
          FOREIGN KEY (parent_id) REFERENCES sub_domain_queries(id) ON DELETE CASCADE
        `);
      }
    }

    // Create inspection_subdomain_submissions table for tracking sub-domain submissions
    await this.execute(`
      CREATE TABLE IF NOT EXISTS inspection_subdomain_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id INT NOT NULL,
        sub_domain_id INT NOT NULL,
        domain_id INT NULL,
        submitted_by INT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_rejected TINYINT(1) DEFAULT 0,
        rejected_at TIMESTAMP NULL,
        rejected_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (sub_domain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
        FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_inspection_subdomain (inspection_id, sub_domain_id, domain_id),
        INDEX idx_inspection_id (inspection_id),
        INDEX idx_sub_domain_id (sub_domain_id),
        INDEX idx_domain_id (domain_id),
        INDEX idx_submitted_by (submitted_by),
        INDEX idx_is_rejected (is_rejected)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add is_rejected column to existing table if it doesn't exist
    if (await tableExists('inspection_subdomain_submissions')) {
      await ensureColumn('inspection_subdomain_submissions', 'is_rejected', 'ALTER TABLE inspection_subdomain_submissions ADD COLUMN is_rejected TINYINT(1) DEFAULT 0 AFTER submitted_at');
      await ensureColumn('inspection_subdomain_submissions', 'rejected_at', 'ALTER TABLE inspection_subdomain_submissions ADD COLUMN rejected_at TIMESTAMP NULL AFTER is_rejected');
      await ensureColumn('inspection_subdomain_submissions', 'rejected_by', 'ALTER TABLE inspection_subdomain_submissions ADD COLUMN rejected_by INT NULL AFTER rejected_at');
      await ensureFk('inspection_subdomain_submissions', 'rejected_by', 'ALTER TABLE inspection_subdomain_submissions ADD CONSTRAINT fk_submissions_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL');
      await ensureIndex('inspection_subdomain_submissions', 'is_rejected', 'ALTER TABLE inspection_subdomain_submissions ADD INDEX idx_is_rejected (is_rejected)');
    }

    // Create inspection_rejection_history table for tracking rejection audit trail
    await this.execute(`
      CREATE TABLE IF NOT EXISTS inspection_rejection_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id INT NOT NULL,
        rejection_type ENUM('reviewer', 'manager', 'project_edit') NOT NULL DEFAULT 'reviewer',
        rejected_by INT NOT NULL,
        rejection_reason VARCHAR(255) NOT NULL,
        rejection_notes TEXT,
        responses JSON,
        rejection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_inspection_id (inspection_id),
        INDEX idx_rejected_by (rejected_by),
        INDEX idx_rejection_date (rejection_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure sub_domain_scores table has domain_id column
    if (await tableExists('sub_domain_scores')) {
      await ensureColumn('sub_domain_scores', 'domain_id', 'ALTER TABLE sub_domain_scores ADD COLUMN domain_id INT NULL AFTER sub_domain_id');
      
      // Migrate unique key to include domain_id
      // The old key was named 'unique_inspection_subdomain' (without domain_id),
      // which caused same sub_domain across different domains to overwrite each other's scores
      const oldKeyNames = ['uq_inspection_sub_domain', 'unique_inspection_subdomain'];
      for (const oldKeyName of oldKeyNames) {
        try {
          const oldKeyExists = await this.executeOne(`
            SELECT 1 as ok FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
              AND table_name = 'sub_domain_scores'
              AND constraint_name = ?
              AND constraint_type = 'UNIQUE'
          `, [oldKeyName]);
          if (oldKeyExists) {
            await this.execute(`ALTER TABLE sub_domain_scores DROP INDEX \`${oldKeyName}\``);
            logger.info(`Migrated sub_domain_scores: dropped old unique key '${oldKeyName}'`);
          }
        } catch (e) {
          logger.debug(`sub_domain_scores unique key migration for '${oldKeyName}':`, e.message);
        }
      }
      
      // Add new composite unique key if it doesn't exist
      try {
        const newKeyExists = await this.executeOne(`
          SELECT 1 as ok FROM information_schema.table_constraints
          WHERE table_schema = DATABASE()
            AND table_name = 'sub_domain_scores'
            AND constraint_name = 'uq_inspection_sub_domain_domain'
            AND constraint_type = 'UNIQUE'
        `);
        if (!newKeyExists) {
          await this.execute('ALTER TABLE sub_domain_scores ADD UNIQUE KEY uq_inspection_sub_domain_domain (inspection_id, sub_domain_id, domain_id)');
          logger.info('Migrated sub_domain_scores: added composite unique key with domain_id');
        }
      } catch (e) {
        logger.debug('sub_domain_scores add new unique key:', e.message);
      }
    } else {
      // Create sub_domain_scores table if it doesn't exist
      await this.execute(`
        CREATE TABLE IF NOT EXISTS sub_domain_scores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          inspection_id INT NOT NULL,
          sub_domain_id INT NOT NULL,
          domain_id INT NULL,
          secured_points DECIMAL(10,2) DEFAULT 0,
          max_points DECIMAL(10,2) DEFAULT 0,
          sub_domain_rating DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
          UNIQUE KEY uq_inspection_sub_domain_domain (inspection_id, sub_domain_id, domain_id),
          INDEX idx_inspection_id (inspection_id),
          INDEX idx_sub_domain_id (sub_domain_id),
          INDEX idx_domain_id (domain_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      logger.info('Created sub_domain_scores table');
    }

    logger.info('Schema check completed successfully');
  }

  /**
   * Test database connection health
   * @returns {Promise<Object>} - Health status
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      const connection = await this.getConnection();
      
      // Test basic query
      const [result] = await connection.execute('SELECT 1 as test_value');
      const responseTime = Date.now() - startTime;
      
      connection.release();
      
      logger.info('Database connection test successful', {
        responseTime: `${responseTime}ms`,
        threadId: connection.threadId
      });
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        testValue: result[0].test_value
      };
    } catch (error) {
      logger.error('Database connection test failed', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      });
      
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} - Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return {
        status: 'not_initialized',
        message: 'Database pool not initialized'
      };
    }

    return {
      status: 'active',
      totalConnections: this.pool._allConnections?.length || 0,
      freeConnections: this.pool._freeConnections?.length || 0,
      waitingConnections: this.pool._connectionQueue?.length || 0,
      connectionLimit: this.config.connectionLimit,
      host: this.config.host,
      database: this.config.database,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Close all connections in the pool
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.pool) {
        const activeConnections = this.pool._allConnections?.length || 0;
        const waitingConnections = this.pool._connectionQueue?.length || 0;
        
        logger.info('Closing database connection pool...', {
          activeConnections,
          waitingConnections
        });
        
        await this.pool.end();
        
        logger.info('Database connection pool closed successfully');
      }
    } catch (error) {
      logger.error('Error closing database connection pool', {
        error: error.message,
        code: error.code,
        errno: error.errno
      });
      throw error;
    }
  }

  /**
   * Get the pool instance for advanced usage
   * @returns {Pool} - MySQL2 pool instance
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Handle connection errors
   * @param {Error} error - Connection error
   */
  handleConnectionError(error) {
    logger.error('Database connection error', {
      error: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      fatal: error.fatal,
      host: this.config.host
    });

    // Common error handling
    switch (error.code) {
      case 'ECONNREFUSED':
        logger.error('Database connection refused - check if MySQL server is running');
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        logger.error('Database access denied - check credentials');
        break;
      case 'ER_BAD_DB_ERROR':
        logger.error('Database does not exist - check database name');
        break;
      case 'ECONNRESET':
        logger.error('Database connection reset');
        break;
      case 'ETIMEDOUT':
        logger.error('Database connection timeout');
        break;
      default:
        logger.error('Unknown database error');
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

// Handle process termination gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections...');
  try {
    await dbConnection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGTERM shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connections...');
  try {
    await dbConnection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGINT shutdown', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', error);
  try {
    await dbConnection.close();
  } catch (closeError) {
    logger.error('Error closing database during uncaught exception', closeError);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  try {
    await dbConnection.close();
  } catch (closeError) {
    logger.error('Error closing database during unhandled rejection', closeError);
  }
  process.exit(1);
});

module.exports = dbConnection;
