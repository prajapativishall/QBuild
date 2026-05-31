/**
 * DATABASE MIGRATION STRATEGY
 * 
 * Migrations for implementing the enterprise architecture
 * Run in order to safely add new tables and columns
 */

// ============================================================================
// MIGRATION 001: Add Workflow State Columns
// ============================================================================

const migration001 = {
  name: '001_add_workflow_states.sql',
  description: 'Add state tracking columns to inspections and responses',
  up: `
    -- Add state tracking to inspections
    ALTER TABLE inspections ADD COLUMN (
      state ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 
                 'PARTIALLY_REJECTED', 'FULLY_REJECTED', 
                 'APPROVED', 'COMPLETED') 
             DEFAULT 'DRAFT' AFTER status,
      submitted_at TIMESTAMP NULL AFTER state,
      submitted_by INT NULL AFTER submitted_at,
      review_started_at TIMESTAMP NULL AFTER submitted_by,
      reviewed_by INT NULL AFTER review_started_at,
      approved_at TIMESTAMP NULL AFTER reviewed_by,
      approved_by INT NULL AFTER approved_at,
      resubmitted_at TIMESTAMP NULL AFTER approved_by,
      resubmitted_by INT NULL AFTER resubmitted_at,
      last_reviewed_by INT NULL AFTER resubmitted_by
    );

    -- Add state tracking to responses
    ALTER TABLE checklist_responses ADD COLUMN (
      state ENUM('PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED') 
            DEFAULT 'PENDING' AFTER response_value,
      rejected_at TIMESTAMP NULL AFTER state,
      reviewed_by INT NULL AFTER rejected_at,
      resubmitted_at TIMESTAMP NULL AFTER reviewed_by,
      confidence INT NULL COMMENT 'Inspector confidence level (0-100)' AFTER resubmitted_at
    );

    -- Add indexes for state queries
    CREATE INDEX idx_inspections_state ON inspections(state);
    CREATE INDEX idx_inspections_state_created ON inspections(state, created_at DESC);
    CREATE INDEX idx_responses_state ON checklist_responses(state);
    CREATE INDEX idx_responses_state_inspection ON checklist_responses(state, inspection_id);
  `,
  down: `
    -- Remove indexes
    DROP INDEX idx_inspections_state ON inspections;
    DROP INDEX idx_inspections_state_created ON inspections;
    DROP INDEX idx_responses_state ON checklist_responses;
    DROP INDEX idx_responses_state_inspection ON checklist_responses;

    -- Remove columns
    ALTER TABLE inspections DROP COLUMN state,
                            DROP COLUMN submitted_at,
                            DROP COLUMN submitted_by,
                            DROP COLUMN review_started_at,
                            DROP COLUMN reviewed_by,
                            DROP COLUMN approved_at,
                            DROP COLUMN approved_by,
                            DROP COLUMN resubmitted_at,
                            DROP COLUMN resubmitted_by,
                            DROP COLUMN last_reviewed_by;

    ALTER TABLE checklist_responses DROP COLUMN state,
                                   DROP COLUMN rejected_at,
                                   DROP COLUMN reviewed_by,
                                   DROP COLUMN resubmitted_at,
                                   DROP COLUMN confidence;
  `
};

// ============================================================================
// MIGRATION 002: Create Rejection Tracking Tables
// ============================================================================

const migration002 = {
  name: '002_add_rejection_tracking.sql',
  description: 'Create tables for tracking rejections and partial rejections',
  up: `
    -- Create rejections table
    CREATE TABLE rejections (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inspection_id INT NOT NULL,
      
      -- Rejection scope
      rejection_level ENUM('INSPECTION', 'DOMAIN', 'SUBDOMAIN', 'QUERY'),
      
      -- What was rejected (JSON for flexibility)
      affected_item_ids JSON NOT NULL COMMENT 'Array of item IDs affected by rejection',
      
      -- Review metadata
      reviewed_by INT NOT NULL,
      comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      INDEX idx_inspection (inspection_id),
      INDEX idx_rejection_level (rejection_level),
      INDEX idx_created (created_at)
    );

    -- Create detailed rejection tracking
    CREATE TABLE rejection_details (
      id INT PRIMARY KEY AUTO_INCREMENT,
      rejection_id INT NOT NULL,
      
      -- Item being rejected
      item_type ENUM('DOMAIN', 'SUBDOMAIN', 'QUERY'),
      item_id INT NOT NULL,
      
      -- Reason and feedback
      reason_code VARCHAR(50) COMMENT 'e.g., INCOMPLETE, WRONG_VALUE, MISSING_PHOTO',
      reason_text TEXT,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (rejection_id) REFERENCES rejections(id) ON DELETE CASCADE,
      INDEX idx_item (item_type, item_id)
    );
  `,
  down: `
    DROP TABLE IF EXISTS rejection_details;
    DROP TABLE IF EXISTS rejections;
  `
};

// ============================================================================
// MIGRATION 003: Create Audit Trail Tables
// ============================================================================

const migration003 = {
  name: '003_add_audit_trail.sql',
  description: 'Create tables for comprehensive audit logging',
  up: `
    -- Create audit log table
    CREATE TABLE audit_log (
      id INT PRIMARY KEY AUTO_INCREMENT,
      
      -- What changed
      entity_type VARCHAR(50) COMMENT 'INSPECTION, QUERY, DOMAIN, etc',
      entity_id INT,
      
      -- What action
      action VARCHAR(50) COMMENT 'CREATED, SUBMITTED, REJECTED, APPROVED, etc',
      
      -- Who did it
      actor_id INT,
      
      -- Details (flexible JSON)
      details JSON,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_entity (entity_type, entity_id),
      INDEX idx_actor (actor_id),
      INDEX idx_action (action),
      INDEX idx_created (created_at),
      INDEX idx_entity_time (entity_type, entity_id, created_at DESC)
    );

    -- Create review history table (audit-specific for reviews)
    CREATE TABLE review_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inspection_id INT NOT NULL,
      
      reviewer_id INT NOT NULL,
      
      -- Review lifecycle
      action VARCHAR(50) COMMENT 'REVIEW_STARTED, APPROVED, REJECTED, RESUBMISSION_RECEIVED',
      
      affected_items JSON COMMENT 'Items that were affected by this action',
      comments TEXT,
      
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      INDEX idx_inspection (inspection_id),
      INDEX idx_reviewer (reviewer_id),
      INDEX idx_action (action)
    );
  `,
  down: `
    DROP TABLE IF EXISTS review_history;
    DROP TABLE IF EXISTS audit_log;
  `
};

// ============================================================================
// MIGRATION 004: Create File Metadata Table
// ============================================================================

const migration004 = {
  name: '004_add_file_tracking.sql',
  description: 'Create table for file upload metadata and storage tracking',
  up: `
    -- Create file metadata table
    CREATE TABLE file_uploads (
      id INT PRIMARY KEY AUTO_INCREMENT,
      
      -- What it's associated with
      inspection_id INT,
      response_id INT,
      domain_id INT,
      subdomain_id INT,
      query_id INT,
      
      -- File details
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100),
      file_size INT COMMENT 'Size in bytes',
      
      -- Storage location
      storage_path VARCHAR(500) COMMENT 'Local path or S3 key',
      storage_type ENUM('LOCAL', 'S3') DEFAULT 'LOCAL',
      
      -- Status
      upload_status ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
      error_message TEXT,
      
      -- Cleanup
      marked_for_deletion BOOLEAN DEFAULT FALSE,
      deletion_requested_at TIMESTAMP NULL,
      deleted_at TIMESTAMP NULL,
      
      -- Metadata
      uploaded_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY (response_id) REFERENCES checklist_responses(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      
      INDEX idx_inspection (inspection_id),
      INDEX idx_response (response_id),
      INDEX idx_upload_status (upload_status),
      INDEX idx_marked_deletion (marked_for_deletion),
      INDEX idx_created (created_at)
    );

    -- Add column to inspections for file count
    ALTER TABLE inspections ADD COLUMN (
      file_count INT DEFAULT 0,
      total_file_size INT DEFAULT 0 COMMENT 'Total size in bytes'
    );
  `,
  down: `
    ALTER TABLE inspections DROP COLUMN file_count,
                             DROP COLUMN total_file_size;
    DROP TABLE IF EXISTS file_uploads;
  `
};

// ============================================================================
// MIGRATION 005: Create Dashboard Optimization Tables
// ============================================================================

const migration005 = {
  name: '005_add_dashboard_views.sql',
  description: 'Create materialized view tables for dashboard optimization',
  up: `
    -- Inspection summary for dashboard
    CREATE TABLE inspection_summary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inspection_id INT UNIQUE NOT NULL,
      
      -- Counts
      total_domains INT,
      total_subdomains INT,
      total_queries INT,
      queries_answered INT,
      queries_rejected INT,
      
      -- Status snapshots
      current_state VARCHAR(50),
      days_in_current_state INT,
      days_since_submission INT,
      
      -- Score cache
      overall_score DECIMAL(5, 2),
      score_by_domain JSON,
      
      -- Updated timestamp
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      INDEX idx_inspection (inspection_id),
      INDEX idx_state (current_state),
      INDEX idx_updated (updated_at)
    );

    -- Inspector performance tracking
    CREATE TABLE inspector_analytics (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inspector_id INT NOT NULL,
      
      -- Statistics
      total_inspections INT,
      completed_inspections INT,
      avg_completion_time INT COMMENT 'Days',
      submission_rate DECIMAL(5, 2) COMMENT 'Percentage',
      rejection_rate DECIMAL(5, 2) COMMENT 'Percentage',
      avg_quality_score DECIMAL(5, 2),
      
      -- Last update
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (inspector_id) REFERENCES users(id),
      INDEX idx_inspector (inspector_id),
      INDEX idx_updated (updated_at)
    );

    -- Reviewer analytics
    CREATE TABLE reviewer_analytics (
      id INT PRIMARY KEY AUTO_INCREMENT,
      reviewer_id INT NOT NULL,
      
      -- Statistics
      total_reviewed INT,
      avg_review_time INT COMMENT 'Minutes',
      approval_rate DECIMAL(5, 2),
      rejection_rate DECIMAL(5, 2),
      avg_items_rejected INT,
      
      -- Last update
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      INDEX idx_reviewer (reviewer_id),
      INDEX idx_updated (updated_at)
    );
  `,
  down: `
    DROP TABLE IF EXISTS reviewer_analytics;
    DROP TABLE IF EXISTS inspector_analytics;
    DROP TABLE IF EXISTS inspection_summary;
  `
};

// ============================================================================
// MIGRATION 006: Refactor Inspection Rejection History
// ============================================================================

const migration006 = {
  name: '006_refactor_inspection_history.sql',
  description: 'Refactor inspection_rejection_history to support actor_role, action_type, and scope_type',
  up: `
    -- Add new columns to inspection_rejection_history
    -- actor_role: WHO performed the action (reviewer/manager)
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN actor_role ENUM('reviewer', 'manager') NULL AFTER rejection_type;
    
    -- action_type: WHAT action happened (approved/rejected)
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN action_type ENUM('approved', 'rejected') NULL AFTER actor_role;
    
    -- scope_type: WHICH scope was affected (inspection/domain/subdomain/query)
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN scope_type ENUM('inspection', 'domain', 'subdomain', 'query') NULL AFTER action_type;
    
    -- Add granular target columns
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN domain_id INT NULL AFTER scope_type;
    
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN sub_domain_id INT NULL AFTER domain_id;
    
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN query_id INT NULL AFTER sub_domain_id;
    
    -- Add indexes for new columns
    CREATE INDEX idx_actor_role ON inspection_rejection_history(actor_role);
    CREATE INDEX idx_action_type ON inspection_rejection_history(action_type);
    CREATE INDEX idx_scope_type ON inspection_rejection_history(scope_type);
    CREATE INDEX idx_domain ON inspection_rejection_history(domain_id);
    CREATE INDEX idx_subdomain ON inspection_rejection_history(sub_domain_id);
    CREATE INDEX idx_query ON inspection_rejection_history(query_id);
    
    -- Backfill existing data
    -- rejection_type='reviewer' → actor_role='reviewer'
    -- rejection_type='manager' → actor_role='manager'
    UPDATE inspection_rejection_history 
    SET actor_role = rejection_type 
    WHERE actor_role IS NULL;
    
    -- Set default action_type='rejected' for old records (they were all rejections)
    UPDATE inspection_rejection_history 
    SET action_type = 'rejected' 
    WHERE action_type IS NULL;
    
    -- Set default scope_type='inspection' for old records
    UPDATE inspection_rejection_history 
    SET scope_type = 'inspection' 
    WHERE scope_type IS NULL;
    
    -- Remove old rejection_type column
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN rejection_type;
  `,
  down: `
    -- Restore old rejection_type column
    ALTER TABLE inspection_rejection_history 
    ADD COLUMN rejection_type ENUM('reviewer', 'manager') NULL AFTER id;
    
    -- Backfill rejection_type from actor_role
    UPDATE inspection_rejection_history 
    SET rejection_type = actor_role 
    WHERE rejection_type IS NULL;
    
    -- Remove new columns and indexes
    DROP INDEX idx_query ON inspection_rejection_history;
    DROP INDEX idx_subdomain ON inspection_rejection_history;
    DROP INDEX idx_domain ON inspection_rejection_history;
    DROP INDEX idx_scope_type ON inspection_rejection_history;
    DROP INDEX idx_action_type ON inspection_rejection_history;
    DROP INDEX idx_actor_role ON inspection_rejection_history;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN query_id;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN sub_domain_id;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN domain_id;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN scope_type;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN action_type;
    
    ALTER TABLE inspection_rejection_history 
    DROP COLUMN actor_role;
  `
};

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

class MigrationRunner {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.migrations = [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006
    ];
  }

  async runUp(toMigration = null) {
    for (const migration of this.migrations) {
      if (migration.up) {
        try {
          this.logger.info(`Running migration: ${migration.name}`);
          
          // Execute all statements in the migration
          const statements = migration.up
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          
          for (const statement of statements) {
            await this.db.execute(statement);
          }
          
          this.logger.info(`✓ ${migration.name} completed`);
        } catch (error) {
          this.logger.error(`✗ ${migration.name} failed:`, error.message);
          throw error;
        }
      }

      if (toMigration && migration.name === toMigration) break;
    }
  }

  async rollback(fromMigration = null) {
    // Rollback in reverse order
    const migrationsToRollback = this.migrations.reverse();
    
    for (const migration of migrationsToRollback) {
      if (migration.down) {
        try {
          this.logger.info(`Rolling back: ${migration.name}`);
          
          const statements = migration.down
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          
          for (const statement of statements) {
            await this.db.execute(statement);
          }
          
          this.logger.info(`✓ ${migration.name} rolled back`);
        } catch (error) {
          this.logger.error(`✗ Rollback failed for ${migration.name}:`, error.message);
          throw error;
        }
      }

      if (fromMigration && migration.name === fromMigration) break;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  MigrationRunner,
  migrations: [
    migration001,
    migration002,
    migration003,
    migration004,
    migration005,
    migration006
  ]
};
