import React from 'react';

/**
 * Modal Component
 *
 * A modal dialog for displaying content.
 *
 * Props:
 * - title: string - Modal title
 * - content: string - Modal content (text/code) - displayed in <pre>
 * - children: ReactNode - Custom content (takes precedence over content)
 * - onClose: function - Callback to close modal
 */
export default function Modal({ title, content, children, onClose }) {
  if (!title && !content && !children) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children || <pre>{content}</pre>}
        </div>
      </div>
    </div>
  );
}
