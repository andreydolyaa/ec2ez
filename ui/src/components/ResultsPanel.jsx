import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ResultsPanel.css';

export default function ResultsPanel({ sessionData, isRunning }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [data, setData] = useState({
    s3Buckets: [],
    secrets: [],
    ssmParams: [],
    iamUsers: [],
    iamRoles: [],
    lambdaFunctions: [],
    ec2Instances: [],
    logGroups: [],
  });
  const [loading, setLoading] = useState({});
  const [loadedSections, setLoadedSections] = useState(new Set());

  // Auto-update S3 buckets when sessionData changes
  useEffect(() => {
    if (sessionData.s3Buckets && sessionData.s3Buckets.length > 0) {
      setData(prev => ({ ...prev, s3Buckets: sessionData.s3Buckets }));
      setLoadedSections(prev => new Set([...prev, 's3Buckets']));
    }
  }, [sessionData.s3Buckets]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const loadData = async (type, endpoint, dataKey) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    setLoadedSections(prev => new Set([...prev, type]));
    try {
      const res = await axios.get(endpoint);
      const result = res.data[dataKey];
      setData(prev => ({ ...prev, [type]: Array.isArray(result) ? result : [] }));
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      setData(prev => ({ ...prev, [type]: [] }));
    }
    setLoading(prev => ({ ...prev, [type]: false }));
  };

  const hasData = sessionData.accountId || sessionData.roles?.length > 0;

  return (
    <div className="results-panel">
      <div className="results-header">
        <h3>Actions & Data</h3>
      </div>

      {!hasData && !isRunning && (
        <div className="results-empty">
          <p>No data yet</p>
          <span className="text-muted">Start exploitation to see results</span>
        </div>
      )}

      {isRunning && !hasData && (
        <div className="results-empty">
          <span className="spinner"></span>
          <p>Running...</p>
        </div>
      )}

      {hasData && (
        <div className="results-content">
          {/* Token */}
          {sessionData.token && (
            <Section
              title="IMDSv2 Token"
              badge={<span className="badge badge-success">Active</span>}
              expanded={expandedSection === 'token'}
              onToggle={() => toggleSection('token')}
            >
              <code className="token-display">{sessionData.token}</code>
              <p className="text-muted" style={{ marginTop: '8px', fontSize: '11px' }}>TTL: 6 hours</p>
            </Section>
          )}

          {/* Roles */}
          {sessionData.roles?.length > 0 && (
            <Section
              title="IAM Roles"
              badge={<span className="badge badge-info">{sessionData.roles.length}</span>}
              expanded={expandedSection === 'roles'}
              onToggle={() => toggleSection('roles')}
            >
              <ul className="resource-list">
                {sessionData.roles.map((role, idx) => (
                  <li key={idx}><code>{role}</code></li>
                ))}
              </ul>
            </Section>
          )}

          {/* Permissions */}
          {sessionData.permissions?.totalPermissions > 0 && (
            <Section
              title="Permissions"
              badge={<span className="badge badge-warning">{sessionData.permissions.totalPermissions}</span>}
              expanded={expandedSection === 'permissions'}
              onToggle={() => toggleSection('permissions')}
            >
              <div className="perm-list">
                {sessionData.permissions.allPermissions.map((perm, idx) => (
                  <div key={idx} className="perm-item"><code>{perm}</code></div>
                ))}
              </div>
            </Section>
          )}

          {/* S3 Buckets */}
          {loadedSections.has('s3Buckets') && (
          <Section
            title="S3 Buckets"
            badge={data.s3Buckets.length > 0 && <span className="badge badge-info">{data.s3Buckets.length}</span>}
            expanded={expandedSection === 's3'}
            onToggle={() => {
              toggleSection('s3');
              if (expandedSection !== 's3' && data.s3Buckets.length === 0) {
                loadData('s3Buckets', '/api/s3/buckets', 'buckets');
              }
            }}
          >
            {loading.s3Buckets ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.s3Buckets.length > 0 ? (
              <ul className="resource-list">
                {data.s3Buckets.map((bucket, idx) => (
                  <li key={idx}><code>{typeof bucket === 'string' ? bucket : bucket.name || JSON.stringify(bucket)}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')}>
                List Buckets
              </button>
            )}
          </Section>
          )}

          {/* Secrets Manager */}
          {loadedSections.has('secrets') && (
          <Section
            title="Secrets Manager"
            badge={data.secrets.length > 0 && <span className="badge badge-danger">{data.secrets.length}</span>}
            expanded={expandedSection === 'secrets'}
            onToggle={() => {
              toggleSection('secrets');
              if (expandedSection !== 'secrets' && data.secrets.length === 0) {
                loadData('secrets', '/api/secrets/list', 'secrets');
              }
            }}
          >
            {loading.secrets ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.secrets.length > 0 ? (
              <ul className="resource-list">
                {data.secrets.map((secret, idx) => (
                  <li key={idx}><code>{secret}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('secrets', '/api/secrets/list', 'secrets')}>
                List Secrets
              </button>
            )}
          </Section>
          )}

          {/* SSM Parameters */}
          {loadedSections.has('ssmParams') && (
          <Section
            title="SSM Parameters"
            badge={data.ssmParams.length > 0 && <span className="badge badge-warning">{data.ssmParams.length}</span>}
            expanded={expandedSection === 'ssm'}
            onToggle={() => {
              toggleSection('ssm');
              if (expandedSection !== 'ssm' && data.ssmParams.length === 0) {
                loadData('ssmParams', '/api/ssm/parameters', 'parameters');
              }
            }}
          >
            {loading.ssmParams ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.ssmParams.length > 0 ? (
              <ul className="resource-list">
                {data.ssmParams.map((param, idx) => (
                  <li key={idx}><code>{param}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('ssmParams', '/api/ssm/parameters', 'parameters')}>
                List Parameters
              </button>
            )}
          </Section>
          )}

          {/* IAM Users */}
          {loadedSections.has('iamUsers') && (
          <Section
            title="IAM Users"
            badge={data.iamUsers.length > 0 && <span className="badge badge-info">{data.iamUsers.length}</span>}
            expanded={expandedSection === 'iamUsers'}
            onToggle={() => {
              toggleSection('iamUsers');
              if (expandedSection !== 'iamUsers' && data.iamUsers.length === 0) {
                loadData('iamUsers', '/api/iam/users', 'users');
              }
            }}
          >
            {loading.iamUsers ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.iamUsers.length > 0 ? (
              <ul className="resource-list">
                {data.iamUsers.map((user, idx) => (
                  <li key={idx}><code>{user}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('iamUsers', '/api/iam/users', 'users')}>
                List IAM Users
              </button>
            )}
          </Section>
          )}

          {/* IAM Roles (from AWS, not IMDS) */}
          {loadedSections.has('iamRoles') && (
          <Section
            title="IAM Roles (AWS)"
            badge={data.iamRoles.length > 0 && <span className="badge badge-info">{data.iamRoles.length}</span>}
            expanded={expandedSection === 'iamRolesAWS'}
            onToggle={() => {
              toggleSection('iamRolesAWS');
              if (expandedSection !== 'iamRolesAWS' && data.iamRoles.length === 0) {
                loadData('iamRoles', '/api/iam/roles', 'roles');
              }
            }}
          >
            {loading.iamRoles ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.iamRoles.length > 0 ? (
              <ul className="resource-list">
                {data.iamRoles.map((role, idx) => (
                  <li key={idx}><code>{role}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('iamRoles', '/api/iam/roles', 'roles')}>
                List All IAM Roles
              </button>
            )}
          </Section>
          )}

          {/* Lambda Functions */}
          {loadedSections.has('lambdaFunctions') && (
          <Section
            title="Lambda Functions"
            badge={data.lambdaFunctions.length > 0 && <span className="badge badge-info">{data.lambdaFunctions.length}</span>}
            expanded={expandedSection === 'lambda'}
            onToggle={() => {
              toggleSection('lambda');
              if (expandedSection !== 'lambda' && data.lambdaFunctions.length === 0) {
                loadData('lambdaFunctions', '/api/lambda/functions', 'functions');
              }
            }}
          >
            {loading.lambdaFunctions ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.lambdaFunctions.length > 0 ? (
              <ul className="resource-list">
                {data.lambdaFunctions.map((fn, idx) => (
                  <li key={idx}><code>{fn}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('lambdaFunctions', '/api/lambda/functions', 'functions')}>
                List Lambda Functions
              </button>
            )}
          </Section>
          )}

          {/* EC2 Instances */}
          {loadedSections.has('ec2Instances') && (
          <Section
            title="EC2 Instances"
            badge={data.ec2Instances.length > 0 && <span className="badge badge-info">{data.ec2Instances.length}</span>}
            expanded={expandedSection === 'ec2'}
            onToggle={() => {
              toggleSection('ec2');
              if (expandedSection !== 'ec2' && data.ec2Instances.length === 0) {
                loadData('ec2Instances', '/api/ec2/instances', 'instances');
              }
            }}
          >
            {loading.ec2Instances ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.ec2Instances.length > 0 ? (
              <ul className="resource-list">
                {data.ec2Instances.map((instance, idx) => (
                  <li key={idx}><code>{instance}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('ec2Instances', '/api/ec2/instances', 'instances')}>
                List EC2 Instances
              </button>
            )}
          </Section>
          )}

          {/* CloudWatch Log Groups */}
          {loadedSections.has('logGroups') && (
          <Section
            title="CloudWatch Logs"
            badge={data.logGroups.length > 0 && <span className="badge badge-info">{data.logGroups.length}</span>}
            expanded={expandedSection === 'cloudwatch'}
            onToggle={() => {
              toggleSection('cloudwatch');
              if (expandedSection !== 'cloudwatch' && data.logGroups.length === 0) {
                loadData('logGroups', '/api/cloudwatch/log-groups', 'logGroups');
              }
            }}
          >
            {loading.logGroups ? (
              <div className="loading"><span className="spinner"></span> Loading...</div>
            ) : data.logGroups.length > 0 ? (
              <ul className="resource-list">
                {data.logGroups.map((lg, idx) => (
                  <li key={idx}><code>{lg}</code></li>
                ))}
              </ul>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => loadData('logGroups', '/api/cloudwatch/log-groups', 'logGroups')}>
                List Log Groups
              </button>
            )}
          </Section>
          )}

          {/* Load More Data Section */}
          <div className="load-more-section">
            <h4 style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Load More Data</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {!loadedSections.has('s3Buckets') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')}>S3 Buckets</button>
              )}
              {!loadedSections.has('secrets') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('secrets', '/api/secrets/list', 'secrets')}>Secrets</button>
              )}
              {!loadedSections.has('ssmParams') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('ssmParams', '/api/ssm/parameters', 'parameters')}>SSM Parameters</button>
              )}
              {!loadedSections.has('iamUsers') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('iamUsers', '/api/iam/users', 'users')}>IAM Users</button>
              )}
              {!loadedSections.has('iamRoles') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('iamRoles', '/api/iam/roles', 'roles')}>IAM Roles</button>
              )}
              {!loadedSections.has('lambdaFunctions') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('lambdaFunctions', '/api/lambda/functions', 'functions')}>Lambda Functions</button>
              )}
              {!loadedSections.has('ec2Instances') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('ec2Instances', '/api/ec2/instances', 'instances')}>EC2 Instances</button>
              )}
              {!loadedSections.has('logGroups') && (
                <button className="btn-primary btn-sm" onClick={() => loadData('logGroups', '/api/cloudwatch/log-groups', 'logGroups')}>CloudWatch Logs</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, badge, expanded, onToggle, children }) {
  return (
    <div className="result-section">
      <button className="section-header" onClick={onToggle}>
        <span>{title}</span>
        {badge}
      </button>
      {expanded && <div className="section-body">{children}</div>}
    </div>
  );
}
