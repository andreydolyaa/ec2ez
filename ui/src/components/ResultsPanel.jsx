import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ResultsPanel.css';

const API_URL = 'http://localhost:3006';

// Recursive Tree Component for Metadata
function TreeNode({ name, node, path, onViewValue }) {
  const [expanded, setExpanded] = useState(false);

  if (node.type === 'file') {
    return (
      <div className="tree-file">
        <span className="tree-icon">📄</span>
        <code className="tree-name">{name}</code>
        {String(node.value).length > 50 ? (
          <>
            <span className="tree-value-preview">{String(node.value).substring(0, 50)}...</span>
            <button className="btn-link" onClick={() => onViewValue(node.path, node.value)}>
              View
            </button>
          </>
        ) : (
          <span className="tree-value">{String(node.value)}</span>
        )}
      </div>
    );
  }

  // This is a folder
  const children = node.children || {};
  const childCount = Object.keys(children).length;

  return (
    <div className="tree-folder">
      <div className="tree-folder-header" onClick={() => setExpanded(!expanded)}>
        <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
        <code className="tree-name">{name}/</code>
        <span className="tree-count">({childCount} items)</span>
        <span className="tree-arrow">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="tree-folder-children">
          {Object.entries(children)
            .sort(([, a], [, b]) => {
              // Folders first, then files
              if (a.type === 'folder' && b.type === 'file') return -1;
              if (a.type === 'file' && b.type === 'folder') return 1;
              return 0;
            })
            .map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                path={`${path}/${childName}`}
                onViewValue={onViewValue}
              />
            ))}
        </div>
      )}
    </div>
  );
}

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
  const [fetchedData, setFetchedData] = useState(new Set());

  // Auto-update S3 buckets when sessionData changes
  useEffect(() => {
    if (sessionData.s3Buckets && sessionData.s3Buckets.length > 0) {
      setData(prev => ({ ...prev, s3Buckets: sessionData.s3Buckets }));
    }
  }, [sessionData.s3Buckets]);

  // Auto-expand metadata tree when it becomes available
  useEffect(() => {
    if (sessionData.metadataTree && Object.keys(sessionData.metadataTree).length > 0) {
      console.log('[AUTO-EXPAND] IMDS Metadata Tree');
      setExpandedSection('metadataTree');
    }
  }, [sessionData.metadataTree]);

  // Auto-fetch data when permissions become available
  useEffect(() => {
    if (!sessionData.permissions) return;

    const perms = sessionData.permissions.allPermissions || [];
    const checkPerm = (perm) => perms.some(p => p === perm || p === perm.split(':')[0] + ':*' || p === '*');

    // Auto-fetch IAM users
    if (checkPerm('iam:ListUsers') && !fetchedData.has('iamUsers')) {
      console.log('[AUTO-FETCH] IAM Users');
      setFetchedData(prev => new Set([...prev, 'iamUsers']));
      loadData('iamUsers', '/api/iam/users', 'users');
    }

    // Auto-fetch IAM roles
    if (checkPerm('iam:ListRoles') && !fetchedData.has('iamRoles')) {
      console.log('[AUTO-FETCH] IAM Roles');
      setFetchedData(prev => new Set([...prev, 'iamRoles']));
      loadData('iamRoles', '/api/iam/roles', 'roles');
    }

    // Auto-fetch Secrets Manager
    if (checkPerm('secretsmanager:ListSecrets') && !fetchedData.has('secrets')) {
      console.log('[AUTO-FETCH] Secrets Manager');
      setFetchedData(prev => new Set([...prev, 'secrets']));
      loadData('secrets', '/api/secrets/list', 'secrets');
    }

    // Auto-fetch SSM Parameters
    if (checkPerm('ssm:DescribeParameters') && !fetchedData.has('ssmParams')) {
      console.log('[AUTO-FETCH] SSM Parameters');
      setFetchedData(prev => new Set([...prev, 'ssmParams']));
      loadData('ssmParams', '/api/ssm/parameters', 'parameters');
    }

    // Auto-fetch Lambda Functions
    if (checkPerm('lambda:ListFunctions') && !fetchedData.has('lambdaFunctions')) {
      console.log('[AUTO-FETCH] Lambda Functions');
      setFetchedData(prev => new Set([...prev, 'lambdaFunctions']));
      loadData('lambdaFunctions', '/api/lambda/functions', 'functions');
    }

    // Auto-fetch EC2 Instances
    if (checkPerm('ec2:DescribeInstances') && !fetchedData.has('ec2Instances')) {
      console.log('[AUTO-FETCH] EC2 Instances');
      setFetchedData(prev => new Set([...prev, 'ec2Instances']));
      loadData('ec2Instances', '/api/ec2/instances', 'instances');
    }
  }, [sessionData.permissions, fetchedData]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const loadData = async (type, endpoint, dataKey) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await axios.get(`${API_URL}${endpoint}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
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
      const objectsArray = Array.isArray(objects) ? objects : [];

      // Display in modal instead of section
      const objectsList = objectsArray.length > 0
        ? objectsArray.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')
        : 'No objects found in this bucket';

      setModalData({
        title: `Objects in ${bucket} (${objectsArray.length} total)`,
        content: objectsList
      });
    } catch (error) {
      console.error('Error listing bucket objects:', error);
      setModalData({
        title: `Error: ${bucket}`,
        content: `Failed to list objects: ${error.message}`
      });
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

  // Check if user has a specific permission
  const hasPermission = (perm) => {
    if (!sessionData.permissions || !sessionData.permissions.allPermissions) return false;
    return sessionData.permissions.allPermissions.some(p =>
      p === perm || p === perm.split(':')[0] + ':*' || p === '*'
    );
  };

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
          {/* IMDSv2 Token Section */}
          {sessionData.imdsToken && (
            <Section
              title="IMDSv2 Token"
              badge={<span className="badge badge-warning">6 hour TTL</span>}
              expanded={expandedSection === 'imdsToken'}
              onToggle={() => toggleSection('imdsToken')}
            >
              <div className="cred-grid">
                <p className="text-muted" style={{ marginBottom: '12px' }}>
                  Session token for accessing Instance Metadata Service v2
                </p>
                <div><strong>Token Length:</strong> {sessionData.imdsToken.length} characters</div>
                <div><strong>Time to Live:</strong> 21600 seconds (6 hours)</div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Token Value:</strong>
                  <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', maxHeight: '150px', overflow: 'auto' }}>
                    {sessionData.imdsToken}
                  </pre>
                </div>
              </div>
            </Section>
          )}

          {/* Extracted Credentials Section */}
          {sessionData.credentials && (
            <Section
              title="Extracted Credentials"
              badge={<span className="badge badge-danger">SENSITIVE</span>}
              expanded={expandedSection === 'extractedCreds'}
              onToggle={() => toggleSection('extractedCreds')}
            >
              <div className="cred-grid">
                <p className="text-danger" style={{ marginBottom: '12px', fontWeight: '600' }}>
                  ⚠ Credentials extracted from IMDSv2 - Handle securely!
                </p>
                <div><strong>Role Name:</strong> <code>{sessionData.credentials.roleName}</code></div>
                <div><strong>Access Key ID:</strong> <code style={{ color: 'var(--accent-blue)' }}>{sessionData.credentials.accessKeyId}</code></div>
                <div><strong>Secret Access Key:</strong>
                  <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', backgroundColor: 'rgba(248, 81, 73, 0.1)', borderColor: 'var(--accent-red)' }}>
                    {sessionData.credentials.secretAccessKey}
                  </pre>
                </div>
                <div><strong>Session Token:</strong>
                  <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', maxHeight: '120px', overflow: 'auto', backgroundColor: 'rgba(248, 81, 73, 0.1)', borderColor: 'var(--accent-red)' }}>
                    {sessionData.credentials.sessionToken}
                  </pre>
                </div>
                <div><strong>Expiration:</strong> <code>{new Date(sessionData.credentials.expiration).toLocaleString()}</code></div>
                <div className="text-muted" style={{ marginTop: '8px', fontSize: '11px' }}>
                  These credentials have been written to ~/.aws/credentials
                </div>
              </div>
            </Section>
          )}

          {/* Account Info Section */}
          {sessionData.accountId && (
            <Section
              title="AWS Account Info"
              badge={<span className="badge badge-success">Valid</span>}
              expanded={expandedSection === 'accountInfo'}
              onToggle={() => toggleSection('accountInfo')}
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

          {/* Metadata Tree Section */}
          {sessionData.metadataTree && Object.keys(sessionData.metadataTree).length > 0 && (
            <Section
              title="IMDS Metadata (Tree View)"
              badge={<span className="badge badge-info">{sessionData.metadata} entries</span>}
              expanded={expandedSection === 'metadataTree'}
              onToggle={() => toggleSection('metadataTree')}
            >
              <div className="metadata-tree">
                <p className="text-muted" style={{ marginBottom: '12px' }}>
                  📁 Folder and file structure from EC2 Instance Metadata Service (IMDSv2)
                </p>
                <div className="tree-root">
                  {Object.entries(sessionData.metadataTree)
                    .sort(([, a], [, b]) => {
                      if (a.type === 'folder' && b.type === 'file') return -1;
                      if (a.type === 'file' && b.type === 'folder') return 1;
                      return 0;
                    })
                    .map(([name, node]) => (
                      <TreeNode
                        key={name}
                        name={name}
                        node={node}
                        path={name}
                        onViewValue={(path, value) => setModalData({ title: path, content: String(value) })}
                      />
                    ))}
                </div>
              </div>
            </Section>
          )}

          {/* Secrets Found in Metadata */}
          {sessionData.metadataSecrets && Array.isArray(sessionData.metadataSecrets) && sessionData.metadataSecrets.length > 0 && (
            <Section
              title="Secrets Found in Metadata"
              badge={<span className="badge badge-danger">{sessionData.metadataSecrets.length} secrets</span>}
              expanded={expandedSection === 'metadataSecrets'}
              onToggle={() => toggleSection('metadataSecrets')}
            >
              <div className="secrets-display">
                <p className="text-danger" style={{ marginBottom: '12px', fontWeight: '600' }}>
                  ⚠ Potential credentials and secrets detected in IMDS metadata
                </p>
                {sessionData.metadataSecrets.map((secret, idx) => (
                  <div key={idx} className="secret-entry">
                    <div className="secret-header">
                      <code className="secret-path">{secret.path}</code>
                      <div className="secret-types">
                        {secret.types && secret.types.map((type, i) => (
                          <span key={i} className="badge badge-danger" style={{ marginLeft: '4px', fontSize: '10px' }}>
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="secret-value">
                      {String(secret.value).length > 150 ? (
                        <>
                          <pre className="secret-value-short">{String(secret.value).substring(0, 150)}...</pre>
                          <button className="btn-link" onClick={() => setModalData({ title: `${secret.path} - ${secret.types.join(', ')}`, content: String(secret.value) })}>
                            View Full Value
                          </button>
                        </>
                      ) : (
                        <pre className="secret-value-short">{String(secret.value)}</pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

          {/* S3 Operations - only show if has s3 permission or buckets already discovered */}
          {(hasPermission('s3:ListAllMyBuckets') || hasPermission('s3:ListBucket') || data.s3Buckets.length > 0) && (
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
          )}


          {/* Secrets Manager - only show if has secretsmanager permission */}
          {hasPermission('secretsmanager:ListSecrets') && (
          <Section
            title="Secrets Manager"
            badge={data.secrets.length > 0 && <span className="badge badge-danger">{data.secrets.length} secrets</span>}
            expanded={expandedSection === 'secrets'}
            onToggle={() => toggleSection('secrets')}
          >
            {loading.secrets ? (
              <div className="loading"><span className="spinner"></span> Loading secrets...</div>
            ) : data.secrets.length === 0 ? (
              <p className="text-muted">No secrets found</p>
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
          )}

          {/* SSM Parameters - only show if has ssm permission */}
          {hasPermission('ssm:DescribeParameters') && (
          <Section
            title="SSM Parameters"
            badge={data.ssmParams.length > 0 && <span className="badge badge-warning">{data.ssmParams.length} params</span>}
            expanded={expandedSection === 'ssm'}
            onToggle={() => toggleSection('ssm')}
          >
            {loading.ssmParams ? (
              <div className="loading"><span className="spinner"></span> Loading parameters...</div>
            ) : data.ssmParams.length === 0 ? (
              <>
                <p className="text-muted">No SSM parameters found</p>
                <button className="btn-danger btn-sm" style={{ marginTop: '8px' }} onClick={createSSMParameter}>Create Parameter</button>
              </>
            ) : (
              <>
                <div className="action-buttons">
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
          )}

          {/* Lambda Functions - only show if has lambda permission */}
          {hasPermission('lambda:ListFunctions') && (
          <Section
            title="Lambda Functions"
            badge={data.lambdaFunctions.length > 0 && <span className="badge badge-info">{data.lambdaFunctions.length} functions</span>}
            expanded={expandedSection === 'lambda'}
            onToggle={() => toggleSection('lambda')}
          >
            {loading.lambdaFunctions ? (
              <div className="loading"><span className="spinner"></span> Loading functions...</div>
            ) : data.lambdaFunctions.length === 0 ? (
              <p className="text-muted">No Lambda functions found</p>
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
          )}

          {/* IAM Users - only show if has iam permission */}
          {hasPermission('iam:ListUsers') && (
          <Section
            title="IAM Users"
            badge={data.iamUsers.length > 0 && <span className="badge badge-info">{data.iamUsers.length} users</span>}
            expanded={expandedSection === 'iamUsers'}
            onToggle={() => toggleSection('iamUsers')}
          >
            {loading.iamUsers ? (
              <div className="loading"><span className="spinner"></span> Loading IAM users...</div>
            ) : data.iamUsers.length === 0 ? (
              <p className="text-muted">No IAM users found</p>
            ) : (
              <ul className="resource-list">
                {data.iamUsers.map((user, idx) => (
                  <li key={idx}><code>{user}</code></li>
                ))}
              </ul>
            )}
          </Section>
          )}

          {/* IAM Roles - only show if has iam permission */}
          {hasPermission('iam:ListRoles') && (
          <Section
            title="IAM Roles (AWS)"
            badge={data.iamRoles.length > 0 && <span className="badge badge-info">{data.iamRoles.length} roles</span>}
            expanded={expandedSection === 'iamRoles'}
            onToggle={() => toggleSection('iamRoles')}
          >
            {loading.iamRoles ? (
              <div className="loading"><span className="spinner"></span> Loading IAM roles...</div>
            ) : data.iamRoles.length === 0 ? (
              <p className="text-muted">No IAM roles found</p>
            ) : (
              <ul className="resource-list">
                {data.iamRoles.map((role, idx) => (
                  <li key={idx}><code>{role}</code></li>
                ))}
              </ul>
            )}
          </Section>
          )}

          {/* EC2 Instances - only show if has ec2 permission */}
          {hasPermission('ec2:DescribeInstances') && (
          <Section
            title="EC2 Instances"
            badge={data.ec2Instances.length > 0 && <span className="badge badge-info">{data.ec2Instances.length} instances</span>}
            expanded={expandedSection === 'ec2'}
            onToggle={() => toggleSection('ec2')}
          >
            {loading.ec2Instances ? (
              <div className="loading"><span className="spinner"></span> Loading EC2 instances...</div>
            ) : data.ec2Instances.length === 0 ? (
              <p className="text-muted">No EC2 instances found</p>
            ) : (
              <ul className="resource-list">
                {data.ec2Instances.map((instance, idx) => (
                  <li key={idx}><code>{typeof instance === 'string' ? instance : `${instance.InstanceId} - ${instance.State} (${instance.InstanceType})`}</code></li>
                ))}
              </ul>
            )}
          </Section>
          )}

          {/* Advanced Operations - always show */}
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
