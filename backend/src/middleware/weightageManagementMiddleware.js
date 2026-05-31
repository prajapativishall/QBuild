/**
 * Weightage Management Middleware
 * Enforces validation rules for Domain and Sub-domain weightage distributions
 * - Domain total must equal 100% per phase
 * - Sub-domain total must equal 100% per domain per phase
 */
const db = require('../config/db');
const logger = require('../utils/logger');
const WeightageValidationService = require('../services/weightageValidation.service');

/**
 * Validate domain weightages sum to 100% for a given phase.
 * 
 * This is a soft validation that only blocks when the user has actually entered
 * non-zero weightages that don't sum to 100%. If weightages are all zero (default),
 * the validation passes — the form auto-normalizes them via the frontend.
 * 
 * Strict validation (must sum to exactly 100%) is enforced on final submission
 * when the inspection is being finalized.
 */
const validatePhaseDomainWeightages = async (req, res, next) => {
  try {
    const { projectId, phaseNumber } = req.params;
    const domains = req.body.domains || [];

    if (domains.length === 0) {
      return next(); // No domains = nothing to validate
    }

    // Check if any domain has a non-zero weightage. If all are zero, skip strict validation
    // (the frontend will auto-normalize on submit)
    const hasAnyWeightage = domains.some(d => parseFloat(d.weightage || 0) > 0);
    
    // During incremental entry, only enforce that totals don't EXCEED 100%.
    // The frontend auto-normalizes on final submission.
    // Strict 100% exact validation happens only when explicitly requested.
    
    if (hasAnyWeightage) {
      // Validate domain weightages - only check individual items and max total
      const domainTotal = domains.reduce((sum, d) => sum + (parseFloat(d.weightage) || 0), 0);
      if (domainTotal > 100.01) {
        return res.status(400).json({
          success: false,
          message: `Domain weightages total ${domainTotal.toFixed(2)}% exceeds 100%. Please reduce some values.`,
          total: domainTotal
        });
      }
      // Check individual domain weights
      for (let i = 0; i < domains.length; i++) {
        const w = parseFloat(domains[i].weightage) || 0;
        if (w > 100) {
          return res.status(400).json({
            success: false,
            message: `Domain "${domains[i].domainName || domains[i].stageName || i + 1}" weightage (${w}%) cannot exceed 100%.`
          });
        }
      }
    }

    // Validate sub-domain weightages per domain
    for (const domain of domains) {
      const subDomains = domain.subDomains || domain.sections || [];
      if (subDomains.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Domain "${domain.domainName || domain.domainId}" has no sub-domains. Each domain must have at least one sub-domain.`
        });
      }

      // Only validate max total for sub-domain weightages during incremental entry
      const hasAnySubDomainWeightage = subDomains.some(sd => parseFloat(sd.weightage || 0) > 0);
      
      if (hasAnySubDomainWeightage) {
        const subDomainTotal = subDomains.reduce((sum, sd) => sum + (parseFloat(sd.weightage) || 0), 0);
        if (subDomainTotal > 100.01) {
          const domainName = domain.domainName || domain.stageName || `ID ${domain.domainId || domain.stageId}`;
          return res.status(400).json({
            success: false,
            message: `Sub-domain weightages for "${domainName}" total ${subDomainTotal.toFixed(2)}% exceeds 100%. Please reduce some values.`,
            domainId: domain.domainId,
            total: subDomainTotal
          });
        }
        // Check individual sub-domain weights
        for (let i = 0; i < subDomains.length; i++) {
          const w = parseFloat(subDomains[i].weightage) || 0;
          if (w > 100) {
            return res.status(400).json({
              success: false,
              message: `Sub-domain "${subDomains[i].sectionName || subDomains[i].subDomainName || i + 1}" weightage (${w}%) cannot exceed 100%.`
            });
          }
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Error in validatePhaseDomainWeightages:', error);
    res.status(500).json({
      success: false,
      message: 'Weightage validation error',
      error: error.message
    });
  }
};

/**
 * Validate weightage inputs for batch updates on existing phases
 */
const validateWeightageUpdate = async (req, res, next) => {
  try {
    const { projectId, domainId } = req.params;
    const { subDomains } = req.body;

    if (!subDomains || subDomains.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'SubDomains array is required'
      });
    }

    // Separate manual and auto items
    const manualSubDomains = subDomains.filter(s => s.isManual === true);
    const autoSubDomains = subDomains.filter(s => s.isManual !== true);

    // If all are manual, they must sum to 100%
    if (autoSubDomains.length === 0) {
      const validation = WeightageValidationService.validateWeightage(
        manualSubDomains,
        (s) => parseFloat(s.weightage || 0),
        { allowZero: false, maxTotal: 100, minTotal: 100, tolerance: 0.01 }
      );

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `Sub-domain weightage validation failed: ${validation.errors.join('; ')}`,
          errors: validation.errors,
          total: validation.total
        });
      }
    } else {
      // Manual items cannot exceed 100%
      const manualTotal = manualSubDomains.reduce((sum, s) => sum + (parseFloat(s.weightage) || 0), 0);
      if (manualTotal > 100) {
        return res.status(400).json({
          success: false,
          message: `Manual sub-domain weightages total ${manualTotal.toFixed(2)}% exceeds 100%`
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in validateWeightageUpdate:', error);
    res.status(500).json({
      success: false,
      message: 'Weightage validation error',
      error: error.message
    });
  }
};

module.exports = {
  validatePhaseDomainWeightages,
  validateWeightageUpdate
};