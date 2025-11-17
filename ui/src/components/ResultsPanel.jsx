import React, { useState, useEffect, useCallback } from 'react';
import './ResultsPanel.css';

// Hooks
import { useAutoFetch } from '../hooks/useAutoFetch';
import { useAPIOperations } from '../hooks/useAPIOperations';

// Utils
import { loadData as apiLoadData, hasPermission as checkPermission } from '../utils/apiUtils';

// Components
import Modal from './modals/Modal';
import IMDSTokenSection from './sections/IMDSTokenSection';
import CredentialsSection from './sections/CredentialsSection';
import AccountInfoSection from './sections/AccountInfoSection';
import MetadataTreeSection from './sections/MetadataTreeSection';
import PermissionsSection from './sections/PermissionsSection';
import S3Section from './sections/S3Section';
import S3ObjectsList from './sections/S3ObjectsList';
import ResourceListSection from './sections/ResourceListSection';
import Section from './common/Section';

/**
 * ResultsPanel Component (Refactored - ~80 lines)
 *
 * Main panel orchestrator using custom hooks for logic.
 */
export default function ResultsPanel({ sessionData, isRunning }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [data, setData] = useState({
    s3Buckets: [], secrets: [], ssmParams: [], iamUsers: [],
    iamRoles: [], lambdaFunctions: [], ec2Instances: [],
  });
  const [loading, setLoading] = useState({});
  const [modalData, setModalData] = useState(null);
  const [fetchedData, setFetchedData] = useState(new Set());

  // Wrapped loadData with state setters
  const loadData = useCallback((type, endpoint, dataKey) => {
    apiLoadData(type, endpoint, dataKey, setData, setLoading);
  }, []);

  // API operations hook
  const api = useAPIOperations(setModalData, loadData);

  // Auto-fetch hook
  useAutoFetch(sessionData.permissions, fetchedData, setFetchedData, loadData);

  // Auto-update S3 buckets from sessionData
  useEffect(() => {
    if (sessionData.s3Buckets && sessionData.s3Buckets.length > 0) {
      setData(prev => ({ ...prev, s3Buckets: sessionData.s3Buckets }));
    }
  }, [sessionData.s3Buckets]);

  // Auto-expand metadata tree
  useEffect(() => {
    if (sessionData.metadataTree && Object.keys(sessionData.metadataTree).length > 0) {
      console.log('[AUTO-EXPAND] IMDS Metadata Tree');
      setExpandedSection('metadataTree');
    }
  }, [sessionData.metadataTree]);

  const toggleSection = (section) => setExpandedSection(expandedSection === section ? null : section);
  const hasData = sessionData.accountId || sessionData.roles?.length > 0;
  const hasPermission = (perm) => checkPermission(perm, sessionData.permissions);

  return (
    <div className="results-panel">
      <div className="results-header"><h3>Session Data</h3></div>

      {!hasData ? (
        <div className="results-empty">
          <p>No data yet</p>
          <p>Start exploitation to see results</p>
        </div>
      ) : (
        <div className="results-content">
          <IMDSTokenSection token={sessionData.imdsToken} expanded={expandedSection === 'imdsToken'} onToggle={() => toggleSection('imdsToken')} />
          <CredentialsSection credentials={sessionData.credentials} expanded={expandedSection === 'extractedCreds'} onToggle={() => toggleSection('extractedCreds')} />
          <AccountInfoSection accountId={sessionData.accountId} region={sessionData.region} roles={sessionData.roles} expanded={expandedSection === 'accountInfo'} onToggle={() => toggleSection('accountInfo')} />
          <MetadataTreeSection metadataTree={sessionData.metadataTree} metadataCount={sessionData.metadata} metadataDetails={sessionData.metadataDetails} expanded={expandedSection === 'metadataTree'} onToggle={() => toggleSection('metadataTree')} onViewValue={(path, value) => setModalData({ title: path, content: String(value) })} />

          {/* Secrets from metadata - keeping inline since it has custom rendering */}
          {sessionData.metadataSecrets?.length > 0 && (
            <Section title="Secrets Found in Metadata" badge={<span className="badge badge-danger">{sessionData.metadataSecrets.length} secrets</span>} expanded={expandedSection === 'metadataSecrets'} onToggle={() => toggleSection('metadataSecrets')}>
              <div className="secrets-display">
                <p className="text-danger" style={{ marginBottom: '12px', fontWeight: '600' }}>⚠ Potential credentials and secrets detected in IMDS metadata</p>
                {sessionData.metadataSecrets.map((secret, idx) => (
                  <div key={idx} className="secret-entry">
                    <div className="secret-header">
                      <code className="secret-path">{secret.path}</code>
                      <div className="secret-types">
                        {secret.types?.map((type, i) => <span key={i} className="badge badge-danger" style={{ marginLeft: '4px', fontSize: '10px' }}>{type}</span>)}
                      </div>
                    </div>
                    <div className="secret-value">
                      {String(secret.value).length > 150 ? (
                        <><pre className="secret-value-short">{String(secret.value).substring(0, 150)}...</pre><button className="btn-link" onClick={() => setModalData({ title: `${secret.path} - ${secret.types.join(', ')}`, content: String(secret.value) })}>View Full Value</button></>
                      ) : (<pre className="secret-value-short">{String(secret.value)}</pre>)}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <PermissionsSection permissions={sessionData.permissions} expanded={expandedSection === 'permissions'} onToggle={() => toggleSection('permissions')} />

          {/* AWS Resources */}
          {(hasPermission('s3:ListAllMyBuckets') || hasPermission('s3:ListBucket') || data.s3Buckets.length > 0) && (
            <S3Section buckets={data.s3Buckets} loading={loading.s3Buckets} expanded={expandedSection === 's3'} onToggle={() => toggleSection('s3')} onListBuckets={() => loadData('s3Buckets', '/api/s3/buckets', 'buckets')} onViewObjects={(bucket) => api.listBucketObjects(bucket, setLoading)} onDownload={api.downloadS3Object} onUploadToBucket={api.uploadToSpecificBucket} />
          )}

          {hasPermission('secretsmanager:ListSecrets') && <ResourceListSection title="Secrets Manager" resources={data.secrets} loading={loading.secrets} expanded={expandedSection === 'secrets'} onToggle={() => toggleSection('secrets')} badgeColor="danger" renderItem={(secret) => (<><code>{secret}</code><button className="btn-link" onClick={() => api.viewSecretValue(secret)}>View Value</button></>)} />}
          {hasPermission('ssm:DescribeParameters') && <ResourceListSection title="SSM Parameters" resources={data.ssmParams} loading={loading.ssmParams} expanded={expandedSection === 'ssm'} onToggle={() => toggleSection('ssm')} badgeColor="warning" actions={[{ label: 'Create Parameter', onClick: api.createSSMParameter, className: 'btn-danger btn-sm' }]} renderItem={(param) => (<><code>{param}</code><button className="btn-link" onClick={() => api.viewSSMParameter(param)}>View Value</button></>)} />}
          {hasPermission('lambda:ListFunctions') && <ResourceListSection title="Lambda Functions" resources={data.lambdaFunctions} loading={loading.lambdaFunctions} expanded={expandedSection === 'lambda'} onToggle={() => toggleSection('lambda')} renderItem={(fn) => (<><code>{fn}</code><button className="btn-danger btn-link" onClick={() => api.invokeLambdaFunction(fn)}>Invoke</button></>)} />}
          {hasPermission('iam:ListUsers') && <ResourceListSection title="IAM Users" resources={data.iamUsers} loading={loading.iamUsers} expanded={expandedSection === 'iamUsers'} onToggle={() => toggleSection('iamUsers')} />}
          {hasPermission('iam:ListRoles') && <ResourceListSection title="IAM Roles (AWS)" resources={data.iamRoles} loading={loading.iamRoles} expanded={expandedSection === 'iamRoles'} onToggle={() => toggleSection('iamRoles')} />}
          {hasPermission('ec2:DescribeInstances') && <ResourceListSection title="EC2 Instances" resources={data.ec2Instances} loading={loading.ec2Instances} expanded={expandedSection === 'ec2'} onToggle={() => toggleSection('ec2')} renderItem={(instance) => (<code>{typeof instance === 'string' ? instance : `${instance.InstanceId} - ${instance.State} (${instance.InstanceType})`}</code>)} />}

          {/* Advanced Operations */}
          <Section title="Advanced Operations" badge={<span className="badge badge-danger">SENSITIVE</span>} expanded={expandedSection === 'advanced'} onToggle={() => toggleSection('advanced')}>
            <div className="action-buttons-vertical">
              {(hasPermission('secretsmanager:ListSecrets') || hasPermission('ssm:DescribeParameters')) && (
                <button className="btn-danger btn-sm" onClick={api.extractAllSecrets}>Extract All Secrets & Parameters</button>
              )}
              <button className="btn-primary btn-sm" onClick={api.runShellCommand}>Run Shell Command</button>
            </div>
          </Section>
        </div>
      )}

      <Modal title={modalData?.title} content={modalData?.content} onClose={() => setModalData(null)}>
        {modalData?.type === 's3-objects' && (
          <S3ObjectsList
            objects={modalData.objects}
            bucket={modalData.bucket}
            onDownload={api.downloadSpecificObject}
          />
        )}
      </Modal>
    </div>
  );
}
