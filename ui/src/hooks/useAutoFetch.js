import { useEffect } from 'react';

/**
 * useAutoFetch Hook
 *
 * Auto-fetches AWS resources when permissions become available.
 *
 * @param {object} permissions - Permissions object from sessionData
 * @param {Set} fetchedData - Set of already fetched resource types
 * @param {function} setFetchedData - Setter for fetchedData
 * @param {function} loadData - Function to load data for a resource type
 */
export function useAutoFetch(permissions, fetchedData, setFetchedData, loadData) {
  useEffect(() => {
    if (!permissions) return;

    const perms = permissions.allPermissions || [];
    const checkPerm = (perm) => perms.some(p => p === perm || p === perm.split(':')[0] + ':*' || p === '*');

    const resourcesToFetch = [
      { type: 'iamUsers', permission: 'iam:ListUsers', endpoint: '/api/iam/users', key: 'users' },
      { type: 'iamRoles', permission: 'iam:ListRoles', endpoint: '/api/iam/roles', key: 'roles' },
      { type: 'secrets', permission: 'secretsmanager:ListSecrets', endpoint: '/api/secrets/list', key: 'secrets' },
      { type: 'ssmParams', permission: 'ssm:DescribeParameters', endpoint: '/api/ssm/parameters', key: 'parameters' },
      { type: 'lambdaFunctions', permission: 'lambda:ListFunctions', endpoint: '/api/lambda/functions', key: 'functions' },
      { type: 'ec2Instances', permission: 'ec2:DescribeInstances', endpoint: '/api/ec2/instances', key: 'instances' },
    ];

    resourcesToFetch.forEach(({ type, permission, endpoint, key }) => {
      if (checkPerm(permission) && !fetchedData.has(type)) {
        console.log(`[AUTO-FETCH] ${type}`);
        setFetchedData(prev => new Set([...prev, type]));
        loadData(type, endpoint, key);
      }
    });
  }, [permissions, fetchedData, loadData, setFetchedData]);
}
