const db = require('../config/db');
const logger = require('../utils/logger');

class QueryService {
  async getAllQueries(page = 1, limit = 25) {
    try {
      console.log('========================================');
      console.log('Executing getAllQueries...');
      console.log('Page:', page, 'Limit:', limit);

      const offset = (page - 1) * limit;
      const limitInt = parseInt(limit);
      const offsetInt = parseInt(offset);

      // Get total count
      const countQuery = 'SELECT COUNT(*) as total FROM queries';
      const [countResult] = await db.execute(countQuery);
      const total = countResult.total;

      // Get paginated data - use direct string interpolation for LIMIT/OFFSET
      const query = `
        SELECT
          id,
          question_text as text,
          created_at
        FROM queries
        ORDER BY id ASC
        LIMIT ${limitInt} OFFSET ${offsetInt}
      `;
      console.log('Query string:', query);
      console.log('Limit:', limitInt, 'Offset:', offsetInt);
      console.log('========================================');
      const queries = await db.execute(query);
      console.log('Query executed successfully, rows:', queries.length);
      logger.info(`Retrieved ${queries.length} queries (page ${page}, limit ${limit})`);

      const totalPages = Math.ceil(total / limit);

      return {
        data: queries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error('========================================');
      console.error('Error in getAllQueries:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('========================================');
      logger.error('Error fetching all queries:', error);
      throw error;
    }
  }

  async getQueryById(id) {
    try {
      const query = `
        SELECT 
          q.id,
          q.question_text as text,
          q.created_at
        FROM queries q
        WHERE q.id = ?
      `;
      const [queryData] = await db.execute(query, [id]);
      return queryData;
    } catch (error) {
      logger.error('Error fetching query by ID:', error);
      throw error;
    }
  }

  async createQuery(queryData) {
    try {
      const { text } = queryData;

      const query = `
        INSERT INTO queries (question_text)
        VALUES (?)
      `;
      const result = await db.execute(query, [text]);

      const newQuery = await this.getQueryById(result.insertId);
      logger.info(`Created query with ID: ${result.insertId}`);
      return newQuery;
    } catch (error) {
      logger.error('Error creating query:', error);
      throw error;
    }
  }

  async updateQuery(id, queryData) {
    try {
      const { text } = queryData;

      const query = `
        UPDATE queries
        SET question_text = ?
        WHERE id = ?
      `;
      await db.execute(query, [text, id]);
      
      const updatedQuery = await this.getQueryById(id);
      logger.info(`Updated query with ID: ${id}`);
      return updatedQuery;
    } catch (error) {
      logger.error('Error updating query:', error);
      throw error;
    }
  }

  async deleteQuery(id) {
    try {
      // Check if query is linked to any sub-domain
      const linked = await db.execute(
        'SELECT COUNT(*) as count FROM sub_domain_queries WHERE query_id = ?',
        [id]
      );

      if (linked[0].count > 0) {
        throw new Error('Cannot delete query that is linked to sub-domains. Remove from sub-domains first.');
      }

      const result = await db.execute('DELETE FROM queries WHERE id = ?', [id]);
      logger.info(`Deleted query with ID: ${id}`);
      return { message: 'Query deleted successfully' };
    } catch (error) {
      logger.error('Error deleting query:', error);
      throw error;
    }
  }

  async getQueriesNotInSubDomain(subDomainId) {
    try {
      const query = `
        SELECT 
          q.id,
          q.question_text as text
        FROM queries q
        WHERE q.id NOT IN (
          SELECT sq.query_id 
          FROM sub_domain_queries sq 
          WHERE sq.sub_domain_id = ?
        )
        ORDER BY q.id ASC
      `;
      const queries = await db.execute(query, [subDomainId]);
      return queries;
    } catch (error) {
      logger.error('Error fetching queries not in sub-domain:', error);
      throw error;
    }
  }

  async linkQueryToSubDomain(subDomainId, queryId, queryType = 'primary', parentId = null, itemOrder = 0) {
    try {
      // First validate that the query exists in queries table
      const queryExists = await db.execute(
        'SELECT id, question_text FROM queries WHERE id = ?',
        [queryId]
      );
      
      if (queryExists.length === 0) {
        throw new Error(`Query ${queryId} does not exist in the system`);
      }
      
      logger.info(`Validated query ${queryId} exists: ${queryExists[0].question_text}`);
      
      // Validate parent_id if provided - parentId is the query_id of the parent query
      if (parentId !== null && parentId !== undefined) {
        logger.info('=== PARENT VALIDATION DEBUG ===', {
          subDomainId,
          queryId,
          parentId,
          queryType
        });
        
        const parentExists = await db.execute(
          'SELECT id, query_type FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?',
          [subDomainId, parentId]
        );
        
        logger.info('Parent query validation result:', {
          found: parentExists.length,
          parentData: parentExists
        });
        
        if (parentExists.length === 0) {
          logger.warn(`Parent query ${parentId} does not exist in sub-domain ${subDomainId}, attempting to auto-link it first`);
          
          // Try to auto-link the parent query as primary if it exists in queries table
          try {
            // Prevent recursion: only auto-link if we're not already trying to link the same query
            if (parentId !== queryId) {
              await this.linkQueryToSubDomain(subDomainId, parentId, 'primary', null, 0);
              
              // Re-fetch the newly created parent to get its row id
              const newParent = await db.execute(
                'SELECT id FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?',
                [subDomainId, parentId]
              );
              
              if (newParent.length > 0) {
                logger.info(`Auto-linked parent query ${parentId} to sub-domain ${subDomainId} as primary with row id ${newParent[0].id}`);
                // Update parentId to use the actual row id for the foreign key
                parentId = newParent[0].id;
              }
            } else {
              logger.warn(`Skipping auto-link of parent query ${parentId} to prevent recursion`);
            }
          } catch (autoLinkError) {
            logger.error(`Failed to auto-link parent query ${parentId}: ${autoLinkError.message}`);
            throw new Error(`Cannot link query ${queryId}: Parent query ${parentId} must be linked to sub-domain ${subDomainId} first. Please link the primary query manually.`);
          }
        } else {
          // Use the actual row id as parent_id for foreign key constraint
          const parentRowId = parentExists[0].id;
          logger.info(`Found parent row id ${parentRowId} for query ${parentId}, using it as parent_id`);
          parentId = parentRowId;
        }
      }

      const query = `
        INSERT INTO sub_domain_queries (sub_domain_id, query_id, query_type, parent_id, item_order)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE query_type = VALUES(query_type), parent_id = VALUES(parent_id), item_order = VALUES(item_order)
      `;
      await db.execute(query, [subDomainId, queryId, queryType, parentId, itemOrder]);
      logger.info(`Linked query ${queryId} to sub-domain ${subDomainId} with type ${queryType}`);

      // Also sync this query into existing project_queries and phase_queries
      // so it appears in ongoing inspections on mobile
      try {
        // Find all project phases that use this sub-domain
        const projectPhases = await db.execute(
          `SELECT DISTINCT pdsd.project_id, pdsd.phase_number, pdsd.domain_id
           FROM phase_domain_sub_domains pdsd
           WHERE pdsd.sub_domain_id = ?`,
          [subDomainId]
        );

        for (const pp of projectPhases) {
          // Check if project_query already exists
          const existingPQ = await db.execute(
            `SELECT id FROM project_queries
             WHERE project_id = ? AND phase_number = ? AND query_id = ? AND sub_domain_id = ?`,
            [pp.project_id, pp.phase_number, queryId, subDomainId]
          );

          let projectQueryId;
          if (existingPQ.length > 0) {
            projectQueryId = existingPQ[0].id;
          } else {
            // Create project_query entry
            const insertResult = await db.execute(
              `INSERT INTO project_queries (project_id, phase_number, query_id, domain_id, sub_domain_id, query_type, weightage)
               VALUES (?, ?, ?, ?, ?, ?, 0)`,
              [pp.project_id, pp.phase_number, queryId, pp.domain_id, subDomainId, queryType]
            );
            projectQueryId = insertResult.insertId;
          }

          // Insert into phase_queries
          await db.execute(
            `INSERT INTO phase_queries (project_id, phase_number, query_id, project_query_id, domain_id, sub_domain_id, weightage)
             VALUES (?, ?, ?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)`,
            [pp.project_id, pp.phase_number, queryId, projectQueryId, pp.domain_id, subDomainId]
          );
        }
        
        if (projectPhases.length > 0) {
          logger.info(`Synced query ${queryId} into ${projectPhases.length} project phases`);
        }
      } catch (syncError) {
        logger.warn(`Failed to sync query ${queryId} into project phases: ${syncError.message}`);
        // Don't fail the link operation if sync fails
      }

      return { message: 'Query linked successfully' };
    } catch (error) {
      logger.error('Error linking query to sub-domain:', error);
      throw error;
    }
  }

  async unlinkQueryFromSubDomain(subDomainId, queryId) {
    try {
      await db.execute(
        'DELETE FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?',
        [subDomainId, queryId]
      );
      logger.info(`Unlinked query ${queryId} from sub-domain ${subDomainId}`);
      return { message: 'Query unlinked successfully' };
    } catch (error) {
      logger.error('Error unlinking query from sub-domain:', error);
      throw error;
    }
  }

  async updateSubDomainQuery(subDomainId, queryId, queryType, parentId = null, itemOrder = null) {
    try {
      // Check if the record exists
      const existingRecord = await db.execute(
        'SELECT * FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?',
        [subDomainId, queryId]
      );

      if (existingRecord.length === 0) {
        // Record doesn't exist, insert it
        await this.linkQueryToSubDomain(subDomainId, queryId, queryType, parentId, itemOrder || 0);
        logger.info(`Inserted query ${queryId} configuration in sub-domain ${subDomainId}`);
        return { message: 'Query configuration created successfully' };
      }

      // Record exists, update it
      const updates = ['query_type = ?'];
      const params = [queryType];
      
      if (parentId !== null && parentId !== undefined) {
        updates.push('parent_id = ?');
        params.push(parentId);
      }
      
      if (itemOrder !== null && itemOrder !== undefined) {
        updates.push('item_order = ?');
        params.push(itemOrder);
      }
      
      params.push(subDomainId, queryId);
      
      const query = `
        UPDATE sub_domain_queries
        SET ${updates.join(', ')}
        WHERE sub_domain_id = ? AND query_id = ?
      `;
      await db.execute(query, params);
      
      logger.info(`Updated query ${queryId} configuration in sub-domain ${subDomainId}`);
      return { message: 'Query configuration updated successfully' };
    } catch (error) {
      logger.error('Error updating sub-domain query configuration:', error);
      throw error;
    }
  }

  async getQueriesBySubDomain(subDomainId) {
    try {
      const query = `
        SELECT 
          q.id,
          q.question_text as text,
          sq.query_type as type,
          sq.parent_id,
          sq.item_order
        FROM queries q
        INNER JOIN sub_domain_queries sq ON q.id = sq.query_id
        WHERE sq.sub_domain_id = ?
        ORDER BY sq.item_order ASC, q.id ASC
      `;
      const queries = await db.execute(query, [subDomainId]);
      return queries;
    } catch (error) {
      logger.error('Error fetching queries by sub-domain:', error);
      throw error;
    }
  }
}

module.exports = new QueryService();
