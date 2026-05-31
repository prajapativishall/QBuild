const db = require('../config/db');
const { NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Get all domains with their checklist items
const getAllDomains = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        s.id as domain_id,
        s.domain_name,
        s.created_at as domain_created_at,
        s.updated_at as domain_updated_at,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', ci.id,
            'item_description', ci.item_description,
            'item_type', ci.item_type,
            'severity', ci.severity,
            'is_mandatory', ci.is_mandatory,
            'sop_reference', ci.sop_reference,
            'created_at', ci.created_at,
            'updated_at', ci.updated_at
          )
        ) as checklist_items
      FROM domains s
      LEFT JOIN checklist_items ci ON s.id = ci.domain_id
      GROUP BY s.id, s.domain_name, s.created_at, s.updated_at
      ORDER BY s.domain_name ASC
    `;

    const domains = await db.execute(query);

    // Parse JSON arrays for MySQL result
    const formattedDomains = domains.map(domain => ({
      domainId: domain.domain_id,
      domainName: domain.domain_name,
      domainOrder: 0,
      weightage: 0,
      createdAt: domain.domain_created_at,
      updatedAt: domain.domain_updated_at,
      checklistItems: JSON.parse(domain.checklist_items).filter(item => item.id !== null)
    }));

    res.json({
      success: true,
      data: {
        domains: formattedDomains
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get checklist items for a specific domain
const getChecklistByDomain = async (req, res, next) => {
  try {
    const { domain_id } = req.params;

    // First verify domain exists
    const domainQuery = `
      SELECT id, domain_name, created_at, updated_at
      FROM domains
      WHERE id = ?
    `;

    const domains = await db.execute(domainQuery, [domain_id]);

    if (domains.length === 0) {
      throw new NotFoundError('Domain');
    }

    const domain = domains[0];

    // Get checklist items for the domain
    const checklistQuery = `
      SELECT 
        id,
        domain_id,
        item_description,
        max_score,
        yes_score,
        no_score,
        na_score,
        item_order,
        created_at,
        updated_at
      FROM checklist_items
      WHERE domain_id = ?
      ORDER BY item_order ASC
    `;

    const checklistItems = await db.execute(checklistQuery, [domain_id]);

    const formattedItems = checklistItems.map(item => ({
      id: item.id,
      domainId: item.domain_id,
      itemDescription: item.item_description,
      maxScore: parseFloat(item.max_score),
      yesScore: parseFloat(item.yes_score),
      noScore: parseFloat(item.no_score),
      naScore: parseFloat(item.na_score),
      itemOrder: item.item_order,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    res.json({
      success: true,
      data: {
        domain: {
          id: domain.id,
          domainName: domain.domain_name,
          domainOrder: domain.domain_order,
          weightage: parseFloat(domain.weightage),
          createdAt: domain.created_at,
          updatedAt: domain.updated_at
        },
        checklistItems: formattedItems
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get single checklist item
const getChecklistItem = async (req, res, next) => {
  try {
    const { item_id } = req.params;

    const query = `
      SELECT 
        ci.id,
        ci.domain_id,
        ci.item_description,
        ci.max_score,
        ci.yes_score,
        ci.no_score,
        ci.na_score,
        ci.item_order,
        ci.created_at,
        ci.updated_at,
        s.domain_name
      FROM checklist_items ci
      JOIN domains s ON ci.domain_id = s.id
      WHERE ci.id = ?
    `;

    const items = await db.execute(query, [item_id]);

    if (items.length === 0) {
      throw new NotFoundError('Checklist item');
    }

    const item = items[0];

    const formattedItem = {
      id: item.id,
      domainId: item.domain_id,
      itemDescription: item.item_description,
      maxScore: parseFloat(item.max_score),
      yesScore: parseFloat(item.yes_score),
      noScore: parseFloat(item.no_score),
      naScore: parseFloat(item.na_score),
      itemOrder: item.item_order,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      domain: {
        id: item.domain_id,
        domainName: item.domain_name,
        domainOrder: 0,
        weightage: 0
      }
    };

    res.json({
      success: true,
      data: {
        checklistItem: formattedItem
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Create new domain (admin only)
const createDomain = async (req, res, next) => {
  try {
    const { domainName } = req.body;

    const query = `
      INSERT INTO domains (domain_name)
      VALUES (?)
    `;
    const [result] = await db.execute(query, [domainName]);

    // Get the created domain
    const getDomainQuery = `
      SELECT id, domain_name, created_at, updated_at
      FROM domains
      WHERE id = ?
    `;

    const domains = await db.execute(getDomainQuery, [result.insertId]);
    const domain = domains[0];

    logger.info('Domain created', {
      domainId: domain.id,
      domainName: domain.domain_name,
      createdBy: req.user.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Domain created successfully',
      data: {
        domain: {
          id: domain.id,
          domainName: domain.domain_name,
          domainOrder: domain.domain_order,
          weightage: parseFloat(domain.weightage),
          createdAt: domain.created_at,
          updatedAt: domain.updated_at
        }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Create new checklist item (admin only)
const createChecklistItem = async (req, res, next) => {
  try {
    const { 
      domainId, 
      itemDescription, 
      maxScore, 
      yesScore, 
      noScore, 
      naScore, 
      itemOrder 
    } = req.body;

    // Verify domain exists
    const domainQuery = 'SELECT id, domain_name FROM domains WHERE id = ?';
    const domains = await db.execute(domainQuery, [domainId]);

    if (domains.length === 0) {
      throw new NotFoundError('Domain');
    }

    const query = `
      INSERT INTO checklist_items 
      (domain_id, item_description, max_score, yes_score, no_score, na_score, item_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.execute(query, [
      domainId,
      itemDescription,
      maxScore,
      yesScore,
      noScore,
      naScore,
      itemOrder || 0
    ]);

    // Get the created checklist item
    const getItemQuery = `
      SELECT 
        id,
        domain_id,
        item_description,
        max_score,
        yes_score,
        no_score,
        na_score,
        item_order,
        created_at,
        updated_at
      FROM checklist_items
      WHERE id = ?
    `;

    const items = await db.execute(getItemQuery, [result.insertId]);
    const item = items[0];

    logger.info('Checklist item created', {
      itemId: item.id,
      domainId: item.domain_id,
      createdBy: req.user.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Checklist item created successfully',
      data: {
        checklistItem: {
          id: item.id,
          domainId: item.domain_id,
          itemDescription: item.item_description,
          maxScore: parseFloat(item.max_score),
          yesScore: parseFloat(item.yes_score),
          noScore: parseFloat(item.no_score),
          naScore: parseFloat(item.na_score),
          itemOrder: item.item_order,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Update domain (admin only)
const updateDomain = async (req, res, next) => {
  try {
    const { domain_id } = req.params;
    const { domainName, domainOrder, weightage } = req.body;

    // Check if domain exists
    const existingDomainQuery = 'SELECT id FROM domains WHERE id = ?';
    const existingDomains = await db.execute(existingDomainQuery, [domain_id]);

    if (existingDomains.length === 0) {
      throw new NotFoundError('Domain');
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (domainName !== undefined) {
      updateFields.push('domain_name = ?');
      updateValues.push(domainName);
    }

    if (domainOrder !== undefined) {
      updateFields.push('domain_order = ?');
      updateValues.push(domainOrder);
    }

    if (weightage !== undefined) {
      updateFields.push('weightage = ?');
      updateValues.push(weightage);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(domain_id);

    const updateQuery = `
      UPDATE domains 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.execute(updateQuery, updateValues);

    // Get updated domain
    const getDomainQuery = `
      SELECT id, domain_name, domain_order, weightage, created_at, updated_at
      FROM domains
      WHERE id = ?
    `;

    const domains = await db.execute(getDomainQuery, [domain_id]);
    const domain = domains[0];

    logger.info('Domain updated', {
      domainId: domain.id,
      domainName: domain.domain_name,
      updatedBy: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Domain updated successfully',
      data: {
        domain: {
          id: domain.id,
          domainName: domain.domain_name,
          domainOrder: domain.domain_order,
          weightage: parseFloat(domain.weightage),
          createdAt: domain.created_at,
          updatedAt: domain.updated_at
        }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Update checklist item (admin only)
const updateChecklistItem = async (req, res, next) => {
  try {
    const { item_id } = req.params;
    const { 
      domainId, 
      itemDescription, 
      maxScore, 
      yesScore, 
      noScore, 
      naScore, 
      itemOrder 
    } = req.body;

    // Check if checklist item exists
    const existingItemQuery = 'SELECT id FROM checklist_items WHERE id = ?';
    const existingItems = await db.execute(existingItemQuery, [item_id]);

    if (existingItems.length === 0) {
      throw new NotFoundError('Checklist item');
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (domainId !== undefined) {
      updateFields.push('domain_id = ?');
      updateValues.push(domainId);
    }

    if (itemDescription !== undefined) {
      updateFields.push('item_description = ?');
      updateValues.push(itemDescription);
    }

    if (maxScore !== undefined) {
      updateFields.push('max_score = ?');
      updateValues.push(maxScore);
    }

    if (yesScore !== undefined) {
      updateFields.push('yes_score = ?');
      updateValues.push(yesScore);
    }

    if (noScore !== undefined) {
      updateFields.push('no_score = ?');
      updateValues.push(noScore);
    }

    if (naScore !== undefined) {
      updateFields.push('na_score = ?');
      updateValues.push(naScore);
    }

    if (itemOrder !== undefined) {
      updateFields.push('item_order = ?');
      updateValues.push(itemOrder);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(item_id);

    const updateQuery = `
      UPDATE checklist_items 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.execute(updateQuery, updateValues);

    // Get updated checklist item
    const getItemQuery = `
      SELECT 
        id,
        domain_id,
        item_description,
        max_score,
        yes_score,
        no_score,
        na_score,
        item_order,
        created_at,
        updated_at
      FROM checklist_items
      WHERE id = ?
    `;

    const items = await db.execute(getItemQuery, [item_id]);
    const item = items[0];

    logger.info('Checklist item updated', {
      itemId: item.id,
      domainId: item.domain_id,
      updatedBy: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Checklist item updated successfully',
      data: {
        checklistItem: {
          id: item.id,
          domainId: item.domain_id,
          itemDescription: item.item_description,
          maxScore: parseFloat(item.max_score),
          yesScore: parseFloat(item.yes_score),
          noScore: parseFloat(item.no_score),
          naScore: parseFloat(item.na_score),
          itemOrder: item.item_order,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Delete domain (admin only)
const deleteDomain = async (req, res, next) => {
  try {
    const { domain_id } = req.params;

    // Check if domain exists
    const existingDomainQuery = 'SELECT id, domain_name FROM domains WHERE id = ?';
    const existingDomains = await db.execute(existingDomainQuery, [domain_id]);

    if (existingDomains.length === 0) {
      throw new NotFoundError('Domain');
    }

    const domain = existingDomains[0];

    // Delete domain (cascade will delete related checklist items)
    const deleteQuery = 'DELETE FROM domains WHERE id = ?';
    await db.execute(deleteQuery, [domain_id]);

    logger.info('Domain deleted', {
      domainId: domain.id,
      domainName: domain.domain_name,
      deletedBy: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Domain deleted successfully'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Delete checklist item (admin only)
const deleteChecklistItem = async (req, res, next) => {
  try {
    const { item_id } = req.params;

    // Check if checklist item exists
    const existingItemQuery = 'SELECT id FROM checklist_items WHERE id = ?';
    const existingItems = await db.execute(existingItemQuery, [item_id]);

    if (existingItems.length === 0) {
      throw new NotFoundError('Checklist item');
    }

    // Delete checklist item
    const deleteQuery = 'DELETE FROM checklist_items WHERE id = ?';
    await db.execute(deleteQuery, [item_id]);

    logger.info('Checklist item deleted', {
      itemId: item_id,
      deletedBy: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Checklist item deleted successfully'
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

// Get checklist questions for an inspection (Mobile app)
const getChecklistByInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;

    // Check if inspectionId is actually a projectId (when no inspection exists yet)
    let projectId;

    const projectQuery = `
      SELECT project_id
      FROM inspections
      WHERE id = ?
    `;

    const inspections = await db.execute(projectQuery, [inspectionId]);

    if (inspections.length > 0) {
      // It's a valid inspection ID
      projectId = inspections[0].project_id;
    } else {
      // Try to find project by ID (inspectionId might be a projectId)
      const projectCheckQuery = `
        SELECT id
        FROM projects
        WHERE id = ?
      `;
      const projects = await db.execute(projectCheckQuery, [inspectionId]);

      if (projects.length > 0) {
        // It's a project ID
        projectId = inspectionId;
      } else {
        throw new NotFoundError('Inspection or Project');
      }
    }

    // Get domains with their sub_domains for the current phase
    const domainsQuery = `
      SELECT 
        s.id as domain_id,
        s.domain_name,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'sub_domain_id', sec.id,
            'sub_domain_name', sec.sub_domain_name,
            'sub_domain_description', sec.description,
            'sub_domain_weightage', sec.weightage
          )
        ) as subDomains
      FROM domains s
      INNER JOIN phase_domains ps ON s.id = ps.domain_id
      INNER JOIN projects p ON ps.project_id = p.id
      INNER JOIN inspections i ON i.project_id = p.id AND i.id = ? AND i.phase = ps.phase_number
      INNER JOIN phase_domain_sub_domains pss ON ps.project_id = pss.project_id
        AND ps.phase_number = pss.phase_number
        AND pss.domain_id = ps.domain_id
      INNER JOIN sub_domains sec ON pss.sub_domain_id = sec.id
      WHERE sec.is_active = true
      GROUP BY s.id, s.domain_name
      ORDER BY s.domain_name ASC
    `;

    const domains = await db.execute(domainsQuery, [projectId]);

    // Get queries for sub_domains assigned to domains
    const queriesQuery = `
      SELECT 
        q.id,
        q.question_text,
        sq.query_type as question_type,
        sq.parent_id,
        sq.item_order,
        sec.id as sub_domain_id,
        sec.sub_domain_name,
        s.id as domain_id,
        s.domain_name
      FROM queries q
      INNER JOIN sub_domain_queries sq ON q.id = sq.query_id
      INNER JOIN sub_domains sec ON sq.sub_domain_id = sec.id
      INNER JOIN phase_domain_sub_domains pss ON sec.id = pss.sub_domain_id
      INNER JOIN domains s ON pss.domain_id = s.id
      INNER JOIN inspections i ON i.id = ? AND pss.project_id = i.project_id AND pss.phase_number = i.phase
      WHERE pss.project_id = (SELECT project_id FROM inspections WHERE id = ?)
      ORDER BY s.domain_name ASC, sec.sub_domain_name ASC, sq.item_order ASC
    `;

    const queries = await db.execute(queriesQuery, [projectId]);

    // Format domains with sub_domains
    const formattedDomains = domains.map(domain => ({
      domainId: domain.domain_id,
      domainName: domain.domain_name,
      subDomains: domain.subDomains ? (typeof domain.subDomains === 'string' ? JSON.parse(domain.subDomains) : domain.subDomains) : []
    }));

    // Format queries
    const formattedQueries = queries.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      parentId: q.parent_id,
      subDomainId: q.sub_domain_id,
      subDomainName: q.sub_domain_name,
      domainId: q.domain_id,
      domainName: q.domain_name,
      itemOrder: q.item_order
    }));

    res.json({
      success: true,
      data: {
        inspectionId,
        domains: formattedDomains,
        queries: formattedQueries
      }
    });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

module.exports = {
  getAllDomains,
  getChecklistByDomain,
  getChecklistItem,
  createDomain,
  createChecklistItem,
  updateDomain,
  updateChecklistItem,
  deleteDomain,
  deleteChecklistItem,
  getChecklistByInspection
};
