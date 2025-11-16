import React from 'react';
import './Sidebar.css';

const sections = [
  { id: 'start', name: 'Get Started', icon: '🚀', category: 'main' },
  { id: 'imds', name: 'IMDS Extraction', icon: '🔑', category: 'exploitation' },
  { id: 's3', name: 'S3 Operations', icon: '🪣', category: 'services' },
  { id: 'secrets', name: 'Secrets Manager', icon: '🔐', category: 'services' },
  { id: 'ssm', name: 'SSM Parameters', icon: '⚙️', category: 'services' },
  { id: 'iam', name: 'IAM Operations', icon: '👤', category: 'services' },
  { id: 'lambda', name: 'Lambda Functions', icon: 'λ', category: 'services' },
  { id: 'ec2', name: 'EC2 Instances', icon: '🖥️', category: 'services' },
  { id: 'cloudwatch', name: 'CloudWatch Logs', icon: '📊', category: 'services' },
  { id: 'permissions', name: 'Permissions', icon: '🛡️', category: 'analysis' },
  { id: 'logs', name: 'Live Logs', icon: '📝', category: 'output' },
  { id: 'summary', name: 'Session Summary', icon: '📋', category: 'output' },
];

const categoryNames = {
  main: 'Main',
  exploitation: 'Exploitation',
  services: 'AWS Services',
  analysis: 'Analysis',
  output: 'Output',
};

export default function Sidebar({ currentSection, onSectionChange, sessionData }) {
  const groupedSections = sections.reduce((acc, section) => {
    if (!acc[section.category]) {
      acc[section.category] = [];
    }
    acc[section.category].push(section);
    return acc;
  }, {});

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">EC2EZ</h2>
        <p className="sidebar-subtitle">IMDSv2 Exploitation</p>
      </div>

      <nav className="sidebar-nav">
        {Object.entries(groupedSections).map(([category, items]) => (
          <div key={category} className="nav-section">
            <div className="nav-category">{categoryNames[category]}</div>
            {items.map((section) => (
              <button
                key={section.id}
                className={`nav-item ${currentSection === section.id ? 'active' : ''}`}
                onClick={() => onSectionChange(section.id)}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-name">{section.name}</span>
                {sessionData?.counts?.[section.id] > 0 && (
                  <span className="nav-badge">{sessionData.counts[section.id]}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
}
