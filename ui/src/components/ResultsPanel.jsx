import React, { useState } from 'react';
import axios from 'axios';
import './ResultsPanel.css';

export default function ResultsPanel({ sessionData, isRunning }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [s3Buckets, setS3Buckets] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [ssmParams, setSSMParams] = useState([]);
  const [loading, setLoading] = useState({});

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const loadS3Buckets = async () => {
    setLoading(prev => ({ ...prev, s3: true }));
    try {
      const res = await axios.get('/api/s3/buckets');
      setS3Buckets(Array.isArray(res.data.buckets) ? res.data.buckets : []);
    } catch (error) {
      console.error('Error loading S3 buckets:', error);
      setS3Buckets([]);
    }
    setLoading(prev => ({ ...prev, s3: false }));
  };

  const loadSecrets = async () => {
    setLoading(prev => ({ ...prev, secrets: true }));
    try {
      const res = await axios.get('/api/secrets/list');
      setSecrets(Array.isArray(res.data.secrets) ? res.data.secrets : []);
    } catch (error) {
      console.error('Error loading secrets:', error);
      setSecrets([]);
    }
    setLoading(prev => ({ ...prev, secrets: false }));
  };

  const loadSSMParams = async () => {
    setLoading(prev => ({ ...prev, ssm: true }));
    try {
      const res = await axios.get('/api/ssm/parameters');
      setSSMParams(Array.isArray(res.data.parameters) ? res.data.parameters : []);
    } catch (error) {
      console.error('Error loading SSM parameters:', error);
      setSSMParams([]);
    }
    setLoading(prev => ({ ...prev, ssm: false }));
  };

  const hasData = sessionData.accountId || sessionData.roles?.length > 0;

  return (
    <div className="results-panel">
      <div className="results-header">
        <h3>Session Data</h3>
      </div>

      {!hasData && !isRunning && (
        <div className="results-empty">
          <p>No data yet</p>
          <span className="text-muted">Start an exploitation to see results</span>
        </div>
      )}

      {isRunning && !hasData && (
        <div className="results-empty">
          <span className="spinner"></span>
          <p>Running exploitation...</p>
        </div>
      )}

      {hasData && (
        <div className="results-content">
          {/* IMDSv2 Token */}
          {sessionData.token && (
            <div className="result-section">
              <button
                className="section-header"
                onClick={() => toggleSection('token')}
              >
                <span>IMDSv2 Token</span>
                <span className="badge badge-success">Active</span>
              </button>
              {expandedSection === 'token' && (
                <div className="section-body">
                  <code className="token-display">{sessionData.token}</code>
                  <p className="text-muted" style={{ marginTop: '8px', fontSize: '11px' }}>
                    TTL: 6 hours
                  </p>
                </div>
              )}
            </div>
          )}

          {/* IAM Roles */}
          {sessionData.roles && sessionData.roles.length > 0 && (
            <div className="result-section">
              <button
                className="section-header"
                onClick={() => toggleSection('roles')}
              >
                <span>IAM Roles</span>
                <span className="badge badge-info">{sessionData.roles.length}</span>
              </button>
              {expandedSection === 'roles' && (
                <div className="section-body">
                  <ul className="role-list">
                    {sessionData.roles.map((role, idx) => (
                      <li key={idx}>{role}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Permissions */}
          {sessionData.permissions && sessionData.permissions.totalPermissions > 0 && (
            <div className="result-section">
              <button
                className="section-header"
                onClick={() => toggleSection('permissions')}
              >
                <span>Permissions</span>
                <span className="badge badge-warning">
                  {sessionData.permissions.totalPermissions}
                </span>
              </button>
              {expandedSection === 'permissions' && (
                <div className="section-body">
                  <div className="perm-list">
                    {sessionData.permissions.allPermissions.map((perm, idx) => (
                      <div key={idx} className="perm-item">
                        <code>{perm}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* S3 Buckets */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => {
                toggleSection('s3');
                if (expandedSection !== 's3' && s3Buckets.length === 0) {
                  loadS3Buckets();
                }
              }}
            >
              <span>S3 Buckets</span>
              {s3Buckets.length > 0 && (
                <span className="badge badge-info">{s3Buckets.length}</span>
              )}
            </button>
            {expandedSection === 's3' && (
              <div className="section-body">
                {loading.s3 ? (
                  <div className="loading"><span className="spinner"></span> Loading...</div>
                ) : s3Buckets.length > 0 ? (
                  <ul className="resource-list">
                    {s3Buckets.map((bucket, idx) => (
                      <li key={idx}><code>{bucket}</code></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No buckets found</p>
                )}
              </div>
            )}
          </div>

          {/* Secrets Manager */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => {
                toggleSection('secrets');
                if (expandedSection !== 'secrets' && secrets.length === 0) {
                  loadSecrets();
                }
              }}
            >
              <span>Secrets Manager</span>
              {secrets.length > 0 && (
                <span className="badge badge-danger">{secrets.length}</span>
              )}
            </button>
            {expandedSection === 'secrets' && (
              <div className="section-body">
                {loading.secrets ? (
                  <div className="loading"><span className="spinner"></span> Loading...</div>
                ) : secrets.length > 0 ? (
                  <ul className="resource-list">
                    {secrets.map((secret, idx) => (
                      <li key={idx}><code>{secret}</code></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No secrets found</p>
                )}
              </div>
            )}
          </div>

          {/* SSM Parameters */}
          <div className="result-section">
            <button
              className="section-header"
              onClick={() => {
                toggleSection('ssm');
                if (expandedSection !== 'ssm' && ssmParams.length === 0) {
                  loadSSMParams();
                }
              }}
            >
              <span>SSM Parameters</span>
              {ssmParams.length > 0 && (
                <span className="badge badge-warning">{ssmParams.length}</span>
              )}
            </button>
            {expandedSection === 'ssm' && (
              <div className="section-body">
                {loading.ssm ? (
                  <div className="loading"><span className="spinner"></span> Loading...</div>
                ) : ssmParams.length > 0 ? (
                  <ul className="resource-list">
                    {ssmParams.map((param, idx) => (
                      <li key={idx}><code>{param}</code></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No parameters found</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
