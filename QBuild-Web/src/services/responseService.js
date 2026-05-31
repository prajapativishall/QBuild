// Response Service - Handles storing and calculating scores from inspection responses

const RESPONSES_KEY = 'inspection_responses';
const SCORES_KEY = 'project_scores';

// 8 Assessment Dimensions
export const DIMENSIONS = [
  'Quality',
  'Safety', 
  'Progress',
  'Compliance',
  'Documentation',
  'Materials',
  'Workmanship',
  'Testing'
];

// Default dimension mapping for questions (can be customized per question)
export const DEFAULT_DIMENSION_MAPPING = {
  // Quality related keywords
  quality: 'Quality',
  standard: 'Quality',
  specification: 'Quality',
  defect: 'Quality',
  
  // Safety related keywords
  safety: 'Safety',
  hazard: 'Safety',
  protection: 'Safety',
  ppe: 'Safety',
  
  // Progress related keywords
  progress: 'Progress',
  schedule: 'Progress',
  timeline: 'Progress',
  completion: 'Progress',
  
  // Compliance related keywords
  compliance: 'Compliance',
  regulation: 'Compliance',
  permit: 'Compliance',
  approval: 'Compliance',
  
  // Documentation related keywords
  documentation: 'Documentation',
  document: 'Documentation',
  record: 'Documentation',
  certificate: 'Documentation',
  
  // Materials related keywords
  materials: 'Materials',
  material: 'Materials',
  cement: 'Materials',
  steel: 'Materials',
  concrete: 'Materials',
  
  // Workmanship related keywords
  workmanship: 'Workmanship',
  work: 'Workmanship',
  finishing: 'Workmanship',
  installation: 'Workmanship',
  
  // Testing related keywords
  testing: 'Testing',
  test: 'Testing',
  inspection: 'Testing',
  check: 'Testing',
  measurement: 'Testing'
};

// Store a single response
export const storeResponse = (inspectionId, projectId, stageId, sectionId, questionId, response) => {
  const responses = getAllResponses();
  
  const responseData = {
    id: Date.now(),
    inspectionId,
    projectId,
    stageId,
    sectionId,
    questionId,
    response: response.value, // 'YES', 'NO', 'N/A'
    remarks: response.remarks || '',
    attachments: response.attachments || [],
    timestamp: new Date().toISOString(),
    inspectorId: response.inspectorId,
    dimension: response.dimension || inferDimension(questionId, response.questionText)
  };
  
  // Check if response already exists for this question in this inspection
  const existingIndex = responses.findIndex(r => 
    r.inspectionId === inspectionId && 
    r.questionId === questionId
  );
  
  if (existingIndex >= 0) {
    responses[existingIndex] = responseData;
  } else {
    responses.push(responseData);
  }
  
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
  
  // Recalculate scores
  calculateProjectScores(projectId);
  
  return responseData;
};

// Store bulk responses
export const storeBulkResponses = (inspectionId, projectId, responses) => {
  const allResponses = getAllResponses();
  
  responses.forEach(response => {
    const responseData = {
      id: Date.now() + Math.random(),
      inspectionId,
      projectId: projectId,
      stageId: response.stageId,
      sectionId: response.sectionId,
      questionId: response.questionId,
      response: response.value,
      remarks: response.remarks || '',
      attachments: response.attachments || [],
      timestamp: new Date().toISOString(),
      inspectorId: response.inspectorId,
      dimension: response.dimension || inferDimension(response.questionId, response.questionText),
      isSecondary: response.isSecondary || false,
      parentId: response.parentId || null
    };
    
    // Remove existing response for this question
    const existingIndex = allResponses.findIndex(r => 
      r.inspectionId === inspectionId && 
      r.questionId === response.questionId
    );
    
    if (existingIndex >= 0) {
      allResponses[existingIndex] = responseData;
    } else {
      allResponses.push(responseData);
    }
  });
  
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(allResponses));
  
  // Recalculate scores
  calculateProjectScores(projectId);
  
  return true;
};

// Get all responses
export const getAllResponses = () => {
  const responses = localStorage.getItem(RESPONSES_KEY);
  return responses ? JSON.parse(responses) : [];
};

// Get responses for a specific inspection
export const getInspectionResponses = (inspectionId) => {
  const responses = getAllResponses();
  return responses.filter(r => r.inspectionId === inspectionId);
};

// Get responses for a specific project
export const getProjectResponses = (projectId) => {
  const responses = getAllResponses();
  return responses.filter(r => r.projectId === projectId);
};

// Infer dimension from question text
export const inferDimension = (questionId, questionText) => {
  if (!questionText) return 'Quality'; // Default
  
  const text = questionText.toLowerCase();
  
  for (const [keyword, dimension] of Object.entries(DEFAULT_DIMENSION_MAPPING)) {
    if (text.includes(keyword.toLowerCase())) {
      return dimension;
    }
  }
  
  return 'Quality'; // Default dimension
};

// Calculate score for a single response (0-100)
export const calculateResponseScore = (response) => {
  switch (response) {
    case 'YES':
      return 100;
    case 'NO':
      return 0;
    case 'N/A':
      return null; // Exclude from calculation
    default:
      return 0;
  }
};

// Calculate section score
export const calculateSectionScore = (sectionResponses) => {
  if (!sectionResponses || sectionResponses.length === 0) return 0;
  
  let totalScore = 0;
  let count = 0;
  
  sectionResponses.forEach(response => {
    const score = calculateResponseScore(response.response);
    if (score !== null) {
      totalScore += score;
      count++;
    }
  });
  
  return count > 0 ? Math.round(totalScore / count) : 0;
};

// Calculate dimension scores for a project
export const calculateDimensionScores = (projectId) => {
  const responses = getProjectResponses(projectId);
  
  const dimensionScores = {};
  
  DIMENSIONS.forEach(dim => {
    const dimResponses = responses.filter(r => r.dimension === dim);
    
    let totalScore = 0;
    let count = 0;
    
    dimResponses.forEach(response => {
      const score = calculateResponseScore(response.response);
      if (score !== null) {
        totalScore += score;
        count++;
      }
    });
    
    dimensionScores[dim] = count > 0 ? Math.round(totalScore / count) : 75; // Default 75 if no data
  });
  
  return dimensionScores;
};

// Calculate stage scores by dimension
export const calculateStageDimensionScores = (projectId, stageId) => {
  const responses = getProjectResponses(projectId).filter(r => r.stageId === stageId);
  
  const dimensionScores = {};
  
  DIMENSIONS.forEach(dim => {
    const dimResponses = responses.filter(r => r.dimension === dim);
    
    let totalScore = 0;
    let count = 0;
    
    dimResponses.forEach(response => {
      const score = calculateResponseScore(response.response);
      if (score !== null) {
        totalScore += score;
        count++;
      }
    });
    
    dimensionScores[dim] = count > 0 ? Math.round(totalScore / count) : 75;
  });
  
  return dimensionScores;
};

// Calculate overall project score
export const calculateProjectOverallScore = (projectId) => {
  const dimensionScores = calculateDimensionScores(projectId);
  const scores = Object.values(dimensionScores);
  
  if (scores.length === 0) return 75; // Default
  
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
};

// Store calculated scores
export const calculateProjectScores = (projectId) => {
  const scores = {
    projectId,
    timestamp: new Date().toISOString(),
    overall: calculateProjectOverallScore(projectId),
    dimensions: calculateDimensionScores(projectId),
    stages: {} // Will be populated below
  };
  
  // Get project stages
  const projects = JSON.parse(localStorage.getItem('projects') || '[]');
  const project = projects.find(p => p.id.toString() === projectId.toString());
  
  if (project && project.stages) {
    project.stages.forEach(stage => {
      const stageId = stage.stageId || stage.id;
      scores.stages[stageId] = {
        overall: 75, // Will calculate properly
        dimensions: calculateStageDimensionScores(projectId, stageId),
        sections: {}
      };
    });
  }
  
  // Store scores
  const allScores = JSON.parse(localStorage.getItem(SCORES_KEY) || '{}');
  allScores[projectId] = scores;
  localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
  
  return scores;
};

// Get stored scores for a project
export const getProjectScores = (projectId) => {
  const allScores = JSON.parse(localStorage.getItem(SCORES_KEY) || '{}');
  return allScores[projectId] || {
    overall: 75,
    dimensions: DIMENSIONS.reduce((acc, dim) => ({ ...acc, [dim]: 75 }), {}),
    stages: {}
  };
};

// Get master chart data for spider chart
export const getMasterChartData = (projectId) => {
  const scores = getProjectScores(projectId);
  
  return DIMENSIONS.map(dim => ({
    subject: dim,
    A: scores.dimensions[dim] || 75,
    fullMark: 100
  }));
};

// Get stage chart data for spider chart
export const getStageChartData = (projectId, stageId) => {
  const scores = getProjectScores(projectId);
  const stageScores = scores.stages[stageId] || { dimensions: {} };
  
  return DIMENSIONS.map(dim => ({
    subject: dim,
    A: stageScores.dimensions[dim] || 75,
    fullMark: 100
  }));
};

// Handle cascading N/A for secondary questions
export const cascadeNAForSecondaryQuestions = (inspectionId, primaryQuestionId) => {
  const responses = getAllResponses();
  const allSections = JSON.parse(localStorage.getItem('sections') || '[]');
  
  // Find all secondary questions linked to this primary
  let secondaryQuestions = [];
  
  allSections.forEach(section => {
    if (section.questions) {
      section.questions.forEach(q => {
        if (q.type === 'secondary' && q.parentId === primaryQuestionId) {
          secondaryQuestions.push({
            questionId: q.id,
            sectionId: section.id
          });
        }
      });
    }
  });
  
  // Auto-mark secondary questions as N/A
  secondaryQuestions.forEach(({ questionId, sectionId }) => {
    const existingResponse = responses.find(r => 
      r.inspectionId === inspectionId && 
      r.questionId === questionId
    );
    
    if (!existingResponse) {
      // Find the inspection to get project info
      const inspectionResponse = responses.find(r => r.inspectionId === inspectionId);
      
      responses.push({
        id: Date.now() + Math.random(),
        inspectionId,
        projectId: inspectionResponse?.projectId,
        stageId: inspectionResponse?.stageId,
        sectionId,
        questionId,
        response: 'N/A',
        remarks: 'Auto N/A - Primary question is N/A',
        timestamp: new Date().toISOString(),
        inspectorId: inspectionResponse?.inspectorId,
        dimension: inspectionResponse?.dimension || 'Quality',
        isSecondary: true,
        parentId: primaryQuestionId
      });
    }
  });
  
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
};

// Submit a complete inspection with all responses
export const submitInspection = (inspectionData) => {
  const { inspectionId, projectId, inspectorId, responses } = inspectionData;
  
  // Store all responses
  storeBulkResponses(inspectionId, projectId, responses.map(r => ({
    ...r,
    inspectorId
  })));
  
  // Calculate final scores
  const scores = calculateProjectScores(projectId);
  
  return {
    success: true,
    inspectionId,
    scores
  };
};

export default {
  storeResponse,
  storeBulkResponses,
  getAllResponses,
  getInspectionResponses,
  getProjectResponses,
  calculateDimensionScores,
  calculateProjectOverallScore,
  getProjectScores,
  getMasterChartData,
  getStageChartData,
  cascadeNAForSecondaryQuestions,
  submitInspection,
  DIMENSIONS
};
