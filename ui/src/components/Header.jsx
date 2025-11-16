import React from 'react';
import './Header.css';

export default function Header({ sessionData }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          {sessionData?.proxyUrl && (
            <div className="header-info">
              <span className="header-label">Target:</span>
              <code className="header-value">{sessionData.proxyUrl}</code>
            </div>
          )}
          {sessionData?.accountId && (
            <div className="header-info">
              <span className="header-label">Account:</span>
              <code className="header-value">{sessionData.accountId}</code>
            </div>
          )}
          {sessionData?.region && (
            <div className="header-info">
              <span className="header-label">Region:</span>
              <code className="header-value">{sessionData.region}</code>
            </div>
          )}
        </div>
        <div className="header-right">
          {sessionData?.roles?.length > 0 && (
            <div className="header-stat">
              <span className="stat-value">{sessionData.roles.length}</span>
              <span className="stat-label">Roles</span>
            </div>
          )}
          {sessionData?.permissions?.total > 0 && (
            <div className="header-stat">
              <span className="stat-value">{sessionData.permissions.total}</span>
              <span className="stat-label">Permissions</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
