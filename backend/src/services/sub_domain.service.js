const db = require('../config/db');
const logger = require('../utils/logger');

class SubDomainService {
  // Get all sub_domains with their queries
  async getAllSubDomains() {
    try {
      const query = `
        SELECT 
          sec.id,
          sec.sub_domain_name as name,
          sec.description,
          sec.is_active
        FROM sub_domains sec
        ORDER BY sec.sub_domain_name
      `;

      const rows = await db.execute(query);
      logger.info(`Retrieved ${rows.length} sub_domains from database`);
      logger.info('Database rows:', JSON.stringify(rows, null, 2));

      const subDomains = rows.map((row) => {
        logger.info('Processing row:', JSON.stringify(row, null, 2));
        logger.info('row.is_active:', row.is_active);
        const result = {
          ...row,
          description: row.description || '',
          isActive: row.is_active === 1, // Convert is_active (0/1) to isActive (boolean)
          queries: []
        };
        logger.info('Final result:', JSON.stringify(result, null, 2));
        return result;
      });

      if (subDomains.length === 0) return subDomains;

      const subDomainIds = subDomains.map(s => s.id);
      const placeholders = subDomainIds.map(() => '?').join(',');
      const queryRows = await db.execute(
        `
          SELECT
            q.id,
            sq.sub_domain_id as subDomainId,
            q.question_text as text,
            sq.query_type as type,
            sq.parent_id as parentId,
            sq.item_order as itemOrder
          FROM queries q
          INNER JOIN sub_domain_queries sq ON q.id = sq.query_id
          WHERE sq.sub_domain_id IN (${placeholders})
          ORDER BY sq.sub_domain_id, sq.item_order, q.id
        `,
        subDomainIds
      );

      const queriesBySubDomainId = new Map();
      for (const q of queryRows) {
        const list = queriesBySubDomainId.get(q.subDomainId) || [];
        list.push({
          id: q.id,
          text: q.text,
          type: q.type,
          parentId: q.parentId,
          itemOrder: q.itemOrder
        });
        queriesBySubDomainId.set(q.subDomainId, list);
      }

      return subDomains.map((s) => ({
        ...s,
        queries: queriesBySubDomainId.get(s.id) || []
      }));
    } catch (error) {
      logger.error('Error fetching sub_domains:', error);
      throw error;
    }
  }

  // Get sub_domain by ID with queries
  async getSubDomainById(id) {
    try {
      const query = `
        SELECT 
          sec.id,
          sec.sub_domain_name as name,
          sec.description
        FROM sub_domains sec
        WHERE sec.id = ?
      `;
      
      const rows = await db.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const subDomain = rows[0];

      const queries = await db.execute(
        `
          SELECT
            q.id,
            q.question_text as text,
            sq.query_type as type,
            sq.parent_id as parentId,
            sq.item_order as itemOrder
          FROM queries q
          INNER JOIN sub_domain_queries sq ON q.id = sq.query_id
          WHERE sq.sub_domain_id = ?
          ORDER BY sq.item_order, q.id
        `,
        [id]
      );

      return {
        ...subDomain,
        description: subDomain.description || '',
        queries
      };
    } catch (error) {
      logger.error(`Error fetching sub_domain ${id}:`, error);
      throw error;
    }
  }

  // Create new sub_domain
  async createSubDomain(subDomainData) {
    try {
      const subDomainResult = await db.executeWithResult(
        `
          INSERT INTO sub_domains (sub_domain_name, description)
          VALUES (?, ?)
        `,
        [subDomainData.name, subDomainData.description || '']
      );

      const subDomainId = subDomainResult.insertId;

      // If queries are provided, link them via junction table
      if (Array.isArray(subDomainData.queries) && subDomainData.queries.length > 0) {
        let order = 0;
        for (const q of subDomainData.queries) {
          if (q && q.id) {
            await db.execute(
              `
                INSERT INTO sub_domain_queries (sub_domain_id, query_id, query_type, parent_id, item_order)
                VALUES (?, ?, ?, ?, ?)
              `,
              [subDomainId, q.id, q.query_type || q.type || 'primary', q.parent_id || q.parentId || null, order++]
            );
          }
        }
      }

      logger.info(`SubDomain created: ${subDomainId}`);
      return await this.getSubDomainById(subDomainId);
    } catch (error) {
      logger.error('Error creating sub_domain:', error);
      throw error;
    }
  }

  // Update sub_domain
  async updateSubDomain(id, subDomainData) {
    try {
      logger.info(`Updating sub_domain ${id} with data:`, subDomainData);
      const result = await db.execute(
        `
          UPDATE sub_domains SET
            sub_domain_name = ?,
            description = ?
          WHERE id = ?
        `,
        [subDomainData.name, subDomainData.description || '', id]
      );
      logger.info(`Update result:`, result);

      // If queries are provided, update junction table links
      if (Array.isArray(subDomainData.queries)) {
        // Delete existing links
        await db.execute('DELETE FROM sub_domain_queries WHERE sub_domain_id = ?', [id]);

        // Create new links
        let order = 0;
        for (const q of subDomainData.queries) {
          if (q && q.id) {
            await db.execute(
              `
                INSERT INTO sub_domain_queries (sub_domain_id, query_id, query_type, parent_id, item_order)
                VALUES (?, ?, ?, ?, ?)
              `,
              [id, q.id, q.query_type || q.type || 'primary', q.parent_id || q.parentId || null, order++]
            );
          }
        }
      }

      logger.info(`SubDomain updated: ${id}`);
      return await this.getSubDomainById(id);
    } catch (error) {
      logger.error(`Error updating sub_domain ${id}:`, error);
      throw error;
    }
  }

  // Delete sub_domain
  async deleteSubDomain(id) {
    try {
      const query = 'DELETE FROM sub_domains WHERE id = ?';
      const result = await db.execute(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('SubDomain not found');
      }
      
      logger.info(`SubDomain deleted: ${id}`);
      return { id, message: 'SubDomain deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting sub_domain ${id}:`, error);
      throw error;
    }
  }
}

module.exports = new SubDomainService();
