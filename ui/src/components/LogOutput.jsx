import React, { useEffect, useRef } from 'react';
import './LogOutput.css';

export default function LogOutput({ logs, autoScroll = true }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const getLogClassName = (type) => {
    switch (type) {
      case 'success':
        return 'log-success';
      case 'error':
        return 'log-error';
      case 'warning':
        return 'log-warning';
      case 'info':
        return 'log-info';
      case 'danger':
        return 'log-danger';
      default:
        return '';
    }
  };

  return (
    <div className="log-output">
      <div className="log-output-header">
        <span className="log-output-title">Console Output</span>
        <span className="log-count">{logs.length} logs</span>
      </div>
      <div className="log-output-content">
        {logs.length === 0 ? (
          <div className="log-empty">No logs yet. Start an operation to see output.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`log-entry ${getLogClassName(log.type)}`}>
              <span className="log-timestamp">{log.timestamp}</span>
              <span className="log-message">{log.message}</span>
              {log.data && (
                <pre className="log-data">{JSON.stringify(log.data, null, 2)}</pre>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
