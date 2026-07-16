/**
 * Returns the correct API base URL.
 * - In development (port 3001), routes to Express on port 3000.
 * - In production, routes relative to the same origin.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const port = window.location.port;
  const hostname = window.location.hostname;
  // Development: Next.js dev server on 3001 -> Express on 3000
  if (port === '3001') {
    return `http://${hostname}:3000`;
  }
  return '';
}

/**
 * A thin wrapper around fetch that automatically prepends the API base URL
 * and includes credentials for session cookies.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  return fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
  });
}
