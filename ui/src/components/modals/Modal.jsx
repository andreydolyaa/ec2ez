import React from 'react';

/**
 * Modal Component
 *
 * A modal dialog for displaying content.
 *
 * Props:
 * - title: string - Modal title
 * - content: string - Modal content (text/code)
 * - onClose: function - Callback to close modal
 */
export default function Modal({ title, content, onClose }) {
  if (!title && !content) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}
