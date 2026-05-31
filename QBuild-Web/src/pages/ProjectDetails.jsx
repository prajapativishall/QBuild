import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Layers,
  Folder,
  HelpCircle,
  Users,
  CheckCircle
} from 'lucide-react';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stages, setStages] = useState([]);
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [relatedInspections, setRelatedInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionFormData, setQuestionFormData] = useState({
    questionText: '',
    questionType: 'PRIMARY',
    parentQuestionId: '',
    sectionId: '',
    displayOrder: 0
  });

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);

        const savedProjects = localStorage.getItem('projects');
        const savedInspections = localStorage.getItem('inspections');

        let loadedProject = null;
        if (savedProjects) {
          const projects = JSON.parse(savedProjects);
          loadedProject = projects.find(p => p.id === parseInt(id));
        }

        let nextRelatedInspections = [];
        if (savedInspections && loadedProject) {
          const inspections = JSON.parse(savedInspections);
          nextRelatedInspections = inspections.filter(i => i.projectName === loadedProject.name);
        }

        if (!loadedProject) {
          loadedProject = {
            id: parseInt(id),
            name: 'Project',
            description: '',
            status: 'active',
            startDate: null,
            endDate: null,
            engineers: [],
            progress: 0,
            totalInspections: 0,
            completedInspections: 0,
            totalQuestions: 0,
            completedQuestions: 0,
            stages: [],
            sections: [],
            questions: []
          };
        }

        setProject(loadedProject);
        setStages(loadedProject.stages || []);
        setSections(loadedProject.sections || []);
        setQuestions(loadedProject.questions || []);
        setRelatedInspections(nextRelatedInspections);
      } catch (error) {
        console.error('Error fetching project details:', error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionFormData({
      questionText: '',
      questionType: 'PRIMARY',
      parentQuestionId: '',
      sectionId: '',
      displayOrder: questions.length
    });
    setShowQuestionForm(true);
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionFormData({
      questionText: question.question || '',
      questionType: question.type || 'PRIMARY',
      parentQuestionId: question.parentQuestionId || '',
      sectionId: question.sectionId || '',
      displayOrder: question.displayOrder || 0
    });
    setShowQuestionForm(true);
  };

  const handleSaveQuestion = () => {
    if (!questionFormData.questionText.trim()) {
      alert('Question text is required');
      return;
    }

    const updatedQuestions = [...questions];
    if (editingQuestion) {
      const index = updatedQuestions.findIndex(q => q.id === editingQuestion.id);
      if (index !== -1) {
        updatedQuestions[index] = {
          ...updatedQuestions[index],
          question: questionFormData.questionText,
          type: questionFormData.questionType,
          parentQuestionId: questionFormData.questionType === 'SECONDARY' ? questionFormData.parentQuestionId : null,
          sectionId: questionFormData.sectionId,
          displayOrder: questionFormData.displayOrder
        };
      }
    } else {
      const newQuestion = {
        id: Date.now(),
        question: questionFormData.questionText,
        type: questionFormData.questionType,
        parentQuestionId: questionFormData.questionType === 'SECONDARY' ? questionFormData.parentQuestionId : null,
        sectionId: questionFormData.sectionId,
        displayOrder: questionFormData.displayOrder
      };
      updatedQuestions.push(newQuestion);
    }

    setQuestions(updatedQuestions);
    setProject(prev => ({ ...prev, questions: updatedQuestions }));
    localStorage.setItem('projects', JSON.stringify([project]));
    setShowQuestionForm(false);
  };

  const handleDeleteQuestion = (questionId) => {
    if (!confirm('Delete this question?')) return;
    const updatedQuestions = questions.filter(q => q.id !== questionId);
    setQuestions(updatedQuestions);
    setProject(prev => ({ ...prev, questions: updatedQuestions }));
    localStorage.setItem('projects', JSON.stringify([project]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-secondary-900 mb-2">Project not found</h3>
        <button onClick={() => navigate('/projects')} className="btn-primary">
          Back to Projects
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: CheckCircle },
    { id: 'stages', label: 'Stages', icon: Layers },
    { id: 'sections', label: 'Sections', icon: Folder },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">{project.name}</h1>
            <p className="text-secondary-600">{project.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-secondary flex items-center">
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </button>
          <button className="btn-primary flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Start Inspection
          </button>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-success-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Inspections</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {project.completedInspections}/{project.totalInspections}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-warning-100 rounded-lg">
              <HelpCircle className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Questions</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {project.completedQuestions}/{project.totalQuestions}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-secondary-100 rounded-lg">
              <Users className="h-6 w-6 text-secondary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Engineers</p>
              <p className="text-2xl font-semibold text-secondary-900">{project.engineers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Button */}
      <div className="fixed bottom-4 right-4 p-4">
        <button 
          onClick={() => {
            console.log('ProjectDetails Debug Info:');
            console.log('Project:', project);
            console.log('Stages:', stages);
            console.log('Sections:', sections);
            console.log('Questions:', questions);
            console.log('Related Inspections:', relatedInspections);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
        >
          Debug ProjectDetails
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-secondary-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Project Information</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-secondary-600">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'active' 
                        ? 'bg-success-100 text-success-800' 
                        : 'bg-secondary-100 text-secondary-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-secondary-600">Date Range</p>
                    <p className="font-medium text-secondary-900">
                      {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-secondary-600">Assigned Engineers</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {project.engineers.map((engineer, index) => (
                        <span
                          key={index}
                          className="inline-flex px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full"
                        >
                          {engineer}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full btn-primary flex items-center justify-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Inspection
                  </button>
                  <button className="w-full btn-secondary flex items-center justify-center">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Project Details
                  </button>
                  <button className="w-full btn-secondary flex items-center justify-center">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Engineers
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-success-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary-900">Foundation inspection completed</p>
                    <p className="text-xs text-secondary-500">2 hours ago - John Doe</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-warning-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary-900">Electrical systems inspection started</p>
                    <p className="text-xs text-secondary-500">5 hours ago - Jane Smith</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-primary-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary-900">New questions added to Structure stage</p>
                    <p className="text-xs text-secondary-500">1 day ago - Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-secondary-900">Stages</h3>
              <button className="btn-primary flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stages.map((stage) => (
                <div key={stage.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">{stage.name}</h4>
                      <div className="mt-2 text-sm text-secondary-600">
                        <p>{stage.sections} sections</p>
                        <p>{stage.questions} questions</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        stage.isActive 
                          ? 'bg-success-100 text-success-800' 
                          : 'bg-secondary-100 text-secondary-800'
                      }`}>
                        {stage.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button className="p-1 text-secondary-600 hover:text-primary-600">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-secondary-900">Sections</h3>
              <button className="btn-primary flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </button>
            </div>
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">{section.name}</h4>
                      <p className="text-sm text-secondary-600 mt-1">{section.stageName}</p>
                      <p className="text-sm text-secondary-500 mt-1">{section.questions} questions</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-1 text-secondary-600 hover:text-primary-600">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-secondary-600 hover:text-error-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-secondary-900">Questions</h3>
              <button className="btn-primary flex items-center" onClick={handleAddQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </button>
            </div>
            
            {showQuestionForm && (
              <div className="card p-6 space-y-4">
                <h4 className="font-semibold text-secondary-900">
                  {editingQuestion ? 'Edit Question' : 'Add Question'}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Question Type</label>
                    <select
                      className="w-full border border-secondary-300 rounded-lg px-3 py-2"
                      value={questionFormData.questionType}
                      onChange={(e) => {
                        console.log('Question type changed to:', e.target.value);
                        setQuestionFormData({ ...questionFormData, questionType: e.target.value });
                      }}
                    >
                      <option value="PRIMARY">Primary</option>
                      <option value="SECONDARY">Secondary</option>
                    </select>
                  </div>
                  
                  {questionFormData.questionType === 'SECONDARY' && (
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-1">Link to Primary Question</label>
                      <select
                        className="w-full border border-secondary-300 rounded-lg px-3 py-2"
                        value={questionFormData.parentQuestionId}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, parentQuestionId: e.target.value })}
                      >
                        <option value="">Select primary question</option>
                        {questions
                          .filter(q => q.type === 'PRIMARY')
                          .map(q => (
                            <option key={q.id} value={q.id}>
                              {q.question}
                            </option>
                          ))}
                      </select>
                      {questions.filter(q => q.type === 'PRIMARY').length === 0 && (
                        <p className="text-sm text-secondary-500 mt-1">No primary questions available. Create a primary question first.</p>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Section</label>
                    <select
                      className="w-full border border-secondary-300 rounded-lg px-3 py-2"
                      value={questionFormData.sectionId}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, sectionId: e.target.value })}
                    >
                      <option value="">Select section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Question Text</label>
                    <textarea
                      className="w-full border border-secondary-300 rounded-lg px-3 py-2"
                      rows={3}
                      value={questionFormData.questionText}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, questionText: e.target.value })}
                      placeholder="Enter question text"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1">Display Order</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-secondary-300 rounded-lg px-3 py-2"
                      value={questionFormData.displayOrder}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <button className="btn-primary" onClick={handleSaveQuestion}>
                      {editingQuestion ? 'Update' : 'Create'}
                    </button>
                    <button className="btn-secondary" onClick={() => setShowQuestionForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {questions.map((question) => (
                <div key={question.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">{question.question}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          question.type === 'PRIMARY' 
                            ? 'bg-primary-100 text-primary-800' 
                            : 'bg-secondary-100 text-secondary-800'
                        }`}>
                          {question.type}
                        </span>
                        {question.type === 'SECONDARY' && question.parentQuestionId && (
                          <span className="text-sm text-secondary-500">
                            → Linked to: {questions.find(q => q.id === question.parentQuestionId)?.question || 'Unknown'}
                          </span>
                        )}
                        <span className="text-sm text-secondary-500">{sections.find(s => s.id === question.sectionId)?.name || ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-1 text-secondary-600 hover:text-primary-600" onClick={() => handleEditQuestion(question)}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-secondary-600 hover:text-error-600" onClick={() => handleDeleteQuestion(question.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
