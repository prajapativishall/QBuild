const db = require('../config/db');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Get dashboard data with active and completed inspections
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get active inspections (only in_progress, pending should be in inbox, rejected should be in rejected inbox)
    const activeQuery = `
      SELECT i.id, i.project_id, p.project_name, i.status, i.phase,
        i.inspection_date, i.created_at
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      WHERE i.inspector_id = ? AND i.status = 'in_progress' AND (i.approval_status IS NULL OR i.approval_status != 'rejected')
      ORDER BY i.inspection_date DESC
    `;

    // Get completed inspections history
    const historyQuery = `
      SELECT i.id, i.project_id, p.project_name, i.status, i.phase,
        i.inspection_date, i.created_at, i.updated_at, p.site_address as location
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      WHERE i.inspector_id = ? AND i.status = 'completed'
      ORDER BY i.updated_at DESC LIMIT 20
    `;

    // Get pending inspections count for inbox
    const pendingQuery = `
      SELECT COUNT(*) as count
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      WHERE i.inspector_id = ? AND i.status IN ('pending', 'scheduled')
    `;

    const active = await db.execute(activeQuery, [userId]);
    const history = await db.execute(historyQuery, [userId]);
    const pendingResult = await db.execute(pendingQuery, [userId]);
    const inboxCount = pendingResult[0].count;

    // Get rejected inspections count
    const rejectedQuery = `
      SELECT COUNT(*) as count
      FROM inspections i
      WHERE i.inspector_id = ? 
        AND i.approval_status = 'rejected'
        AND i.status = 'in_progress'
    `;
    const rejectedResult = await db.execute(rejectedQuery, [userId]);
    const rejectedCount = rejectedResult[0]?.count || 0;

    res.json({
      success: true,
      data: {
        stats: { 
          total: active.length + history.length + inboxCount, 
          inboxCount: inboxCount,
          rejectedCount: rejectedCount,
          pending: inboxCount, 
          inProgress: active.length, 
          completed: history.length 
        },
        active: active.map(i => ({ id: i.id, projectId: i.project_id, projectName: i.project_name, status: i.status, phase: i.phase, inspectionDate: i.inspection_date })),
        history: history.map(i => ({
          id: i.id,
          projectId: i.project_id,
          projectName: i.project_name,
          status: i.status,
          phase: i.phase,
          assignedDate: i.created_at,
          submitDate: i.updated_at,
          location: i.location
        }))
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get inbox - pending inspections
const getInbox = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT i.id, i.project_id, p.project_name, p.description,
        i.status, i.phase, i.inspection_date, i.created_at, p.site_address as location,
        i.approval_status, i.reviewer_notes
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      WHERE i.inspector_id = ? AND i.status IN ('pending', 'scheduled')
      ORDER BY i.created_at DESC
    `;
    const inspections = await db.execute(query, [userId]);
    res.json({ success: true, data: inspections });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Accept inspection
const acceptInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    
    const checkQuery = `SELECT i.id FROM inspections i WHERE i.id = ? AND i.inspector_id = ? AND i.status = 'pending'`;
    const inspections = await db.execute(checkQuery, [inspectionId, userId]);
    
    if (inspections.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or already accepted' });
    }
    
    const updateQuery = `UPDATE inspections SET status = 'in_progress', updated_at = NOW() WHERE id = ?`;
    await db.execute(updateQuery, [inspectionId]);

    await db.execute(
      `UPDATE phases ph
       INNER JOIN inspections i ON ph.project_id = i.project_id AND ph.phase_number = i.phase
       SET ph.status = 'in_progress', ph.updated_at = NOW()
       WHERE i.id = ?`,
      [inspectionId]
    );
    
    res.json({ success: true, message: 'Inspection accepted successfully' });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get inspection domains with sub-domains
const getInspectionDomains = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;

    // Get project domains with sub-domains and weightage from project-specific configuration
    const query = `
      SELECT s.id as domain_id, s.domain_name,
        COALESCE(pd.weightage, 0) as domain_weightage,
        COALESCE(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'sub_domain_id', sec.id,
              'sub_domain_name', sec.sub_domain_name,
              'weightage', pdsd.weightage,
              'is_manual', pdsd.is_manual
            )
          ),
          JSON_ARRAY()
        ) as sub_domains
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      INNER JOIN phase_domains pd ON i.project_id = pd.project_id AND i.phase = pd.phase_number
      INNER JOIN domains s ON pd.domain_id = s.id
      LEFT JOIN phase_domain_sub_domains pdsd ON s.id = pdsd.domain_id
        AND pdsd.project_id = i.project_id
        AND pdsd.phase_number = i.phase
      LEFT JOIN sub_domains sec ON pdsd.sub_domain_id = sec.id
      WHERE i.id = ? AND i.inspector_id = ?
      GROUP BY s.id, s.domain_name, pd.weightage
      ORDER BY s.domain_name
    `;

    const domains = await db.execute(query, [inspectionId, userId]);

    // Get submitted sub-domains for this inspection with domain_id (excluding rejected ones)
    const submittedSubDomains = await db.execute(
      `SELECT sub_domain_id, domain_id FROM inspection_subdomain_submissions WHERE inspection_id = ? AND (is_rejected IS NULL OR is_rejected = 0)`,
      [inspectionId]
    );
    const submittedSubDomainMap = new Map();
    submittedSubDomains.forEach(s => {
      const key = `${s.domain_id || 'null'}-${s.sub_domain_id}`;
      submittedSubDomainMap.set(key, true);
    });

    const formattedDomains = domains.map(d => {
      let subDomains = d.sub_domains;
      if (typeof subDomains === 'string') {
        if (subDomains.startsWith('[object')) {
          subDomains = [];
        } else {
          subDomains = JSON.parse(subDomains || '[]');
        }
      } else if (!Array.isArray(subDomains)) {
        subDomains = [];
      }

      const subDomainsWithStatus = subDomains.map(sd => {
        const key = `${d.domain_id}-${sd.sub_domain_id}`;
        const isSubmitted = submittedSubDomainMap.has(key);
        return { ...sd, isSubmitted };
      });

      const allSubDomainsSubmitted = subDomainsWithStatus.length > 0 &&
        subDomainsWithStatus.every(sd => sd.isSubmitted);
      const submittedCount = subDomainsWithStatus.filter(sd => sd.isSubmitted).length;
      const totalCount = subDomainsWithStatus.length;
      const formattedSubDomains = subDomainsWithStatus.map(sd => ({
        ...sd,
        weightage: sd.weightage !== undefined ? parseFloat(sd.weightage) : 0,
        isManual: sd.is_manual === 1 || sd.isManual === true
      }));

      return {
        domainId: d.domain_id,
        domainName: d.domain_name,
        domainWeightage: parseFloat(d.domain_weightage) || 0,
        allSubDomainsSubmitted,
        subDomains: formattedSubDomains
      };
    });

    res.json({ success: true, data: { inspectionId, domains: formattedDomains } });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get queries for a sub-domain in an inspection
const getSubDomainQueries = async (req, res, next) => {
  try {
    const { inspectionId, subDomainId, domainId } = req.params;
    const userId = req.user.id;

    // Check if sub-domain is submitted
    let submissionCheck;
    if (domainId) {
      submissionCheck = await db.execute(
        `SELECT id, submitted_at FROM inspection_subdomain_submissions
         WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
        [inspectionId, subDomainId, domainId]
      );
    } else {
      submissionCheck = await db.execute(
        `SELECT id, submitted_at FROM inspection_subdomain_submissions
         WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id IS NULL`,
        [inspectionId, subDomainId]
      );
    }
    const isSubmitted = submissionCheck.length > 0;
    const submittedAt = isSubmitted ? submissionCheck[0].submitted_at : null;

    const inspectionInfo = await db.execute(
      `SELECT project_id, phase FROM inspections WHERE id = ?`,
      [inspectionId]
    );
    const projectId = inspectionInfo[0]?.project_id;
    const inspectionPhase = inspectionInfo[0]?.phase;

    const query = `
      SELECT 
        q.id,
        q.question_text,
        prq.id as project_query_id,
        COALESCE(prq.query_type, sq.query_type, 'primary') as query_type,
        COALESCE(parent_sq.query_id, NULL) as parent_id,
        COALESCE(sq.item_order, prq.id) as item_order,
        r.response as response,
        r.nc_type,
        r.inspector_comment,
        r.additional_remarks,
        r.photos,
        r.domain_id,
        r.sub_domain_id,
        r.submitted_at,
        r.editable_by_inspector,
        i.phase as inspection_phase
      FROM phase_queries pq
      JOIN project_queries prq ON pq.project_query_id = prq.id
      JOIN queries q ON prq.query_id = q.id
      LEFT JOIN sub_domain_queries sq ON q.id = sq.query_id AND sq.sub_domain_id = prq.sub_domain_id
      LEFT JOIN sub_domain_queries parent_sq ON parent_sq.id = sq.parent_id
      LEFT JOIN responses r ON q.id = r.query_id 
        AND r.inspection_id = ? 
        AND r.sub_domain_id = ?
        AND (r.domain_id = ? OR r.domain_id IS NULL)
      JOIN inspections i ON i.id = ?
      WHERE pq.project_id = ? 
        AND pq.phase_number = ?
        AND prq.sub_domain_id = ?
        AND i.inspector_id = ?
      ORDER BY COALESCE(sq.item_order, prq.id)
    `;
    const queryParams = [inspectionId, subDomainId, domainId, inspectionId, projectId, inspectionPhase, subDomainId, userId];

    const queries = await db.execute(query, queryParams);

    // Parse photos from JSON string to array for each query
    const parsedQueries = queries.map(q => ({
      ...q,
      photos: q.photos ? (typeof q.photos === 'string' ? (() => { try { return JSON.parse(q.photos); } catch { return []; } })() : q.photos) : []
    }));

    res.json({
      success: true,
      data: {
        inspectionId,
        subDomainId,
        isSubmitted,
        submittedAt,
        queries: parsedQueries
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get hierarchical inspection data with responses for spider chart (single inspection)
const getInspectionHierarchy = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    
    const accessCheck = await db.execute(
      `SELECT i.id, i.project_id, p.project_name, i.phase
       FROM inspections i 
       WHERE i.id = ? AND i.inspector_id = ?`,
      [inspectionId, userId]
    );
    
    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }
    
    const projectId = accessCheck[0].project_id;
    const projectName = accessCheck[0].project_name;
    const phase = accessCheck[0].phase;
    
    const hierarchyQuery = `
      SELECT
        d.id as domain_id,
        d.domain_name,
        sd.id as sub_domain_id,
        sd.sub_domain_name,
        q.id as query_id,
        q.question_text,
        sq.query_type,
        sq.parent_id,
        sq.item_order,
        r.id as response_id,
        r.response,
        r.comments,
        r.created_at as response_date,
        r.updated_at as response_updated
      FROM phase_domains pd
      INNER JOIN domains d ON pd.domain_id = d.id
      INNER JOIN phase_domain_sub_domains pdsd ON pd.project_id = pdsd.project_id
        AND pd.phase_number = pdsd.phase_number
        AND pdsd.domain_id = pd.domain_id
      INNER JOIN sub_domains sd ON pdsd.sub_domain_id = sd.id
      INNER JOIN sub_domain_queries sq ON sd.id = sq.sub_domain_id
      INNER JOIN queries q ON sq.query_id = q.id
      LEFT JOIN responses r ON q.id = r.query_id AND r.inspection_id = ? AND r.sub_domain_id = sd.id
      WHERE pd.project_id = ? AND pd.phase_number = ?
      ORDER BY d.domain_name, sd.sub_domain_name, sq.item_order
    `;
    
    const rows = await db.execute(hierarchyQuery, [inspectionId, projectId]);
    
    const projectData = {
      projectId: projectId,
      projectName: projectName,
      inspectionId: parseInt(inspectionId),
      phase: phase,
      domains: []
    };
    
    const domainMap = new Map();
    const subDomainMap = new Map();
    
    rows.forEach(row => {
      if (!domainMap.has(row.domain_id)) {
        const domain = {
          domainId: row.domain_id,
          domainName: row.domain_name,
          subDomains: []
        };
        domainMap.set(row.domain_id, domain);
        projectData.domains.push(domain);
      }
      
      const domainKey = `${row.domain_id}-${row.sub_domain_id}`;
      if (!subDomainMap.has(domainKey)) {
        const subDomain = {
          subDomainId: row.sub_domain_id,
          subDomainName: row.sub_domain_name,
          queries: []
        };
        subDomainMap.set(domainKey, subDomain);
        domainMap.get(row.domain_id).subDomains.push(subDomain);
      }
      
      const queryData = {
        queryId: row.query_id,
        questionText: row.question_text,
        queryType: row.query_type,
        parentId: row.parent_id,
        itemOrder: row.item_order,
        response: row.response_id ? {
          responseId: row.response_id,
          value: row.response,
          comments: row.comments,
          createdAt: row.response_date,
          updatedAt: row.response_updated
        } : null
      };
      subDomainMap.get(domainKey).queries.push(queryData);
    });
    
    res.json({ success: true, data: projectData });
  } catch (error) {
    logger.logError(error, req);
    next(error)
  }
};

// Get project hierarchy with all phases
const getProjectHierarchy = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    // Verify user has access by checking phases
    const accessCheck = await db.execute(
      `SELECT DISTINCT p.id, p.project_name 
       FROM projects p 
       INNER JOIN inspections i ON i.project_id = p.id
       WHERE p.id = ? AND i.inspector_id = ?
       LIMIT 1`,
      [projectId, userId]
    );
    
    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied' });
    }
    
    const projectName = accessCheck[0].project_name;
    
    const inspectionsQuery = `
      SELECT i.id, i.phase, i.status, i.inspection_date, i.created_at
      FROM inspections i
      WHERE i.project_id = ?
      ORDER BY i.phase ASC
    `;
    
    const inspections = await db.execute(inspectionsQuery, [projectId]);
    
    if (inspections.length === 0) {
      return res.json({ 
        success: true, 
        data: {
          projectId: parseInt(projectId),
          projectName: projectName,
          phases: []
        }
      });
    }
    
    const phases = [];

    for (const inspection of inspections) {
      const structureQuery = `
        SELECT 
          d.id as domain_id,
          d.domain_name,
          sd.id as sub_domain_id,
          sd.sub_domain_name,
          q.id as query_id,
          q.question_text,
          sq.query_type,
          sq.parent_id,
          sq.item_order
        FROM phase_domains pd
        INNER JOIN domains d ON pd.domain_id = d.id
        INNER JOIN phase_domain_sub_domains pdsd ON pd.project_id = pdsd.project_id
          AND pd.phase_number = pdsd.phase_number
          AND pd.domain_id = pdsd.domain_id
        INNER JOIN sub_domains sd ON pdsd.sub_domain_id = sd.id
        INNER JOIN sub_domain_queries sq ON sd.id = sq.sub_domain_id
        INNER JOIN queries q ON sq.query_id = q.id
        WHERE pd.project_id = ? AND pd.phase_number = ?
        ORDER BY d.domain_name, sd.sub_domain_name, sq.item_order
      `;

      const structureRows = await db.execute(structureQuery, [projectId, inspection.phase]);
      const baseDomains = new Map();

      structureRows.forEach(row => {
        if (!baseDomains.has(row.domain_id)) {
          baseDomains.set(row.domain_id, {
            domainId: row.domain_id,
            domainName: row.domain_name,
            subDomains: new Map()
          });
        }

        const domain = baseDomains.get(row.domain_id);
        if (!domain.subDomains.has(row.sub_domain_id)) {
          domain.subDomains.set(row.sub_domain_id, {
            subDomainId: row.sub_domain_id,
            subDomainName: row.sub_domain_name,
            queries: []
          });
        }

        const subDomain = domain.subDomains.get(row.sub_domain_id);
        subDomain.queries.push({
          queryId: row.query_id,
          questionText: row.question_text,
          queryType: row.query_type,
          parentId: row.parent_id,
          itemOrder: row.item_order,
          response: null
        });
      });

      const responsesQuery = `
        SELECT
          q.id as query_id,
          r.id as response_id,
          r.response,
          r.comments,
          r.created_at,
          r.updated_at,
          r.sub_domain_id
        FROM responses r
        INNER JOIN queries q ON r.query_id = q.id
        WHERE r.inspection_id = ?
      `;

      const responses = await db.execute(responsesQuery, [inspection.id]);
      const responseMap = new Map();
      responses.forEach(r => {
        const key = `${r.sub_domain_id}-${r.query_id}`;
        responseMap.set(key, {
          responseId: r.response_id,
          value: r.response,
          comments: r.comments,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        });
      });

      const phaseDomains = [];
      baseDomains.forEach((domain) => {
        const phaseDomain = {
          domainId: domain.domainId,
          domainName: domain.domainName,
          subDomains: []
        };

        domain.subDomains.forEach((subDomain) => {
          const phaseSubDomain = {
            subDomainId: subDomain.subDomainId,
            subDomainName: subDomain.subDomainName,
            queries: subDomain.queries.map(q => ({
              ...q,
              response: responseMap.get(`${subDomain.subDomainId}-${q.queryId}`) || null
            }))
          };
          phaseDomain.subDomains.push(phaseSubDomain);
        });

        phaseDomains.push(phaseDomain);
      });

      phases.push({
        phase: inspection.phase,
        inspectionId: inspection.id,
        status: inspection.status,
        inspectionDate: inspection.inspection_date,
        createdAt: inspection.created_at,
        domains: phaseDomains
      });
    }

    res.json({
      success: true,
      data: {
        projectId: parseInt(projectId),
        projectName: projectName,
        phases: phases
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Submit response for a query
const submitQueryResponse = async (req, res, next) => {
  try {
    const { inspectionId, queryId } = req.params;
    const { response, comments, subDomainId, domainId, phase, nc_type, inspector_comment, additional_remarks, photos } = req.body;
    const userId = req.user.id;

    if (!subDomainId) {
      return res.status(400).json({ success: false, message: 'subDomainId is required' });
    }

    // Verify user has access to this inspection
    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       WHERE i.id = ? AND i.inspector_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }

    const existingResponse = await db.execute(
      `SELECT id FROM responses WHERE inspection_id = ? AND sub_domain_id = ? AND query_id = ? AND domain_id = ?`,
      [inspectionId, subDomainId, queryId, domainId || null]
    );

    let result;
    if (existingResponse.length > 0) {
      await db.execute(
        `UPDATE responses 
         SET response = ?, nc_type = ?, inspector_comment = ?, additional_remarks = ?, photos = ?, updated_at = NOW()
         WHERE inspection_id = ? AND sub_domain_id = ? AND query_id = ? AND domain_id = ?`,
        [response, nc_type || null, inspector_comment || comments || null, additional_remarks || null, 
         photos ? JSON.stringify(photos) : null, 
         inspectionId, subDomainId, queryId, domainId || null]
      );
      result = { action: 'updated' };
    } else {
      const insertResult = await db.execute(
        `INSERT INTO responses 
         (inspection_id, sub_domain_id, query_id, response, nc_type, inspector_comment, additional_remarks, photos, domain_id, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [inspectionId, subDomainId, queryId, response, nc_type || null, inspector_comment || comments || null, 
         additional_remarks || null, 
         photos ? JSON.stringify(photos) : null, 
         domainId || null, userId]
      );
      result = { action: 'created', responseId: insertResult.insertId };
    }

    res.json({
      success: true,
      message: 'Response saved successfully',
      data: result
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

const submitSubDomain = async (req, res, next) => {
  try {
    const { inspectionId, subDomainId } = req.params;
    const { domainId } = req.body;
    const userId = req.user.id;

    // Verify user has access to this inspection
    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       WHERE i.id = ? AND i.inspector_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }

    // Check if completion record already exists
    const existingCompletion = await db.execute(
      `SELECT id FROM inspection_subdomain_submissions 
       WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
      [inspectionId, subDomainId, domainId]
    );

    if (existingCompletion.length === 0) {
      await db.execute(
        `INSERT INTO inspection_subdomain_submissions (inspection_id, sub_domain_id, domain_id, submitted_by, submitted_at, is_rejected)
         VALUES (?, ?, ?, ?, NOW(), 0)`,
        [inspectionId, subDomainId, domainId, userId]
      );
    } else {
      await db.execute(
        `UPDATE inspection_subdomain_submissions 
         SET is_rejected = 0, rejected_at = NULL, rejected_by = NULL, submitted_at = NOW()
         WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
        [inspectionId, subDomainId, domainId]
      );
    }

    // Save individual question responses
    const responses = req.body.responses || [];
    for (const resp of responses) {
      const queryId = resp.query_id || resp.question_id;
      const { responseValue, nc_type, inspector_comment, additional_remarks } = resp;
      const photos = resp.photos || resp.site_photos;
      
      if (!queryId || responseValue === undefined || responseValue === null) {
        throw new Error(`Invalid response data for question ${queryId}: missing required fields`);
      }
      
      const isYesResponse = responseValue === 'YES';
      const photosJson = photos && Array.isArray(photos) ? JSON.stringify(photos) : null;
      
      // Determine whether to update photos column:
      // 1. If new photos are provided → always update (overwrite with new photos)
      // 2. If response changed from NO to YES → clear photos (NC evidence no longer applies)
      // 3. If no new photos and response is still NO → preserve existing photos
      // 4. If no new photos and response changed to YES → clear photos
      let shouldUpdatePhotos = false;
      if (responseValue === 'YES') {
        // Changing to YES → ALWAYS clear photos, even if old photos exist in payload
        // Site photos are evidence for non-conformances (NO responses), not for YES
        shouldUpdatePhotos = true;
      } else if (photos && Array.isArray(photos) && photos.length > 0) {
        // New photos provided for a NO response → update with new photos
        shouldUpdatePhotos = true;
      }
      // For NO response without new photos → preserve existing (don't update)
      
      const updatePhotosClause = shouldUpdatePhotos 
        ? 'photos = VALUES(photos), ' 
        : '';
      
      await db.execute(
        `INSERT INTO responses 
         (inspection_id, sub_domain_id, query_id, response, nc_type, inspector_comment, additional_remarks, photos, domain_id, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           response = VALUES(response),
           nc_type = VALUES(nc_type),
           inspector_comment = VALUES(inspector_comment),
           additional_remarks = VALUES(additional_remarks),
           ${updatePhotosClause}
           rejection_notes = NULL,
           rejected_at = NULL,
           rejected_by = NULL`,
        [inspectionId, subDomainId, queryId, responseValue, isYesResponse ? null : (nc_type || null), 
         isYesResponse ? null : (inspector_comment || null), 
         isYesResponse ? null : (additional_remarks || null), 
         photosJson, 
         domainId || null, userId]
      );

      const queryType = await db.execute(
        `SELECT query_type FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?`,
        [subDomainId, queryId]
      );

      if (queryType.length > 0 && queryType[0].query_type === 'primary') {
        const normalizedResponse = String(responseValue).toUpperCase();
        if (['NO', 'N/A'].includes(normalizedResponse)) {
          await autoSubmitSecondaryResponsesNA(inspectionId, subDomainId, domainId, queryId, userId);
        }
      }
    }

    const domainSubDomainsCheck = await db.execute(
      `SELECT COUNT(dsd.sub_domain_id) as total_domain_subdomains,
              COUNT(CASE WHEN iss.id IS NOT NULL AND (iss.is_rejected IS NULL OR iss.is_rejected = 0) THEN iss.sub_domain_id END) as submitted_domain_subdomains
       FROM domain_sub_domains dsd
       LEFT JOIN inspection_subdomain_submissions iss ON dsd.sub_domain_id = iss.sub_domain_id 
         AND dsd.domain_id = iss.domain_id 
         AND iss.inspection_id = ?
       WHERE dsd.domain_id = ?`,
      [inspectionId, domainId]
    );

    const { total_domain_subdomains, submitted_domain_subdomains } = domainSubDomainsCheck[0];
    const domainCompleted = total_domain_subdomains === submitted_domain_subdomains && total_domain_subdomains > 0;

    res.json({
      success: true,
      message: 'Sub-domain responses saved successfully',
      data: { domainCompleted }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

const autoSubmitSecondaryResponsesNA = async (inspectionId, subDomainId, domainId, questionId, userId) => {
  const parentMapping = await db.execute(
    `SELECT id FROM sub_domain_queries WHERE sub_domain_id = ? AND query_id = ?`,
    [subDomainId, questionId]
  );
  if (!parentMapping.length) {
    return;
  }

  const secondaryMappings = await db.execute(
    `SELECT query_id FROM sub_domain_queries WHERE parent_id = ? AND sub_domain_id = ?`,
    [parentMapping[0].id, subDomainId]
  );

  if (!secondaryMappings.length) {
    return;
  }

  for (const secondary of secondaryMappings) {
    const existingSecondary = await db.execute(
      `SELECT id, response FROM responses WHERE inspection_id = ? AND sub_domain_id = ? AND query_id = ? AND domain_id = ?`,
      [inspectionId, subDomainId, secondary.query_id, domainId || null]
    );

    if (existingSecondary.length > 0) {
      // Only overwrite to N/A if the secondary query was NOT explicitly answered by the inspector.
      // If the inspector already gave a YES/NO answer, respect that choice and do NOT cascade N/A.
      const currentResponse = existingSecondary[0].response;
      if (currentResponse === 'YES' || currentResponse === 'NO') {
        // Inspector explicitly answered this secondary query - do not override
        continue;
      }
      // If the existing response is already N/A or empty, then cascade
      await db.execute(
        `UPDATE responses
         SET response = 'N/A',
             nc_type = NULL,
             inspector_comment = NULL,
             additional_remarks = NULL,
             photos = NULL,
             editable_by_inspector = 0,
             rejection_notes = NULL,
             rejected_at = NULL,
             rejected_by = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [existingSecondary[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO responses
         (inspection_id, sub_domain_id, query_id, response, nc_type, inspector_comment, additional_remarks, photos, domain_id, editable_by_inspector, submitted_by, submitted_at)
         VALUES (?, ?, ?, 'N/A', NULL, NULL, NULL, NULL, ?, 0, ?, NOW())`,
        [inspectionId, subDomainId, secondary.query_id, domainId || null, userId]
      );
    }
  }
};

// Final submission from domains screen
const submitFinalInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const { domainId } = req.body;
    const userId = req.user.id;

    // Verify user has access to this inspection
    const accessCheck = await db.execute(
      `SELECT i.id, i.project_id FROM inspections i
       WHERE i.id = ? AND i.inspector_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }

    // Get all sub-domains for this domain
    const subDomains = await db.execute(
      `SELECT pdsd.sub_domain_id, pdsd.domain_id
       FROM phase_domain_sub_domains pdsd
       INNER JOIN inspections i ON pdsd.project_id = i.project_id AND pdsd.phase_number = i.phase
       WHERE i.id = ? AND pdsd.domain_id = ?`,
      [inspectionId, domainId]
    );

    const submissionPromises = subDomains.map(async (sd) => {
      const existing = await db.execute(
        `SELECT id FROM inspection_subdomain_submissions 
         WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
        [inspectionId, sd.sub_domain_id, sd.domain_id]
      );

      if (existing.length === 0) {
        return await db.execute(
          `INSERT INTO inspection_subdomain_submissions (inspection_id, sub_domain_id, domain_id, submitted_by, submitted_at, is_rejected)
           VALUES (?, ?, ?, ?, NOW(), 0)`,
          [inspectionId, sd.sub_domain_id, sd.domain_id, userId]
        );
      } else {
        return await db.execute(
          `UPDATE inspection_subdomain_submissions 
           SET is_rejected = 0, rejected_at = NULL, rejected_by = NULL, submitted_at = NOW()
           WHERE inspection_id = ? AND sub_domain_id = ? AND domain_id = ?`,
          [inspectionId, sd.sub_domain_id, sd.domain_id]
        );
      }
    });

    await Promise.all(submissionPromises);

    // Check if all sub-domains in this inspection are submitted
    const allSubDomainsCheck = await db.execute(
      `SELECT COUNT(DISTINCT CONCAT(pdsd.domain_id, '-', pdsd.sub_domain_id)) as total_subdomains,
              COUNT(DISTINCT CASE WHEN iss.id IS NOT NULL AND (iss.is_rejected IS NULL OR iss.is_rejected = 0) THEN CONCAT(pdsd.domain_id, '-', pdsd.sub_domain_id) END) as submitted_subdomains
       FROM inspections i
       INNER JOIN phase_domain_sub_domains pdsd ON i.project_id = pdsd.project_id AND i.phase = pdsd.phase_number
       LEFT JOIN inspection_subdomain_submissions iss ON pdsd.sub_domain_id = iss.sub_domain_id 
         AND pdsd.domain_id = iss.domain_id 
         AND iss.inspection_id = ?
       WHERE i.id = ?`,
      [inspectionId, inspectionId]
    );

    const { total_subdomains, submitted_subdomains } = allSubDomainsCheck[0];

    if (total_subdomains === submitted_subdomains && total_subdomains > 0) {
      await db.execute(
        `UPDATE inspections SET status = 'completed', approval_status = 'pending', manager_approval_status = 'pending', updated_at = NOW() WHERE id = ?`,
        [inspectionId]
      );

      await db.execute(
        `UPDATE phases ph
         INNER JOIN inspections i ON ph.project_id = i.project_id AND ph.phase_number = i.phase
         SET ph.status = 'submitted', ph.updated_at = NOW()
         WHERE i.id = ?`,
        [inspectionId]
      );
    }

    res.json({
      success: true,
      message: 'Inspection submitted successfully',
      data: { submittedSubDomains: subDomains.length }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get rejected inspections for inspector inbox
const getRejectedInspections = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        i.id,
        i.project_id,
        p.project_name,
        i.phase,
        i.status,
        i.approval_status,
        i.reviewer_notes,
        i.reviewed_at,
        u.name as reviewer_name
      FROM inspections i
      INNER JOIN projects p ON i.project_id = p.id
      INNER JOIN phases ph ON i.project_id = ph.project_id AND i.phase = ph.phase_number
      LEFT JOIN users u ON i.reviewer_id = u.id
      WHERE i.inspector_id = ? 
        AND i.approval_status = 'rejected'
        AND i.status = 'in_progress'
      ORDER BY i.reviewed_at DESC
    `;

    const rejectedInspections = await db.execute(query, [userId]);

    res.json({
      success: true,
      data: rejectedInspections
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Accept rejection and reopen inspection for editing
const acceptRejection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;

    const accessCheck = await db.execute(
      `SELECT i.id FROM inspections i
       WHERE i.id = ? AND i.inspector_id = ?`,
      [inspectionId, userId]
    );

    if (accessCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found or access denied' });
    }

      await db.execute(
        `UPDATE inspections 
         SET approval_status = 'pending',
             manager_approval_status = 'pending',
             status = 'in_progress',
             reviewer_id = NULL,
             reviewer_notes = NULL,
             reviewed_at = NULL,
             manager_reviewed_at = NULL,
             manager_notes = NULL
         WHERE id = ?`,
        [inspectionId]
      );

      await db.execute(
        `UPDATE phases ph
         INNER JOIN inspections i ON ph.project_id = i.project_id AND ph.phase_number = i.phase
         SET ph.status = 'in_progress', ph.updated_at = NOW()
         WHERE i.id = ?`,
        [inspectionId]
      );

    await db.execute(
      `DELETE iss FROM inspection_subdomain_submissions iss
       LEFT JOIN responses r ON iss.inspection_id = r.inspection_id
         AND iss.domain_id = r.domain_id
         AND iss.sub_domain_id = r.sub_domain_id
       WHERE iss.inspection_id = ?
         AND (iss.is_rejected = 1 OR r.rejected_at IS NOT NULL)`,
      [inspectionId]
    );

    await db.execute(
      `UPDATE responses 
       SET editable_by_inspector = 1,
           rejection_notes = NULL,
           rejected_at = NULL,
           rejected_by = NULL
       WHERE inspection_id = ? 
         AND (rejection_notes IS NOT NULL OR rejected_at IS NOT NULL)`,
      [inspectionId]
    );

    res.json({
      success: true,
      message: 'Rejection accepted. Inspection is now open for editing.'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Upload inspection photo
const uploadInspectionPhoto = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const { query_id, domain_id, phase } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const inspection = await db.executeOne(
      'SELECT project_id FROM inspections WHERE id = ?',
      [inspectionId]
    );
    
    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found'
      });
    }

    const projectId = inspection.project_id;

    const uploadDir = path.join(__dirname, '../../uploads/projects', projectId.toString(), 'inspections', inspectionId, 'queries', query_id);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const filename = `${timestamp}${ext}`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    const relativePath = `/uploads/projects/${projectId}/inspections/${inspectionId}/queries/${query_id}/${filename}`;

    const currentPhotos = await db.executeOne(
      `SELECT photos FROM responses 
       WHERE inspection_id = ? AND query_id = ? AND sub_domain_id = ? AND domain_id = ?`,
      [inspectionId, query_id, req.body.sub_domain_id, domain_id]
    );
    
    let existingPhotos = [];
    if (currentPhotos && currentPhotos.photos) {
      try {
        existingPhotos = JSON.parse(currentPhotos.photos);
        if (!Array.isArray(existingPhotos)) existingPhotos = [];
      } catch (parseError) {
        existingPhotos = [];
      }
    }
    
    existingPhotos.push(relativePath);
    
    await db.execute(
      `UPDATE responses 
       SET photos = ?
       WHERE inspection_id = ? AND query_id = ? AND sub_domain_id = ? AND domain_id = ?`,
      [JSON.stringify(existingPhotos), inspectionId, query_id, req.body.sub_domain_id, domain_id]
    );

    res.status(200).json({
      success: true,
      url: relativePath,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

module.exports = {
  getDashboard,
  getInbox,
  acceptInspection,
  getInspectionDomains,
  getSubDomainQueries,
  getInspectionHierarchy,
  getProjectHierarchy,
  submitQueryResponse,
  submitSubDomain,
  submitFinalInspection,
  getRejectedInspections,
  acceptRejection,
  uploadInspectionPhoto
};