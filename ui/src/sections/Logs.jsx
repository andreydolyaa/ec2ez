import React from 'react';
import LogOutput from '../components/LogOutput';
import './Section.css';

export default function Logs({ logs }) {
  return (
    <div className="section">
      <div className="section-header">
        <h1>📝 Live Logs</h1>
        <p className="section-description">
          Real-time console output from all operations
        </p>
      </div>
      <LogOutput logs={logs} />
    </div>
  );
}
