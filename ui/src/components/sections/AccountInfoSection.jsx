import React from 'react';
import Section from '../common/Section';

/**
 * AccountInfoSection Component
 *
 * Displays AWS account information and discovered roles.
 *
 * Props:
 * - accountId: string - AWS account ID
 * - region: string - AWS region
 * - roles: array - List of discovered IAM roles
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 */
export default function AccountInfoSection({ accountId, region, roles, expanded, onToggle }) {
  if (!accountId) return null;

  return (
    <Section
      title="AWS Account Info"
      badge={<span className="badge badge-success">Valid</span>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="cred-grid">
        <div><strong>Account ID:</strong> {accountId}</div>
        <div><strong>Region:</strong> {region}</div>
        {roles && roles.length > 0 && (
          <>
            <div><strong>Roles Found:</strong> {roles.length}</div>
            <div className="role-list">
              {roles.map((role, idx) => (
                <div key={idx} className="role-item">
                  <code>{role}</code>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
