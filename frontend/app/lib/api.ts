// Central API gateway base URL — all frontend calls go through the gateway
export const GATEWAY = 'http://localhost:8000';

// Get the stored JWT token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rentpi_token');
}

// Store token + user info
export function setAuth(token: string, user: object) {
  localStorage.setItem('rentpi_token', token);
  localStorage.setItem('rentpi_user', JSON.stringify(user));
}

// Clear auth state
export function clearAuth() {
  localStorage.removeItem('rentpi_token');
  localStorage.removeItem('rentpi_user');
}

// Get stored user
export function getUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('rentpi_user');
  return u ? JSON.parse(u) : null;
}

// Authenticated fetch helper
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GATEWAY}${path}`, { ...options, headers });
  return res;
}
