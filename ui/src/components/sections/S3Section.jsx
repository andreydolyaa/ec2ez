import React from 'react';
import Section from '../common/Section';

/**
 * S3Section Component
 *
 * Displays S3 buckets with actions to list objects, download, and upload.
 *
 * Props:
 * - buckets: array - List of S3 buckets
 * - loading: boolean - Loading state
 * - expanded: boolean - Section expansion state
 * - onToggle: function - Toggle callback
 * - onListBuckets: function - Callback to list all buckets
 * - onViewObjects: function - Callback to view objects in a bucket
 * - onDownload: function - Callback to download an object (generic)
 * - onUploadToBucket: function - Callback to upload to specific bucket
 */
export default function S3Section({
  buckets,
  loading,
  expanded,
  onToggle,
  onListBuckets,
  onViewObjects,
  onDownload,
  onUploadToBucket
}) {
  const badge = buckets.length > 0 ? (
    <span className="badge badge-info">{buckets.length} buckets</span>
  ) : null;

  return (
    <Section title="S3 Operations" badge={badge} expanded={expanded} onToggle={onToggle}>
      {buckets.length === 0 ? (
        <button className="btn-primary btn-sm" onClick={onListBuckets}>
          List Buckets
        </button>
      ) : (
        <>
          <div className="action-buttons">
            <button className="btn-primary btn-sm" onClick={onListBuckets}>
              Refresh Buckets
            </button>
            <button className="btn-primary btn-sm" onClick={onDownload}>
              Download Object (Generic)
            </button>
          </div>
          <ul className="resource-list">
            {buckets.map((bucket, idx) => {
              const bucketName = typeof bucket === 'string' ? bucket : bucket.name;
              return (
                <li key={idx}>
                  <code>{bucketName}</code>
                  <div className="bucket-actions">
                    <button
                      className="btn-link"
                      onClick={() => onViewObjects(bucketName)}
                    >
                      View Objects
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => onUploadToBucket(bucketName)}
                      style={{ marginLeft: '8px' }}
                    >
                      ⬆ Upload
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}
