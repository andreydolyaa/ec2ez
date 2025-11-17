import React from 'react';
import Section from '../common/Section';
import TreeNode from '../common/TreeNode';

/**
 * MetadataTreeSection Component
 *
 * Displays IMDS metadata in a tree structure with folders and files.
 *
 * Props:
 * - metadataTree: object - Tree structure of metadata
 * - metadataCount: number - Total count of metadata entries
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 * - onViewValue: function - Callback to view full value in modal
 */
export default function MetadataTreeSection({ metadataTree, metadataCount, expanded, onToggle, onViewValue }) {
  if (!metadataTree || Object.keys(metadataTree).length === 0) return null;

  return (
    <Section
      title="IMDS Metadata (Tree View)"
      badge={<span className="badge badge-info">{metadataCount} entries</span>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="metadata-tree">
        <p className="text-muted" style={{ marginBottom: '12px' }}>
          📁 Folder and file structure from EC2 Instance Metadata Service (IMDSv2)
        </p>
        <div className="tree-root">
          {Object.entries(metadataTree)
            .sort(([, a], [, b]) => {
              if (a.type === 'folder' && b.type === 'file') return -1;
              if (a.type === 'file' && b.type === 'folder') return 1;
              return 0;
            })
            .map(([name, node]) => (
              <TreeNode
                key={name}
                name={name}
                node={node}
                path={name}
                onViewValue={onViewValue}
              />
            ))}
        </div>
      </div>
    </Section>
  );
}
