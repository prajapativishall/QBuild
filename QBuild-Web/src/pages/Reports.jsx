import React from 'react';
import '../styles/Reports.css';

const Reports = () => {
  return (
    <div className="reports-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
          Under Construction
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
          Reports and charts are currently being developed. Check back soon!
        </p>
        <div style={{ fontSize: '48px', color: '#d1d5db' }}>
          🚧
        </div>
      </div>
    </div>
  );
};

export default Reports;
