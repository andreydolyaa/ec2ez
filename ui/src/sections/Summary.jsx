import React from 'react';
import './Section.css';

export default function Summary({ sessionData }) {
  return (
    <div className="section">
      <div className="section-header">
        <h1>Summary</h1>
        <p className="section-description">
          Summary operations and management
        </p>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-description">
              Summary UI implementation coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
