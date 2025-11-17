import React from 'react';
import Section from '../common/Section';

/**
 * CredentialsSection Component
 *
 * Displays extracted AWS credentials (Access Key, Secret Key, Session Token).
 *
 * Props:
 * - credentials: object - Credentials object with roleName, accessKeyId, secretAccessKey, sessionToken, expiration
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 */
export default function CredentialsSection({ credentials, expanded, onToggle }) {
  if (!credentials) return null;

  return (
    <Section
      title="Extracted Credentials"
      badge={<span className="badge badge-danger">SENSITIVE</span>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="cred-grid">
        <p className="text-danger" style={{ marginBottom: '12px', fontWeight: '600' }}>
          ⚠ Credentials extracted from IMDSv2 - Handle securely!
        </p>
        <div><strong>Role Name:</strong> <code>{credentials.roleName}</code></div>
        <div><strong>Access Key ID:</strong> <code style={{ color: 'var(--accent-blue)' }}>{credentials.accessKeyId}</code></div>
        <div><strong>Secret Access Key:</strong>
          <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', backgroundColor: 'rgba(248, 81, 73, 0.1)', borderColor: 'var(--accent-red)' }}>
            {credentials.secretAccessKey}
          </pre>
        </div>
        <div><strong>Session Token:</strong>
          <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', maxHeight: '120px', overflow: 'auto', backgroundColor: 'rgba(248, 81, 73, 0.1)', borderColor: 'var(--accent-red)' }}>
            {credentials.sessionToken}
          </pre>
        </div>
        <div><strong>Expiration:</strong> <code>{new Date(credentials.expiration).toLocaleString()}</code></div>
        <div className="text-muted" style={{ marginTop: '8px', fontSize: '11px' }}>
          These credentials have been written to ~/.aws/credentials
        </div>
      </div>
    </Section>
  );
}
