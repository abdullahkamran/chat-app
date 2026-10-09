import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/auth.context';
import { SignupPayload, signupRequest } from '@/lib/auth';

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
