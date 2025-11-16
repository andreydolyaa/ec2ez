import React from 'react';
import './Section.css';

export default function EC2({ sessionData }) {
  return (
    <div className="section">
      <div className="section-header">
        <h1>EC2</h1>
        <p className="section-description">
          EC2 operations and management
        </p>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-description">
              EC2 UI implementation coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
