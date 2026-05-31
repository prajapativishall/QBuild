import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { submitInspection, inferDimension } from '../services/responseService';
import '../styles/InspectionForm.css';

const InspectionForm = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [inspectorId, setInspectorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Load project data
  useEffect(() => {
    const savedProjects = localStorage.getItem('projects');
    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      const foundProject = projects.find(p => p.id.toString() === projectId);
      if (foundProject) {
        setProject(foundProject);
      }
    }
    
    // Get current user (inspector) from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser && currentUser.id) {
      setInspectorId(currentUser.id);
    }
  }, [projectId]);

  if (!project) {
    return (
      <div className="inspection-container">
        <div className="loading-message">Loading project...</div>
      </div>
    );
  }

  const stages = project.stages || [];
  const currentStage = stages[currentStageIndex];
  
  // Get sections for current stage
  const getStageSections = (stage) => {
    if (!stage) return [];
    
    // Get all sections from localStorage
    const allSections = JSON.parse(localStorage.getItem('sections') || '[]');
    
    // If stage has sections array, use those
    if (stage.sections && stage.sections.length > 0) {
      return stage.sections.map(sectionRef => {
        const section = allSections.find(s => s.id === sectionRef.sectionId);
        return section || { id: sectionRef.sectionId, name: 'Unknown Section', questions: [] };
      });
    }
    
    return [];
  };

  const stageSections = getStageSections(currentStage);
  const currentSection = stageSections[currentSectionIndex];

  const handleResponse = (questionId, value, questionText, isSecondary = false, parentId = null) => {
    const dimension = inferDimension(questionId, questionText);
    
    setResponses(prev => ({
      ...prev,
      [`${currentStage.stageId || currentStage.id}-${currentSection.id}-${questionId}`]: {
        stageId: currentStage.stageId || currentStage.id,
        sectionId: currentSection.id,
        questionId,
        value,
        questionText,
        dimension,
        isSecondary,
        parentId
      }
    }));
  };

  const handleNext = () => {
    if (currentSectionIndex < stageSections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    } else if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex(prev => prev + 1);
      setCurrentSectionIndex(0);
    } else {
      // All sections completed
      submitInspectionResponses();
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    } else if (currentStageIndex > 0) {
      setCurrentStageIndex(prev => prev - 1);
      const prevStage = stages[currentStageIndex - 1];
      const prevStageSections = getStageSections(prevStage);
      setCurrentSectionIndex(prevStageSections.length - 1);
    }
  };

  const submitInspectionResponses = async () => {
    setIsSubmitting(true);
    
    const inspectionId = Date.now().toString();
    
    // Prepare responses array
    const responsesArray = Object.values(responses).map(r => ({
      stageId: r.stageId,
      sectionId: r.sectionId,
      questionId: r.questionId,
      value: r.value,
      questionText: r.questionText,
      dimension: r.dimension,
      isSecondary: r.isSecondary,
      parentId: r.parentId,
      inspectorId
    }));

    // Submit inspection
    const result = submitInspection({
      inspectionId,
      projectId,
      inspectorId,
      responses: responsesArray
    });

    if (result.success) {
      setIsComplete(true);
      setTimeout(() => {
        navigate('/inspections');
      }, 2000);
    }
    
    setIsSubmitting(false);
  };

  const getResponse = (questionId) => {
    const key = `${currentStage.stageId || currentStage.id}-${currentSection.id}-${questionId}`;
    return responses[key]?.value || '';
  };

  if (isComplete) {
    return (
      <div className="inspection-container">
        <div className="completion-message">
          <div className="completion-icon">✓</div>
          <h2>Inspection Complete!</h2>
          <p>Your responses have been submitted successfully.</p>
          <p>The scores have been updated in the dashboard.</p>
        </div>
      </div>
    );
  }

  if (!currentStage || !currentSection) {
    return (
      <div className="inspection-container">
        <div className="error-message">
          <h2>No stages or sections configured</h2>
          <p>This project doesn&apos;t have any inspection checklists configured.</p>
        </div>
      </div>
    );
  }

  const questions = currentSection.questions || [];
  const primaryQuestions = questions.filter(q => q.type === 'primary');
  const progress = ((currentStageIndex * stageSections.length + currentSectionIndex + 1) / (stages.length * stageSections.length)) * 100;

  return (
    <div className="inspection-container">
      {/* Header */}
      <div className="inspection-header">
        <h1 className="inspection-title">Project Inspection</h1>
        <div className="project-info">
          <span className="project-name">{project.name}</span>
          <span className="stage-info">
            Stage {currentStageIndex + 1} of {stages.length}: {currentStage.stageName || currentStage.name}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        <span className="progress-text">{Math.round(progress)}% Complete</span>
      </div>

      {/* Section Info */}
      <div className="section-header">
        <h2 className="section-title">{currentSection.name}</h2>
        <p className="section-description">{currentSection.description}</p>
        <span className="section-counter">
          Section {currentSectionIndex + 1} of {stageSections.length}
        </span>
      </div>

      {/* Questions List */}
      <div className="questions-container">
        {primaryQuestions.length === 0 ? (
          <div className="no-questions">
            <p>No questions configured for this section.</p>
          </div>
        ) : (
          primaryQuestions.map(primaryQuestion => {
            const secondaryQuestions = questions.filter(
              q => q.type === 'secondary' && q.parentId === primaryQuestion.id
            );
            const primaryResponse = getResponse(primaryQuestion.id);
            
            return (
              <div key={primaryQuestion.id} className="question-group">
                {/* Primary Question */}
                <div className="primary-question">
                  <div className="question-header">
                    <span className="question-badge primary">Primary</span>
                    <span className="question-dimension">
                      {inferDimension(primaryQuestion.id, primaryQuestion.text)}
                    </span>
                  </div>
                  <p className="question-text">{primaryQuestion.text}</p>
                  
                  <div className="response-options">
                    <button
                      className={`response-btn ${primaryResponse === 'YES' ? 'selected' : ''}`}
                      onClick={() => handleResponse(primaryQuestion.id, 'YES', primaryQuestion.text)}
                    >
                      <span className="response-icon">✓</span>
                      YES
                    </button>
                    <button
                      className={`response-btn no ${primaryResponse === 'NO' ? 'selected' : ''}`}
                      onClick={() => handleResponse(primaryQuestion.id, 'NO', primaryQuestion.text)}
                    >
                      <span className="response-icon">✗</span>
                      NO
                    </button>
                    <button
                      className={`response-btn na ${primaryResponse === 'N/A' ? 'selected' : ''}`}
                      onClick={() => handleResponse(primaryQuestion.id, 'N/A', primaryQuestion.text)}
                    >
                      <span className="response-icon">−</span>
                      N/A
                    </button>
                  </div>
                </div>

                {/* Secondary Questions */}
                {secondaryQuestions.length > 0 && primaryResponse !== 'N/A' && (
                  <div className="secondary-questions">
                    {secondaryQuestions.map(secondaryQuestion => {
                      const secondaryResponse = getResponse(secondaryQuestion.id);
                      const isDisabled = primaryResponse === 'NO' || primaryResponse === '';
                      
                      return (
                        <div 
                          key={secondaryQuestion.id} 
                          className={`secondary-question ${isDisabled ? 'disabled' : ''}`}
                        >
                          <div className="question-header">
                            <span className="question-badge secondary">Secondary</span>
                            <span className="question-link">Linked to above</span>
                          </div>
                          <p className="question-text">{secondaryQuestion.text}</p>
                          
                          <div className="response-options">
                            <button
                              className={`response-btn ${secondaryResponse === 'YES' ? 'selected' : ''}`}
                              onClick={() => !isDisabled && handleResponse(
                                secondaryQuestion.id, 'YES', secondaryQuestion.text, true, primaryQuestion.id
                              )}
                              disabled={isDisabled}
                            >
                              <span className="response-icon">✓</span>
                              YES
                            </button>
                            <button
                              className={`response-btn no ${secondaryResponse === 'NO' ? 'selected' : ''}`}
                              onClick={() => !isDisabled && handleResponse(
                                secondaryQuestion.id, 'NO', secondaryQuestion.text, true, primaryQuestion.id
                              )}
                              disabled={isDisabled}
                            >
                              <span className="response-icon">✗</span>
                              NO
                            </button>
                            <button
                              className={`response-btn na ${secondaryResponse === 'N/A' ? 'selected' : ''}`}
                              onClick={() => !isDisabled && handleResponse(
                                secondaryQuestion.id, 'N/A', secondaryQuestion.text, true, primaryQuestion.id
                              )}
                              disabled={isDisabled}
                            >
                              <span className="response-icon">−</span>
                              N/A
                            </button>
                          </div>
                          
                          {isDisabled && (
                            <p className="disabled-hint">
                              Auto N/A when primary is unanswered or NO
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="inspection-navigation">
        <button
          className="nav-btn prev"
          onClick={handlePrevious}
          disabled={currentStageIndex === 0 && currentSectionIndex === 0}
        >
          ← Previous
        </button>
        
        <button
          className="nav-btn next"
          onClick={handleNext}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 
           currentStageIndex === stages.length - 1 && currentSectionIndex === stageSections.length - 1 
             ? 'Submit Inspection ✓' : 'Next →'}
        </button>
      </div>
    </div>
  );
};

export default InspectionForm;
