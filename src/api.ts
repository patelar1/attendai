import { syncAuditLogToFirestore } from './firebase.ts';

const TOKEN_KEY = 'attend_ai_session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  if (options.method && options.method !== 'GET') {
    syncAuditLogToFirestore(
      `log_${Date.now()}`,
      `${options.method} ${path}`,
      path.split('/')[2] || 'api',
      `Executed ${options.method} on ${path}`
    ).catch(() => {});
  }

  return data as T;
}
