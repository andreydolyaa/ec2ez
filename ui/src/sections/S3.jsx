import React, { useState } from 'react';
import axios from 'axios';
import './Section.css';

export default function S3({ sessionData }) {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [objects, setObjects] = useState([]);

  const loadBuckets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/s3/buckets');
      setBuckets(res.data.buckets || []);
    } catch (error) {
      console.error('Error loading buckets:', error);
    }
    setLoading(false);
  };

  const loadObjects = async (bucket) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/s3/list-objects', { bucket, prefix: '' });
      setObjects(res.data.objects || []);
    } catch (error) {
      console.error('Error loading objects:', error);
    }
    setLoading(false);
  };

  return (
    <div className="section">
      <div className="section-header">
        <h1>🪣 S3 Operations</h1>
        <p className="section-description">
          Manage S3 buckets and objects
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">S3 Buckets</h3>
          <button onClick={loadBuckets} className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : '🔄 List Buckets'}
          </button>
        </div>
        <div className="card-body">
          {buckets.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bucket Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, idx) => (
                  <tr key={idx}>
                    <td><code>{bucket}</code></td>
                    <td>
                      <button 
                        onClick={() => { setSelectedBucket(bucket); loadObjects(bucket); }}
                        className="btn-secondary"
                      >
                        List Objects
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🪣</div>
              <div className="empty-state-description">
                Click "List Buckets" to load S3 buckets
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBucket && objects.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Objects in {selectedBucket}</h3>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj, idx) => (
                  <tr key={idx}>
                    <td><code>{obj.Key}</code></td>
                    <td>{obj.Size} bytes</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
