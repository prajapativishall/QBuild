const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Response Service for QRating System
 * Handles checklist response submission with UPSERT logic and admin override functionality
 */

class ResponseService {
  constructor() {
    this.allowedResponseValues = ['YES', 'NO', 'NA'];
  }

  /**
   * Submit a single response (UPSERT logic)
   * @param {number} inspectionId - Inspection ID
   * @param {number} checklistItemId - Checklist item ID
   * @param {string} responseValue - Response value (YES/NO/NA)
   * @param {string} remarks - Optional remarks
   * @param {number} submittedBy - User ID from JWT
   * @returns {Promise<Object>} - Response result
   */
  async submitResponse(inspectionId, checklistItemId, responseValue, remarks, submittedBy) {
    try {
      // Validate response value
      this.validateResponseValue(responseValue);

      logger.info('Submitting single response', {
        inspectionId,
        checklistItemId,
        responseValue,
        submittedBy
      });

      // Use UPSERT logic with ON DUPLICATE KEY UPDATE
      const query = `
        INSERT INTO checklist_responses 
        (inspection_id, checklist_item_id, response_value, notes, submitted_by, submitted_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
        response_value = VALUES(response_value),
        notes = VALUES(notes),
        submitted_by = VALUES(submitted_by),
        submitted_at = CURRENT_TIMESTAMP
      `;

      const result = await db.execute(query, [
        inspectionId,
        checklistItemId,
        responseValue,
        remarks || null,
        submittedBy
      ]);

      const action = result.affectedRows === 1 ? 'inserted' : 'updated';

      // Handle cascading N/A for secondary queries if primary is N/A or NO
      let cascadedResponses = [];
      if (responseValue === 'NA' || responseValue === 'NO') {
        cascadedResponses = await this.cascadeNAForSecondaryQueries(
          inspectionId,
          checklistItemId,
          submittedBy
        );
      }
      
      logger.info('Response submitted successfully', {
        inspectionId,
        checklistItemId,
        responseValue,
        action,
        submittedBy,
        cascadedCount: cascadedResponses.length
      });

      return {
        success: true,
        action,
        inspectionId,
        checklistItemId,
        responseValue,
        remarks,
        submittedBy,
        affectedRows: result.affectedRows,
        cascadedResponses: cascadedResponses.length > 0 ? cascadedResponses : undefined
      };

    } catch (error) {
      logger.error('Error submitting response', {
        inspectionId,
        checklistItemId,
        responseValue,
        submittedBy,
        error: error.message
      });
      throw new Error(`Response submission failed: ${error.message}`);
    }
  }

  /**
   * Submit multiple responses in bulk using MySQL transaction
   * @param {number} inspectionId - Inspection ID
   * @param {Array} responses - Array of response objects
   * @param {number} submittedBy - User ID from JWT
   * @param {string} phase - Phase number
   * @param {string} sourcePhase - Source phase number
   * @returns {Promise<Object>} - Bulk submission result
   */
  async bulkSubmitResponses(inspectionId, responses, submittedBy, phase = null, sourcePhase = null) {
    let actualInspectionId = inspectionId;

    try {
      logger.info('Bulk response submission request', {
        inspectionId,
        responseCount: responses.length,
        submittedBy,
        phase
      });

      // Check if inspection_id exists, if not, check if it's a project_id and create inspection
      const inspectionCheck = await db.execute('SELECT id FROM inspections WHERE id = ?', [inspectionId]);

      if (inspectionCheck.length === 0) {
        // Check if it's a project_id
        const projectCheck = await db.execute('SELECT id FROM projects WHERE id = ?', [inspectionId]);

        if (projectCheck.length > 0) {
          // It's a project_id, check if inspection already exists for this project with the given phase
          let phaseQuery = 'SELECT id FROM inspections WHERE project_id = ?';
          let phaseParams = [inspectionId];

          // If phase is provided, filter by phase to avoid clutter/override
          if (phase !== null && phase !== undefined) {
            phaseQuery += ' AND phase = ?';
            phaseParams.push(phase);
          }

          phaseQuery += ' ORDER BY id DESC LIMIT 1';

          const existingInspection = await db.execute(phaseQuery, phaseParams);

          if (existingInspection.length > 0) {
            // Use existing inspection
            actualInspectionId = existingInspection[0].id;
            logger.info('Using existing inspection for project', {
              projectId: inspectionId,
              inspectionId: actualInspectionId,
              phase: phase,
              userId: submittedBy
            });
          } else {
            // Create new inspection with provided phase or auto-incremented phase
            logger.info('No inspection found, creating inspection for project', {
              projectId: inspectionId,
              userId: submittedBy,
              phase: phase
            });

            let nextPhase;
            if (phase !== null && phase !== undefined) {
              // Use the provided phase
              nextPhase = phase;
            } else {
              // Get the next phase number for this project
              const maxPhaseQuery = `
                SELECT COALESCE(MAX(phase), 0) as max_phase
                FROM inspections
                WHERE project_id = ?
              `;
              const maxPhaseResult = await db.execute(maxPhaseQuery, [inspectionId]);
              nextPhase = (maxPhaseResult[0]?.max_phase || 0) + 1;
            }

            const createInspectionQuery = `
              INSERT INTO inspections (project_id, created_by, inspection_date, status, phase)
              VALUES (?, ?, CURDATE(), 'in_progress', ?)
            `;

            const createResult = await db.execute(createInspectionQuery, [inspectionId, submittedBy, nextPhase]);
            actualInspectionId = createResult.insertId;

            // Get source phase data to copy configuration
            const sourcePhaseNumber = sourcePhase || (nextPhase - 1);
            const previousPhaseQuery = `
              SELECT * FROM phases
              WHERE project_id = ? AND phase_number = ?
              ORDER BY phase_number DESC
              LIMIT 1
            `;
            const previousPhaseResult = await db.execute(previousPhaseQuery, [inspectionId, sourcePhaseNumber]);

            let phaseData = {
              project_id: inspectionId,
              phase_number: nextPhase,
              status: 'in_progress',
              progress: 0,
              inspection_id: actualInspectionId
            };

            // Copy configuration from previous phase if exists
            if (previousPhaseResult.length > 0) {
              const prevPhase = previousPhaseResult[0];
              phaseData = {
                ...phaseData,
                description: prevPhase.description,
                site_address: prevPhase.site_address,
                city: prevPhase.city,
                state: prevPhase.state,
                start_date: prevPhase.start_date,
                end_date: prevPhase.end_date,
                engineers: prevPhase.engineers,
                inspector_id: prevPhase.inspector_id,
                reviewer_id: prevPhase.reviewer_id,
                viewer_id: prevPhase.viewer_id,
                client_name: prevPhase.client_name,
                client_designation: prevPhase.client_designation,
                client_mobile_no: prevPhase.client_mobile_no,
                client_email: prevPhase.client_email,
                alternate_client_name: prevPhase.alternate_client_name,
                alternate_designation: prevPhase.alternate_designation,
                alternate_email: prevPhase.alternate_email,
                alternate_mobile_no: prevPhase.alternate_mobile_no
              };
              logger.info('Copied configuration from previous phase', { previousPhase: nextPhase - 1, newPhase: nextPhase });
            }

            // Insert new phase record into phases table
            const phaseResult = await db.executeWithResult(
              `
                INSERT INTO phases (
                  project_id, phase_number, description, site_address, city, state,
                  status, progress, start_date, end_date, engineers, inspector_id, reviewer_id,
                  viewer_id, inspection_id, client_name, client_designation, client_mobile_no,
                  client_email, alternate_client_name, alternate_designation, alternate_email,
                  alternate_mobile_no
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                phaseData.project_id,
                phaseData.phase_number,
                phaseData.description,
                phaseData.site_address,
                phaseData.city,
                phaseData.state,
                phaseData.status,
                phaseData.progress || 0,
                phaseData.start_date,
                phaseData.end_date,
                phaseData.engineers,
                phaseData.inspector_id,
                phaseData.reviewer_id,
                phaseData.viewer_id,
                phaseData.inspection_id,
                phaseData.client_name,
                phaseData.client_designation,
                phaseData.client_mobile_no,
                phaseData.client_email,
                phaseData.alternate_client_name,
                phaseData.alternate_designation,
                phaseData.alternate_email,
                phaseData.alternate_mobile_no
              ]
            );

            const phaseId = phaseResult.insertId;

            // Copy queries from source phase to project_queries and phase_queries table
            if (previousPhaseResult.length > 0) {
              // Copy domains from source phase
              const previousPhaseDomainsQuery = `
                SELECT domain_id, weightage
                FROM phase_domains
                WHERE project_id = ? AND phase_number = ?
              `;
              const previousPhaseDomains = await db.execute(previousPhaseDomainsQuery, [inspectionId, sourcePhaseNumber]);

              if (previousPhaseDomains.length > 0) {
                const insertDomainValues = previousPhaseDomains.map(pd =>
                  `(${inspectionId}, ${nextPhase}, ${pd.domain_id}, ${pd.weightage || 0})`
                ).join(', ');

                await db.execute(
                  `INSERT INTO phase_domains (project_id, phase_number, domain_id, weightage)
                   VALUES ${insertDomainValues}`
                );
                logger.info('Copied domains from source phase', { sourcePhase: sourcePhaseNumber, newPhase: nextPhase, domainCount: previousPhaseDomains.length });
              }

              // Copy sub-domains from source phase
              const previousPhaseSubDomainsQuery = `
                SELECT domain_id, sub_domain_id, weightage, is_manual
                FROM phase_domain_sub_domains
                WHERE project_id = ? AND phase_number = ?
              `;
              const previousPhaseSubDomains = await db.execute(previousPhaseSubDomainsQuery, [inspectionId, sourcePhaseNumber]);

              if (previousPhaseSubDomains.length > 0) {
                const insertSubDomainValues = previousPhaseSubDomains.map(psd =>
                  `(${inspectionId}, ${nextPhase}, ${psd.domain_id}, ${psd.sub_domain_id}, ${psd.weightage || 0}, ${psd.is_manual || 0})`
                ).join(', ');

                await db.execute(
                  `INSERT INTO phase_domain_sub_domains (project_id, phase_number, domain_id, sub_domain_id, weightage, is_manual)
                   VALUES ${insertSubDomainValues}`
                );
                logger.info('Copied sub-domains from source phase', { sourcePhase: sourcePhaseNumber, newPhase: nextPhase, subDomainCount: previousPhaseSubDomains.length });
              }

              // Copy queries from source phase
              const previousPhaseQueriesQuery = `
                SELECT pq.project_query_id, pq.weightage
                FROM phase_queries pq
                WHERE pq.project_id = ? AND pq.phase_number = ?
              `;
              const previousPhaseQueries = await db.execute(previousPhaseQueriesQuery, [inspectionId, sourcePhaseNumber]);

              if (previousPhaseQueries.length > 0) {
                const insertQueryValues = previousPhaseQueries.map(qq =>
                  `(${inspectionId}, ${nextPhase}, ${qq.project_query_id}, ${qq.weightage || 0})`
                ).join(', ');

                await db.execute(
                  `INSERT INTO phase_queries (project_id, phase_number, project_query_id, weightage)
                   VALUES ${insertQueryValues}`
                );
                logger.info('Copied queries from source phase', { sourcePhase: sourcePhaseNumber, newPhase: nextPhase, queryCount: previousPhaseQueries.length });
              }
            }

            // Update project's current_phase_id to the new phase record
            await db.execute(
              'UPDATE projects SET current_phase_id = ? WHERE id = ?',
              [phaseId, inspectionId]
            );
            logger.info('Created new phase record with copied configuration and updated project current_phase_id', { projectId: inspectionId, newPhase: nextPhase, phaseId, inspectionId: actualInspectionId });

            // Store phase info for logging
            const phaseInfo = {
              project_id: projectConfig.project_id,
              project_name: projectConfig.project_name,
              inspector_id: projectConfig.inspector_id,
              viewer_id: projectConfig.viewer_id
            };

            logger.info('Created inspection with phase', {
              projectId: inspectionId,
              inspectionId: actualInspectionId,
              phase: nextPhase,
              userId: submittedBy
            });
          }
        } else {
          throw new Error(`Invalid inspection_id or project_id: ${inspectionId}`);
        }
      }

      // Validate all responses before processing
      this.validateBulkResponses(responses);

      // Use MySQL transaction for bulk operations
      const result = await db.transaction(async (connection) => {
        const processedResponses = [];
        const failedResponses = [];

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const index = i + 1;

          try {
            // Validate individual response
            this.validateResponseValue(response.responseValue);

            // Use UPSERT logic with prepared statement
            const query = `
              INSERT INTO checklist_responses 
              (inspection_id, question_id, domain_id, response_value, nc_type, inspector_comment, 
               additional_remarks, photos, notes, submitted_by, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON DUPLICATE KEY UPDATE
              response_value = VALUES(response_value),
              nc_type = VALUES(nc_type),
              inspector_comment = VALUES(inspector_comment),
              additional_remarks = VALUES(additional_remarks),
              photos = VALUES(photos),
              notes = VALUES(notes),
              submitted_by = VALUES(submitted_by),
              submitted_at = CURRENT_TIMESTAMP
            `;

            const insertResult = await connection.execute(query, [
              actualInspectionId,
              response.question_id,
              response.domain_id || null,
              response.responseValue,
              response.nc_type || null,
              response.inspector_comment || null,
              response.additional_remarks || null,
              response.photos ? JSON.stringify(response.photos) : null,
              response.remarks || null,
              submittedBy
            ]);

            const action = insertResult.affectedRows === 1 ? 'inserted' : 'updated';

            processedResponses.push({
              index,
              questionId: response.question_id,
              responseValue: response.responseValue,
              ncType: response.nc_type,
              inspectorComment: response.inspector_comment,
              additionalRemarks: response.additional_remarks,
              photos: response.photos,
              remarks: response.remarks,
              action,
              affectedRows: insertResult.affectedRows
            });

            // Handle cascading N/A for secondary queries if primary is N/A or NO
            if (response.responseValue === 'NA' || response.responseValue === 'NO') {
              const cascaded = await this.cascadeNAForSecondaryQueries(
                actualInspectionId,
                response.question_id,
                submittedBy
              );
              
              if (cascaded.length > 0) {
                processedResponses[processedResponses.length - 1].cascadedResponses = cascaded;
              }
            }

          } catch (error) {
            logger.error('Error processing individual response in bulk', {
              inspectionId: actualInspectionId,
              questionId: response.question_id,
              responseValue: response.responseValue,
              index,
              error: error.message
            });

            failedResponses.push({
              index,
              questionId: response.question_id,
              responseValue: response.responseValue,
              error: error.message
            });
          }
        }

        // If any responses failed, rollback the entire transaction
        if (failedResponses.length > 0) {
          throw new Error(`Bulk submission failed: ${failedResponses.length} responses failed`);
        }

        return {
          processedResponses,
          failedResponses,
          totalProcessed: processedResponses.length,
          totalFailed: failedResponses.length
        };
      });

      logger.info('Bulk response submission completed', {
        inspectionId: actualInspectionId,
        totalProcessed: result.totalProcessed,
        totalFailed: result.totalFailed,
        submittedBy
      });

      return {
        success: true,
        inspectionId: actualInspectionId,
        submittedBy,
        totalProcessed: result.totalProcessed,
        totalFailed: result.totalFailed,
        processedResponses: result.processedResponses,
        failedResponses: result.failedResponses
      };

    } catch (error) {
      logger.error('Error in bulk response submission', {
        inspectionId: actualInspectionId,
        responseCount: responses.length,
        submittedBy,
        error: error.message
      });
      throw new Error(`Bulk response submission failed: ${error.message}`);
    }
  }

  /**
   * Override an existing response (Admin only)
   * @param {number} responseId - Response ID to override
   * @param {string} responseValue - New response value
   * @param {string} remarks - Override remarks
   * @param {number} overriddenBy - Admin user ID
   * @returns {Promise<Object>} - Override result
   */
  async overrideResponse(responseId, responseValue, remarks, overriddenBy) {
    try {
      // Validate response value
      this.validateResponseValue(responseValue);

      logger.info('Overriding response', {
        responseId,
        responseValue,
        overriddenBy
      });

      // Check if response exists
      const existingResponseQuery = `
        SELECT id, inspection_id, checklist_item_id, response_value, notes, submitted_by
        FROM checklist_responses
        WHERE id = ?
      `;

      const existingResponses = await db.execute(existingResponseQuery, [responseId]);

      if (existingResponses.length === 0) {
        throw new Error('Response not found');
      }

      const existingResponse = existingResponses[0];

      // Update response with override information
      const updateQuery = `
        UPDATE checklist_responses
        SET response_value = ?,
            notes = ?,
            submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await db.execute(updateQuery, [
        responseValue,
        remarks || null,
        overriddenBy,
        responseId
      ]);

      logger.info('Response overridden successfully', {
        responseId,
        originalValue: existingResponse.response_value,
        newValue: responseValue,
        overriddenBy
      });

      return {
        success: true,
        responseId,
        inspectionId: existingResponse.inspection_id,
        checklistItemId: existingResponse.checklist_item_id,
        originalResponse: {
          responseValue: existingResponse.response_value,
          remarks: existingResponse.notes,
          submittedBy: existingResponse.submitted_by
        },
        overriddenResponse: {
          responseValue,
          remarks,
          overriddenBy
        },
        affectedRows: result.affectedRows
      };

    } catch (error) {
      logger.error('Error overriding response', {
        responseId,
        responseValue,
        overriddenBy,
        error: error.message
      });
      throw new Error(`Response override failed: ${error.message}`);
    }
  }

  /**
   * Get all responses for an inspection, grouped by hierarchy
   * @param {number} inspectionId - Inspection ID
   * @returns {Promise<Object>} - Grouped responses
   */
  async getResponsesByInspection(inspectionId) {
    try {
      logger.info('Fetching responses for inspection', { inspectionId });

      // Get all responses with hierarchy information
      const query = `
        SELECT 
          cr.id,
          cr.inspection_id,
          cr.checklist_item_id,
          cr.response_value,
          cr.notes,
          cr.submitted_by,
          cr.submitted_at,
          ci.item_description,
          ci.item_type,
          ci.parent_item_id,
          sd.sub_domain_name,
          sd.sub_domain_id,
          d.domain_name,
          d.domain_id,
          u_submitter.name as submitted_by_name,
          u_submitter.email as submitted_by_email
        FROM checklist_responses cr
        JOIN checklist_items ci ON cr.checklist_item_id = ci.id
        JOIN sub_domains sd ON ci.sub_domain_id = sd.id
        JOIN domains d ON ci.domain_id = d.id
        LEFT JOIN users u_submitter ON cr.submitted_by = u_submitter.id
        WHERE cr.inspection_id = ?
        ORDER BY d.domain_name ASC, sd.id ASC, ci.id ASC
      `;

      const responses = await db.execute(query, [inspectionId]);

      if (responses.length === 0) {
        return {
          inspectionId,
          domains: [],
          summary: {
            totalResponses: 0,
            overriddenResponses: 0,
            domainsCount: 0,
            subDomainsCount: 0
          }
        };
      }

      // Group responses by hierarchy: Domain -> SubDomain -> Question
      const groupedData = this.groupResponsesByHierarchy(responses);

      logger.info('Responses retrieved successfully', {
        inspectionId,
        totalResponses: responses.length,
        domainsCount: groupedData.domains.length
      });

      return {
        inspectionId,
        domains: groupedData.domains,
        summary: groupedData.summary
      };

    } catch (error) {
      logger.error('Error fetching responses by inspection', {
        inspectionId,
        error: error.message
      });
      throw new Error(`Failed to fetch responses: ${error.message}`);
    }
  }

  /**
   * Get single response by ID
   * @param {number} responseId - Response ID
   * @returns {Promise<Object>} - Response details
   */
  async getResponseById(responseId) {
    try {
      const query = `
        SELECT 
          cr.id,
          cr.inspection_id,
          cr.checklist_item_id,
          cr.response_value,
          cr.notes,
          cr.submitted_by,
          cr.submitted_at,
          ci.item_description,
          ci.item_type,
          ci.parent_item_id,
          sd.sub_domain_name,
          sd.sub_domain_id,
          d.domain_name,
          d.domain_id,
          u_submitter.name as submitted_by_name,
          u_submitter.email as submitted_by_email
        FROM checklist_responses cr
        JOIN checklist_items ci ON cr.checklist_item_id = ci.id
        JOIN sub_domains sd ON ci.sub_domain_id = sd.id
        JOIN domains d ON ci.domain_id = d.id
        LEFT JOIN users u_submitter ON cr.submitted_by = u_submitter.id
        WHERE cr.id = ?
      `;

      const responses = await db.execute(query, [responseId]);

      if (responses.length === 0) {
        throw new Error('Response not found');
      }

      return this.formatResponseDetails(responses[0]);

    } catch (error) {
      logger.error('Error fetching response by ID', {
        responseId,
        error: error.message
      });
      throw new Error(`Failed to fetch response: ${error.message}`);
    }
  }

  /**
   * Delete a response
   * @param {number} responseId - Response ID
   * @param {number} deletedBy - User ID performing deletion
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteResponse(responseId, deletedBy) {
    try {
      logger.info('Deleting response', { responseId, deletedBy });

      // Get response details before deletion
      const existingResponse = await this.getResponseById(responseId);

      // Delete the response
      const deleteQuery = 'DELETE FROM checklist_responses WHERE id = ?';
      const result = await db.execute(deleteQuery, [responseId]);

      if (result.affectedRows === 0) {
        throw new Error('Response not found or already deleted');
      }

      logger.info('Response deleted successfully', {
        responseId,
        deletedBy,
        deletedResponse: existingResponse
      });

      return {
        success: true,
        responseId,
        deletedBy,
        deletedResponse: existingResponse,
        affectedRows: result.affectedRows
      };

    } catch (error) {
      logger.error('Error deleting response', {
        responseId,
        deletedBy,
        error: error.message
      });
      throw new Error(`Response deletion failed: ${error.message}`);
    }
  }

  /**
   * Cascade N/A to secondary queries when primary query is N/A or NO
   * @param {number} inspectionId - Inspection ID
   * @param {number} checklistItemId - Primary checklist item ID
   * @param {number} submittedBy - User ID submitting the response
   * @returns {Promise<Array>} - Array of cascaded secondary responses
   */
  async cascadeNAForSecondaryQueries(inspectionId, checklistItemId, submittedBy) {
    try {
      logger.info('Checking for secondary queries to cascade N/A', {
        inspectionId,
        checklistItemId,
        submittedBy
      });

      // First, check if this is a PRIMARY query and get its secondary queries
      const findSecondaryQuery = `
        SELECT
          ci.id as secondary_item_id,
          ci.item_description,
          ci.item_type,
          ci.parent_id
        FROM checklist_items ci
        WHERE ci.parent_id = ?
          AND ci.item_type = 'SECONDARY'
          AND ci.id NOT IN (
            -- Exclude items that already have a response
            SELECT checklist_item_id 
            FROM checklist_responses 
            WHERE inspection_id = ?
          )
      `;

      const secondaryItems = await db.execute(findSecondaryQuery, [checklistItemId, inspectionId]);

      if (secondaryItems.length === 0) {
        logger.info('No secondary queries found to cascade N/A', {
          inspectionId,
          checklistItemId
        });
        return [];
      }

      logger.info(`Found ${secondaryItems.length} secondary queries to mark as N/A`, {
        inspectionId,
        checklistItemId,
        secondaryCount: secondaryItems.length
      });

      // Mark all secondary queries as N/A
      const cascadedResponses = [];
      const naRemarks = 'Automatically marked as N/A - Primary query is N/A or NO';

      for (const secondaryItem of secondaryItems) {
        try {
          const upsertQuery = `
            INSERT INTO checklist_responses 
            (inspection_id, checklist_item_id, response_value, notes, submitted_by, submitted_at)
            VALUES (?, ?, 'NA', ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
            response_value = 'NA',
            notes = VALUES(notes),
            submitted_by = VALUES(submitted_by),
            submitted_at = CURRENT_TIMESTAMP
          `;

          const result = await db.execute(upsertQuery, [
            inspectionId,
            secondaryItem.secondary_item_id,
            naRemarks,
            submittedBy
          ]);

          const action = result.affectedRows === 1 ? 'inserted' : 'updated';

          cascadedResponses.push({
            checklistItemId: secondaryItem.secondary_item_id,
            itemDescription: secondaryItem.item_description,
            responseValue: 'NA',
            action,
            remarks: naRemarks
          });

          logger.info('Secondary query marked as N/A', {
            inspectionId,
            primaryItemId: checklistItemId,
            secondaryItemId: secondaryItem.secondary_item_id,
            action
          });

        } catch (error) {
          logger.error('Error marking secondary query as N/A', {
            inspectionId,
            secondaryItemId: secondaryItem.secondary_item_id,
            error: error.message
          });
          // Continue with other secondary queries even if one fails
        }
      }

      logger.info('Cascading N/A completed', {
        inspectionId,
        primaryItemId: checklistItemId,
        cascadedCount: cascadedResponses.length
      });

      return cascadedResponses;

    } catch (error) {
      logger.error('Error in cascadeNAForSecondaryQueries', {
        inspectionId,
        checklistItemId,
        submittedBy,
        error: error.message
      });
      // Return empty array on error to not block the primary response submission
      return [];
    }
  }

  /**
   * Validate response value
   * @param {string} responseValue - Response value to validate
   * @throws {Error} - If invalid
   */
  validateResponseValue(responseValue) {
    if (!responseValue) {
      throw new Error('Response value is required');
    }

    if (!this.allowedResponseValues.includes(responseValue)) {
      throw new Error(`Invalid response value: ${responseValue}. Allowed values: ${this.allowedResponseValues.join(', ')}`);
    }
  }

  /**
   * Validate bulk responses array
   * @param {Array} responses - Array of response objects
   * @throws {Error} - If invalid
   */
  validateBulkResponses(responses) {
    if (!Array.isArray(responses)) {
      throw new Error('Responses must be an array');
    }

    if (responses.length === 0) {
      throw new Error('Responses array cannot be empty');
    }

    if (responses.length > 100) {
      throw new Error('Maximum 100 responses allowed per bulk submission');
    }

    // Validate each response object
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const index = i + 1;

      if (!response.question_id) {
        throw new Error(`Response at index ${index} is missing question_id`);
      }

      if (!response.responseValue) {
        throw new Error(`Response at index ${index} is missing responseValue`);
      }

      // Validate response value
      this.validateResponseValue(response.responseValue);
    }

    // Check for duplicate checklist_item_id
    const checklistItemIds = responses.map(r => r.checklist_item_id);
    const uniqueChecklistItemIds = new Set(checklistItemIds);

    if (checklistItemIds.length !== uniqueChecklistItemIds.size) {
      throw new Error('Duplicate checklist_item_id found in bulk responses');
    }
  }

  /**
   * Group responses by hierarchy: Domain -> SubDomain -> Question
   * @param {Array} responses - Array of response objects
   * @returns {Object} - Grouped data
   */
  groupResponsesByHierarchy(responses) {
    const domainsMap = new Map();

    responses.forEach(response => {
      const domainKey = response.domain_id;

      if (!domainsMap.has(domainKey)) {
        domainsMap.set(domainKey, {
          domainId: response.domain_id,
          domainName: response.domain_name,
          subDomains: new Map()
        });
      }

      const domain = domainsMap.get(domainKey);
      const subDomainKey = response.sub_domain_id;

      if (!domain.subDomains.has(subDomainKey)) {
        domain.subDomains.set(subDomainKey, {
          subDomainId: response.sub_domain_id,
          subDomainName: response.sub_domain_name,
          queries: []
        });
      }

      const subDomain = domain.subDomains.get(subDomainKey);
      subDomain.queries.push(this.formatResponseDetails(response));
    });

    // Convert Maps to Arrays
    const domains = Array.from(domainsMap.values()).map(domain => ({
      domainId: domain.domainId,
      domainName: domain.domainName,
      subDomains: Array.from(domain.subDomains.values())
    }));

    // Calculate summary
    const totalResponses = responses.length;
    const domainsCount = domains.length;
    const subDomainsCount = domains.reduce((sum, domain) => sum + domain.subDomains.length, 0);

    return {
      domains,
      summary: {
        totalResponses,
        domainsCount,
        subDomainsCount
      }
    };
  }

  /**
   * Format response details for API response
   * @param {Object} response - Raw response object
   * @returns {Object} - Formatted response object
   */
  formatResponseDetails(response) {
    return {
      id: response.id,
      inspectionId: response.inspection_id,
      checklistItemId: response.checklist_item_id,
      itemDescription: response.item_description,
      itemType: response.item_type,
      parentItemId: response.parent_item_id,
      responseValue: response.response_value,
      remarks: response.notes,
      submittedBy: {
        id: response.submitted_by,
        name: response.submitted_by_name,
        email: response.submitted_by_email
      },
      submittedAt: response.submitted_at
    };
  }

  /**
   * Get response statistics for an inspection
   * @param {number} inspectionId - Inspection ID
   * @returns {Promise<Object>} - Response statistics
   */
  async getResponseStatistics(inspectionId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_responses,
          COUNT(CASE WHEN response_value = 'YES' THEN 1 END) as yes_count,
          COUNT(CASE WHEN response_value = 'NO' THEN 1 END) as no_count,
          COUNT(CASE WHEN response_value = 'NA' THEN 1 END) as na_count,
          COUNT(DISTINCT checklist_item_id) as unique_items,
          COUNT(DISTINCT submitted_by) as unique_submitters
        FROM checklist_responses
        WHERE inspection_id = ?
      `;

      const stats = await db.execute(query, [inspectionId]);
      const statsData = stats[0] || {};

      return {
        inspectionId,
        totalResponses: statsData.total_responses || 0,
        yesCount: statsData.yes_count || 0,
        noCount: statsData.no_count || 0,
        naCount: statsData.na_count || 0,
        uniqueItems: statsData.unique_items || 0,
        uniqueSubmitters: statsData.unique_submitters || 0,
        responseDistribution: {
          yes: statsData.yes_count || 0,
          no: statsData.no_count || 0,
          na: statsData.na_count || 0
        }
      };

    } catch (error) {
      logger.error('Error fetching response statistics', {
        inspectionId,
        error: error.message
      });
      throw new Error(`Failed to fetch response statistics: ${error.message}`);
    }
  }
}

module.exports = new ResponseService();
