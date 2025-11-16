import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import Layout from './components/Layout';
import Start from './sections/Start';
import IMDS from './sections/IMDS';
import S3 from './sections/S3';
import Secrets from './sections/Secrets';
import SSM from './sections/SSM';
import IAM from './sections/IAM';
import Lambda from './sections/Lambda';
import EC2 from './sections/EC2';
import CloudWatch from './sections/CloudWatch';
import Permissions from './sections/Permissions';
import Logs from './sections/Logs';
import Summary from './sections/Summary';
import './styles/theme.css';

const API_URL = '/api';

export default function App() {
  const [currentSection, setCurrentSection] = useState('start');
  const [sessionData, setSessionData] = useState({});
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
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

  const handleStart = async (proxyUrl) => {
    setIsRunning(true);
    setLogs([]);
    setSessionData({ proxyUrl });
    setCurrentSection('logs');

    try {
      await axios.post(`${API_URL}/start`, { proxyUrl });
    } catch (error) {
      console.error('Error starting exploitation:', error);
      setIsRunning(false);
    }
  };

  const renderSection = () => {
    const sectionProps = {
      sessionData,
      logs,
      isRunning,
    };

    switch (currentSection) {
      case 'start':
        return <Start onStart={handleStart} isRunning={isRunning} />;
      case 'imds':
        return <IMDS {...sectionProps} />;
      case 's3':
        return <S3 {...sectionProps} />;
      case 'secrets':
        return <Secrets {...sectionProps} />;
      case 'ssm':
        return <SSM {...sectionProps} />;
      case 'iam':
        return <IAM {...sectionProps} />;
      case 'lambda':
        return <Lambda {...sectionProps} />;
      case 'ec2':
        return <EC2 {...sectionProps} />;
      case 'cloudwatch':
        return <CloudWatch {...sectionProps} />;
      case 'permissions':
        return <Permissions {...sectionProps} />;
      case 'logs':
        return <Logs logs={logs} />;
      case 'summary':
        return <Summary {...sectionProps} />;
      default:
        return <Start onStart={handleStart} isRunning={isRunning} />;
    }
  };

  return (
    <Layout
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
      sessionData={sessionData}
    >
      {renderSection()}
    </Layout>
  );
}
