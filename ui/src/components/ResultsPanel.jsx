import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ResultsPanel.css';

// Components
import Modal from './modals/Modal';
import IMDSTokenSection from './sections/IMDSTokenSection';
import CredentialsSection from './sections/CredentialsSection';
import AccountInfoSection from './sections/AccountInfoSection';
import MetadataTreeSection from './sections/MetadataTreeSection';
import PermissionsSection from './sections/PermissionsSection';
import S3Section from './sections/S3Section';
import ResourceListSection from './sections/ResourceListSection';
import Section from './common/Section';

// Use relative URL to work with Vite proxy (configured in vite.config.js)
// This allows external access to work properly
const API_URL = '';

/**
 * ResultsPanel Component
 *
 * Main panel displaying all exploitation results and AWS resource information.
 * Broken down into modular, reusable section components.
 */
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

  // S3 Operations
  const listBucketObjects = async (bucket) => {
    setLoading(prev => ({ ...prev, bucketObjects: true }));
    try {
      const res = await axios.post(`${API_URL}/api/s3/list-objects`, { bucket, prefix: '' });
      const objects = res.data.objects || [];
      const objectsArray = Array.isArray(objects) ? objects : [];

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

  // Secrets & SSM Operations
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
      loadData('ssmParams', '/api/ssm/parameters', 'parameters');
    } catch (error) {
      alert(`Failed to create parameter: ${error.message}`);
    }
  };

  // Lambda Operations
  const invokeLambdaFunction = async (functionName) => {
    const payload = prompt('Enter JSON payload (or leave empty for {}):') || '{}';
    try {
      const res = await axios.post(`${API_URL}/api/lambda/invoke`, { functionName, payload });
      setModalData({ title: `Lambda Result: ${functionName}`, content: JSON.stringify(res.data.result, null, 2) });
    } catch (error) {
      alert(`Failed to invoke Lambda: ${error.message}`);
    }
  };

  // Advanced Operations
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

  // Helper functions
  const hasData = sessionData.accountId || sessionData.roles?.length > 0;

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
          {/* Core Sections */}
          <IMDSTokenSection
            token={sessionData.imdsToken}
            expanded={expandedSection === 'imdsToken'}
            onToggle={() => toggleSection('imdsToken')}
          />

          <CredentialsSection
            credentials={sessionData.credentials}
            expanded={expandedSection === 'extractedCreds'}
            onToggle={() => toggleSection('extractedCreds')}
          />

          <AccountInfoSection
            accountId={sessionData.accountId}
            region={sessionData.region}
            roles={sessionData.roles}
            expanded={expandedSection === 'accountInfo'}
            onToggle={() => toggleSection('accountInfo')}
          />

          <MetadataTreeSection
            metadataTree={sessionData.metadataTree}
            metadataCount={sessionData.metadata}
            expanded={expandedSection === 'metadataTree'}
            onToggle={() => toggleSection('metadataTree')}
            onViewValue={(path, value) => setModalData({ title: path, content: String(value) })}
          />

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

          <PermissionsSection
            permissions={sessionData.permissions}
            expanded={expandedSection === 'permissions'}
            onToggle={() => toggleSection('permissions')}
          />

          {/* S3 Operations */}
          {(hasPermission('s3:ListAllMyBuckets') || hasPermission('s3:ListBucket') || data.s3Buckets.length > 0) && (
            <S3Section
              buckets={data.s3Buckets}
              loading={loading.s3Buckets}
              expanded={expandedSection === 's3'}
              onToggle={() => toggleSection('s3')}
              onListBuckets={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')}
              onViewObjects={listBucketObjects}
              onDownload={downloadS3Object}
              onUpload={uploadS3Object}
            />
          )}

          {/* Resource Sections */}
          {hasPermission('secretsmanager:ListSecrets') && (
            <ResourceListSection
              title="Secrets Manager"
              resources={data.secrets}
              loading={loading.secrets}
              expanded={expandedSection === 'secrets'}
              onToggle={() => toggleSection('secrets')}
              badgeColor="danger"
              renderItem={(secret) => (
                <>
                  <code>{secret}</code>
                  <button className="btn-link" onClick={() => viewSecretValue(secret)}>View Value</button>
                </>
              )}
            />
          )}

          {hasPermission('ssm:DescribeParameters') && (
            <ResourceListSection
              title="SSM Parameters"
              resources={data.ssmParams}
              loading={loading.ssmParams}
              expanded={expandedSection === 'ssm'}
              onToggle={() => toggleSection('ssm')}
              badgeColor="warning"
              actions={[{ label: 'Create Parameter', onClick: createSSMParameter, className: 'btn-danger btn-sm' }]}
              renderItem={(param) => (
                <>
                  <code>{param}</code>
                  <button className="btn-link" onClick={() => viewSSMParameter(param)}>View Value</button>
                </>
              )}
            />
          )}

          {hasPermission('lambda:ListFunctions') && (
            <ResourceListSection
              title="Lambda Functions"
              resources={data.lambdaFunctions}
              loading={loading.lambdaFunctions}
              expanded={expandedSection === 'lambda'}
              onToggle={() => toggleSection('lambda')}
              renderItem={(fn) => (
                <>
                  <code>{fn}</code>
                  <button className="btn-danger btn-link" onClick={() => invokeLambdaFunction(fn)}>Invoke</button>
                </>
              )}
            />
          )}

          {hasPermission('iam:ListUsers') && (
            <ResourceListSection
              title="IAM Users"
              resources={data.iamUsers}
              loading={loading.iamUsers}
              expanded={expandedSection === 'iamUsers'}
              onToggle={() => toggleSection('iamUsers')}
            />
          )}

          {hasPermission('iam:ListRoles') && (
            <ResourceListSection
              title="IAM Roles (AWS)"
              resources={data.iamRoles}
              loading={loading.iamRoles}
              expanded={expandedSection === 'iamRoles'}
              onToggle={() => toggleSection('iamRoles')}
            />
          )}

          {hasPermission('ec2:DescribeInstances') && (
            <ResourceListSection
              title="EC2 Instances"
              resources={data.ec2Instances}
              loading={loading.ec2Instances}
              expanded={expandedSection === 'ec2'}
              onToggle={() => toggleSection('ec2')}
              renderItem={(instance) => (
                <code>
                  {typeof instance === 'string'
                    ? instance
                    : `${instance.InstanceId} - ${instance.State} (${instance.InstanceType})`
                  }
                </code>
              )}
            />
          )}

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

      {/* Modal */}
      <Modal
        title={modalData?.title}
        content={modalData?.content}
        onClose={() => setModalData(null)}
      />
    </div>
  );
}
