import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

export default function Layout({ children, currentSection, onSectionChange, sessionData }) {
  return (
    <div className="layout">
      <Sidebar
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        sessionData={sessionData}
      />
      <div className="main-content">
        <Header sessionData={sessionData} />
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
}
