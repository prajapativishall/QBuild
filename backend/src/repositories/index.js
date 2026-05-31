/**
 * REPOSITORY PATTERN IMPLEMENTATION
 * 
 * This demonstrates how to implement repositories for clean data access
 * and proper separation of data access from business logic.
 * 
 * Key Benefits:
 * - Testable with mock repositories
 * - SQL logic centralized in one place
 * - Easy to switch database implementations
 * - Reusable query patterns
 */

// ============================================================================
// BASE REPOSITORY
// ============================================================================

/**
 * Abstract base repository providing common CRUD operations
 * Child repositories inherit these and add domain-specific queries
 */
class BaseRepository {
  constructor(tableName, db, logger) {
    this.tableName = tableName;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Find single record by ID
   */
  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const [rows] = await this.db.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      this.logger.error(`findById error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Find all records with filters and pagination
   */
  async findAll(filters = {}, pagination = {}) {
    try {
      const { limit = 50, offset = 0 } = pagination;
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];

      // Build WHERE clause
      if (Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters)
          .map(([key, value]) => {
            if (value === null) {
              return `${key} IS NULL`;
            }
            params.push(value);
            return `${key} = ?`;
          })
          .join(' AND ');
        query += ` WHERE ${conditions}`;
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await this.db.execute(query, params);
      return rows;
    } catch (error) {
      this.logger.error(`findAll error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Create new record
   */
  async create(data, transaction = null) {
    try {
      const keys = Object.keys(data);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(data);

      const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      const executor = transaction || this.db;
      const [result] = await executor.execute(query, values);

      return {
        id: result.insertId,
        ...data
      };
    } catch (error) {
      this.logger.error(`create error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Update record by ID
   */
  async update(id, data, transaction = null) {
    try {
      const keys = Object.keys(data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(data), id];

      const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      const executor = transaction || this.db;
      await executor.execute(query, values);

      return this.findById(id);
    } catch (error) {
      this.logger.error(`update error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Delete record by ID
   */
  async delete(id, transaction = null) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const executor = transaction || this.db;
      await executor.execute(query, [id]);
    } catch (error) {
      this.logger.error(`delete error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Count records matching filters
   */
  async count(filters = {}) {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params = [];

      if (Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters)
          .map(([key, value]) => {
            if (value === null) return `${key} IS NULL`;
            params.push(value);
            return `${key} = ?`;
          })
          .join(' AND ');
        query += ` WHERE ${conditions}`;
      }

      const [rows] = await this.db.execute(query, params);
      return rows[0]?.count || 0;
    } catch (error) {
      this.logger.error(`count error in ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Check if record exists
   */
  async exists(id) {
    const record = await this.findById(id);
    return !!record;
  }
}

// ============================================================================
// INSPECTION REPOSITORY
// ============================================================================

class InspectionRepository extends BaseRepository {
  constructor(db, logger) {
    super('inspections', db, logger);
  }

  /**
   * Find inspections by creator (inspector) with pagination
   */
  async findByCreator(userId, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE created_by = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.execute(query, [userId, limit, offset]);
      return rows;
    } catch (error) {
      this.logger.error('findByCreator error', error);
      throw error;
    }
  }

  /**
   * Find inspections by project
   */
  async findByProject(projectId, filters = {}, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE project_id = ?
      `;
      const params = [projectId];

      // Optional state filter
      if (filters.state) {
        query += ` AND state = ?`;
        params.push(filters.state);
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await this.db.execute(query, params);
      return rows;
    } catch (error) {
      this.logger.error('findByProject error', error);
      throw error;
    }
  }

  /**
   * Find inspections by state - useful for filtering queues
   */
  async findByState(state, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      const query = `
        SELECT i.*, 
               u.name as creator_name,
               p.name as project_name
        FROM ${this.tableName} i
        JOIN users u ON i.created_by = u.id
        JOIN projects p ON i.project_id = p.id
        WHERE i.state = ?
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.execute(query, [state, limit, offset]);
      return rows;
    } catch (error) {
      this.logger.error('findByState error', error);
      throw error;
    }
  }

  /**
   * Get inspection with full hierarchy
   * Includes all domains, subdomains, and queries
   */
  async findWithHierarchy(inspectionId) {
    try {
      const inspection = await this.findById(inspectionId);
      if (!inspection) return null;

      const query = `
        SELECT 
          i.id, i.project_id, i.state,
          d.id as domain_id, d.name as domain_name,
          sd.id as subdomain_id, sd.name as subdomain_name,
          q.id as query_id, q.question, cr.response_value, cr.state as response_state
        FROM ${this.tableName} i
        LEFT JOIN domains d ON d.id IN (
          SELECT DISTINCT domain_id FROM checklist_queries WHERE subdomain_id IN (
            SELECT id FROM sub_domains WHERE domain_id = d.id
          ) AND inspection_id = i.id
        )
        LEFT JOIN sub_domains sd ON sd.domain_id = d.id
        LEFT JOIN checklist_queries q ON q.subdomain_id = sd.id AND q.inspection_id = i.id
        LEFT JOIN checklist_responses cr ON cr.query_id = q.id AND cr.inspection_id = i.id
        WHERE i.id = ?
        ORDER BY d.id, sd.id, q.id
      `;

      const [rows] = await this.db.execute(query, [inspectionId]);

      // Transform flat result into hierarchy
      const hierarchy = this._buildHierarchy(rows);
      return { ...inspection, hierarchy };
    } catch (error) {
      this.logger.error('findWithHierarchy error', error);
      throw error;
    }
  }

  /**
   * Get statistics about an inspection
   */
  async getStats(inspectionId) {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT CASE WHEN sd.id IS NOT NULL THEN sd.id END) as total_subdomains,
          COUNT(DISTINCT CASE WHEN q.id IS NOT NULL THEN q.id END) as total_queries,
          COUNT(DISTINCT CASE WHEN cr.response_value IS NOT NULL THEN cr.id END) as answered_queries,
          COUNT(DISTINCT CASE WHEN cr.state = 'REJECTED' THEN cr.id END) as rejected_queries,
          AVG(CASE WHEN cr.response_value IS NOT NULL THEN cr.confidence END) as avg_confidence
        FROM inspections i
        LEFT JOIN sub_domains sd ON sd.id IN (
          SELECT DISTINCT subdomain_id FROM checklist_queries WHERE inspection_id = i.id
        )
        LEFT JOIN checklist_queries q ON q.inspection_id = i.id
        LEFT JOIN checklist_responses cr ON cr.query_id = q.id AND cr.inspection_id = i.id
        WHERE i.id = ?
      `;

      const [rows] = await this.db.execute(query, [inspectionId]);
      return rows[0] || {};
    } catch (error) {
      this.logger.error('getStats error', error);
      throw error;
    }
  }

  /**
   * Helper to transform flat result rows into hierarchical structure
   */
  _buildHierarchy(rows) {
    const hierarchy = {};

    for (const row of rows) {
      const domainId = row.domain_id;
      const subdomainId = row.subdomain_id;
      const queryId = row.query_id;

      if (!domainId) continue;

      if (!hierarchy[domainId]) {
        hierarchy[domainId] = {
          id: domainId,
          name: row.domain_name,
          subdomains: {}
        };
      }

      if (subdomainId && !hierarchy[domainId].subdomains[subdomainId]) {
        hierarchy[domainId].subdomains[subdomainId] = {
          id: subdomainId,
          name: row.subdomain_name,
          queries: {}
        };
      }

      if (queryId && subdomainId) {
        if (!hierarchy[domainId].subdomains[subdomainId].queries[queryId]) {
          hierarchy[domainId].subdomains[subdomainId].queries[queryId] = {
            id: queryId,
            question: row.question,
            response: row.response_value,
            state: row.response_state
          };
        }
      }
    }

    return Object.values(hierarchy).map(domain => ({
      ...domain,
      subdomains: Object.values(domain.subdomains).map(subdomain => ({
        ...subdomain,
        queries: Object.values(subdomain.queries)
      }))
    }));
  }
}

// ============================================================================
// QUERY RESPONSE REPOSITORY
// ============================================================================

class ResponseRepository extends BaseRepository {
  constructor(db, logger) {
    super('checklist_responses', db, logger);
  }

  /**
   * Find all responses for an inspection
   */
  async findByInspection(inspectionId) {
    try {
      const query = `
        SELECT cr.*, q.question, sd.name as subdomain_name
        FROM ${this.tableName} cr
        JOIN checklist_queries q ON cr.query_id = q.id
        JOIN sub_domains sd ON q.subdomain_id = sd.id
        WHERE cr.inspection_id = ?
      `;
      const [rows] = await this.db.execute(query, [inspectionId]);
      return rows;
    } catch (error) {
      this.logger.error('findByInspection error', error);
      throw error;
    }
  }

  /**
   * Find unanswered queries
   */
  async findUnanswered(inspectionId) {
    try {
      const query = `
        SELECT q.*
        FROM checklist_queries q
        WHERE q.inspection_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM checklist_responses cr 
          WHERE cr.query_id = q.id 
          AND cr.inspection_id = q.inspection_id
          AND cr.response_value IS NOT NULL
        )
      `;
      const [rows] = await this.db.execute(query, [inspectionId]);
      return rows;
    } catch (error) {
      this.logger.error('findUnanswered error', error);
      throw error;
    }
  }

  /**
   * Find rejected responses that need resubmission
   */
  async findRejected(inspectionId, rejectionId = null) {
    try {
      let query = `
        SELECT cr.*
        FROM ${this.tableName} cr
        WHERE cr.inspection_id = ? AND cr.state = 'REJECTED'
      `;
      const params = [inspectionId];

      // Optional: filter by specific rejection
      if (rejectionId) {
        query += `
          AND EXISTS (
            SELECT 1 FROM rejections r
            WHERE r.id = ?
            AND JSON_CONTAINS(r.affected_item_ids, JSON_ARRAY(cr.query_id))
          )
        `;
        params.push(rejectionId);
      }

      const [rows] = await this.db.execute(query, params);
      return rows;
    } catch (error) {
      this.logger.error('findRejected error', error);
      throw error;
    }
  }

  /**
   * Find responses by subdomain
   */
  async findBySubdomain(subdomainId, inspectionId) {
    try {
      const query = `
        SELECT cr.*
        FROM ${this.tableName} cr
        JOIN checklist_queries q ON cr.query_id = q.id
        WHERE q.subdomain_id = ? AND cr.inspection_id = ?
      `;
      const [rows] = await this.db.execute(query, [subdomainId, inspectionId]);
      return rows;
    } catch (error) {
      this.logger.error('findBySubdomain error', error);
      throw error;
    }
  }
}

// ============================================================================
// REJECTION REPOSITORY
// ============================================================================

class RejectionRepository extends BaseRepository {
  constructor(db, logger) {
    super('rejections', db, logger);
  }

  /**
   * Find latest rejection for an inspection
   */
  async findLatest(inspectionId) {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE inspection_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const [rows] = await this.db.execute(query, [inspectionId]);
      return rows[0] || null;
    } catch (error) {
      this.logger.error('findLatest error', error);
      throw error;
    }
  }

  /**
   * Find all rejections for an inspection (history)
   */
  async findHistory(inspectionId) {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE inspection_id = ?
        ORDER BY created_at DESC
      `;
      const [rows] = await this.db.execute(query, [inspectionId]);
      return rows;
    } catch (error) {
      this.logger.error('findHistory error', error);
      throw error;
    }
  }

  /**
   * Find rejections by reviewer
   */
  async findByReviewer(reviewerId, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      const query = `
        SELECT r.*, i.project_id
        FROM ${this.tableName} r
        JOIN inspections i ON r.inspection_id = i.id
        WHERE r.reviewed_by = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.execute(query, [reviewerId, limit, offset]);
      return rows;
    } catch (error) {
      this.logger.error('findByReviewer error', error);
      throw error;
    }
  }
}

// ============================================================================
// AUDIT LOG REPOSITORY
// ============================================================================

class AuditRepository extends BaseRepository {
  constructor(db, logger) {
    super('audit_log', db, logger);
  }

  /**
   * Get audit trail for an entity
   */
  async getTrail(entityType, entityId) {
    try {
      const query = `
        SELECT a.*, u.name as actor_name
        FROM ${this.tableName} a
        LEFT JOIN users u ON a.actor_id = u.id
        WHERE a.entity_type = ? AND a.entity_id = ?
        ORDER BY a.created_at DESC
      `;
      const [rows] = await this.db.execute(query, [entityType, entityId]);
      return rows;
    } catch (error) {
      this.logger.error('getTrail error', error);
      throw error;
    }
  }

  /**
   * Get all actions by an actor
   */
  async findByActor(actorId, pagination = {}) {
    try {
      const { limit = 50, offset = 0 } = pagination;
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE actor_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.execute(query, [actorId, limit, offset]);
      return rows;
    } catch (error) {
      this.logger.error('findByActor error', error);
      throw error;
    }
  }

  /**
   * Get all actions of a specific type
   */
  async findByAction(action, pagination = {}) {
    try {
      const { limit = 50, offset = 0 } = pagination;
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE action = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.execute(query, [action, limit, offset]);
      return rows;
    } catch (error) {
      this.logger.error('findByAction error', error);
      throw error;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  BaseRepository,
  InspectionRepository,
  ResponseRepository,
  RejectionRepository,
  AuditRepository
};
