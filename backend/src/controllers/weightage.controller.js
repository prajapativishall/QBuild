const db = require('../config/db');
const logger = require('../utils/logger');

class WeightageController {
  // Get default weightages for project creation
  async getDefaultWeightages(req, res) {
    try {
      const projectService = require('../services/project.service');
      const defaultWeightages = await projectService.loadDefaultWeightages();
      
      res.json({
        success: true,
        data: defaultWeightages
      });
    } catch (error) {
      logger.error('Error in getDefaultWeightages:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching default weightages',
        error: error.message
      });
    }
  }

  // Get all domains with their default weightage and sub_domains
  async getDomainsWithSubDomains(req, res) {
    try {
      const domains = await db.execute(`
        SELECT 
          s.id as domainId,
          s.domain_name as domainName,
          ss.sub_domain_id as subDomainId,
          sec.sub_domain_name as subDomainName,
          ss.weightage as defaultSubDomainWeightage
        FROM domains s
        LEFT JOIN domain_sub_domains ss ON s.id = ss.domain_id
        LEFT JOIN sub_domains sec ON ss.sub_domain_id = sec.id
        WHERE s.is_active = true
        ORDER BY s.domain_name, sec.sub_domain_name
      `);

      const domainsMap = new Map();
      
      for (const row of domains) {
        if (!domainsMap.has(row.domainId)) {
          domainsMap.set(row.domainId, {
            domainId: row.domainId,
            domainName: row.domainName,
            defaultWeightage: row.defaultWeightage,
            domainOrder: row.domainOrder,
            subDomains: []
          });
        }
        
        if (row.subDomainId) {
          domainsMap.get(row.domainId).subDomains.push({
            subDomainId: row.subDomainId,
            subDomainName: row.subDomainName,
            defaultWeightage: row.defaultSubDomainWeightage
          });
        }
      }

      res.json({
        success: true,
        data: Array.from(domainsMap.values())
      });
    } catch (error) {
      logger.error('Error in getDomainsWithSubDomains:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domains and sub_domains',
        error: error.message
      });
    }
  }

  // Get project-specific weightage for a domain
  async getProjectDomainWeightage(req, res) {
    try {
      const { projectId, domainId } = req.params;
      
      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      const domainInfo = await db.executeOne(`
        SELECT 
          s.id as domainId,
          s.domain_name as domainName,
          ps.weightage as projectWeightage,
          s.weightage as defaultWeightage
        FROM domains s
        LEFT JOIN phase_domains ps ON s.id = ps.domain_id AND ps.project_id = ? AND ps.phase_number = ?
        WHERE s.id = ?
      `, [projectId, phaseNumber, domainId]);

      if (!domainInfo) {
        return res.status(404).json({
          success: false,
          message: 'Domain not found'
        });
      }

      const subDomains = await db.execute(`
        SELECT 
          sec.id as subDomainId,
          sec.sub_domain_name as subDomainName,
          ss.weightage as defaultWeightage,
          pss.weightage as projectWeightage,
          CASE WHEN pss.sub_domain_id IS NOT NULL THEN 1 ELSE 0 END as isSelected
        FROM sub_domains sec
        LEFT JOIN domain_sub_domains ss ON sec.id = ss.sub_domain_id AND ss.domain_id = ?
        LEFT JOIN phase_domain_sub_domains pss ON sec.id = pss.sub_domain_id 
          AND pss.domain_id = ? AND pss.project_id = ? AND pss.phase_number = ?
        WHERE ss.sub_domain_id IS NOT NULL
        ORDER BY sec.sub_domain_name
      `, [domainId, domainId, projectId, phaseNumber]);

      res.json({
        success: true,
        data: {
          ...domainInfo,
          projectWeightage: domainInfo.projectWeightage || domainInfo.defaultWeightage,
          subDomains: subDomains.map(s => ({
            ...s,
            projectWeightage: s.projectWeightage || s.defaultWeightage
          }))
        }
      });
    } catch (error) {
      logger.error('Error in getProjectDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching project domain weightage',
        error: error.message
      });
    }
  }

  // Update project domain weightage
  async updateProjectDomainWeightage(req, res) {
    try {
      const { projectId, domainId } = req.params;
      const { weightage } = req.body;

      if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weightage must be a number between 0 and 100'
        });
      }

      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      await db.execute(`
        INSERT INTO phase_domains (project_id, phase_number, domain_id, weightage)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)
      `, [projectId, phaseNumber, domainId, weightage]);

      res.json({
        success: true,
        message: 'Domain weightage updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateProjectDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating domain weightage',
        error: error.message
      });
    }
  }

  // Add sub_domains to a project domain
  async addSubDomainsToProjectDomain(req, res) {
    try {
      const { projectId, domainId } = req.params;
      const { subDomains } = req.body;

      if (!Array.isArray(subDomains) || subDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'SubDomains array is required'
        });
      }

      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      // Validate sub_domains exist in domain_sub_domains
      const validSubDomains = await db.execute(`
        SELECT sub_domain_id, weightage
        FROM domain_sub_domains 
        WHERE domain_id = ? AND sub_domain_id IN (${subDomains.map(() => '?').join(',')})
      `, [domainId, ...subDomains]);

      if (validSubDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid sub_domains found for this domain'
        });
      }

      // Insert sub_domains with default weightage
      for (const subDomain of validSubDomains) {
        await db.execute(`
          INSERT INTO phase_domain_sub_domains (project_id, phase_number, domain_id, sub_domain_id, weightage)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)
        `, [projectId, phaseNumber, domainId, subDomain.sub_domain_id, subDomain.weightage]);
      }

      res.json({
        success: true,
        message: `Added ${validSubDomains.length} sub_domains to project domain`
      });
    } catch (error) {
      logger.error('Error in addSubDomainsToProjectDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding sub_domains to project domain',
        error: error.message
      });
    }
  }

  // Remove sub_domains from a project domain
  async removeSubDomainsFromProjectDomain(req, res) {
    try {
      const { projectId, domainId } = req.params;
      const { subDomains } = req.body;

      if (!Array.isArray(subDomains) || subDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'SubDomains array is required'
        });
      }

      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      const result = await db.execute(`
        DELETE FROM phase_domain_sub_domains 
        WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id IN (${subDomains.map(() => '?').join(',')})
      `, [projectId, phaseNumber, domainId, ...subDomains]);

      res.json({
        success: true,
        message: `Removed ${result.affectedRows} sub_domains from project domain`
      });
    } catch (error) {
      logger.error('Error in removeSubDomainsFromProjectDomain:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing sub_domains from project domain',
        error: error.message
      });
    }
  }

  // Update project domain sub_domain weightage
  async updateProjectSubDomainWeightage(req, res) {
    try {
      const { projectId, domainId, subDomainId } = req.params;
      const { weightage } = req.body;

      if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weightage must be a number between 0 and 100'
        });

        // Also ensure queries for the added sub-domains are copied into project_queries and phase_queries
        for (const sd of validSubDomains) {
          // get all queries for this sub-domain from the library
          const sqRows = await db.execute(
            `SELECT q.id as query_id, sdq.query_type, sdq.parent_id
             FROM sub_domain_queries sdq
             JOIN queries q ON sdq.query_id = q.id
             WHERE sdq.sub_domain_id = ?
             ORDER BY sdq.item_order ASC`,
            [sd.sub_domain_id]
          );

          for (const q of sqRows) {
            // ensure project_query exists
            const existing = await db.execute(
              `SELECT id FROM project_queries WHERE project_id = ? AND query_id = ? AND sub_domain_id = ?`,
              [projectId, q.query_id, sd.sub_domain_id]
            );

            let projectQueryId;
            if (existing.length > 0) {
              projectQueryId = existing[0].id;
            } else {
              const ins = await db.executeWithResult(
                `INSERT INTO project_queries (project_id, phase_number, query_id, domain_id, sub_domain_id, query_type, parent_id, weightage)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [projectId, phaseNumber, q.query_id, domainId, sd.sub_domain_id, q.query_type || 'primary', q.parent_id || null, 0]
              );
              projectQueryId = ins.insertId;
            }

            // insert into phase_queries if not present
            await db.execute(
              `INSERT INTO phase_queries (project_id, phase_number, query_id, project_query_id, domain_id, sub_domain_id, weightage)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)`,
              [projectId, phaseNumber, q.query_id, projectQueryId, domainId, sd.sub_domain_id, 0]
            );
          }
        }
      }

      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      const result = await db.execute(`
        UPDATE phase_domain_sub_domains 
        SET weightage = ?
        WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id = ?
      `, [weightage, projectId, phaseNumber, domainId, subDomainId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'SubDomain not found in project domain'
        });
      }

      res.json({
        success: true,
        message: 'SubDomain weightage updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateProjectSubDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sub_domain weightage',
        error: error.message
      });
    }
  }

  // Normalize weightage for a project domain
  async normalizeProjectDomainWeightage(req, res) {
    try {
      const { projectId, domainId } = req.params;
      
      const phaseRow = await db.executeOne(
        `SELECT ph.phase_number FROM projects p
         LEFT JOIN phases ph ON p.current_phase_id = ph.id
         WHERE p.id = ?`,
        [projectId]
      );
      const phaseNumber = phaseRow?.phase_number;

      // Get all sub_domains for this project domain
      const subDomains = await db.execute(`
        SELECT sub_domain_id, weightage
        FROM phase_domain_sub_domains 
        WHERE project_id = ? AND phase_number = ? AND domain_id = ?
      `, [projectId, phaseNumber, domainId]);

      if (subDomains.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No sub_domains found for this project domain'
        });
      }

      // Calculate normalized weightage (equal distribution)
      const normalizedWeightage = 100 / subDomains.length;
      const roundedWeightage = Math.round(normalizedWeightage * 100) / 100;

      // Update all sub_domains
      for (const subDomain of subDomains) {
        await db.execute(`
          UPDATE phase_domain_sub_domains 
          SET weightage = ?
          WHERE project_id = ? AND phase_number = ? AND domain_id = ? AND sub_domain_id = ?
        `, [roundedWeightage, projectId, phaseNumber, domainId, subDomain.sub_domain_id]);
      }

      res.json({
        success: true,
        message: `Normalized weightage to ${roundedWeightage}% for ${subDomains.length} sub_domains`
      });
    } catch (error) {
      logger.error('Error in normalizeProjectDomainWeightage:', error);
      res.status(500).json({
        success: false,
        message: 'Error normalizing weightage',
        error: error.message
      });
    }
  }
}

module.exports = new WeightageController();
