# Authentication

This app uses a **JWT access token + refresh token** pattern. Access tokens are short-lived and kept in memory. Refresh tokens are long-lived, stored securely on-device, and rotated on every use.

---

## Token lifecycle

```
Login
  │
  ├─ POST /api/v1/auth/login  { username, password }
  │       └─▶  { accessToken (15m), refreshToken (30d), userId }
  │
  ├─ accessToken  → stored in memory (React state / module variable)
  └─ refreshToken → stored in device Keychain/Keystore (expo-secure-store)


App relaunch
  │
  ├─ Read refreshToken from SecureStore
  ├─ POST /api/v1/auth/refresh  { refreshToken }
  │       └─▶  { accessToken (new), refreshToken (new, rotated) }
  │
  ├─ Store new refreshToken in SecureStore (replaces old one)
  └─ Store new accessToken in memory → user is silently logged in


Authenticated API call
  │
  └─ GET /api/v1/...
       Authorization: Bearer <accessToken>


Access token expires (401 response)
  │
  ├─ API client intercepts 401
  ├─ Silently calls /auth/refresh
  ├─ Retries original request with new accessToken
  └─ If refresh also fails → clear tokens, redirect to login


Logout
  │
  ├─ POST /api/v1/auth/logout  { refreshToken }
  │       └─▶  server removes token from user's refreshTokens array
  └─ Clear accessToken from memory + refreshToken from SecureStore
```

---

## Security properties

| Property | Detail |
|----------|--------|
| Access token storage | Memory only — never written to disk |
| Refresh token storage | `expo-secure-store` → iOS Keychain / Android Keystore (hardware-backed encryption) |
| Refresh token rotation | Every `/auth/refresh` call invalidates the old token and issues a new one |
| Multi-device support | Each device holds its own refresh token; all are stored in `user.refreshTokens[]` |
| Remote logout | Deleting a token from `user.refreshTokens[]` immediately invalidates that device's session |
| Password storage | bcrypt (cost factor 10) — plaintext password never stored |

---

## Backend

### Endpoints

| Method | Path | Auth required | Description |
|--------|------|:---:|-------------|
| `POST` | `/api/v1/auth/login` | No | Exchange credentials for tokens |
| `POST` | `/api/v1/auth/refresh` | No | Rotate refresh token, get new access token |
| `POST` | `/api/v1/auth/logout` | No | Invalidate refresh token |

All other `/api/v1/*` routes can be protected by adding the `requireAuth` middleware.

### Protecting a route

```ts
import { requireAuth } from '../middleware/auth.middleware';

router.get('/protected', requireAuth, (req, res) => {
    // req.user = { userId, username }
    res.send({ userId: req.user!.userId });
});
```

### Environment variables

```env
JWT_ACCESS_SECRET=<random string, 32+ chars>
JWT_REFRESH_SECRET=<different random string, 32+ chars>
```

Use separate secrets so a compromised access secret cannot be used to forge refresh tokens.

Generate strong secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Token payload

```ts
interface TokenPayload {
    userId: string;
    username: string;
}
```

Both access and refresh tokens carry the same payload. The server additionally validates refresh tokens against the stored list in MongoDB before issuing new tokens.

---

## Mobile

### File overview

| File | Role |
|------|------|
| `lib/api.ts` | Fetch wrapper — attaches `Authorization` header, auto-refreshes on `401` and retries |
| `lib/auth.ts` | SecureStore helpers + typed API calls (`loginRequest`, `refreshRequest`, `logoutRequest`) |
| `context/auth.context.tsx` | `AuthProvider` — manages auth state, silent login on launch, exposes `login` / `logout` |
| `app/(auth)/login.tsx` | Login screen |
| `app/_layout.tsx` | Redirects to login when not authenticated |

### Using auth in a component

```tsx
import { useAuth } from '@/context/auth.context';

export function ProfileButton() {
    const { userId, logout } = useAuth();

    return (
        <Button title="Log out" onPress={logout} />
    );
}
```

### Making authenticated API calls

```ts
import { api } from '@/lib/api';

// The Bearer token is attached automatically
const rooms = await api.get<Room[]>('/api/v1/rooms/all');
```

The `api` client automatically:
1. Reads the in-memory access token and adds the `Authorization` header
2. On `401`, calls `/auth/refresh`, updates the stored tokens, and retries the original request once
3. If the retry also fails, clears all tokens and redirects to the login screen

---

## Why not store the access token in SecureStore?

The access token is intentionally kept **in memory only**. SecureStore access is async and requires a device unlock in some configurations. Since access tokens are short-lived (15 minutes), the marginal security benefit of persisting them does not outweigh the added complexity and latency. The refresh token — which is the long-lived credential — is what gets persisted securely.
