import React, { useState } from 'react';
import './Section.css';

export default function Start({ onStart, isRunning }) {
  const [proxyUrl, setProxyUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (proxyUrl && !isRunning) {
      onStart(proxyUrl);
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <h1>🚀 Get Started with EC2EZ</h1>
        <p className="section-description">
          EC2EZ is an AWS IMDSv2 exploitation tool for authorized security testing.
          Enter your SSRF endpoint URL below to begin the automated extraction process.
        </p>
      </div>

      <div className="alert alert-warning">
        <strong>⚠️ Legal Warning:</strong> This tool is for authorized security testing and educational purposes ONLY.
        Ensure you have written permission before proceeding.
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">SSRF Endpoint Configuration</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">SSRF Proxy URL</label>
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://vulnerable-site.com/proxy?url="
                disabled={isRunning}
              />
              <div className="form-helper">
                Enter the full URL including the parameter name (e.g., ?url=, ?target=, etc.)
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={!proxyUrl || isRunning}
              style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
            >
              {isRunning ? (
                <>
                  <span className="spinner"></span> Running Exploitation...
                </>
              ) : (
                '▶ Start Exploitation'
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">What EC2EZ Will Do</h3>
        </div>
        <div className="card-body">
          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon">🔍</div>
              <div className="feature-content">
                <h4>Test SSRF Vulnerability</h4>
                <p>Verify the endpoint can reach AWS IMDS</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔑</div>
              <div className="feature-content">
                <h4>Extract IMDSv2 Token</h4>
                <p>Obtain 6-hour TTL authentication token</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">👥</div>
              <div className="feature-content">
                <h4>Enumerate IAM Roles</h4>
                <p>Discover all roles on the EC2 instance</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎫</div>
              <div className="feature-content">
                <h4>Extract Credentials</h4>
                <p>Get AWS credentials for each role</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📦</div>
              <div className="feature-content">
                <h4>Discover Metadata</h4>
                <p>Enumerate IMDS metadata tree</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✅</div>
              <div className="feature-content">
                <h4>Validate Access</h4>
                <p>Test credentials across regions</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🛡️</div>
              <div className="feature-content">
                <h4>Analyze Permissions</h4>
                <p>Enumerate IAM policies and permissions</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">☁️</div>
              <div className="feature-content">
                <h4>Interactive Menu</h4>
                <p>Access AWS services post-exploitation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
