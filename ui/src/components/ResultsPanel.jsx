import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ResultsPanel.css';

const API_URL = 'http://localhost:3006';

export default function ResultsPanel({ sessionData, isRunning }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [data, setData] = useState({
    s3Buckets: [],
    selectedBucket: null,
    bucketObjects: [],
    secrets: [],
    ssmParams: [],
    iamUsers: [],
    iamRoles: [],
    lambdaFunctions: [],
    ec2Instances: [],
    logGroups: [],
  });
  const [loading, setLoading] = useState({});
  const [modalData, setModalData] = useState(null);

  // Auto-update S3 buckets when sessionData changes
  useEffect(() => {
    if (sessionData.s3Buckets && sessionData.s3Buckets.length > 0) {
      setData(prev => ({ ...prev, s3Buckets: sessionData.s3Buckets }));
    }
  }, [sessionData.s3Buckets]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const loadData = async (type, endpoint, dataKey) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await axios.get(`${API_URL}${endpoint}`);
      const result = res.data[dataKey];
      setData(prev => ({ ...prev, [type]: Array.isArray(result) ? result : [] }));
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      setData(prev => ({ ...prev, [type]: [] }));
    }
    setLoading(prev => ({ ...prev, [type]: false }));
  };

  const listBucketObjects = async (bucket) => {
    setLoading(prev => ({ ...prev, bucketObjects: true }));
    try {
      const res = await axios.post(`${API_URL}/api/s3/list-objects`, { bucket, prefix: '' });
      const objects = res.data.objects || [];
      setData(prev => ({ ...prev, selectedBucket: bucket, bucketObjects: objects }));
      setExpandedSection('s3-objects');
    } catch (error) {
      console.error('Error listing bucket objects:', error);
      setData(prev => ({ ...prev, bucketObjects: [] }));
    }
    setLoading(prev => ({ ...prev, bucketObjects: false }));
  };

  const downloadS3Object = async () => {
    const bucket = prompt('Enter bucket name:');
    if (!bucket) return;
    const key = prompt('Enter object key:');
    if (!key) return;
    const outputPath = prompt('Enter local save path:');
    if (!outputPath) return;

    try {
      await axios.post(`${API_URL}/api/s3/download`, { bucket, key, outputPath });
      alert('Download initiated! Check terminal for progress.');
    } catch (error) {
      alert(`Download failed: ${error.message}`);
    }
  };

  const uploadS3Object = async () => {
    const localPath = prompt('Enter local file path:');
    if (!localPath) return;
    const bucket = prompt('Enter bucket name:');
    if (!bucket) return;
    const key = prompt('Enter S3 key (path):');
    if (!key) return;

    try {
      await axios.post(`${API_URL}/api/s3/upload`, { localPath, bucket, key });
      alert('Upload initiated! Check terminal for progress.');
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  };

  const viewSecretValue = async (secretName) => {
    try {
      const res = await axios.post(`${API_URL}/api/secrets/get`, { secretName });
      setModalData({ title: `Secret: ${secretName}`, content: JSON.stringify(res.data.value, null, 2) });
    } catch (error) {
      alert(`Failed to get secret: ${error.message}`);
    }
  };

  const viewSSMParameter = async (paramName) => {
    try {
      const res = await axios.post(`${API_URL}/api/ssm/get-parameter`, { paramName });
      setModalData({ title: `Parameter: ${paramName}`, content: res.data.value });
    } catch (error) {
      alert(`Failed to get parameter: ${error.message}`);
    }
  };

  const createSSMParameter = async () => {
    const paramName = prompt('Enter parameter name:');
    if (!paramName) return;
    const value = prompt('Enter parameter value:');
    if (!value) return;
    const paramType = prompt('Enter type (String/SecureString/StringList) [default: String]:') || 'String';

    try {
      await axios.post(`${API_URL}/api/ssm/put-parameter`, { paramName, value, paramType });
      alert('Parameter created successfully!');
      // Refresh list
      loadData('ssmParams', '/api/ssm/parameters', 'parameters');
    } catch (error) {
      alert(`Failed to create parameter: ${error.message}`);
    }
  };

  const invokeLambdaFunction = async (functionName) => {
    const payload = prompt('Enter JSON payload (or leave empty for {}):') || '{}';
    try {
      const res = await axios.post(`${API_URL}/api/lambda/invoke`, { functionName, payload });
      setModalData({ title: `Lambda Result: ${functionName}`, content: JSON.stringify(res.data.result, null, 2) });
    } catch (error) {
      alert(`Failed to invoke Lambda: ${error.message}`);
    }
  };

  const runShellCommand = async () => {
    const command = prompt('Enter shell command (e.g., ls, pwd, cat /etc/hosts):');
    if (!command) return;

    try {
      const res = await axios.post(`${API_URL}/api/shell/exec`, { command });
      setModalData({ title: `Command: ${command}`, content: res.data.output });
    } catch (error) {
      alert(`Command failed: ${error.message}`);
    }
  };

  const extractAllSecrets = async () => {
    if (!confirm('This will download ALL secrets and SSM parameters. Continue?')) return;

    try {
      const res = await axios.post(`${API_URL}/api/bulk/extract-secrets`);
      setModalData({ title: 'Bulk Extraction Results', content: res.data.summary });
    } catch (error) {
      alert(`Extraction failed: ${error.message}`);
    }
  };

  const hasData = sessionData.accountId || sessionData.roles?.length > 0;

  return (
    <div className="results-panel">
      <div className="results-header">
        <h3>Session Data</h3>
      </div>

      {!hasData ? (
        <div className="results-empty">
          <p>No data yet</p>
          <p>Start exploitation to see results</p>
        </div>
      ) : (
        <div className="results-content">
          {/* Credentials Section */}
          {sessionData.accountId && (
            <Section
              title="Credentials"
              badge={<span className="badge badge-success">Valid</span>}
              expanded={expandedSection === 'credentials'}
              onToggle={() => toggleSection('credentials')}
            >
              <div className="cred-grid">
                <div><strong>Account ID:</strong> {sessionData.accountId}</div>
                <div><strong>Region:</strong> {sessionData.region}</div>
                {sessionData.roles && sessionData.roles.length > 0 && (
                  <>
                    <div><strong>Roles Found:</strong> {sessionData.roles.length}</div>
                    <div className="role-list">
                      {sessionData.roles.map((role, idx) => (
                        <div key={idx} className="role-item">
                          <code>{role}</code>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {/* Metadata Section */}
          {sessionData.metadata > 0 && (
            <Section
              title="IMDS Metadata"
              badge={<span className="badge badge-info">{sessionData.metadata} entries</span>}
              expanded={expandedSection === 'metadata'}
              onToggle={() => toggleSection('metadata')}
            >
              <p className="text-muted">Metadata entries discovered from IMDS</p>
            </Section>
          )}

          {/* Permissions Section */}
          {sessionData.permissions && (
            <Section
              title="IAM Permissions"
              badge={<span className="badge badge-info">{sessionData.permissions.totalPermissions} permissions</span>}
              expanded={expandedSection === 'permissions'}
              onToggle={() => toggleSection('permissions')}
            >
              <div className="perm-list">
                {sessionData.permissions.allPermissions?.map((perm, idx) => (
                  <div key={idx} className="perm-item">
                    <code>{perm}</code>
                  </div>
                ))}
              </div>
              {sessionData.permissions.dangerousPermissionsList?.length > 0 && (
                <div className="dangerous-perms">
                  <h4>Dangerous Permissions</h4>
                  {sessionData.permissions.dangerousPermissionsList.map((perm, idx) => (
                    <div key={idx} className="perm-item danger">
                      <code>{perm}</code>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* S3 Operations */}
          <Section
            title="S3 Operations"
            badge={data.s3Buckets.length > 0 && <span className="badge badge-info">{data.s3Buckets.length} buckets</span>}
            expanded={expandedSection === 's3'}
            onToggle={() => toggleSection('s3')}
          >
            {data.s3Buckets.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')}>
                List Buckets
              </button>
            ) : (
              <>
                <div className="action-buttons">
                  <button className="btn-primary btn-sm" onClick={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')}>
                    Refresh Buckets
                  </button>
                  <button className="btn-primary btn-sm" onClick={downloadS3Object}>Download Object</button>
                  <button className="btn-danger btn-sm" onClick={uploadS3Object}>Upload Object</button>
                </div>
                <ul className="resource-list">
                  {data.s3Buckets.map((bucket, idx) => (
                    <li key={idx}>
                      <code>{typeof bucket === 'string' ? bucket : bucket.name}</code>
                      <button className="btn-link" onClick={() => listBucketObjects(typeof bucket === 'string' ? bucket : bucket.name)}>
                        View Objects
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* S3 Bucket Objects (dynamic) */}
          {data.selectedBucket && (
            <Section
              title={`Objects in ${data.selectedBucket}`}
              badge={<span className="badge badge-info">{data.bucketObjects.length} objects</span>}
              expanded={expandedSection === 's3-objects'}
              onToggle={() => toggleSection('s3-objects')}
            >
              {loading.bucketObjects ? (
                <div className="loading"><span className="spinner"></span> Loading...</div>
              ) : data.bucketObjects.length > 0 ? (
                <ul className="resource-list">
                  {data.bucketObjects.map((obj, idx) => (
                    <li key={idx}><code>{obj}</code></li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No objects found</p>
              )}
            </Section>
          )}

          {/* Secrets Manager */}
          <Section
            title="Secrets Manager"
            badge={data.secrets.length > 0 && <span className="badge badge-danger">{data.secrets.length} secrets</span>}
            expanded={expandedSection === 'secrets'}
            onToggle={() => toggleSection('secrets')}
          >
            {data.secrets.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('secrets', '/api/secrets/list', 'secrets')}>
                List Secrets
              </button>
            ) : (
              <ul className="resource-list">
                {data.secrets.map((secret, idx) => (
                  <li key={idx}>
                    <code>{secret}</code>
                    <button className="btn-link" onClick={() => viewSecretValue(secret)}>View Value</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* SSM Parameters */}
          <Section
            title="SSM Parameters"
            badge={data.ssmParams.length > 0 && <span className="badge badge-warning">{data.ssmParams.length} params</span>}
            expanded={expandedSection === 'ssm'}
            onToggle={() => toggleSection('ssm')}
          >
            {data.ssmParams.length === 0 ? (
              <div className="action-buttons">
                <button className="btn-primary btn-sm" onClick={() => loadData('ssmParams', '/api/ssm/parameters', 'parameters')}>
                  List Parameters
                </button>
                <button className="btn-danger btn-sm" onClick={createSSMParameter}>Create Parameter</button>
              </div>
            ) : (
              <>
                <div className="action-buttons">
                  <button className="btn-primary btn-sm" onClick={() => loadData('ssmParams', '/api/ssm/parameters', 'parameters')}>
                    Refresh
                  </button>
                  <button className="btn-danger btn-sm" onClick={createSSMParameter}>Create Parameter</button>
                </div>
                <ul className="resource-list">
                  {data.ssmParams.map((param, idx) => (
                    <li key={idx}>
                      <code>{param}</code>
                      <button className="btn-link" onClick={() => viewSSMParameter(param)}>View Value</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* Lambda Functions */}
          <Section
            title="Lambda Functions"
            badge={data.lambdaFunctions.length > 0 && <span className="badge badge-info">{data.lambdaFunctions.length} functions</span>}
            expanded={expandedSection === 'lambda'}
            onToggle={() => toggleSection('lambda')}
          >
            {data.lambdaFunctions.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('lambdaFunctions', '/api/lambda/functions', 'functions')}>
                List Functions
              </button>
            ) : (
              <ul className="resource-list">
                {data.lambdaFunctions.map((fn, idx) => (
                  <li key={idx}>
                    <code>{fn}</code>
                    <button className="btn-danger btn-link" onClick={() => invokeLambdaFunction(fn)}>Invoke</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* IAM Users */}
          <Section
            title="IAM Users"
            badge={data.iamUsers.length > 0 && <span className="badge badge-info">{data.iamUsers.length} users</span>}
            expanded={expandedSection === 'iamUsers'}
            onToggle={() => toggleSection('iamUsers')}
          >
            {data.iamUsers.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('iamUsers', '/api/iam/users', 'users')}>
                List IAM Users
              </button>
            ) : (
              <ul className="resource-list">
                {data.iamUsers.map((user, idx) => (
                  <li key={idx}><code>{user}</code></li>
                ))}
              </ul>
            )}
          </Section>

          {/* IAM Roles */}
          <Section
            title="IAM Roles (AWS)"
            badge={data.iamRoles.length > 0 && <span className="badge badge-info">{data.iamRoles.length} roles</span>}
            expanded={expandedSection === 'iamRoles'}
            onToggle={() => toggleSection('iamRoles')}
          >
            {data.iamRoles.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('iamRoles', '/api/iam/roles', 'roles')}>
                List All IAM Roles
              </button>
            ) : (
              <ul className="resource-list">
                {data.iamRoles.map((role, idx) => (
                  <li key={idx}><code>{role}</code></li>
                ))}
              </ul>
            )}
          </Section>

          {/* EC2 Instances */}
          <Section
            title="EC2 Instances"
            badge={data.ec2Instances.length > 0 && <span className="badge badge-info">{data.ec2Instances.length} instances</span>}
            expanded={expandedSection === 'ec2'}
            onToggle={() => toggleSection('ec2')}
          >
            {data.ec2Instances.length === 0 ? (
              <button className="btn-primary btn-sm" onClick={() => loadData('ec2Instances', '/api/ec2/instances', 'instances')}>
                List EC2 Instances
              </button>
            ) : (
              <ul className="resource-list">
                {data.ec2Instances.map((instance, idx) => (
                  <li key={idx}><code>{instance}</code></li>
                ))}
              </ul>
            )}
          </Section>

          {/* Advanced Operations */}
          <Section
            title="Advanced Operations"
            badge={<span className="badge badge-danger">SENSITIVE</span>}
            expanded={expandedSection === 'advanced'}
            onToggle={() => toggleSection('advanced')}
          >
            <div className="action-buttons-vertical">
              <button className="btn-danger btn-sm" onClick={extractAllSecrets}>
                Extract All Secrets & Parameters
              </button>
              <button className="btn-primary btn-sm" onClick={runShellCommand}>
                Run Shell Command
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* Modal for viewing values */}
      {modalData && (
        <div className="modal-overlay" onClick={() => setModalData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalData.title}</h3>
              <button className="modal-close" onClick={() => setModalData(null)}>×</button>
            </div>
            <div className="modal-body">
              <pre>{modalData.content}</pre>
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
        <div className="section-header-right">
          {badge}
          <span className="section-arrow">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>
      {expanded && <div className="section-body">{children}</div>}
    </div>
  );
}
