const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Scoring Service for QRating System
 * 
 * Implements the following scoring specification:
 * 
 * Inspection Score = Σ (Domain Score × Domain Weight)
 * Domain Score = Σ (Sub-domain Score × Sub-domain Weight)
 * 
 * Sub-domain Score = (Earned Marks / Max Marks) × 100%
 * 
 * MARKING RULES:
 * ---------------
 * Each cluster = 1 Primary + 2 linked Secondaries = 3 marks max
 * 
 * Max Marks (Denominator):
 *   - Start with total queries count
 *   - Primary N/A → exclude entire cluster (-3 marks)
 *   - Secondary N/A → exclude just that secondary (-1 mark)
 * 
 * Earned Marks (Numerator):
 *   - Start at 0
 *   - Each YES → +1 mark earned
 *   - Primary NO → entire cluster fails, -3 marks from earned
 *   - Secondary NO → -1 mark from earned
 *   - N/A → no penalty (already handled in Max Marks)
 */

class ScoringService {
  /**
   * Calculate inspection score with complete business logic
   * @param {number} inspectionId - The inspection ID to calculate score for
   * @returns {Promise<Object>} - Complete scoring results
   */
  async calculateInspectionScore(inspectionId) {
    try {
      logger.info('Starting inspection score calculation', { inspectionId });

      // Check if inspection is approved by manager
      const inspectionCheck = await db.execute(
        'SELECT manager_approval_status, project_id, phase FROM inspections WHERE id = ?',
        [inspectionId]
      );

      if (inspectionCheck.length === 0) {
        throw new Error('Inspection not found');
      }

      if (inspectionCheck[0].manager_approval_status !== 'approved') {
        throw new Error('Inspection must be approved by a manager before generating spider chart');
      }

      const { project_id: projectId, phase } = inspectionCheck[0];

      // Load domain weightages from phase_domains
      const domainWeightages = await this.loadDomainWeightages(projectId, phase);

      // Load all sub-domain weightages from phase_domain_sub_domains
      const subDomainWeightages = await this.loadSubDomainWeightages(projectId, phase);

      // Load all query clusters for this project phase (organized by sub-domain, then by parent)
      const queryClusters = await this.loadQueryClusters(projectId, phase);

      // Load all responses for this inspection
      const responses = await this.loadResponses(inspectionId);

      // Calculate score for each sub-domain using the cluster-based marking rules
      const subDomainResults = this.calculateAllSubDomainScores(
        subDomainWeightages, queryClusters, responses
      );

      // Calculate each domain's score
      const domainResults = this.calculateAllDomainScores(
        domainWeightages, subDomainResults
      );

      // Calculate overall inspection score
      const inspectionScore = this.calculateInspectionOverallScore(
        domainWeightages, domainResults
      );

      // Build detailed breakdown (queryClusters is an object keyed by subDomainId, flatten to array)
      const clusterBreakdown = Object.values(queryClusters).flatMap(sdCluster => 
        (sdCluster.clusters || []).map(cluster => ({
          subDomainId: sdCluster.subDomainId,
          subDomainName: sdCluster.subDomainName,
          primaryQueryId: cluster.primaryQueryId,
          primaryQuestionText: cluster.primaryQuestionText,
          primaryResponse: cluster.primaryResponse,
          secondaries: (cluster.secondaries || []).map(s => ({
            queryId: s.queryId,
            questionText: s.questionText,
            response: s.response,
          })),
          clusterEarned: cluster.clusterEarned,
          clusterMax: cluster.clusterMax,
        }))
      );

      const result = {
        inspectionId,
        inspectionScore: Math.round(inspectionScore * 100) / 100,
        grade: this.calculateGrade(inspectionScore),
        domains: domainResults,
        subDomains: subDomainResults,
        queryClusterBreakdown: clusterBreakdown,
      };

      // Persist results
      await this.persistScores(inspectionId, subDomainResults, domainResults);

      logger.info('Inspection score calculation completed', { 
        inspectionId, 
        score: result.inspectionScore,
        grade: result.grade 
      });

      return result;

    } catch (error) {
      logger.error('Error calculating inspection score', { inspectionId, error: error.message });
      throw new Error(`Score calculation failed: ${error.message}`);
    }
  }

  /**
   * Load domain weightages from phase_domains
   */
  async loadDomainWeightages(projectId, phaseNumber) {
    const rows = await db.execute(
      `SELECT pd.domain_id as domainId, d.domain_name as domainName, pd.weightage
       FROM phase_domains pd
       JOIN domains d ON pd.domain_id = d.id
       WHERE pd.project_id = ? AND pd.phase_number = ?
       ORDER BY d.domain_name`,
      [projectId, phaseNumber]
    );
    return rows.map(r => ({
      domainId: r.domainId,
      domainName: r.domainName,
      weightage: parseFloat(r.weightage) || 0,
    }));
  }

  /**
   * Load sub-domain weightages from phase_domain_sub_domains
   */
  async loadSubDomainWeightages(projectId, phaseNumber) {
    const rows = await db.execute(
      `SELECT pdsd.sub_domain_id as subDomainId, pdsd.domain_id as domainId,
              sd.sub_domain_name as subDomainName, pdsd.weightage
       FROM phase_domain_sub_domains pdsd
       JOIN sub_domains sd ON pdsd.sub_domain_id = sd.id
       WHERE pdsd.project_id = ? AND pdsd.phase_number = ?
       ORDER BY sd.sub_domain_name`,
      [projectId, phaseNumber]
    );
    return rows.map(r => ({
      subDomainId: r.subDomainId,
      domainId: r.domainId,
      subDomainName: r.subDomainName,
      weightage: parseFloat(r.weightage) || 0,
    }));
  }

  /**
   * Load all queries organized by clusters (primary + its linked secondaries)
   * Also loads responses and attaches them to each query
   */
  async loadQueryClusters(projectId, phaseNumber) {
    // Get all queries for this phase, with their types and parent relationships
    const queryRows = await db.execute(
      `SELECT 
        pq.id as phaseQueryId,
        pq.query_id as queryId,
        pq.sub_domain_id as subDomainId,
        pq.domain_id as domainId,
        q.question_text as questionText,
        COALESCE(prq.query_type, sq.query_type, 'primary') as queryType,
        sq.parent_id as subDomainQueryParentId,
        sq.id as subDomainQueryId
       FROM phase_queries pq
       LEFT JOIN project_queries prq ON pq.project_query_id = prq.id
       JOIN queries q ON pq.query_id = q.id
       LEFT JOIN sub_domain_queries sq ON q.id = sq.query_id AND sq.sub_domain_id = pq.sub_domain_id
       WHERE pq.project_id = ? AND pq.phase_number = ?
       ORDER BY pq.sub_domain_id, sq.item_order, q.id`,
      [projectId, phaseNumber]
    );

    // Also get sub_domain names
    const subDomainNames = {};
    for (const row of queryRows) {
      if (!subDomainNames[row.subDomainId]) {
        const sd = await db.execute(
          'SELECT sub_domain_name FROM sub_domains WHERE id = ?',
          [row.subDomainId]
        );
        subDomainNames[row.subDomainId] = sd[0]?.sub_domain_name || `Sub-domain ${row.subDomainId}`;
      }
    }

    // Build a map of subDomainQueryId -> queryId for parent resolution
    const sdqToQueryId = {};
    for (const row of queryRows) {
      if (row.subDomainQueryId) {
        sdqToQueryId[row.subDomainQueryId] = row.queryId;
      }
    }

    // Organize by domain:sub_domain pair, then by cluster (primary + linked secondaries)
    // This prevents same sub-domain in different domains from merging their clusters
    const clustersBySubDomain = {};

    for (const row of queryRows) {
      const compositeKey = `${row.domainId}:${row.subDomainId}`;
      if (!clustersBySubDomain[compositeKey]) {
        clustersBySubDomain[compositeKey] = {
          domainId: row.domainId,
          subDomainId: row.subDomainId,
          subDomainName: subDomainNames[row.subDomainId] || `Sub-domain ${row.subDomainId}`,
          clusters: [],
        };
      }

      if (row.queryType === 'primary') {
        // Start a new cluster
        clustersBySubDomain[compositeKey].clusters.push({
          primaryQueryId: row.queryId,
          primaryQuestionText: row.questionText,
          primaryResponse: null, // Will be filled with response later
          parentSubDomainQueryId: row.subDomainQueryId,
          secondaries: [],
        });
      } else if (row.queryType === 'secondary' && row.subDomainQueryParentId) {
        // Find the parent query ID for this secondary
        const parentQueryId = sdqToQueryId[row.subDomainQueryParentId];
        if (parentQueryId) {
          // Find the cluster this secondary belongs to
          const sdClusters = clustersBySubDomain[compositeKey].clusters;
          const parentCluster = sdClusters.find(c => c.primaryQueryId === parentQueryId);
          if (parentCluster) {
            parentCluster.secondaries.push({
              queryId: row.queryId,
              questionText: row.questionText,
              response: null,
            });
          }
        }
      }
    }

    return clustersBySubDomain;
  }

  /**
   * Load all responses for this inspection
   */
  async loadResponses(inspectionId) {
    const rows = await db.execute(
      `SELECT query_id as queryId, response, sub_domain_id as subDomainId, domain_id as domainId
       FROM responses
       WHERE inspection_id = ?`,
      [inspectionId]
    );
    return rows;
  }

  /**
   * Calculate sub-domain scores using cluster-based marking rules
   * 
   * Each cluster = 1 Primary + its linked Secondaries
   * 
   * Max Marks (Denominator):
   *   Base = total queries in sub-domain
   *   If Primary N/A → -3 (exclude entire cluster)
   *   If Secondary N/A → -1 (exclude just that secondary)
   * 
   * Earned Marks (Numerator):
   *   If Primary NO → cluster fails: -3 earned marks
   *   If Secondary NO → -1 earned mark
   *   YES → +1 earned mark
   *   N/A → no penalty (already reduced max marks)
   */
  calculateAllSubDomainScores(subDomainWeightages, queryClusters, responses) {
    // Build a lookup: (domainId:subDomainId:queryId) -> responseValue
    // Using domainId in the key prevents same sub-domain in different domains
    // from overwriting each other's responses
    const responseMap = {};
    for (const r of responses) {
      const key = `${r.domainId || 'null'}:${r.subDomainId}:${r.queryId}`;
      responseMap[key] = r.response;
    }

    const results = [];

    for (const sdWeight of subDomainWeightages) {
      const compositeKey = `${sdWeight.domainId}:${sdWeight.subDomainId}`;
      const sdClusterData = queryClusters[compositeKey];

      if (!sdClusterData || !sdClusterData.clusters || sdClusterData.clusters.length === 0) {
        // No clusters for this sub-domain → score = 0
        results.push({
          subDomainId: sdWeight.subDomainId,
          subDomainName: sdWeight.subDomainName,
          domainId: sdWeight.domainId,
          weightage: sdWeight.weightage,
          earnedMarks: 0,
          maxMarks: 0,
          score: 0,
          clusters: [],
        });
        continue;
      }

      // Process each cluster: attach responses and calculate marks
      let totalEarned = 0;
      let totalMax = 0;
      const clusterResults = [];

      for (const cluster of sdClusterData.clusters) {
        const primaryResponse = responseMap[`${sdWeight.domainId}:${sdWeight.subDomainId}:${cluster.primaryQueryId}`] || null;
        cluster.primaryResponse = primaryResponse;

        // Attach responses to secondaries
        const secondaryResults = cluster.secondaries.map(s => {
          const resp = responseMap[`${sdWeight.domainId}:${sdWeight.subDomainId}:${s.queryId}`] || null;
          s.response = resp;
          return { ...s, response: resp };
        });

        // Calculate cluster max marks (Denominator)
        let clusterMax = 0; // Start at 0, add only answered/relevant queries
        let primaryIsNA = primaryResponse === 'NA';

        if (primaryIsNA) {
          // Primary N/A → entire cluster excluded (1 primary + all secondaries = 0 max)
          clusterMax = 0;
        } else if (primaryResponse === 'YES' || primaryResponse === 'NO') {
          // Primary answered → counts as 1 in max marks
          clusterMax = 1;
          // Count secondaries that are answered and NOT N/A
          for (const sec of secondaryResults) {
            if (sec.response === 'NA') {
              continue; // N/A secondary → excluded from max
            }
            clusterMax += 1; // YES or NO secondary → counts in max
          }
        } else {
          // Primary unanswered → 0 for primary
          clusterMax = 0;
          for (const sec of secondaryResults) {
            if (sec.response === 'NA') {
              continue;
            }
            clusterMax += 1;
          }
        }

        // Calculate cluster earned marks (Numerator)
        let clusterEarned = 0;

        if (primaryResponse === 'YES') {
          clusterEarned += 1;
        } else if (primaryResponse === 'NO') {
          // Primary NO → entire cluster fails: 0 earned
          clusterEarned = 0;
          // Max marks still counts this cluster (primary + non-NA secondaries)
        } else if (primaryIsNA) {
          // Primary N/A → cluster excluded: 0 earned, 0 max
          clusterEarned = 0;
        }
        // Primary unanswered: 0 earned (but counts in max)

        if (primaryResponse === 'YES') {
          // Process secondaries only if primary passed (YES)
          for (const sec of secondaryResults) {
            if (sec.response === 'YES') {
              clusterEarned += 1;
            } else if (sec.response === 'NO') {
              // Secondary NO → 0 earned (but 1 max)
            } else if (sec.response === 'NA') {
              // N/A → excluded from both, already handled
              continue;
            }
          }
        }

        totalEarned += clusterEarned;
        totalMax += clusterMax;

        clusterResults.push({
          primaryQueryId: cluster.primaryQueryId,
          primaryQuestionText: cluster.primaryQuestionText,
          primaryResponse,
          secondaries: secondaryResults,
          clusterEarned,
          clusterMax,
        });
      }

      const score = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

      results.push({
        subDomainId: sdWeight.subDomainId,
        subDomainName: sdWeight.subDomainName,
        domainId: sdWeight.domainId,
        weightage: sdWeight.weightage,
        earnedMarks: totalEarned,
        maxMarks: totalMax,
        score: Math.round(score * 100) / 100,
        clusters: clusterResults,
      });
    }

    return results;
  }

  /**
   * Calculate domain scores from sub-domain results
   * Domain Score = Σ (Sub-domain Score × Sub-domain Weight)
   */
  calculateAllDomainScores(domainWeightages, subDomainResults) {
    // Group sub-domains by domain
    const subDomainsByDomain = {};
    for (const sd of subDomainResults) {
      if (!subDomainsByDomain[sd.domainId]) {
        subDomainsByDomain[sd.domainId] = [];
      }
      subDomainsByDomain[sd.domainId].push(sd);
    }

    const domainResults = [];

    for (const dw of domainWeightages) {
      const sdList = subDomainsByDomain[dw.domainId] || [];

      // Domain Score = Σ (Sub-domain Score × Sub-domain Weight as decimal)
      let domainScore = 0;
      for (const sd of sdList) {
        const sdWeightDecimal = sd.weightage / 100;
        domainScore += sd.score * sdWeightDecimal;
      }

      domainResults.push({
        domainId: dw.domainId,
        domainName: dw.domainName,
        weightage: dw.weightage,
        score: Math.round(domainScore * 100) / 100,
        subDomains: sdList,
      });
    }

    return domainResults;
  }

  /**
   * Calculate overall inspection score
   * Inspection Score = Σ (Domain Score × Domain Weight as decimal)
   */
  calculateInspectionOverallScore(domainWeightages, domainResults) {
    let totalScore = 0;
    for (const dr of domainResults) {
      const dw = domainWeightages.find(d => d.domainId === dr.domainId);
      const domainWeightDecimal = (dw ? dw.weightage : 0) / 100;
      totalScore += dr.score * domainWeightDecimal;
    }
    return totalScore;
  }

  /**
   * Persist scores to database
   */
  async persistScores(inspectionId, subDomainResults, domainResults) {
    try {
      // Delete existing scores
      await db.execute('DELETE FROM sub_domain_scores WHERE inspection_id = ?', [inspectionId]);
      await db.execute('DELETE FROM domain_scores WHERE inspection_id = ?', [inspectionId]);

      // Insert sub-domain scores
      for (const sd of subDomainResults) {
        await db.execute(
          `INSERT INTO sub_domain_scores 
           (inspection_id, sub_domain_id, domain_id, secured_points, max_points, sub_domain_rating)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [inspectionId, sd.subDomainId, sd.domainId, sd.earnedMarks, sd.maxMarks, sd.score]
        );
      }

      // Insert domain scores
      for (const dr of domainResults) {
        await db.execute(
          `INSERT INTO domain_scores 
           (inspection_id, domain_id, percentage)
           VALUES (?, ?, ?)`,
          [inspectionId, dr.domainId, dr.score]
        );
      }

      logger.info('Scores persisted successfully', { inspectionId });
    } catch (error) {
      logger.error('Error persisting scores', { inspectionId, error: error.message });
      // Don't throw - scores are still calculated, just not persisted
    }
  }

  /**
   * Calculate grade based on percentage
   */
  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }
}

module.exports = new ScoringService();
