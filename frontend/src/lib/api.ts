'use client';

/**
 * Typed fetch wrapper around the same-origin proxy (/api → Express).
 * Attaches the JWT from localStorage, unwraps JSON, and converts non-2xx
 * responses into a typed ApiClientError so hooks can render server messages.
 */

const TOKEN_KEY = 'creditsea_token';

export class ApiClientError extends Error {
  status: number;
  failures?: Array<{ rule: string; message: string }>;

  constructor(status: number, message: string, failures?: Array<{ rule: string; message: string }>) {
    super(message);
    this.status = status;
    this.failures = failures;
  }
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. proxy error)
  }

  if (!res.ok) {
    const err = (data ?? {}) as { message?: string; failures?: Array<{ rule: string; message: string }> };
    throw new ApiClientError(res.status, err.message ?? `Request failed (${res.status})`, err.failures);
  }

  return data as T;
}
