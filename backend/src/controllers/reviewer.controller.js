const logger = require("../utils/logger");
const reviewService = require("../services/reviewService");

/**
 * Get reviewer dashboard with pending, approved, and rejected inspections
 */
const getReviewerDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dashboardData = await reviewService.getReviewerDashboard(userId);
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Get inspection details for review (project->phase->domains->sub-domains->queries)
 */
const getInspectionForReview = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    const inspectionData = await reviewService.getInspectionForReview(inspectionId, userId);

    if (!inspectionData) {
      return res.status(404).json({ success: false, message: "Inspection not found or access denied" });
    }

    res.json({ success: true, data: inspectionData });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

/**
 * Approve inspection
 */
const approveInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user?.id;
    const { notes } = req.body;

    const result = await reviewService.approveInspection(inspectionId, userId, notes);
    res.json({ success: true, message: result.message });
  } catch (error) {
    logger.error("Error in approveInspection", {
      error: error.message,
      stack: error.stack,
      inspectionId: req.params.inspectionId,
      userId: req.user?.id,
      requestBody: req.body
    });
    
    if (error.message === "User not authenticated") {
      return res.status(401).json({ success: false, message: error.message });
    }
    if (error.message === "Inspection not found or access denied") {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === "Cannot approve - no responses found for this inspection") {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error during approval",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * Reject inspection at granular level (inspection, domain, sub-domain, or query)
 */
const rejectInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;
    const { 
      notes, 
      rejectionType = "inspection", 
      domainId,
      subDomainId, 
      queryId,
      rejectedItems 
    } = req.body;

    const result = await reviewService.rejectInspection(inspectionId, userId, notes, rejectionType, domainId, subDomainId, queryId, rejectedItems);
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    // Detailed logging for rejection errors to help debugging 500s
    logger.error("Error in rejectInspection", {
      error: error.message,
      stack: error.stack,
      inspectionId: req.params.inspectionId,
      userId: req.user?.id,
      requestBody: req.body
    });

    if (error.message === "Rejection notes are required" ||
        error.message === "Domain ID is required for domain rejection" ||
        error.message === "Sub-domain ID and Domain ID are required for sub-domain rejection" ||
        error.message === "Query ID, Sub-domain ID and Domain ID are required for query rejection") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === "Inspection not found or access denied") {
      return res.status(404).json({ success: false, message: error.message });
    }

    // Return 500 with message in development to aid debugging
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get inspection rejection history
 */
const getInspectionRejectionHistory = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const userId = req.user.id;

    const history = await reviewService.getInspectionRejectionHistory(inspectionId, userId);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.logError(error, req);
    next(error);
  }
};

module.exports = {
  getReviewerDashboard,
  getInspectionForReview,
  approveInspection,
  rejectInspection,
  getInspectionRejectionHistory
};