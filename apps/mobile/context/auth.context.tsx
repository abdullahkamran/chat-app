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

interface AuthState {
    userId: string | null;
    selectedAvatar: Avatar | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setSelectedAvatar: (avatar: Avatar | null) => void;
}

const AuthContext = createContext<AuthState>({
    userId: null,
    selectedAvatar: null,
    isLoading: true,
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
    setSelectedAvatar: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        } catch {
            // Refresh failed — force logout
            setAccessToken(null);
            setUserId(null);
            setSelectedAvatar(null);
            await clearRefreshToken();
            return null;
        }
    }, []);

    // On app launch: try silent login via stored refresh token
    useEffect(() => {
        setTokenRefresher(refreshAccessToken);

        (async () => {
            try {
                const stored = await loadRefreshToken();
                if (stored) {
                    const tokens = await refreshRequest(stored);
                    await saveRefreshToken(tokens.refreshToken);
                    // Refresh endpoint doesn't return userId — parse it from the token payload
                    const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
                    applyTokens({ ...tokens, userId: payload.userId, selectedAvatar: tokens.selectedAvatar ?? null });
                }
            } catch {
                await clearRefreshToken();
            } finally {
                setIsLoading(false);
            }
        })();

        return () => setTokenRefresher(null);
    }, [applyTokens, refreshAccessToken]);

    const login = useCallback(async (username: string, password: string) => {
        const tokens = await loginRequest(username, password);
        await saveRefreshToken(tokens.refreshToken);
        applyTokens(tokens);
    }, [applyTokens]);

    const logout = useCallback(async () => {
        const stored = await loadRefreshToken();
        if (stored) await logoutRequest(stored).catch(() => {});
        await clearRefreshToken();
        setAccessToken(null);
        setUserId(null);
        setSelectedAvatar(null);
    }, []);

    return (
        <AuthContext.Provider value={{ userId, selectedAvatar, isLoading, isAuthenticated: !!userId, login, logout, setSelectedAvatar }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
