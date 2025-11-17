import axios from 'axios';

const API_URL = '';

/**
 * Generic data loader for API endpoints
 */
export async function loadData(type, endpoint, dataKey, setData, setLoading) {
  setLoading(prev => ({ ...prev, [type]: true }));
  try {
    const res = await axios.get(`${API_URL}${endpoint}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    const result = res.data[dataKey];
    setData(prev => ({ ...prev, [type]: Array.isArray(result) ? result : [] }));
  } catch (error) {
    console.error(`Error loading ${type}:`, error);
    setData(prev => ({ ...prev, [type]: [] }));
  }
  setLoading(prev => ({ ...prev, [type]: false }));
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(perm, permissions) {
  if (!permissions || !permissions.allPermissions) return false;
  return permissions.allPermissions.some(p =>
    p === perm || p === perm.split(':')[0] + ':*' || p === '*'
  );
}
