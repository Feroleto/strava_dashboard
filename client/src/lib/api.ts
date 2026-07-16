import { API_BASE_URL } from './apiUrl';

// thin fetch wrapper applied to every API call — the backend session lives in
// an httpOnly cookie, so credentials: 'include' is required on every request
// or auth breaks silently (the cookie just never gets sent cross-origin)
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });
}
