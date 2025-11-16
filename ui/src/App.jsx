import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import Terminal from './components/Terminal';
import ResultsPanel from './components/ResultsPanel';
import './App.css';
import './styles/theme.css';

const API_URL = '/api';

export default function App() {
  const [proxyUrl, setProxyUrl] = useState('');
  const [paramName, setParamName] = useState('url');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [sessionData, setSessionData] = useState({
    roles: [],
    permissions: null,
    accountId: null,
    region: null,
    token: null,
  });
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('log', (log) => {
      setLogs((prev) => [...prev, log]);
    });

    newSocket.on('sessionUpdate', (data) => {
      setSessionData((prev) => ({ ...prev, ...data }));
    });

    newSocket.on('exploitationComplete', () => {
      setIsRunning(false);
    });

    return () => newSocket.close();
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!proxyUrl || isRunning) return;

    // Build full URL with parameter
    let fullUrl = proxyUrl.trim();
    // Remove trailing slash
    if (fullUrl.endsWith('/')) {
      fullUrl = fullUrl.slice(0, -1);
    }
    // Add parameter if not already there
    if (!fullUrl.includes('?')) {
      fullUrl = `${fullUrl}?${paramName}=`;
    } else if (!fullUrl.includes('=')) {
      fullUrl = `${fullUrl}=`;
    }

    setIsRunning(true);
    setLogs([]);
    setSessionData({
      roles: [],
      permissions: null,
      accountId: null,
      region: null,
      token: null,
      proxyUrl: fullUrl,
    });

    try {
      await axios.post(`${API_URL}/start`, { proxyUrl: fullUrl });
    } catch (error) {
      console.error('Error:', error);
      setIsRunning(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>EC2EZ</h1>
            <p className="text-muted">AWS IMDSv2 Exploitation Tool</p>
          </div>
          {sessionData.accountId && (
            <div className="header-info">
              <div className="info-item">
                <span className="label">Account</span>
                <code>{sessionData.accountId}</code>
              </div>
              <div className="info-item">
                <span className="label">Region</span>
                <code>{sessionData.region}</code>
              </div>
              {sessionData.roles?.length > 0 && (
                <div className="info-item">
                  <span className="label">Roles</span>
                  <span className="badge badge-success">{sessionData.roles.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        <div className="main-panel">
          <div>
            <form onSubmit={handleStart} className="input-form">
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="SSRF endpoint (e.g., http://target.com/proxy)"
                disabled={isRunning}
                className="url-input"
              />
              <input
                type="text"
                value={paramName}
                onChange={(e) => setParamName(e.target.value)}
                placeholder="param"
                disabled={isRunning}
                className="param-input"
                style={{ width: '100px' }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!proxyUrl || isRunning}
              >
                {isRunning ? (
                  <>
                    <span className="spinner"></span> Running
                  </>
                ) : (
                  'Start'
                )}
              </button>
            </form>
            {proxyUrl && (
              <div className="form-hint">
                Will use: {proxyUrl}{!proxyUrl.includes('?') && '?'}{paramName}=
              </div>
            )}
          </div>

          <Terminal logs={logs} />
        </div>

        <div className="side-panel">
          <ResultsPanel sessionData={sessionData} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
