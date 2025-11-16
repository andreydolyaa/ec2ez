import React, { useEffect, useRef } from 'react';
import './Terminal.css';

export default function Terminal({ logs }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogClass = (type) => {
    switch (type) {
      case 'success': return 'log-success';
      case 'error': return 'log-error';
      case 'warning': return 'log-warning';
      case 'info': return 'log-info';
      case 'danger': return 'log-danger';
      default: return '';
    }
  };

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span>Console Output</span>
        <span className="terminal-count">{logs.length} lines</span>
      </div>
      <div className="terminal-body">
        {logs.length === 0 ? (
          <div className="terminal-empty">Waiting for exploitation to start...</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className={`terminal-line ${getLogClass(log.type)}`}>
              <span className="line-time">[{log.timestamp}]</span>
              <span className="line-msg">{log.message}</span>
              {log.data && (
                <pre className="line-data">{JSON.stringify(log.data, null, 2)}</pre>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
