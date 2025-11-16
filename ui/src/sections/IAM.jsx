import React from 'react';
import './Section.css';

export default function IAM({ sessionData }) {
  return (
    <div className="section">
      <div className="section-header">
        <h1>IAM</h1>
        <p className="section-description">
          IAM operations and management
        </p>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-description">
              IAM UI implementation coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
