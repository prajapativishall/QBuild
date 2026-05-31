const db = require('../config/db');
const logger = require('../utils/logger');
const WeightageValidationService = require('../services/weightageValidation.service');

class WeightageManagementController {
  // Get all default domains with their weightages
  async getDomains(req, res) {
    try {
      const domains = await db.execute(`
        SELECT 
          s.id as domainId,
          s.domain_name as domainName,
          s.is_active as isActive,
          s.created_at as createdAt,
          s.updated_at as updatedAt
        FROM domains s
        ORDER BY s.domain_name
      `);

      res.json({
        success: true,
        data: domains
      });
    } catch (error) {
      logger.error('Error in getDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domains',
        error: error.message
      });
    }
  }

  // Update domain weightage
  async updateDomainWeightage(req, res) {
    try {
      const { domainId } = req.params;
      const { weightage } = req.body;

      if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weightage must be a number between 0 and 100'
        });
      }

      const result = await db.execute(`
        UPDATE domains 
        SET weightage = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [weightage, domainId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Domain not found'
        });
      }

      res.json({
        success: true,
        message: 'Domain weightage updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating domain weightage',
        error: error.message
      });
    }
  }

  // Normalize all domain weightages to 100%
  async normalizeDomainWeightages(req, res) {
    try {
      const domains = await db.execute(`
        SELECT id FROM domains WHERE is_active = true ORDER BY domain_name
      `);

      if (domains.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active domains found'
        });
      }

      const normalizedWeightage = 100 / domains.length;
      const roundedWeightage = Math.round(normalizedWeightage * 100) / 100;

      for (const domain of domains) {
        await db.execute(`
          UPDATE domains 
          SET weightage = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [roundedWeightage, domain.id]);
      }

      res.json({
        success: true,
        message: `Normalized weightage to ${roundedWeightage}% for ${domains.length} domains`
      });
    } catch (error) {
      logger.error('Error in normalizeDomainWeightages:', error);
      res.status(500).json({
        success: false,
        message: 'Error normalizing domain weightages',
        error: error.message
      });
    }
  }

  // Get all sub_domains with their default weightages
  async getSubDomains(req, res) {
    try {
      const subDomains = await db.execute(`
        SELECT 
          sec.id as subDomainId,
          sec.sub_domain_name as subDomainName,
          sec.description,
          sec.is_active as isActive,
          sec.created_at as createdAt,
          sec.updated_at as updatedAt
        FROM sub_domains sec
        ORDER BY sec.sub_domain_name
      `);

      res.json({
        success: true,
        data: subDomains
      });
    } catch (error) {
      logger.error('Error in getSubDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sub_domains',
        error: error.message
      });
    }
  }

  // Get domain-sub_domain relationships with weightages
  async getDomainSubDomains(req, res) {
    try {
      const { domainId } = req.params;

      const domainSubDomains = await db.execute(`
        SELECT 
          ss.domain_id,
          ss.sub_domain_id,
          ss.weightage,
          sec.sub_domain_name,
          sec.description,
          sec.is_active
        FROM domain_sub_domains ss
        INNER JOIN sub_domains sec ON ss.sub_domain_id = sec.id
        ${domainId ? 'WHERE ss.domain_id = ?' : ''}
        ORDER BY sec.sub_domain_name
      `, domainId ? [domainId] : []);

      logger.info('=== WEIGHTAGE MANAGEMENT DEBUG ===');
      logger.info('Raw domainSubDomains:', JSON.stringify(domainSubDomains, null, 2));
      
      const mappedDomainSubDomains = domainSubDomains.map(item => {
        logger.info('Processing item:', JSON.stringify(item, null, 2));
        logger.info('item.is_active:', item.is_active);
        const result = {
          ...item,
          id: item.sub_domain_id,
          name: item.sub_domain_name,
          isActive: item.is_active === 1,
          queries: []
        };
        logger.info('Mapped result:', JSON.stringify(result, null, 2));
        return result;
      });
      
      logger.info('Final mappedDomainSubDomains:', JSON.stringify(mappedDomainSubDomains, null, 2));

      res.json({
        success: true,
        data: mappedDomainSubDomains
      });
    } catch (error) {
      logger.error('Error in getDomainSubDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domain sub_domains',
        error: error.message
      });
    }
  }

  // Update domain-sub_domain weightage
  async updateDomainSubDomainWeightage(req, res) {
    try {
      const { domainId, subDomainId } = req.params;
      const { weightage } = req.body;

      if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weightage must be a number between 0 and 100'
        });
      }

      const result = await db.execute(`
        UPDATE domain_sub_domains 
        SET weightage = ?
        WHERE domain_id = ? AND sub_domain_id = ?
      `, [weightage, domainId, subDomainId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Domain-sub_domain relationship not found'
        });
      }

      res.json({
        success: true,
        message: 'Domain-sub_domain weightage updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateDomainSubDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating domain-sub_domain weightage',
        error: error.message
      });
    }
  }

  // Add sub_domain to domain
  async addSubDomainToDomain(req, res) {
    try {
      const { domainId, subDomainId } = req.params;
      const { weightage } = req.body;

      if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weightage must be a number between 0 and 100'
        });
      }

      await db.execute(`
        INSERT INTO domain_sub_domains (domain_id, sub_domain_id, weightage)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)
      `, [domainId, subDomainId, weightage || 0]);

      res.json({
        success: true,
        message: 'SubDomain added to domain successfully'
      });
    } catch (error) {
      logger.error('Error in addSubDomainToDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding sub_domain to domain',
        error: error.message
      });
    }
  }

  // Remove sub_domain from domain
  async removeSubDomainFromDomain(req, res) {
    try {
      const { domainId, subDomainId } = req.params;

      const result = await db.execute(`
        DELETE FROM domain_sub_domains 
        WHERE domain_id = ? AND sub_domain_id = ?
      `, [domainId, subDomainId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Domain-sub_domain relationship not found'
        });
      }

      res.json({
        success: true,
        message: 'SubDomain removed from domain successfully'
      });
    } catch (error) {
      logger.error('Error in removeSubDomainFromDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing sub_domain from domain',
        error: error.message
      });
    }
  }

  // Normalize sub_domains weightage for a domain
  async normalizeDomainSubDomains(req, res) {
    try {
      const { domainId } = req.params;
      
      const subDomains = await db.execute(`
        SELECT sub_domain_id, weightage
        FROM domain_sub_domains 
        WHERE domain_id = ?
      `, [domainId]);

      if (subDomains.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No sub_domains found for this domain'
        });
      }

      const normalizedWeightage = 100 / subDomains.length;
      const roundedWeightage = Math.round(normalizedWeightage * 100) / 100;

      for (const subDomain of subDomains) {
        await db.execute(`
          UPDATE domain_sub_domains 
          SET weightage = ?
          WHERE domain_id = ? AND sub_domain_id = ?
        `, [roundedWeightage, domainId, subDomain.sub_domain_id]);
      }

      res.json({
        success: true,
        message: `Normalized weightage to ${roundedWeightage}% for ${subDomains.length} sub_domains in domain`
      });
    } catch (error) {
      logger.error('Error in normalizeDomainSubDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error normalizing domain sub_domains weightage',
        error: error.message
      });
    }
  }

  // Batch update domain weightages
  async batchUpdateDomainWeightages(req, res) {
    try {
      const { domains } = req.body;

      if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Domains array is required'
        });
      }

      // Validate and normalize weightages
      logger.info('Validating domains:', { domains });
      const validation = WeightageValidationService.validateWeightage(
        domains,
        (s) => s.weightage,
        { allowZero: false, maxTotal: 100, minTotal: 100 }
      );

      logger.info('Validation result:', { validation });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid weightage distribution',
          errors: validation.errors
        });
      }

      const normalizedDomains = WeightageValidationService.normalizeWeightage(
        domains,
        (s) => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );

      // Update database
      for (const domain of normalizedDomains) {
        await db.execute(`
          UPDATE domains 
          SET weightage = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [domain.weightage, domain.domainId]);
      }

      res.json({
        success: true,
        message: `Updated weightages for ${normalizedDomains.length} domains`,
        data: normalizedDomains
      });
    } catch (error) {
      logger.error('Error in batchUpdateDomainWeightages:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating domain weightages',
        error: error.message
      });
    }
  }

  // Batch update domain-sub_domain weightages
  async batchUpdateDomainSubDomainWeightages(req, res) {
    try {
      const { domainId, subDomains } = req.body;

      if (!Array.isArray(subDomains) || subDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'SubDomains array is required'
        });
      }

      // Validate and normalize weightages
      const validation = WeightageValidationService.validateWeightage(
        subDomains,
        (s) => s.weightage,
        { allowZero: false, maxTotal: 100, minTotal: 100 }
      );

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid weightage distribution',
          errors: validation.errors
        });
      }

      const normalizedSubDomains = WeightageValidationService.normalizeWeightage(
        subDomains,
        (s) => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );

      // Update database
      for (const subDomain of normalizedSubDomains) {
        await db.execute(`
          UPDATE domain_sub_domains 
          SET weightage = ?
          WHERE domain_id = ? AND sub_domain_id = ?
        `, [subDomain.weightage, domainId, subDomain.subDomainId]);
      }

      res.json({
        success: true,
        message: `Updated weightages for ${normalizedSubDomains.length} sub_domains`,
        data: normalizedSubDomains
      });
    } catch (error) {
      logger.error('Error in batchUpdateDomainSubDomainWeightages:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sub_domain weightages',
        error: error.message
      });
    }
  }

  // Get complete weightage summary
  async getWeightageSummary(req, res) {
    try {
      const domains = await db.execute(`
        SELECT 
          s.id as domainId,
          s.domain_name as domainName,
          COUNT(ss.sub_domain_id) as subDomainCount,
          COALESCE(SUM(ss.weightage), 0) as totalSubDomainWeightage
        FROM domains s
        LEFT JOIN domain_sub_domains ss ON s.id = ss.domain_id
        WHERE s.is_active = true
        GROUP BY s.id, s.domain_name
        ORDER BY s.domain_name
      `);

      const domainSubDomains = await db.execute(`
        SELECT 
          ss.domain_id,
          ss.sub_domain_id,
          ss.weightage as subDomainWeightage,
          s.domain_name as domainName,
          sec.sub_domain_name as subDomainName
        FROM domain_sub_domains ss
        INNER JOIN domains s ON ss.domain_id = s.id
        INNER JOIN sub_domains sec ON ss.sub_domain_id = sec.id
        WHERE s.is_active = true
        ORDER BY s.domain_name, sec.sub_domain_name
      `);

      const subDomainsByDomain = new Map();
      for (const ss of domainSubDomains) {
        if (!subDomainsByDomain.has(ss.domain_id)) {
          subDomainsByDomain.set(ss.domain_id, []);
        }
        subDomainsByDomain.get(ss.domain_id).push({
          subDomainId: ss.sub_domain_id,
          subDomainName: ss.sub_domainName,
          weightage: ss.subDomainWeightage
        });
      }

      const summary = domains.map(domain => ({
        ...domain,
        subDomains: subDomainsByDomain.get(domain.domainId) || []
      }));

      // Calculate overall statistics
      const domainStats = WeightageValidationService.calculateStats(
        domains,
        (s) => 0
      );

      res.json({
        success: true,
        data: {
          domains: summary,
          statistics: {
            domains: domainStats,
            totalDomains: domains.length,
            totalDomainWeightage: 0
          }
        }
      });
    } catch (error) {
      logger.error('Error in getWeightageSummary:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching weightage summary',
        error: error.message
      });
    }
  }

  // Update project sub-domain manual flag (opt-out from auto-normalization)
  async updateProjectSubDomainManualFlag(req, res) {
    try {
      const { projectId, domainId, subDomainId } = req.params;
      const { isManual } = req.body;

      if (typeof isManual !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isManual must be a boolean value'
        });
      }

      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      // Check if the project-domain-subdomain relationship exists
      const existing = await db.execute(`
        SELECT id FROM phase_domain_sub_domains
        WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id = ?
      `, [projectId, phaseNumber, domainId, subDomainId]);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project-domain-subdomain relationship not found'
        });
      }

      await db.execute(`
        UPDATE phase_domain_sub_domains
        SET is_manual = ?
        WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id = ?
      `, [isManual ? 1 : 0, projectId, phaseNumber, domainId, subDomainId]);

      res.json({
        success: true,
        message: `Sub-domain manual flag updated to ${isManual}`
      });
    } catch (error) {
      logger.error('Error in updateProjectSubDomainManualFlag:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sub-domain manual flag',
        error: error.message
      });
    }
  }

  // Batch update project sub-domain weightages with manual flag support
  async batchUpdateProjectSubDomainWeightages(req, res) {
    try {
      const { projectId, domainId, subDomains } = req.body;

      if (!Array.isArray(subDomains) || subDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'SubDomains array is required'
        });
      }

      // Separate manual and auto items
      const manualSubDomains = subDomains.filter(s => s.isManual === true);
      const autoSubDomains = subDomains.filter(s => s.isManual !== true);

      // Calculate total from manual items
      const manualTotal = manualSubDomains.reduce((sum, s) => sum + (parseFloat(s.weightage) || 0), 0);
      const remainingTarget = Math.max(0, 100 - manualTotal);

      // Normalize auto items to fill remaining target
      let normalizedAutoSubDomains = [];
      if (autoSubDomains.length > 0) {
        normalizedAutoSubDomains = WeightageValidationService.normalizeWeightage(
          autoSubDomains,
          (s) => s.weightage,
          (s, w) => ({ ...s, weightage: w }),
          { getManualFlag: (s) => s.isManual === true, totalTarget: remainingTarget }
        );
      }

      // Combine manual items (unchanged) with normalized auto items
      const allSubDomains = [...manualSubDomains, ...normalizedAutoSubDomains];

      // Update database
      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      for (const subDomain of allSubDomains) {
        await db.execute(`
          UPDATE phase_domain_sub_domains
          SET weightage = ?, is_manual = ?
          WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id = ?
        `, [subDomain.weightage, subDomain.isManual === true ? 1 : 0, projectId, phaseNumber, domainId, subDomain.subDomainId]);
      }

      res.json({
        success: true,
        message: `Updated weightages for ${allSubDomains.length} sub-domains`,
        data: allSubDomains
      });
    } catch (error) {
      logger.error('Error in batchUpdateProjectSubDomainWeightages:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sub-domain weightages',
        error: error.message
      });
    }
  }
}

module.exports = new WeightageManagementController();
