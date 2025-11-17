import React from 'react';
import Section from '../common/Section';

/**
 * IMDSTokenSection Component
 *
 * Displays the extracted IMDSv2 token with TTL information.
 *
 * Props:
 * - token: string - The IMDSv2 token
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 */
export default function IMDSTokenSection({ token, expanded, onToggle }) {
  if (!token) return null;

  return (
    <Section
      title="IMDSv2 Token"
      badge={<span className="badge badge-warning">6 hour TTL</span>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="cred-grid">
        <p className="text-muted" style={{ marginBottom: '12px' }}>
          Session token for accessing Instance Metadata Service v2
        </p>
        <div><strong>Token Length:</strong> {token.length} characters</div>
        <div><strong>Time to Live:</strong> 21600 seconds (6 hours)</div>
        <div style={{ marginTop: '8px' }}>
          <strong>Token Value:</strong>
          <pre className="token-display" style={{ marginTop: '4px', fontSize: '10px', maxHeight: '150px', overflow: 'auto' }}>
            {token}
          </pre>
        </div>
      </div>
    </Section>
  );
}
