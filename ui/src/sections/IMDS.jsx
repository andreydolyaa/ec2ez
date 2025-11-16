import React from 'react';
import './Section.css';

export default function IMDS({ sessionData }) {
  return (
    <div className="section">
      <div className="section-header">
        <h1>🔑 IMDS Extraction</h1>
        <p className="section-description">
          IMDSv2 token and metadata information
        </p>
      </div>

      {sessionData.token ? (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">IMDSv2 Token</h3>
              <span className="badge badge-success">Active</span>
            </div>
            <div className="card-body">
              <pre><code>{sessionData.token}</code></pre>
              <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                Token TTL: 6 hours (21600 seconds)
              </p>
            </div>
          </div>

          {sessionData.metadata > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Metadata Statistics</h3>
              </div>
              <div className="card-body">
                <div className="stats-grid">
                  <div className="stat-card success">
                    <div className="stat-card-value">{sessionData.metadata}</div>
                    <div className="stat-card-label">Metadata Entries</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔑</div>
          <div className="empty-state-title">No IMDS Data</div>
          <div className="empty-state-description">
            Run the exploitation from the "Get Started" section to extract IMDS data
          </div>
        </div>
      )}
    </div>
  );
}
