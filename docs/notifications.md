# Notifications

Push notifications through Firebase Cloud Messaging (FCM). This doc records what exists today, what's broken,
and the questions we need to answer to spec the feature. Update it as decisions land.

**Status (2026-10-23): not working end to end.** The backend sends pushes, but the mobile app never registers
a token, so no user has one and every send returns early. The client code was commented out in `cfdbe92`
(2026-02-23) and has stayed that way.

---

## How it's wired

```
mobile                                   backend                                  FCM
──────                                   ───────                                  ───
registerForPushNotificationsAsync()                                               
  ask permission, get device token                                                
savePushTokenToServer(token) ──POST /api/v1/users/push-token──▶ User.pushTokens   
                                                                ($addToSet)       
                                         socket event (message/enter/exit)        
                                           └─ sendPushToRoom() ──sendEachForMulticast──▶ devices
                                                prune tokens FCM says are dead
```

### Backend

| Piece | File | Notes |
|---|---|---|
| Firebase Admin init | [apps/backend/src/config/firebase.ts](../apps/backend/src/config/firebase.ts) | Reads the service account JSON from `FIREBASE_SERVICE_ACCOUNT_KEY`. Unset → logs a warning and pushes are disabled. |
| Send | [apps/backend/src/services/notification.service.ts](../apps/backend/src/services/notification.service.ts) | `sendPushToRoom(roomId, senderUserId, { title, body, type })`. Loads the room's `members`, drops the sender, collects every token, multicasts. Removes tokens FCM reports as invalid or unregistered. Errors are logged and swallowed. |
| Token storage | [apps/backend/src/models/user.model.ts](../apps/backend/src/models/user.model.ts) | `User.pushTokens: string[]`, stripped from JSON responses. |
| Token routes | [apps/backend/src/routes/user.route.ts](../apps/backend/src/routes/user.route.ts), [user.controller.ts](../apps/backend/src/controllers/user.controller.ts) | `POST` and `DELETE /api/v1/users/push-token`, body `{ token }`, auth required. |
| Triggers | [apps/backend/src/sockets/socketHandler.ts](../apps/backend/src/sockets/socketHandler.ts) | See [When pushes are sent](#when-pushes-are-sent-today). |

### Mobile

| Piece | File | Notes |
|---|---|---|
| Register / save / remove token | [apps/mobile/utils/notifications.ts](../apps/mobile/utils/notifications.ts) | Requests permission, gets the native device token (`getDevicePushTokenAsync`, not an Expo push token), creates the Android `default` channel. Physical devices only. |
| Root wiring | [apps/mobile/app/_layout.tsx](../apps/mobile/app/_layout.tsx) | **All commented out**: the foreground handler, token registration on login, and tap-to-open-room. |
| Active room tracking | [apps/mobile/context/activeRoom.context.ts](../apps/mobile/context/activeRoom.context.ts), [apps/mobile/app/room/[roomId].tsx](../apps/mobile/app/room/[roomId].tsx) | Room screen sets `activeRoomId` so the foreground handler can hide pushes for the room you're in. Still runs, but nothing reads it. |
| Native config | [apps/mobile/app.json](../apps/mobile/app.json) | `expo-notifications` plugin; `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in `apps/mobile/`, both gitignored. |

Setup steps are in the [README](../README.md#push-notifications). Pushes need a dev client build; they don't
work in Expo Go or on simulators.

---

## When pushes are sent today

The first three go to every room **member** except the sender, on every device they've registered (a personal
room has no members, so none of them fire there).

| Trigger | Socket event | Title | Body | `data.type` |
|---|---|---|---|---|
| Someone sends a chat message in a room | `SEND_MESSAGE` | `New message` | the raw message text | `message` |
| Someone enters a room | `SEND_ENTER` (after the access check passes) | `Room activity` | `Someone entered the room` | `enter` |
| Someone leaves a room on purpose | `SEND_EXIT` (only if they really left) | `Room activity` | `Someone left the room` | `exit` |
| A friend enters your personal room | `SEND_ENTER`, not a reconnect re-entry; skipped if you're in the room, and at most once per friend per 10 minutes | room name | `<username> visited your room` | `visit` |
| Someone leaves mail in a room's postbox | `POST /api/v1/rooms/:roomId/mail`; to its readers (personal room: the owner; group room: owner and members) who aren't in the room | room name | `<username> left a mail: <first 100 chars>` | `mail` |

The last two also reach the app by socket, to the user's own channel (`RECEIVE_ROOM_VISITED`,
`RECEIVE_ROOM_MAIL`), and show as an in-app toast ([`Toast.tsx`](../apps/mobile/components/Toast.tsx)). That
part works today, without push.

Every push carries `data: { roomId, type, senderUserId }`.

Deliberately **not** sent: disconnects (flaky networks would spam it), walking, sitting, emotes, typing,
avatar changes.

The client was meant to (now commented out):

- **In the foreground:** hide a push for the room you're viewing, show the rest as banners. No badge.
- **On tap:** open `/room/{roomId}`.

---

## Issues

### Blocking: nothing gets delivered

1. **Client side commented out.** No token is ever registered, so `sendPushToRoom` always finds zero tokens.
   Re-enabling needs the fixes below too; the commented handler references `activeRoomIdRef`, which no longer
   exists.
2. **iOS tokens are the wrong kind.** On iOS `getDevicePushTokenAsync()` returns an APNs token, not an FCM
   token, and `admin.messaging()` rejects APNs tokens. Android works. Fix: get FCM tokens on iOS
   (`@react-native-firebase/messaging`), or switch both platforms to Expo push tokens and the Expo push
   service (then `firebase-admin` isn't needed on the backend).

### Wrong recipients

3. **Room owners never get pushes.** Recipients come from `room.members`, but the creator is stored as
   `ownerId` (and in their own `ownedRooms`), not in `members`.
4. **People in the room get pushed too.** The server doesn't skip users who are in the room right now, even
   though it knows who is (`roomPresence`). The only planned guard was client-side and only for the room on
   screen. Better to skip present users on the server.
5. **Tokens outlive logout.** `removePushTokenFromServer` exists but `logout()` in
   [auth.context.tsx](../apps/mobile/context/auth.context.tsx) never calls it. If someone else logs in on that
   phone, it gets both accounts' pushes.
6. **Token rotation isn't handled.** No `addPushTokenListener`; a rotated token is only picked up on the next
   app start (once registration is re-enabled). FCM prunes the old one on the next failed send.

### Spam and content

7. **Enter/exit pushes are noisy.** Every enter pushes every other member, and that includes re-entering
   after a reconnect (the app re-sends `SEND_ENTER`). Busy rooms would flood people.
8. **Pushes don't say who or where.** No sender name or room name: "New message" with the text, or "Someone
   entered the room". The service only has IDs and would need to look up names.
9. **Message text isn't trimmed** and can be long. It also shows on the lock screen with no privacy option.
10. **The message is gone when you open it.** Chat is ephemeral speech bubbles kept for a few seconds
    (`roomPresence.addMessage`), not stored. Tapping a message push opens a room where the message isn't
    shown.
11. **No user controls.** No global toggle, per-room mute, or quiet hours. The only way out is the OS
    permission.
12. **Permission is asked right at login,** with no explanation screen first. On iOS a refusal is hard to
    reverse.

### Robustness and cost

13. **Every chat message costs two DB reads** (room with members, then users) before the multicast, with no
    rate limiting or batching. `sendEachForMulticast` also caps at 500 tokens per call; large rooms would
    fail.
14. **A bad service account path crashes startup.** `readFileSync`/`JSON.parse` in `firebase.ts` throw
    instead of falling back to "push disabled".
15. **Android channel is created after the token is fetched** and server payloads don't set `channelId`.
    Works because `default` is used anyway, but there's only one channel, so users can't silence one kind
    (e.g. activity) separately.
16. **No tap handling when the app was killed.** The commented listener only catches taps while the app is
    running; a cold start from a push needs `getLastNotificationResponseAsync()`.
17. **No tests** for the service or the token routes.

---

## Open questions for the spec

**What should notify?**

- Chat messages: every message, only after a quiet period, or a digest ("5 new messages in Lobby")?
- Enter/exit: drop them, keep them only for friends, or only for rooms you own?
- New candidates: added to a room, friend request or accept, @mentions, someone entering your room while
  you're away.

**Who gets it?**

- Skip people already in the room (server side)? Skip anyone online in the app?
- Owners included (yes, presumably)?
- Rooms you've favourited only (`favouriteRooms`)?

**What does it say?**

- Format, e.g. title `<room name>`, body `<username>: <message>`. Length limit?
- Lock screen privacy: allow hiding the content?

**What happens on tap?**

- Open the room. How do we show the message that caused it, given chat isn't stored? Persist recent
  messages, or put the text in the push and show it on arrival?

**Controls**

- Global on/off, per-room mute, per-kind toggles (messages vs activity), quiet hours. Stored where (user
  model)?
- When and how to ask for permission (pre-prompt screen, after joining a first room)?
- Badge count: unread rooms? Needs a server-side unread state we don't have.

**Platform**

- Stay on FCM (fix iOS with `@react-native-firebase/messaging`) or move to Expo push (one token type, no
  Firebase Admin)?
- Android channels: one per kind (messages, activity)?
