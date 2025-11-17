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
 * - metadataDetails: object - Raw metadata for debugging
 */
export default function MetadataTreeSection({ metadataTree, metadataCount, expanded, onToggle, onViewValue, metadataDetails }) {
  // Debug logging
  React.useEffect(() => {
    if (metadataTree) {
      console.log('[METADATA TREE] Tree keys:', Object.keys(metadataTree));
      console.log('[METADATA TREE] Full tree:', metadataTree);
    }
    if (metadataDetails) {
      console.log('[METADATA DETAILS] Count:', Object.keys(metadataDetails).length);
      console.log('[METADATA DETAILS] Paths:', Object.keys(metadataDetails).slice(0, 10));
    }
  }, [metadataTree, metadataDetails]);

  // Don't show section at all if we never got any data
  const hasAnyData = metadataTree && Object.keys(metadataTree).length > 0;
  const hasPotentialData = metadataCount > 0 || metadataDetails;

  // Only return null if we're sure there's no metadata at all
  if (!hasAnyData && !hasPotentialData) return null;

  return (
    <Section
      title="IMDS Metadata (Tree View)"
      badge={metadataCount > 0 ? <span className="badge badge-info">{metadataCount} entries</span> : null}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="metadata-tree">
        <p className="text-muted" style={{ marginBottom: '12px' }}>
          📁 Folder and file structure from EC2 Instance Metadata Service (IMDSv2)
        </p>
        {!hasAnyData ? (
          <div className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>
            <p>⏳ Loading metadata tree...</p>
            {metadataDetails && (
              <p style={{ fontSize: '11px' }}>Found {Object.keys(metadataDetails).length} metadata entries, building tree...</p>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </Section>
  );
}
