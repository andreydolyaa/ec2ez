import React from 'react';

/**
 * Section Component
 *
 * A collapsible section with a header and body.
 *
 * Props:
 * - title: string - Section title
 * - badge: ReactNode - Optional badge to display in header
 * - expanded: boolean - Whether the section is expanded
 * - onToggle: function - Callback when section is toggled
 * - children: ReactNode - Section content
 */
export default function Section({ title, badge, expanded, onToggle, children }) {
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
