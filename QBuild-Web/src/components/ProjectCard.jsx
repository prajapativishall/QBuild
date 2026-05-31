import React from 'react';
import { Edit, Trash2, Eye, Users, Calendar, CheckCircle } from 'lucide-react';

const ProjectCard = ({ project, onEdit, onDelete }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-success-100 text-success-800';
      case 'pending':
        return 'bg-warning-100 text-warning-800';
      case 'completed':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-secondary-100 text-secondary-800';
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 70) return 'bg-success-500';
    if (progress >= 40) return 'bg-warning-500';
    return 'bg-error-500';
  };

  return (
    <div className="card p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">
            {project.name}
          </h3>
          <p className="text-sm text-secondary-600 line-clamp-2">
            {project.description}
          </p>
        </div>
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-secondary-600">Progress</span>
          <span className="text-sm font-medium text-secondary-900">{project.progress}%</span>
        </div>
        <div className="w-full bg-secondary-200 rounded-full h-2">
          <div 
            className={`${getProgressColor(project.progress)} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${project.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center text-sm text-secondary-600">
          <CheckCircle className="h-4 w-4 mr-1 text-success-500" />
          <span>{project.completedInspections}/{project.totalInspections} inspections</span>
        </div>
        <div className="flex items-center text-sm text-secondary-600">
          <Users className="h-4 w-4 mr-1 text-primary-500" />
          <span>{project.engineers.length} engineers</span>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center text-sm text-secondary-600 mb-4">
        <Calendar className="h-4 w-4 mr-1" />
        <span>
          {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
        </span>
      </div>

      {/* Engineers */}
      {project.engineers.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-secondary-600 mb-2">Assigned Engineers:</p>
          <div className="flex flex-wrap gap-2">
            {project.engineers.map((engineer, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full"
              >
                {engineer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-secondary-200">
        <div className="flex items-center space-x-2">
          <button
            className="p-2 text-secondary-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-secondary-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Edit Project"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-secondary-600 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            title="Delete Project"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
