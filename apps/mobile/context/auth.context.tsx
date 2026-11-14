import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Avatar } from '@chat-app/shared-types';
import { setAccessToken, setTokenRefresher } from '@/lib/api';
import {
    AuthTokens,
    clearRefreshToken,
    loadRefreshToken,
    loginRequest,
    logoutRequest,
    refreshRequest,
    saveRefreshToken,
} from '@/lib/auth';
import { unregisterPushToken } from '@/utils/notifications';

interface AuthState {
    userId: string | null;
    selectedAvatar: Avatar | null;
    isLoading: boolean;
    /** Signing back in on launch couldn't reach the server. The saved session is kept; call retryBoot to try again. */
    bootFailed: boolean;
    retryBoot: () => void;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setSelectedAvatar: (avatar: Avatar | null) => void;
}

const AuthContext = createContext<AuthState>({
    userId: null,
    selectedAvatar: null,
    isLoading: true,
    bootFailed: false,
    retryBoot: () => {},
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
    setSelectedAvatar: () => {},
});

/** The server looked at the refresh token and turned it down, as opposed to not answering at all. */
function isRejected(e: unknown): boolean {
    const status = (e as { status?: number } | null)?.status;
    return status === 400 || status === 401 || status === 403;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [bootFailed, setBootFailed] = useState(false);
    const [bootAttempt, setBootAttempt] = useState(0);

    const applyTokens = useCallback((tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'> & { userId?: string; selectedAvatar?: Avatar | null }) => {
        setAccessToken(tokens.accessToken);
        if (tokens.userId) setUserId(tokens.userId);
        if ('selectedAvatar' in tokens) setSelectedAvatar(tokens.selectedAvatar ?? null);
    }, []);

    // Called by the API client on 401 to silently get a new access token
    const refreshAccessToken = useCallback(async (): Promise<string | null> => {
        try {
            const stored = await loadRefreshToken();
            if (!stored) return null;

            const tokens = await refreshRequest(stored);
            await saveRefreshToken(tokens.refreshToken);
            setAccessToken(tokens.accessToken);
            return tokens.accessToken;
        } catch (e) {
            // Server unreachable: keep the session and let this request fail; the next one tries again
            if (!isRejected(e)) return null;
            // The server turned the token down — sign out
            setAccessToken(null);
            setUserId(null);
            setSelectedAvatar(null);
            await clearRefreshToken();
            return null;
        }
    }, []);

    useEffect(() => {
        setTokenRefresher(refreshAccessToken);
        return () => setTokenRefresher(null);
    }, [refreshAccessToken]);

    // On app launch: try silent login via stored refresh token.
    // Only a rejected token signs you out. If the server can't be reached (e.g. the backend is
    // restarting), keep the token and offer a retry, so a restart doesn't log you out.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stored = await loadRefreshToken();
                console.log(`[boot] saved session: ${stored ? 'yes, signing in' : 'none'}`);
                if (stored) {
                    const tokens = await refreshRequest(stored);
                    await saveRefreshToken(tokens.refreshToken);
                    // Refresh endpoint doesn't return userId — parse it from the token payload
                    const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
                    if (cancelled) return;
                    applyTokens({ ...tokens, userId: payload.userId, selectedAvatar: tokens.selectedAvatar ?? null });
                }
                if (!cancelled) setIsLoading(false);
            } catch (e) {
                if (cancelled) return;
                if (isRejected(e)) {
                    await clearRefreshToken();
                    setIsLoading(false);
                } else {
                    console.warn('Silent sign-in could not reach the server', e);
                    setBootFailed(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [applyTokens, bootAttempt]);

    const retryBoot = useCallback(() => {
        setBootFailed(false);
        setBootAttempt(n => n + 1);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const tokens = await loginRequest(username, password);
        await saveRefreshToken(tokens.refreshToken);
        applyTokens(tokens);
    }, [applyTokens]);

    const logout = useCallback(async () => {
        // While still signed in, so the server accepts it: this device stops getting this account's pushes.
        await unregisterPushToken();
        const stored = await loadRefreshToken();
        if (stored) await logoutRequest(stored).catch(() => {});
        await clearRefreshToken();
        setAccessToken(null);
        setUserId(null);
        setSelectedAvatar(null);
    }, []);

    return (
        <AuthContext.Provider value={{ userId, selectedAvatar, isLoading, bootFailed, retryBoot, isAuthenticated: !!userId, login, logout, setSelectedAvatar }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
