import React, { useState } from 'react';

/**
 * TreeNode Component
 *
 * A recursive tree node for displaying IMDS metadata in a folder/file structure.
 *
 * Props:
 * - name: string - Node name
 * - node: object - Node data with type (file/folder), value, children
 * - path: string - Current path
 * - onViewValue: function - Callback to view full value in modal
 */
export default function TreeNode({ name, node, path, onViewValue }) {
  const [expanded, setExpanded] = useState(false);

  if (node.type === 'file') {
    return (
      <div className="tree-file">
        <span className="tree-icon">📄</span>
        <code className="tree-name">{name}</code>
        {String(node.value).length > 50 ? (
          <>
            <span className="tree-value-preview">{String(node.value).substring(0, 50)}...</span>
            <button className="btn-link" onClick={() => onViewValue(node.path, node.value)}>
              View
            </button>
          </>
        ) : (
          <span className="tree-value">{String(node.value)}</span>
        )}
      </div>
    );
  }

  // This is a folder
  const children = node.children || {};
  const childCount = Object.keys(children).length;

  return (
    <div className="tree-folder">
      <div className="tree-folder-header" onClick={() => setExpanded(!expanded)}>
        <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
        <code className="tree-name">{name}/</code>
        <span className="tree-count">({childCount} items)</span>
        <span className="tree-arrow">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="tree-folder-children">
          {Object.entries(children)
            .sort(([, a], [, b]) => {
              // Folders first, then files
              if (a.type === 'folder' && b.type === 'file') return -1;
              if (a.type === 'file' && b.type === 'folder') return 1;
              return 0;
            })
            .map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                path={`${path}/${childName}`}
                onViewValue={onViewValue}
              />
            ))}
        </div>
      )}
    </div>
  );
}
