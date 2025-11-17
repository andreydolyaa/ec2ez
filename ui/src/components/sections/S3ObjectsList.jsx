import React from 'react';

/**
 * S3ObjectsList Component
 *
 * Displays a list of S3 objects with download buttons.
 *
 * Props:
 * - objects: array - List of object keys
 * - bucket: string - Bucket name
 * - onDownload: function - Callback to download object (bucket, key)
 */
export default function S3ObjectsList({ objects, bucket, onDownload }) {
  if (!objects || objects.length === 0) {
    return <p className="text-muted">No objects found in this bucket</p>;
  }

  return (
    <div className="s3-objects-list">
      {objects.map((objectKey, idx) => (
        <div key={idx} className="s3-object-item">
          <div className="s3-object-key">
            <span className="s3-object-number">{idx + 1}.</span>
            <code>{objectKey}</code>
          </div>
          <button
            className="btn-primary btn-sm"
            onClick={() => onDownload(bucket, objectKey)}
            title={`Download ${objectKey}`}
          >
            ⬇ Download
          </button>
        </div>
      ))}
    </div>
  );
}
