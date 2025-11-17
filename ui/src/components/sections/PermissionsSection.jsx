import React from 'react';
import Section from '../common/Section';

/**
 * PermissionsSection Component
 *
 * Displays discovered IAM permissions with dangerous permissions highlighted.
 *
 * Props:
 * - permissions: object - Permissions object with allPermissions and dangerousPermissionsList
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 */
export default function PermissionsSection({ permissions, expanded, onToggle }) {
  if (!permissions) return null;

  return (
    <Section
      title="IAM Permissions"
      badge={<span className="badge badge-info">{permissions.totalPermissions} permissions</span>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="perm-list">
        {permissions.allPermissions?.map((perm, idx) => (
          <div key={idx} className="perm-item">
            <code>{perm}</code>
          </div>
        ))}
      </div>
      {permissions.dangerousPermissionsList?.length > 0 && (
        <div className="dangerous-perms">
          <h4>Dangerous Permissions</h4>
          {permissions.dangerousPermissionsList.map((perm, idx) => (
            <div key={idx} className="perm-item danger">
              <code>{perm}</code>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
