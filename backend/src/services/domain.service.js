const db = require('../config/db');
const logger = require('../utils/logger');

class DomainService {
  // Get all domains with their sub_domains
  async getAllDomains() {
    try {
      const query = `
        SELECT 
          s.id,
          s.domain_name as name,
          s.description,
          s.is_active as isActive,
          s.created_at as createdAt
        FROM domains s
        ORDER BY s.domain_name
      `;
      
      const rows = await db.execute(query);

      const domains = rows.map((row) => ({
        ...row,
        description: row.description || '',
        isActive: row.isActive !== false,
        subDomains: []
      }));

      if (domains.length === 0) return domains;

      const domainIds = domains.map(s => s.id);
      const placeholders = domainIds.map(() => '?').join(',');
      const subDomainRows = await db.execute(
        `
          SELECT
            ss.domain_id as domainId,
            sec.id as subDomainId,
            sec.sub_domain_name as subDomainName,
            ss.weightage
          FROM domain_sub_domains ss
          INNER JOIN sub_domains sec ON sec.id = ss.sub_domain_id
          WHERE ss.domain_id IN (${placeholders})
          ORDER BY ss.domain_id, sec.sub_domain_name
        `,
        domainIds
      );

      const subDomainsByDomainId = new Map();
      for (const r of subDomainRows) {
        const list = subDomainsByDomainId.get(r.domainId) || [];
        list.push({
          subDomainId: r.subDomainId,
          subDomainName: r.subDomainName,
          weightage: r.weightage
        });
        subDomainsByDomainId.set(r.domainId, list);
      }

      return domains.map((s) => ({
        ...s,
        subDomains: subDomainsByDomainId.get(s.id) || []
      }));
    } catch (error) {
      logger.error('Error fetching domains:', error);
      throw error;
    }
  }

  // Get domain by ID with sub_domains
  async getDomainById(id) {
    try {
      const query = `
        SELECT 
          s.id,
          s.domain_name as name,
          s.description,
          s.is_active as isActive,
          s.created_at as createdAt
        FROM domains s
        WHERE s.id = ?
      `;
      
      const rows = await db.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const domain = rows[0];

      const subDomains = await db.execute(
        `
          SELECT
            sec.id as subDomainId,
            sec.sub_domain_name as subDomainName,
            ss.weightage
          FROM domain_sub_domains ss
          INNER JOIN sub_domains sec ON sec.id = ss.sub_domain_id
          WHERE ss.domain_id = ?
          ORDER BY sec.sub_domain_name
        `,
        [id]
      );

      return {
        ...domain,
        description: domain.description || '',
        isActive: domain.isActive !== false,
        subDomains
      };
    } catch (error) {
      logger.error(`Error fetching domain ${id}:`, error);
      throw error;
    }
  }

  // Create new domain
  async createDomain(domainData) {
    try {
      const domainResult = await db.executeWithResult(
        `
          INSERT INTO domains (domain_name, description, is_active)
          VALUES (?, ?, ?)
        `,
        [
          domainData.name,
          domainData.description || '',
          domainData.isActive !== false
        ]
      );

      const domainId = domainResult.insertId;
      const subDomains = Array.isArray(domainData.subDomains) ? domainData.subDomains : [];

      try {
        for (const s of subDomains) {
          if (!s || !s.subDomainId) continue;
          const subDomainId = parseInt(s.subDomainId);
          if (!Number.isFinite(subDomainId)) continue;
          await db.execute(
            `
              INSERT INTO domain_sub_domains (domain_id, sub_domain_id, weightage)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)
            `,
            [domainId, subDomainId, s.weightage || 0]
          );
        }
      } catch (e) {
        await db.execute('DELETE FROM domain_sub_domains WHERE domain_id = ?', [domainId]);
        await db.execute('DELETE FROM domains WHERE id = ?', [domainId]);
        throw e;
      }

      logger.info(`Domain created: ${domainId}`);
      return await this.getDomainById(domainId);
    } catch (error) {
      logger.error('Error creating domain:', error);
      throw error;
    }
  }

  // Update domain
  async updateDomain(id, domainData) {
    try {
      await db.execute(
        `
          UPDATE domains SET
            domain_name = ?,
            description = ?,
            is_active = ?
          WHERE id = ?
        `,
        [
          domainData.name,
          domainData.description || '',
          domainData.isActive !== false,
          id
        ]
      );

      if (Array.isArray(domainData.subDomains)) {
        await db.execute('DELETE FROM domain_sub_domains WHERE domain_id = ?', [id]);
        for (const s of domainData.subDomains) {
          if (!s || !s.subDomainId) continue;
          const subDomainId = parseInt(s.subDomainId);
          if (!Number.isFinite(subDomainId)) continue;
          await db.execute(
            `
              INSERT INTO domain_sub_domains (domain_id, sub_domain_id, weightage)
              VALUES (?, ?, ?)
            `,
            [id, subDomainId, s.weightage || 0]
          );
        }
      }

      logger.info(`Domain updated: ${id}`);
      return await this.getDomainById(id);
    } catch (error) {
      logger.error(`Error updating domain ${id}:`, error);
      throw error;
    }
  }

  // Delete domain
  async deleteDomain(id) {
    try {
      const query = 'DELETE FROM domains WHERE id = ?';
      const result = await db.execute(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Domain not found');
      }
      
      logger.info(`Domain deleted: ${id}`);
      return { id, message: 'Domain deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting domain ${id}:`, error);
      throw error;
    }
  }
}

module.exports = new DomainService();
