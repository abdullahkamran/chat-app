import { myFetch } from '@/utils/fetch';

// In-memory access token — set by AuthContext, never persisted to disk
let _accessToken: string | null = null;
let _refresher: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
    _accessToken = token;
}

export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
    _refresher = fn;
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 10000): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (_accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
        res = await myFetch(path, { ...options, headers, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }

    // Auto-refresh on 401 and retry once
    if (res.status === 401 && _refresher) {
        const newToken = await _refresher();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            res = await myFetch(path, { ...options, headers });
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
    }

    if (res.status === 204 || res.status === 205) return null as T;
    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
