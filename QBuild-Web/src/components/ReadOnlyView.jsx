import React from 'react';

/**
 * ReadOnlyView - Wraps list views for read-only role access (manager, reviewer, viewer).
 * Hides create/edit/delete buttons and form modals, showing only the data table.
 */
const ReadOnlyView = ({ children, title, subtitle, searchTerm, onSearchChange, data, emptyMessage }) => {
  return (
    <div className="stages-container">
      <div className="stages-header">
        <div className="stages-title-section">
          <h1 className="stages-title">{title}</h1>
          <p className="stages-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="stages-search">
        <div className="search-input-group">
          <input
            className="search-input"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="stages-empty">
          <h2 className="stages-empty-title">No {title.toLowerCase()} found</h2>
          <p className="stages-empty-description">{emptyMessage}</p>
        </div>
      ) : (
        <div className="stages-list">
          <div style={{ overflowX: 'auto' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadOnlyView;