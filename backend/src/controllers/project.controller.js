const projectService = require('../services/project.service');
const scoringService = require('../services/scoring.service');
const logger = require('../utils/logger');
const db = require('../config/db');

class ProjectController {
  // Get all projects
  async getAllProjects(req, res) {
    try {
      logger.info('Fetching all projects...');
      const projects = await projectService.getAllProjects(req.user);
      logger.info(`Found ${projects.length} projects`);
      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      logger.error('Error in getAllProjects:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching projects',
        error: error.message
      });
    }
  }

  // Get project by ID
  async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const project = await projectService.getProjectById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      logger.error('Error in getProjectById:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching project',
        error: error.message
      });
    }
  }

  // Create new project
  async createProject(req, res) {
    try {
      const projectData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      logger.info('Creating project with data:', { 
        name: projectData.name,
        createdBy: projectData.createdBy
      });
      
      const project = await projectService.createProject(projectData);
      
      logger.info('Project created successfully:', { id: project.id });
      
      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      logger.error('Error in createProject:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating project',
        error: error.message || 'Unknown database error'
      });
    }
  }

  // Update project
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const project = await projectService.updateProject(id, req.body);
      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });
    } catch (error) {
      logger.error('Error in updateProject:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating project',
        error: error.message
      });
    }
  }

  // Delete project
  async deleteProject(req, res) {
    try {
      const { id } = req.params;
      const result = await projectService.deleteProject(id);
      res.json({
        success: true,
        message: result.message || 'Project deleted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error in deleteProject:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting project',
        error: error.message
      });
    }
  }

  async importDomain(req, res) {
    try {
      const { projectId } = req.params;
      const { domainName } = req.body;
      // Get the domain by name (since we're using domain library by name)
      const domains = await db.execute(`SELECT * FROM domains WHERE domain_name = ? LIMIT 1`, [domainName]);
      if (!domains || domains.length === 0) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      const domainId = domains[0].id;
      const result = await projectService.importDomain(projectId, domainId);
      res.json(result);
    } catch (error) {
      logger.error('Error in importDomain:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAvailableDomains(req, res) {
    try {
      const { projectId } = req.params;
      const domains = await projectService.getAvailableDomains(projectId);
      res.json({ data: domains });
    } catch (error) {
      logger.error('Error in getAvailableDomains:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get spider chart data for a project (only after manager approval)
  async getProjectSpiderChart(req, res) {
    try {
      const { projectId } = req.params;
      const { phase } = req.query;

      // Determine the target phase number
      let targetPhaseNumber = phase;
      if (!targetPhaseNumber) {
        // FIX: Instead of using current_phase_id (which always points to the latest phase),
        // find the latest phase that has a manager-approved inspection.
        // This ensures the spider chart shows data for the most recently approved phase.
        const approvedPhaseRows = await db.execute(
          `SELECT i.phase FROM inspections i
           WHERE i.project_id = ? AND i.manager_approval_status = 'approved'
           ORDER BY i.phase DESC
           LIMIT 1`,
          [projectId]
        );
        
        if (approvedPhaseRows.length > 0) {
          targetPhaseNumber = approvedPhaseRows[0].phase;
        } else {
          // Fall back to current_phase_id if no approved inspection exists
          const currentPhaseRows = await db.execute(
            `SELECT ph.phase_number FROM projects p
             LEFT JOIN phases ph ON p.current_phase_id = ph.id
             WHERE p.id = ?`,
            [projectId]
          );
          targetPhaseNumber = currentPhaseRows[0]?.phase_number;
        }
      }

      if (!targetPhaseNumber) {
        const latestPhase = await db.execute(
          `SELECT phase_number FROM phases WHERE project_id = ? ORDER BY phase_number DESC LIMIT 1`,
          [projectId]
        );
        if (latestPhase.length > 0) {
          targetPhaseNumber = latestPhase[0].phase_number;
        } else {
          return res.status(404).json({ success: false, message: 'No phases found for project' });
        }
      }

      // Find the manager-approved inspection for this project phase
      const approvedInspections = await db.execute(
        `SELECT id FROM inspections 
         WHERE project_id = ? AND phase = ? AND manager_approval_status = 'approved'
         LIMIT 1`,
        [projectId, targetPhaseNumber]
      );

      if (approvedInspections.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No manager-approved inspection found for this phase. Spider chart is only available after manager approval.'
        });
      }

      const inspectionId = approvedInspections[0].id;

      // Use scoring service to get properly calculated scores with weightages
      const scoringResult = await scoringService.calculateInspectionScore(inspectionId);

      // Format response with domain scores including weightage
      const spiderData = (scoringResult.domains || []).map(d => ({
        domain_id: d.domainId,
        domain: d.domainName,
        score: Math.round((d.score / 10) * 10) / 10 || 0, // Convert percentage (0-100) to out-of-10
        weightage: d.weightage,
        subDomains: (d.subDomains || []).map(sd => ({
          subDomainId: sd.subDomainId,
          subDomainName: sd.subDomainName,
          score: Math.round((sd.score / 10) * 10) / 10 || 0,
          weightage: sd.weightage,
          earnedMarks: sd.earnedMarks,
          maxMarks: sd.maxMarks
        }))
      }));

      const overallRating = scoringResult.inspectionScore / 10; // Convert percentage to out-of-10

      res.json({
        success: true,
        data: spiderData,
        overallRating: Math.round(overallRating * 10) / 10,
        grade: scoringResult.grade
      });
    } catch (error) {
      logger.error('Error in getProjectSpiderChart:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching spider chart data',
        error: error.message
      });
    }
  }

  // Get spider chart data for a specific domain within a project
  async getDomainSpiderChart(req, res) {
    try {
      const { projectId, domainId } = req.params;
      const { phase } = req.query;

      // Determine the target phase number
      let targetPhaseNumber = phase;
      if (!targetPhaseNumber) {
        // FIX: Same fix as getProjectSpiderChart - find latest approved phase
        const approvedPhaseRows = await db.execute(
          `SELECT i.phase FROM inspections i
           WHERE i.project_id = ? AND i.manager_approval_status = 'approved'
           ORDER BY i.phase DESC
           LIMIT 1`,
          [projectId]
        );
        
        if (approvedPhaseRows.length > 0) {
          targetPhaseNumber = approvedPhaseRows[0].phase;
        } else {
          const currentPhaseRows = await db.execute(
            `SELECT ph.phase_number FROM projects p
             LEFT JOIN phases ph ON p.current_phase_id = ph.id
             WHERE p.id = ?`,
            [projectId]
          );
          targetPhaseNumber = currentPhaseRows[0]?.phase_number;
        }
      }

      if (!targetPhaseNumber) {
        const latestPhase = await db.execute(
          `SELECT phase_number FROM phases WHERE project_id = ? ORDER BY phase_number DESC LIMIT 1`,
          [projectId]
        );
        if (latestPhase.length > 0) {
          targetPhaseNumber = latestPhase[0].phase_number;
        } else {
          return res.status(404).json({ success: false, message: 'No phases found for project' });
        }
      }

      // Find the manager-approved inspection
      const approvedInspections = await db.execute(
        `SELECT id FROM inspections 
         WHERE project_id = ? AND phase = ? AND manager_approval_status = 'approved'
         LIMIT 1`,
        [projectId, targetPhaseNumber]
      );

      if (approvedInspections.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No manager-approved inspection found. Spider chart is only available after manager approval.'
        });
      }

      const inspectionId = approvedInspections[0].id;

      // Use scoring service to get properly calculated scores
      const scoringResult = await scoringService.calculateInspectionScore(inspectionId);
      
      // Find the specific domain data
      const domainData = (scoringResult.domains || []).find(d => d.domainId == domainId);
      
      if (!domainData) {
        return res.status(404).json({
          success: false,
          message: 'Domain not found in scoring results'
        });
      }

      const spiderData = (domainData.subDomains || []).map(sd => ({
        subDomain: sd.subDomainName,
        score: Math.round((sd.score / 10) * 10) / 10 || 0,
        weightage: sd.weightage,
        earnedMarks: sd.earnedMarks,
        maxMarks: sd.maxMarks
      }));

      const domainRating = domainData.score / 10; // Convert percentage to out-of-10

      res.json({
        success: true,
        data: spiderData,
        domainRating: Math.round(domainRating * 10) / 10
      });
    } catch (error) {
      logger.error('Error in getDomainSpiderChart:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domain spider chart data',
        error: error.message
      });
    }
  }

  // Get all phases for a project
  async getProjectPhases(req, res) {
    try {
      const { projectId } = req.params;

      const phases = await db.execute(`
        SELECT
          ph.id,
          ph.phase_number,
          ph.status,
          ph.start_date,
          ph.end_date,
          ph.inspector_id,
          ph.reviewer_id,
          ph.viewer_id,
          COALESCE(ph.inspection_id, i.id) as inspection_id,
          i.status as inspection_status,
          i.approval_status,
          i.manager_approval_status,
          u_insp.name as inspector_name,
          u_rev.name as reviewer_name,
          COALESCE(irh.rejection_count, 0) as history_count,
          irh.last_history_date,
          ph.created_at,
          ph.updated_at
        FROM phases ph
        LEFT JOIN inspections i ON i.project_id = ph.project_id AND i.phase = ph.phase_number
        LEFT JOIN (
          SELECT inspection_id,
                 COUNT(*) AS history_count,
                 COUNT(CASE WHEN action_type = 'rejected' THEN 1 END) AS rejection_count,
                 MAX(rejection_date) AS last_history_date
          FROM inspection_rejection_history
          GROUP BY inspection_id
        ) irh ON i.id = irh.inspection_id
        LEFT JOIN users u_insp ON ph.inspector_id = u_insp.id
        LEFT JOIN users u_rev ON ph.reviewer_id = u_rev.id
        WHERE ph.project_id = ?
        ORDER BY ph.phase_number ASC
      `, [projectId]);

      res.json({
        success: true,
        data: phases
      });
    } catch (error) {
      logger.error('Error in getProjectPhases:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching project phases',
        error: error.message
      });
    }
  }

  // Create new phase for a project
  async createPhase(req, res) {
    try {
      const { projectId } = req.params;
      const {
        sourcePhaseNumber,
        inspectorId,
        reviewerId,
        viewerId,
        inspectionDate,
        description,
        startDate,
        endDate,
        domains
      } = req.body;

      // Validate weightages if domains provided
      if (domains && domains.length > 0) {
        // Validate domain weightages sum to 100%
        const domainWeightageTotal = domains.reduce((sum, d) => sum + parseFloat(d.weightage || 0), 0);
        if (Math.abs(domainWeightageTotal - 100) > 0.01) {
          return res.status(400).json({
            success: false,
            message: `Domain weightages must sum to 100%. Current total: ${domainWeightageTotal.toFixed(2)}%`
          });
        }
        // Validate sub-domain weightages per domain sum to 100%
        for (const domain of domains) {
          const subDomains = domain.subDomains || domain.sections || [];
          if (subDomains.length > 0) {
            const sdTotal = subDomains.reduce((sum, sd) => sum + parseFloat(sd.weightage || 0), 0);
            if (Math.abs(sdTotal - 100) > 0.01) {
              const domainName = domain.domainName || domain.stageName || `ID ${domain.domainId || domain.stageId}`;
              return res.status(400).json({
                success: false,
                message: `Sub-domain weightages for domain "${domainName}" must sum to 100%. Current total: ${sdTotal.toFixed(2)}%`
              });
            }
          }
        }
      }

      logger.info(`Creating new phase for project ${projectId}`, { sourcePhaseNumber });

      // Get current max phase number
      const maxPhaseRows = await db.execute(
        'SELECT MAX(phase_number) as maxPhase FROM phases WHERE project_id = ?',
        [projectId]
      );
      // SELECT returns array of rows
      const maxPhaseResult = maxPhaseRows[0];
      const nextPhaseNumber = (maxPhaseResult?.maxPhase || 0) + 1;

      // Create new phase record
      const phaseResult = await db.execute(
        `INSERT INTO phases (
          project_id, phase_number, status, description, start_date, end_date,
          inspector_id, reviewer_id, viewer_id
        ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          nextPhaseNumber,
          description || null,
          startDate || null,
          endDate || null,
          inspectorId || null,
          reviewerId || null,
          viewerId || null
        ]
      );

      // INSERT returns ResultSetHeader object with insertId
      const phaseId = phaseResult.insertId;

      let inspectionId = null;

      // Only create inspection if inspector is assigned
      if (inspectorId) {
        const inspectionDateValue = inspectionDate || req.body.inspection_date || new Date().toISOString().split('T')[0];
        
        // Determine manager for this project's inspections: use project creator
        const projRow = await db.executeOne(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
        const managerForInspection = projRow?.created_by || null;

        const inspectionResult = await db.execute(
          `INSERT INTO inspections (project_id, phase, status, created_by, inspection_date, inspector_id, manager_id)
           VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
          [projectId, nextPhaseNumber, req.user?.id || null, inspectionDateValue, inspectorId, managerForInspection]
        );

        inspectionId = inspectionResult.insertId;

        // Update phase with inspection_id
        await db.execute(
          'UPDATE phases SET inspection_id = ? WHERE id = ?',
          [inspectionId, phaseId]
        );
      }

      // Insert phase domain configurations
      // Frontend sends: stages[].sections[] which maps to domains[].subDomains[]
      if (domains && domains.length > 0) {
        for (const domain of domains) {
          // Insert phase_domains
          await db.execute(
            `INSERT IGNORE INTO phase_domains (project_id, phase_number, domain_id, weightage)
             VALUES (?, ?, ?, ?)`,
            [projectId, nextPhaseNumber, domain.domainId || domain.stageId, domain.weightage || 0]
          );

          // Insert phase_domain_sub_domains and phase_queries
          // subDomains in backend = sections in frontend
          const subDomains = domain.subDomains || domain.sections || [];
          if (subDomains.length > 0) {
            for (const subDomain of subDomains) {
              await db.execute(
                `INSERT IGNORE INTO phase_domain_sub_domains 
                 (project_id, phase_number, domain_id, sub_domain_id, weightage, is_manual)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [projectId, nextPhaseNumber, domain.domainId || domain.stageId, 
                 subDomain.subDomainId || subDomain.sectionId, 
                 subDomain.weightage || 0, subDomain.isManual ? 1 : 0]
              );

              // Insert queries for this sub-domain
              // First ensure project_queries entries exist, then insert into phase_queries with project_query_id
              const queries = subDomain.queries || [];
              if (queries.length > 0) {
                for (const query of queries) {
                  const queryId = query.id || query.queryId;
                  const subDomainId = subDomain.subDomainId || subDomain.sectionId;
                  
                  // Check if project_query exists for this query + sub-domain
                  let projectQuery = await db.execute(
                    `SELECT id FROM project_queries 
                     WHERE project_id = ? AND query_id = ? AND sub_domain_id = ?`,
                    [projectId, queryId, subDomainId]
                  );
                  
                  let projectQueryId;
                  if (projectQuery.length > 0) {
                    projectQueryId = projectQuery[0].id;
                    // Update query_type if provided
                    if (query.type || query.queryType) {
                      await db.execute(
                        `UPDATE project_queries SET query_type = ? WHERE id = ?`,
                        [query.type || query.queryType, projectQueryId]
                      );
                    }
                  } else {
                    // Create project_query entry with query_type
                    const insertResult = await db.execute(
                      `INSERT INTO project_queries (project_id, phase_number, query_id, domain_id, sub_domain_id, weightage, query_type, parent_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [projectId, nextPhaseNumber, queryId, domain.domainId || domain.stageId, subDomainId, query.weightage || 0, query.type || query.queryType || 'primary', query.parentId || null]
                    );
                    projectQueryId = insertResult.insertId;
                  }
                  
                  // Insert into phase_queries using the mapped project_query_id
                  await db.execute(
                    `INSERT INTO phase_queries (project_id, phase_number, query_id, project_query_id, domain_id, sub_domain_id, weightage)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)`,
                    [projectId, nextPhaseNumber, queryId, projectQueryId, domain.domainId || domain.stageId, subDomainId, query.weightage || 0]
                  );
                }
              }
            }
          }
        }
      }

      // Update project's current_phase_id
      await db.execute(
        'UPDATE projects SET current_phase_id = ? WHERE id = ?',
        [phaseId, projectId]
      );

      logger.info(`New phase ${nextPhaseNumber} created successfully for project ${projectId}, set current_phase_id=${phaseId}`);

      res.json({
        success: true,
        message: 'New phase created successfully',
        data: {
          phaseId,
          phaseNumber: nextPhaseNumber,
          inspectionId,
          projectId
        }
      });
    } catch (error) {
      logger.error('Error in createPhase:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating new phase',
        error: error.message
      });
    }
  }

  // Update an existing phase configuration
  async updatePhase(req, res) {
    try {
      const { projectId, phaseNumber } = req.params;
      const {
        inspectorId,
        reviewerId,
        viewerId,
        inspectionDate,
        description,
        startDate,
        endDate,
        domains
      } = req.body;

      // Validate weightages if domains provided
      if (domains && domains.length > 0) {
        const domainWeightageTotal = domains.reduce((sum, d) => sum + parseFloat(d.weightage || 0), 0);
        if (Math.abs(domainWeightageTotal - 100) > 0.01) {
          return res.status(400).json({
            success: false,
            message: `Domain weightages must sum to 100%. Current total: ${domainWeightageTotal.toFixed(2)}%`
          });
        }
        for (const domain of domains) {
          const subDomains = domain.subDomains || domain.sections || [];
          if (subDomains.length > 0) {
            const sdTotal = subDomains.reduce((sum, sd) => sum + parseFloat(sd.weightage || 0), 0);
            if (Math.abs(sdTotal - 100) > 0.01) {
              const domainName = domain.domainName || domain.stageName || `ID ${domain.domainId || domain.stageId}`;
              return res.status(400).json({
                success: false,
                message: `Sub-domain weightages for domain "${domainName}" must sum to 100%. Current total: ${sdTotal.toFixed(2)}%`
              });
            }
          }
        }
      }

      const phaseRows = await db.execute(
        `SELECT id, inspection_id FROM phases WHERE project_id = ? AND phase_number = ?`,
        [projectId, phaseNumber]
      );

      if (phaseRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Phase not found'
        });
      }

      const phase = phaseRows[0];

      await db.execute(
        `UPDATE phases
         SET inspector_id = ?,
             reviewer_id = ?,
             viewer_id = ?,
             description = ?,
             start_date = ?,
             end_date = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          inspectorId || null,
          reviewerId || null,
          viewerId || null,
          description || null,
          startDate || null,
          endDate || null,
          phase.id
        ]
      );

      let inspectionId = phase.inspection_id;
      if (inspectionId && inspectorId) {
        // Update existing inspection with inspector_id
        await db.execute(
          `UPDATE inspections SET inspector_id = ? WHERE id = ?`,
          [inspectorId, inspectionId]
        );
      } else if (!inspectionId && inspectorId) {
        const inspectionDateValue = inspectionDate || req.body.inspection_date || new Date().toISOString().split('T')[0];
        
        // Determine manager for this project's inspections: use project creator
        const projRow = await db.executeOne(`SELECT created_by FROM projects WHERE id = ?`, [projectId]);
        const managerForInspection = projRow?.created_by || null;

        const inspectionResult = await db.execute(
          `INSERT INTO inspections (project_id, phase, status, created_by, inspection_date, inspector_id, manager_id)
           VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
          [projectId, phaseNumber, req.user?.id || null, inspectionDateValue, inspectorId, managerForInspection]
        );

        inspectionId = inspectionResult.insertId;
        await db.execute(
          `UPDATE phases SET inspection_id = ? WHERE id = ?`,
          [inspectionId, phase.id]
        );
      }

      await db.execute(
        `DELETE FROM phase_queries WHERE project_id = ? AND phase_number = ?`,
        [projectId, phaseNumber]
      );
      await db.execute(
        `DELETE FROM phase_domain_sub_domains WHERE project_id = ? AND phase_number = ?`,
        [projectId, phaseNumber]
      );
      await db.execute(
        `DELETE FROM phase_domains WHERE project_id = ? AND phase_number = ?`,
        [projectId, phaseNumber]
      );

      if (domains && domains.length > 0) {
        for (const domain of domains) {
          const domainId = domain.domainId || domain.stageId;
          await db.execute(
            `INSERT INTO phase_domains (project_id, phase_number, domain_id, weightage)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)`,
            [projectId, phaseNumber, domainId, domain.weightage || 0]
          );

          const subDomains = domain.subDomains || domain.sections || [];
          for (const subDomain of subDomains) {
            const subDomainId = subDomain.subDomainId || subDomain.sectionId;
            await db.execute(
              `INSERT INTO phase_domain_sub_domains
               (project_id, phase_number, domain_id, sub_domain_id, weightage, is_manual)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE weightage = VALUES(weightage), is_manual = VALUES(is_manual)`,
              [projectId, phaseNumber, domainId, subDomainId, subDomain.weightage || 0, subDomain.isManual ? 1 : 0]
            );

            const queries = subDomain.queries || [];
            for (const query of queries) {
              const queryId = query.id || query.queryId;
              if (!queryId) continue;

              let projectQuery = await db.execute(
                `SELECT id FROM project_queries
                 WHERE project_id = ? AND phase_number = ? AND query_id = ?`,
                [projectId, phaseNumber, queryId]
              );

              let projectQueryId = projectQuery[0]?.id;
              if (!projectQueryId) {
                const insertResult = await db.execute(
                  `INSERT INTO project_queries (project_id, phase_number, query_id, domain_id, sub_domain_id, query_type, parent_id, weightage)
                   VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
                  [projectId, phaseNumber, queryId, domainId, subDomainId, query.type || 'primary', query.weightage || 0]
                );
                projectQueryId = insertResult.insertId;
              } else {
                await db.execute(
                  `UPDATE project_queries
                   SET domain_id = ?, query_type = ?, weightage = ?
                   WHERE id = ?`,
                  [domainId, query.type || 'primary', query.weightage || 0, projectQueryId]
                );
              }

              await db.execute(
                `INSERT INTO phase_queries (project_id, phase_number, query_id, project_query_id, domain_id, sub_domain_id, weightage)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE weightage = VALUES(weightage)`,
                [projectId, phaseNumber, queryId, projectQueryId, domainId, subDomainId, query.weightage || 0]
              );
            }
          }
        }
      }

      res.json({
        success: true,
        message: 'Phase updated successfully',
        data: {
          phaseId: phase.id,
          phaseNumber: Number(phaseNumber),
          inspectionId,
          projectId: Number(projectId)
        }
      });
    } catch (error) {
      logger.error('Error in updatePhase:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating phase',
        error: error.message
      });
    }
  }

  // Get phase configuration from phase tables
  async getPhaseConfiguration(req, res) {
    try {
      const { projectId, phaseNumber } = req.params;
      logger.info(`Fetching phase configuration for project ${projectId}, phase ${phaseNumber}`);

      // Get phase details
      const phases = await db.execute(
        `SELECT id, phase_number, inspector_id, reviewer_id, viewer_id,
          inspection_id, description, start_date, end_date,
          status
        FROM phases
        WHERE project_id = ? AND phase_number = ?`,
        [projectId, phaseNumber]
      );

      if (phases.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Phase not found'
        });
      }

      const phase = phases[0];
      const inspectionId = phase.inspection_id;
      let inspectionHistory = [];

      if (inspectionId) {
        inspectionHistory = await db.execute(
          `SELECT 
            irh.id,
            irh.inspection_id,
            irh.actor_role,
            irh.action_type,
            irh.scope_type,
            irh.domain_id,
            irh.sub_domain_id,
            irh.query_id,
            irh.rejection_reason,
            irh.rejection_notes,
            irh.responses,
            irh.rejection_date,
            u.name as rejected_by_name,
            u.email as rejected_by_email
          FROM inspection_rejection_history irh
          LEFT JOIN users u ON irh.rejected_by = u.id
          WHERE irh.inspection_id = ?
          ORDER BY irh.rejection_date DESC`,
          [inspectionId]
        );
      }

      // Get phase domains with sub-domains and queries from the current phase configuration
      let domains = await db.execute(
        `SELECT 
          pd.domain_id,
          pd.weightage as domain_weightage,
          d.domain_name
        FROM phase_domains pd
        JOIN domains d ON pd.domain_id = d.id
        WHERE pd.project_id = ? AND pd.phase_number = ?`,
        [projectId, phaseNumber]
      );

      // If no phase_domains are configured for this phase, leave domains empty.
      if (!domains || domains.length === 0) {
        logger.info(`No phase_domains found for project ${projectId} phase ${phaseNumber}; returning empty phase configuration`);
      }

      // Get sub-domains for each domain
      const subDomains = await db.execute(
        `SELECT 
          pdsd.domain_id,
          pdsd.sub_domain_id,
          pdsd.weightage,
          pdsd.is_manual,
          sd.sub_domain_name
        FROM phase_domain_sub_domains pdsd
        JOIN sub_domains sd ON pdsd.sub_domain_id = sd.id
        WHERE pdsd.project_id = ? AND pdsd.phase_number = ?`,
        [projectId, phaseNumber]
      );

      // Get queries for each sub-domain
      const queries = await db.execute(
        `SELECT 
          pq.query_id,
          pq.domain_id,
          pq.sub_domain_id,
          COALESCE(sq.query_type, 'primary') as query_type,
          COALESCE(sq.parent_id, NULL) as parent_id,
          pq.weightage,
          q.question_text
        FROM phase_queries pq
        JOIN queries q ON pq.query_id = q.id
        LEFT JOIN sub_domain_queries sq ON q.id = sq.query_id AND sq.sub_domain_id = pq.sub_domain_id
        WHERE pq.project_id = ? AND pq.phase_number = ?`,
        [projectId, phaseNumber]
      );

      // Ensure arrays (handle case where db.execute might return null/undefined)
      const safeDomains = Array.isArray(domains) ? domains : [];
      const safeSubDomains = Array.isArray(subDomains) ? subDomains : [];
      const safeQueries = Array.isArray(queries) ? queries : [];

      // Build the response structure
      const domainsWithSubDomains = safeDomains.map(domain => {
        const domainSubDomains = safeSubDomains
          .filter(sd => sd.domain_id === domain.domain_id)
          .map(sd => {
            const subDomainQueries = safeQueries
              .filter(q => q.domain_id === sd.domain_id && q.sub_domain_id === sd.sub_domain_id)
              .map(q => ({
                id: q.query_id,
                text: q.question_text,
                type: q.query_type,
                weightage: q.weightage
              }));

            return {
              sub_domain_id: sd.sub_domain_id,
              sub_domain_name: sd.sub_domain_name,
              weightage: sd.weightage,
              is_manual: sd.is_manual === 1,
              queries: subDomainQueries
            };
          });

        return {
          domain_id: domain.domain_id,
          domain_name: domain.domain_name,
          weightage: domain.domain_weightage,
          sub_domains: domainSubDomains
        };
      });

      res.json({
        success: true,
        data: {
          phase_number: phase.phase_number,
          inspector_id: phase.inspector_id,
          reviewer_id: phase.reviewer_id,
          viewer_id: phase.viewer_id,
          inspection_id: phase.inspection_id,
          status: phase.status,
          domains: domainsWithSubDomains,
          history: inspectionHistory
        }
      });
    } catch (error) {
      logger.error('Error in getPhaseConfiguration:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching phase configuration',
        error: error.message
      });
    }
  }
}

module.exports = new ProjectController();