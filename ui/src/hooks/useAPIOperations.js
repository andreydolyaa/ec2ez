import { useCallback } from 'react';
import axios from 'axios';

const API_URL = '';

/**
 * useAPIOperations Hook
 *
 * Provides all API operation functions for AWS resources.
 *
 * @param {function} setModalData - Setter for modal data
 * @param {function} loadData - Function to reload data after mutations
 */
export function useAPIOperations(setModalData, loadData) {
  // S3 Operations
  const listBucketObjects = useCallback(async (bucket, setLoading) => {
    setLoading(prev => ({ ...prev, bucketObjects: true }));
    try {
      const res = await axios.post(`${API_URL}/api/s3/list-objects`, { bucket, prefix: '' });
      const objects = res.data.objects || [];
      const objectsArray = Array.isArray(objects) ? objects : [];
      // Return data for modal to render S3ObjectsList component
      setModalData({
        type: 's3-objects',
        title: `Objects in ${bucket} (${objectsArray.length} total)`,
        bucket,
        objects: objectsArray
      });
    } catch (error) {
      console.error('Error listing bucket objects:', error);
      setModalData({ title: `Error: ${bucket}`, content: `Failed to list objects: ${error.message}` });
    }
    setLoading(prev => ({ ...prev, bucketObjects: false }));
  }, [setModalData]);

  const downloadSpecificObject = useCallback(async (bucket, key) => {
    const outputPath = prompt(`Enter local save path for ${key}:`, `./${key.split('/').pop()}`);
    if (!outputPath) return;
    try {
      await axios.post(`${API_URL}/api/s3/download`, { bucket, key, outputPath });
      alert(`Download initiated for ${key}! Check terminal for progress.`);
    } catch (error) {
      alert(`Download failed: ${error.message}`);
    }
  }, []);

  const downloadS3Object = useCallback(async () => {
    const bucket = prompt('Enter bucket name:');
    if (!bucket) return;
    const key = prompt('Enter object key:');
    if (!key) return;
    const outputPath = prompt('Enter local save path:');
    if (!outputPath) return;
    try {
      await axios.post(`${API_URL}/api/s3/download`, { bucket, key, outputPath });
      alert('Download initiated! Check terminal for progress.');
    } catch (error) {
      alert(`Download failed: ${error.message}`);
    }
  }, []);

  const uploadS3Object = useCallback(async () => {
    const localPath = prompt('Enter local file path:');
    if (!localPath) return;
    const bucket = prompt('Enter bucket name:');
    if (!bucket) return;
    const key = prompt('Enter S3 key (path):');
    if (!key) return;
    try {
      await axios.post(`${API_URL}/api/s3/upload`, { localPath, bucket, key });
      alert('Upload initiated! Check terminal for progress.');
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  }, []);

  // Secrets & SSM Operations
  const viewSecretValue = useCallback(async (secretName) => {
    try {
      const res = await axios.post(`${API_URL}/api/secrets/get`, { secretName });
      setModalData({ title: `Secret: ${secretName}`, content: JSON.stringify(res.data.value, null, 2) });
    } catch (error) {
      alert(`Failed to get secret: ${error.message}`);
    }
  }, [setModalData]);

  const viewSSMParameter = useCallback(async (paramName) => {
    try {
      const res = await axios.post(`${API_URL}/api/ssm/get-parameter`, { paramName });
      setModalData({ title: `Parameter: ${paramName}`, content: res.data.value });
    } catch (error) {
      alert(`Failed to get parameter: ${error.message}`);
    }
  }, [setModalData]);

  const createSSMParameter = useCallback(async () => {
    const paramName = prompt('Enter parameter name:');
    if (!paramName) return;
    const value = prompt('Enter parameter value:');
    if (!value) return;
    const paramType = prompt('Enter type (String/SecureString/StringList) [default: String]:') || 'String';
    try {
      await axios.post(`${API_URL}/api/ssm/put-parameter`, { paramName, value, paramType });
      alert('Parameter created successfully!');
      loadData('ssmParams', '/api/ssm/parameters', 'parameters');
    } catch (error) {
      alert(`Failed to create parameter: ${error.message}`);
    }
  }, [loadData]);

  // Lambda Operations
  const invokeLambdaFunction = useCallback(async (functionName) => {
    const payload = prompt('Enter JSON payload (or leave empty for {}):') || '{}';
    try {
      const res = await axios.post(`${API_URL}/api/lambda/invoke`, { functionName, payload });
      setModalData({ title: `Lambda Result: ${functionName}`, content: JSON.stringify(res.data.result, null, 2) });
    } catch (error) {
      alert(`Failed to invoke Lambda: ${error.message}`);
    }
  }, [setModalData]);

  // Advanced Operations
  const runShellCommand = useCallback(async () => {
    const command = prompt('Enter shell command (e.g., ls, pwd, cat /etc/hosts):');
    if (!command) return;
    try {
      const res = await axios.post(`${API_URL}/api/shell/exec`, { command });
      setModalData({ title: `Command: ${command}`, content: res.data.output });
    } catch (error) {
      alert(`Command failed: ${error.message}`);
    }
  }, [setModalData]);

  const extractAllSecrets = useCallback(async () => {
    if (!confirm('This will download ALL secrets and SSM parameters. Continue?')) return;
    try {
      const res = await axios.post(`${API_URL}/api/bulk/extract-secrets`);
      setModalData({ title: 'Bulk Extraction Results', content: res.data.summary });
    } catch (error) {
      alert(`Extraction failed: ${error.message}`);
    }
  }, [setModalData]);

  return {
    listBucketObjects,
    downloadS3Object,
    downloadSpecificObject,
    uploadS3Object,
    viewSecretValue,
    viewSSMParameter,
    createSSMParameter,
    invokeLambdaFunction,
    runShellCommand,
    extractAllSecrets,
  };
}
