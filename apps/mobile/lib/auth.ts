import * as SecureStore from 'expo-secure-store';
import { useMutation } from '@tanstack/react-query';
import { Avatar } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from './api';

const REFRESH_TOKEN_KEY = 'refreshToken';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    userId: string;
    selectedAvatar: Avatar | null;
}

// ── Storage abstraction ───────────────────────────────────────────────────────
// Priority: SecureStore (iOS/Android) → localStorage (web) → memory (fallback)

const memoryStore = new Map<string, string>();

async function secureGet(key: string): Promise<string | null> {
    try {
        const value = await SecureStore.getItemAsync(key);
        return value || null;
    } catch {
        // Web or outdated Expo Go — fall back to localStorage then memory
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key) || null;
        }
        return memoryStore.get(key) ?? null;
    }
}

async function secureSet(key: string, value: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(key, value);
    } catch {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        } else {
            memoryStore.set(key, value);
        }
    }
}

async function secureClear(key: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(key, '');
    } catch {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        } else {
            memoryStore.delete(key);
        }
    }
}

// ── Public helpers ───────────────────────────────────────────────────────────

export async function saveRefreshToken(token: string) {
    await secureSet(REFRESH_TOKEN_KEY, token);
}

export async function loadRefreshToken(): Promise<string | null> {
    return secureGet(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken() {
    await secureClear(REFRESH_TOKEN_KEY);
}

// ── Auth API calls ───────────────────────────────────────────────────────────

export async function loginRequest(username: string, password: string): Promise<AuthTokens> {
    return api.post<AuthTokens>('/api/v1/auth/login', { username, password });
}

export async function refreshRequest(refreshToken: string): Promise<Pick<AuthTokens, 'accessToken' | 'refreshToken'>> {
    return api.post('/api/v1/auth/refresh', { refreshToken });
}

export async function logoutRequest(refreshToken: string) {
    return api.post('/api/v1/auth/logout', { refreshToken });
}

export interface SignupPayload {
    username: string;
    password: string;
    email: string;
    phoneNumber: string;
    city: string;
    state: string;
    country: string;
}

export async function signupRequest(payload: SignupPayload): Promise<void> {
    await api.post('/api/v1/auth/signup', payload);
}

// ── React Query mutation hooks ────────────────────────────────────────────────

export function useLoginMutation() {
    const { login } = useAuth();
    return useMutation({
        mutationFn: ({ username, password }: { username: string; password: string }) =>
            login(username, password),
    });
}

export function useSignupMutation() {
    const { login } = useAuth();
    return useMutation({
        mutationFn: async (payload: SignupPayload) => {
            await signupRequest(payload);
            await login(payload.username, payload.password);
        },
    });
}

export function useLogoutMutation() {
    const { logout } = useAuth();
    return useMutation({
        mutationFn: logout,
    });
}
