import React from 'react';
import Section from '../common/Section';

/**
 * ResourceListSection Component
 *
 * A generic component for displaying lists of AWS resources (IAM users, roles, Lambda functions, etc.)
 *
 * Props:
 * - title: string - Section title
 * - resources: array - List of resources to display
 * - loading: boolean - Loading state
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 * - badgeColor: string - Badge color class (e.g., 'info', 'warning', 'danger')
 * - actions: array - Optional array of action buttons { label, onClick, className }
 * - renderItem: function - Optional custom render function for each item
 * - onItemClick: function - Optional click handler for items
 */
export default function ResourceListSection({
  title,
  resources,
  loading,
  expanded,
  onToggle,
  badgeColor = 'info',
  actions = [],
  renderItem,
  onItemClick
}) {
  const badge = resources.length > 0 ? (
    <span className={`badge badge-${badgeColor}`}>{resources.length} items</span>
  ) : null;

  return (
    <Section title={title} badge={badge} expanded={expanded} onToggle={onToggle}>
      {loading ? (
        <div className="loading">
          <span className="spinner"></span> Loading...
        </div>
      ) : resources.length === 0 ? (
        <>
          <p className="text-muted">No items found</p>
          {actions.length > 0 && (
            <div className="action-buttons">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  className={action.className || 'btn-primary btn-sm'}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {actions.length > 0 && (
            <div className="action-buttons">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  className={action.className || 'btn-primary btn-sm'}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <ul className="resource-list">
            {resources.map((resource, idx) => (
              <li key={idx}>
                {renderItem ? (
                  renderItem(resource, idx)
                ) : (
                  <code onClick={onItemClick ? () => onItemClick(resource) : undefined}>
                    {typeof resource === 'string' ? resource : JSON.stringify(resource)}
                  </code>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
