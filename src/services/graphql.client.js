import { getAccessToken } from './api.client.js';
import { getDeviceId } from '../utils/device.js';

// Use the same base as the REST client — relative paths work fine with fetch + Vite proxy.
const GQL_ENDPOINT = (import.meta.env.VITE_API_URL || '/api') + '/graphql';

/**
 * Executes a GraphQL request with automatic authentication and device identification.
 * Uses fetch directly to support relative URLs (no URL constructor issues).
 * @param {string} query - GraphQL query or mutation string.
 * @param {object} variables - Query variables.
 * @returns {Promise<any>} The `data` field from the GraphQL response.
 */
export async function gqlRequest(query, variables = {}) {
  const token = getAccessToken();
  const deviceId = await getDeviceId();

  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(GQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));

  // Surface HTTP-level errors
  if (!res.ok) {
    const err = new Error(json.errors?.[0]?.message || `GraphQL request failed: ${res.status}`);
    err.status = res.status;
    err.graphqlErrors = json.errors;
    throw err;
  }

  // Surface GraphQL-level errors
  if (json.errors?.length) {
    const err = new Error(json.errors[0].message);
    err.graphqlErrors = json.errors;
    throw err;
  }

  return json.data;
}
