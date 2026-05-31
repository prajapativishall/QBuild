const db = require('../config/db');
const logger = require('../utils/logger');
const WeightageValidationService = require('./weightageValidation.service');

class ProjectService {
  normalizePercentWeights(items, getWeight, setWeight) {
    return WeightageValidationService.normalizeWeightage(
      items,
      getWeight,
      setWeight,
      { precision: 2 }
    );
  }

  async getProgressSummary(projectIds) {
    const ids = Array.isArray(projectIds) ? projectIds.filter((x) => Number.isFinite(x)) : [];
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');

    const latestInspectionRows = await db.execute(
      `
        SELECT project_id as projectId, MAX(id) as inspectionId
        FROM inspections
        WHERE project_id IN (${placeholders})
        GROUP BY project_id
      `,
      ids
    );

    const latestInspectionByProjectId = new Map();
    for (const r of latestInspectionRows) {
      latestInspectionByProjectId.set(r.projectId, r.inspectionId);
    }

    const domainAnsweredRows = await db.execute(
      `
        SELECT
          i.project_id as projectId,
          pdsd.domain_id as domainId,
          COUNT(DISTINCT r.query_id) as answeredItems
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN responses r ON r.inspection_id = i.id
        INNER JOIN queries q ON q.id = r.query_id
        INNER JOIN sub_domain_queries sq ON sq.query_id = q.id
        INNER JOIN phase_domain_sub_domains pdsd ON pdsd.sub_domain_id = sq.sub_domain_id
          AND pdsd.project_id = i.project_id
          AND pdsd.phase_number = i.phase
        GROUP BY i.project_id, pdsd.domain_id
      `,
      ids
    );

    const answeredByProjectDomain = new Map();
    for (const r of domainAnsweredRows) {
      answeredByProjectDomain.set(`${r.projectId}:${r.domainId}`, Number(r.answeredItems) || 0);
    }

    const domainTotalRows = await db.execute(
      `
        SELECT
          i.project_id as projectId,
          pdsd.domain_id as domainId,
          COUNT(DISTINCT q.id) as totalItems
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN phase_domain_sub_domains pdsd ON pdsd.project_id = i.project_id AND pdsd.phase_number = i.phase
        INNER JOIN sub_domain_queries sq ON sq.sub_domain_id = pdsd.sub_domain_id
        INNER JOIN queries q ON q.id = sq.query_id
        GROUP BY i.project_id, pdsd.domain_id
      `,
      ids
    );
    const totalItemsByDomainId = new Map();
    for (const r of domainTotalRows) {
      totalItemsByDomainId.set(`${r.projectId}:${r.domainId}`, Number(r.totalItems) || 0);
    }

    const domainSubDomainTotalRows = await db.execute(
      `
        SELECT
          i.project_id as projectId,
          pdsd.domain_id as domainId,
          pdsd.sub_domain_id as subDomainId,
          COUNT(DISTINCT q.id) as totalItems
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN phase_domain_sub_domains pdsd ON pdsd.project_id = i.project_id AND pdsd.phase_number = i.phase
        INNER JOIN sub_domain_queries sq ON sq.sub_domain_id = pdsd.sub_domain_id
        INNER JOIN queries q ON q.id = sq.query_id
        GROUP BY i.project_id, pdsd.domain_id, pdsd.sub_domain_id
      `,
      ids
    );
    const totalItemsByDomainSubDomain = new Map();
    for (const r of domainSubDomainTotalRows) {
      totalItemsByDomainSubDomain.set(`${r.projectId}:${r.domainId}:${r.subDomainId}`, Number(r.totalItems) || 0);
    }

    const domainSubDomainAnsweredRows = await db.execute(
      `
        SELECT
          i.project_id as projectId,
          pdsd.domain_id as domainId,
          pdsd.sub_domain_id as subDomainId,
          COUNT(DISTINCT r.query_id) as answeredItems
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN responses r ON r.inspection_id = i.id
        INNER JOIN queries q ON q.id = r.query_id
        INNER JOIN sub_domain_queries sq ON sq.query_id = q.id
        INNER JOIN phase_domain_sub_domains pdsd ON pdsd.sub_domain_id = sq.sub_domain_id
          AND pdsd.project_id = i.project_id
          AND pdsd.phase_number = i.phase
        GROUP BY i.project_id, pdsd.domain_id, pdsd.sub_domain_id
      `,
      ids
    );

    const answeredByProjectDomainSubDomain = new Map();
    for (const r of domainSubDomainAnsweredRows) {
      answeredByProjectDomainSubDomain.set(`${r.projectId}:${r.domainId}:${r.subDomainId}`, Number(r.answeredItems) || 0);
    }

    const projectDomains = await db.execute(
      `
        SELECT i.project_id as projectId, pd.domain_id as domainId
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN phase_domains pd ON pd.project_id = i.project_id AND pd.phase_number = i.phase
      `,
      ids
    );

    const projectDomainSubDomains = await db.execute(
      `
        SELECT i.project_id as projectId, pdsd.domain_id as domainId, pdsd.sub_domain_id as subDomainId
        FROM (
          SELECT project_id, MAX(id) as inspectionId
          FROM inspections
          WHERE project_id IN (${placeholders})
          GROUP BY project_id
        ) li
        INNER JOIN inspections i ON i.id = li.inspectionId
        INNER JOIN phase_domain_sub_domains pdsd ON pdsd.project_id = i.project_id AND pdsd.phase_number = i.phase
      `,
      ids
    );

    const subDomainsByProjectDomain = new Map();
    for (const r of projectDomainSubDomains) {
      const key = `${r.projectId}:${r.domainId}`;
      const list = subDomainsByProjectDomain.get(key) || [];
      list.push(r.subDomainId);
      subDomainsByProjectDomain.set(key, list);
    }

    const summaryByProjectId = new Map();

    for (const id of ids) {
      const domainsForProject = projectDomains.filter((r) => r.projectId === id).map((r) => r.domainId);
      const totalDomains = domainsForProject.length;
      let completedDomains = 0;

      const totalSubDomains = projectDomainSubDomains.filter((r) => r.projectId === id).length;
      let completedSubDomains = 0;
      let effectiveSubDomainsTotal = 0;

      let totalItems = 0;
      let answeredItems = 0;

      for (const domainId of domainsForProject) {
        const selectedSubDomains = subDomainsByProjectDomain.get(`${id}:${domainId}`) || [];

        let domainTotal = 0;
        let domainAnswered = 0;

        if (selectedSubDomains.length > 0) {
          for (const subDomainId of selectedSubDomains) {
            const t = totalItemsByDomainSubDomain.get(`${id}:${domainId}:${subDomainId}`) || 0;
            const a = answeredByProjectDomainSubDomain.get(`${id}:${domainId}:${subDomainId}`) || 0;
            domainTotal += t;
            domainAnswered += a;

            if (t > 0) {
              effectiveSubDomainsTotal += 1;
              if (a >= t) completedSubDomains += 1;
            }
          }
        }

        if (domainTotal <= 0) {
          domainTotal = totalItemsByDomainId.get(`${id}:${domainId}`) || 0;
          domainAnswered = answeredByProjectDomain.get(`${id}:${domainId}`) || 0;
        }

        totalItems += domainTotal;
        answeredItems += domainAnswered;

        if (domainTotal > 0 && domainAnswered >= domainTotal) {
          completedDomains += 1;
        }
      }

      const completionPercent =
        effectiveSubDomainsTotal > 0
          ? Math.round((completedSubDomains / effectiveSubDomainsTotal) * 100)
          : totalDomains > 0
            ? Math.round((completedDomains / totalDomains) * 100)
            : 0;

      summaryByProjectId.set(id, {
        totalDomains,
        completedDomains,
        totalSubDomains,
        completedSubDomains,
        totalItems,
        answeredItems,
        completionPercent,
        latestInspectionId: latestInspectionByProjectId.get(id) || null
      });
    }

    return summaryByProjectId;
  }

  // Get all projects with their domains
  async importDomain(projectId, domainId) {
    try {
      // Get the domain with its full structure
      const domain = await db.executeWithResult(
        `SELECT * FROM domains WHERE id = ?`,
        [domainId]
      );
      if (!domain || domain.length === 0) {
        throw new Error('Domain not found');
      }
      const domainData = domain[0];

      // Create project domain
      const projectDomainResult = await db.executeWithResult(
        `INSERT INTO domains (project_id, domain_name, description, weightage, item_order) VALUES (?, ?, ?, ?, ?)`,
        [projectId, domainData.domain_name, domainData.description, domainData.weightage || 10.00, domainData.item_order || 0]
      );
      const projectDomainId = projectDomainResult.insertId;

      // Get sub-domains for this domain
      const subDomains = await db.execute(
        `SELECT * FROM sub_domains WHERE domain_id = ?`,
        [domainId]
      );

      for (const subDomain of subDomains) {
        // Create project sub-domain
        const projectSubDomainResult = await db.executeWithResult(
          `INSERT INTO sub_domains (domain_id, sub_domain_name, description, weightage, is_active, item_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [projectDomainId, subDomain.sub_domain_name, subDomain.description, subDomain.weightage || 10.00, subDomain.is_active !== false, subDomain.item_order || 0]
        );
        const projectSubDomainId = projectSubDomainResult.insertId;

        // Get queries for this sub-domain with their sub_domain_query IDs for parent mapping
        const queries = await db.execute(
          `SELECT sq.*, sdq.id as sub_domain_query_id, sdq.query_type, sdq.parent_id 
           FROM sub_domain_queries sdq
           JOIN queries sq ON sdq.query_id = sq.id
           WHERE sdq.sub_domain_id = ?
           ORDER BY sdq.item_order, sq.id`,
          [subDomain.id]
        );

        // First pass: Create all queries and build mapping
        const originalToNewSubDomainQueryId = new Map();
        
        for (const query of queries) {
          // Create query
          const queryResult = await db.executeWithResult(
            `INSERT INTO queries (query_text) VALUES (?)`,
            [query.query_text]
          );
          const queryId = queryResult.insertId;

          // Link query to sub-domain (parent_id will be set in second pass)
          const subDomainQueryResult = await db.executeWithResult(
            `INSERT INTO sub_domain_queries (sub_domain_id, query_id, query_type, parent_id) VALUES (?, ?, ?, NULL)`,
            [projectSubDomainId, queryId, query.query_type || 'primary']
          );
          
          // Map original sub_domain_query.id to new sub_domain_query.id
          originalToNewSubDomainQueryId.set(query.sub_domain_query_id, subDomainQueryResult.insertId);
        }

        // Second pass: Update parent_id references
        for (const query of queries) {
          if (query.query_type === 'secondary' && query.parent_id) {
            const newSubDomainQueryId = originalToNewSubDomainQueryId.get(query.sub_domain_query_id);
            const newParentId = originalToNewSubDomainQueryId.get(query.parent_id);
            
            if (newSubDomainQueryId && newParentId) {
              await db.execute(
                `UPDATE sub_domain_queries SET parent_id = ? WHERE id = ?`,
                [newParentId, newSubDomainQueryId]
              );
            }
          }
        }
      }

      logger.info(`Imported domain ${domainData.domain_name} into project ${projectId}`);
      return { message: 'Domain imported successfully with sub-domains and queries' };
    } catch (error) {
      logger.error('Error in importDomain:', error);
      throw error;
    }
  }

  async getAvailableDomains(projectId) {
    try {
      // Get all domains (from the domain library, not from other projects)
      // For now, we'll get domains from any project and filter by name
      const allDomains = await db.execute(`SELECT DISTINCT domain_name, description, weightage FROM domains ORDER BY domain_name`);
      
      // Get already imported domain names for this project
      const projectDomains = await db.execute(
        `SELECT domain_name FROM domains WHERE project_id = ?`,
        [projectId]
      );
      const importedDomainNames = new Set(projectDomains.map(d => d.domain_name));

      // Filter out already imported domains
      const availableDomains = allDomains.filter(d => !importedDomainNames.has(d.domain_name));
      
      return availableDomains;
    } catch (error) {
      logger.error('Error in getAvailableDomains:', error);
      throw error;
    }
  }

  async getAllProjects(user) {
    try {
      let query = `
        SELECT 
          p.id,
          p.project_name as name,
          p.description,
          p.site_address as location,
          p.city,
          p.state,
          p.status,
          p.start_date as startDate,
          p.end_date as endDate,
          p.current_phase_id as currentPhaseId,
          p.created_by as createdBy,
          p.created_at as createdAt,
          COALESCE(i.totalInspections, 0) as totalInspections,
          COALESCE(i.completedInspections, 0) as completedInspections,
          0 as score
        FROM projects p
        LEFT JOIN (
          SELECT
            project_id,
            COUNT(*) as totalInspections,
            SUM(CASE WHEN status IN ('completed', 'submitted') THEN 1 ELSE 0 END) as completedInspections
          FROM inspections
          GROUP BY project_id
        ) i ON i.project_id = p.id
      `;
      
      let params = [];
      
      // If user is a manager (not admin), only show projects they created or are assigned manager to
      if (user && user.role === 'manager') {
        query += ` WHERE p.created_by = ?`;
        params.push(user.id);
      }
      
      query += ` ORDER BY p.created_at DESC`;
      
      const rows = await db.execute(query, params);
      const projects = rows.map((row) => {
        return {
          ...row,
          description: row.description || '',
          status: row.status || 'active',
          startDate: row.startDate ? String(row.startDate) : null,
          endDate: row.endDate ? String(row.endDate) : null,
          score: row.score || 0,
          domains: []
        };
      });

      if (projects.length === 0) return projects;

      const projectIds = projects.map(p => p.id);
      const progressByProjectId = await this.getProgressSummary(projectIds);

      return projects.map((p) => {
        const progress = progressByProjectId.get(p.id) || {
          totalDomains: 0,
          completedDomains: 0,
          totalSubDomains: 0,
          completedSubDomains: 0,
          totalItems: 0,
          answeredItems: 0,
          completionPercent: 0,
          latestInspectionId: null
        };

        return {
          ...p,
          completionPercent: progress.completionPercent,
          domainProgress: { completed: progress.completedDomains, total: progress.totalDomains },
          subDomainProgress: { completed: progress.completedSubDomains, total: progress.totalSubDomains },
          answerProgress: { answered: progress.answeredItems, total: progress.totalItems },
          latestSubmissionId: progress.latestInspectionId,
          domains: p.domains || []
        };
      });
    } catch (error) {
      logger.error('Error fetching projects:', error);
      throw error;
    }
  }

  // Get project by ID with full details
  async getProjectById(id) {
    try {
      const query = `
        SELECT 
          p.id,
          p.project_name as name,
          p.description,
          p.site_address as location,
          p.city,
          p.state,
          p.status,
          p.start_date as startDate,
          p.end_date as endDate,
          p.client_name as clientName,
          p.client_designation as clientDesignation,
          p.client_mobile_no as clientMobileNo,
          p.client_email as clientEmail,
          p.alternate_client_name as alternateClientName,
          p.alternate_designation as alternateDesignation,
          p.alternate_email as alternateEmail,
          p.alternate_mobile_no as alternateMobileNo,
          p.current_phase_id as currentPhaseId,
          p.created_by as createdBy,
          p.created_at as createdAt,
          COALESCE(i.totalInspections, 0) as totalInspections,
          COALESCE(i.completedInspections, 0) as completedInspections,
          0 as score
        FROM projects p
        LEFT JOIN (
          SELECT
            project_id,
            COUNT(*) as totalInspections,
            SUM(CASE WHEN status IN ('completed', 'submitted') THEN 1 ELSE 0 END) as completedInspections
          FROM inspections
          GROUP BY project_id
        ) i ON i.project_id = p.id
        WHERE p.id = ?
      `;
      
      const rows = await db.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const row = rows[0];
      let engineers = [];
      if (row.engineers) {
        try {
          engineers = typeof row.engineers === 'string' ? JSON.parse(row.engineers) : row.engineers;
        } catch {
          engineers = [];
        }
      }

      const domains = [];

      return {
        ...row,
        description: row.description || '',
        status: row.status || 'active',
        startDate: row.startDate ? String(row.startDate) : null,
        endDate: row.endDate ? String(row.endDate) : null,
        clientName: row.clientName || null,
        clientDesignation: row.clientDesignation || null,
        clientMobileNo: row.clientMobileNo || null,
        clientEmail: row.clientEmail || null,
        alternateClientName: row.alternateClientName || null,
        alternateDesignation: row.alternateDesignation || null,
        alternateEmail: row.alternateEmail || null,
        alternateMobileNo: row.alternateMobileNo || null,
        score: row.score || 0,
        domains
      };
    } catch (error) {
      logger.error(`Error fetching project ${id}:`, error);
      throw error;
    }
  }

  // Load default weightages for domains and sub_domains
  async loadDefaultWeightages() {
    try {
      const domains = await db.execute(`
        SELECT 
          s.id as domainId,
          s.domain_name as domainName,
          s.weightage as domainWeightage,
          ss.sub_domain_id as subDomainId,
          sec.sub_domain_name as subDomainName,
          ss.weightage as subDomainWeightage
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
            weightage: row.domainWeightage,
            subDomains: []
          });
        }
        
        if (row.subDomainId) {
          domainsMap.get(row.domainId).subDomains.push({
            subDomainId: row.subDomainId,
            subDomainName: row.subDomainName,
            weightage: row.subDomainWeightage
          });
        }
      }

      return Array.from(domainsMap.values());
    } catch (error) {
      logger.error('Error loading default weightages:', error);
      throw error;
    }
  }

  // Create new project
  async createProject(projectData) {
    try {
      const existingUsers = await db.execute('SELECT id FROM users LIMIT 1');
      let createdBy = projectData.createdBy || null;

      if (!createdBy) {
        if (existingUsers.length === 0) {
          const adminResult = await db.executeWithResult(
            `
              INSERT INTO users (name, email, password_hash, role, is_global_admin, is_active)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              'Global Administrator',
              'admin@qrating.com',
              '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5GS',
              'admin',
              true,
              true
            ]
          );
          createdBy = adminResult.insertId;
        } else {
          createdBy = existingUsers[0].id;
        }
      }

      const engineersJson = Array.isArray(projectData.engineers) ? JSON.stringify(projectData.engineers) : null;

      const projectResult = await db.executeWithResult(
        `
          INSERT INTO projects (
            project_name,
            description,
            site_address,
            city,
            state,
            status,
            progress,
            start_date,
            end_date,
            engineers,
            created_by,
            client_name,
            client_designation,
            client_mobile_no,
            client_email,
            alternate_client_name,
            alternate_designation,
            alternate_email,
            alternate_mobile_no
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          projectData.name,
          projectData.description || '',
          projectData.location || projectData.site_address || '',
          projectData.city || null,
          projectData.state || null,
          projectData.status || 'active',
          0,
          projectData.startDate || projectData.start_date || null,
          projectData.endDate || projectData.end_date || null,
          engineersJson,
          createdBy,
          projectData.clientName || null,
          projectData.clientDesignation || null,
          projectData.clientMobileNo || null,
          projectData.clientEmail || null,
          projectData.alternateClientName || null,
          projectData.alternateDesignation || null,
          projectData.alternateEmail || null,
          projectData.alternateMobileNo || null
        ]
      );

      const projectId = projectResult.insertId;

      logger.info(`Project created: ${projectId}`);

      // Create the initial phase record without inspector/reviewer/viewer assignments.
      // These assignments are handled later when a phase/inspection is set up from settings.
      const phaseResult = await db.executeWithResult(
        `
          INSERT INTO phases (
            project_id, phase_number, description, site_address, city, state,
            status, start_date, end_date, engineers,
            inspection_id, client_name, client_designation, client_mobile_no,
            client_email, alternate_client_name, alternate_designation, alternate_email,
            alternate_mobile_no
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          projectId,
          1,
          projectData.description || '',
          projectData.location || projectData.site_address || '',
          projectData.city || null,
          projectData.state || null,
          'pending',
          projectData.startDate || projectData.start_date || null,
          projectData.endDate || projectData.end_date || null,
          engineersJson,
          null,
          projectData.clientName || null,
          projectData.clientDesignation || null,
          projectData.clientMobileNo || null,
          projectData.clientEmail || null,
          projectData.alternateClientName || null,
          projectData.alternateDesignation || null,
          projectData.alternateEmail || null,
          projectData.alternateMobileNo || null
        ]
      );

      const phaseId = phaseResult.insertId;
      logger.info(`Created Phase 1 record in phases table`, { projectId, phaseId });

      // Link the project to its current active phase
      await db.execute(
        'UPDATE projects SET current_phase_id = ? WHERE id = ?',
        [phaseId, projectId]
      );

      logger.info(`Assigned current_phase_id for project ${projectId} to phase ${phaseId}`);
      return await this.getProjectById(projectId);
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  // Update project
  async updateProject(id, projectData) {
    try {
      const engineersJson = Array.isArray(projectData.engineers) ? JSON.stringify(projectData.engineers) : null;

      await db.execute(
        `
          UPDATE projects SET
            project_name = ?,
            description = ?,
            site_address = ?,
            city = ?,
            state = ?,
            status = ?,
            progress = ?,
            start_date = ?,
            end_date = ?,
            engineers = COALESCE(?, engineers),
            client_name = COALESCE(?, client_name),
            client_designation = COALESCE(?, client_designation),
            client_mobile_no = COALESCE(?, client_mobile_no),
            client_email = COALESCE(?, client_email),
            alternate_client_name = COALESCE(?, alternate_client_name),
            alternate_designation = COALESCE(?, alternate_designation),
            alternate_email = COALESCE(?, alternate_email),
            alternate_mobile_no = COALESCE(?, alternate_mobile_no)
          WHERE id = ?
        `,
        [
          projectData.name,
          projectData.description || '',
          projectData.location || projectData.site_address || '',
          projectData.city || null,
          projectData.state || null,
          projectData.status || 'active',
          Number.isFinite(projectData.progress) ? projectData.progress : 0,
          projectData.startDate || projectData.start_date || null,
          projectData.endDate || projectData.end_date || null,
          engineersJson,
          projectData.clientName || null,
          projectData.clientDesignation || null,
          projectData.clientMobileNo || null,
          projectData.clientEmail || null,
          projectData.alternateClientName || null,
          projectData.alternateDesignation || null,
          projectData.alternateEmail || null,
          projectData.alternateMobileNo || null,
          id
        ]
      );

      if (Array.isArray(projectData.domains)) {
        logger.info(`Project ${id} update with domains: domain config is now managed via phase_domains/phase_domain_sub_domains tables (skipping legacy project_domains/project_domain_sub_domains)`);
      }

      logger.info(`Project updated: ${id}`);
      return await this.getProjectById(id);
    } catch (error) {
      throw error;
    }
  }

  // Delete project
  async deleteProject(id) {
    try {
      const query = 'DELETE FROM projects WHERE id = ?';
      const result = await db.execute(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Project not found');
      }
      
      logger.info(`Project deleted: ${id}`);
      return { id, message: 'Project deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting project ${id}:`, error);
      throw error;
    }
  }
}

module.exports = new ProjectService();
