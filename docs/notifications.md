# Notifications

Push notifications through Firebase Cloud Messaging (FCM) on both platforms. This doc records how it works,
what's sent, what's left, and how to set it up. Update it as decisions land.

**Status (2026-11-12): built, not yet tested on a device.** The app registers FCM tokens and handles pushes
again. Nothing has run on a phone yet: that needs the credentials in [Setup](#setup) and a dev build.

**Decision (2026-11-12): FCM directly, not Expo's push service.** A chat app needs full control of the
platform payload (replacing a room's notification, iOS threads, later silent badge updates), no middleman's
rate limits on the busiest path, and the backend sender already existed. The cost is more native setup in the
app (React Native Firebase, dynamic frameworks on iOS).

---

## How it's wired

```
mobile                                         backend                                   FCM
──────                                         ───────                                   ───
registerForPushNotifications()
  channels, permission (expo-notifications)
  getToken() (@react-native-firebase/messaging)
  ──POST /api/v1/users/push-token──────────▶  User.pushTokens
                                                (taken off any other account first)
  onTokenRefresh → POST again
                                               chat message, visit, mail, friend, room event
                                                 └─ sendPushToUsers() ──sendEachForMulticast──▶ devices
                                                      (500 tokens a call; prunes dead tokens)
logout → DELETE /api/v1/users/push-token
```

Two libraries in the app, split so each notification is handled exactly once:

| | Firebase Messaging | expo-notifications |
|---|---|---|
| Token | FCM token on both platforms | not used |
| Permission, Android channels | | ✓ |
| Push arrives, app in background or closed | OS shows it | |
| Push arrives, app open, Android | `onMessage` → we show a local banner | shows the banner |
| Push arrives, app open, iOS | forwards to expo-notifications | handler shows it |
| Tap on an OS-shown push | `onNotificationOpenedApp`, `getInitialNotification` | ignored (iOS reports it too) |
| Tap on our local banner | | response listener, `getLastNotificationResponseAsync` |

In both foreground paths a push for the room on screen isn't shown. Tapping opens `/room/{roomId}` (unless
you're already in it).

On Android, both libraries declare an FCM receiving service; expo-notifications gives its own priority -1 so
Firebase's wins. On iOS, Firebase's notification delegate forwards to the one it found (expo-notifications).
Both are worth confirming on a device.

### Backend

| Piece | File | Notes |
|---|---|---|
| Firebase Admin init | [config/firebase.ts](../apps/backend/src/config/firebase.ts) | Service account JSON from the path in `FIREBASE_SERVICE_ACCOUNT_KEY`. Unset or unreadable → logs it and pushes are disabled; the server still starts. |
| Send | [services/notification.service.ts](../apps/backend/src/services/notification.service.ts) | `sendPushToUsers(userIds, { title, body, type, replaceKey? }, data)`, and `sendMessagePush` for chat. Sets the Android channel per type, Android `tag` / iOS `apns-collapse-id` from `replaceKey`, iOS `thread-id` per room. Errors are logged and swallowed. |
| Types and channels | [notification.types.ts](../packages/shared-types/src/notification.types.ts) | `PushType`, `PushChannelId`, `PUSH_CHANNEL_OF`, shared with the app. |
| Token storage | [user.model.ts](../apps/backend/src/models/user.model.ts) | `User.pushTokens: string[]`, indexed, stripped from JSON. |
| Token routes | [user.route.ts](../apps/backend/src/routes/user.route.ts), [user.controller.ts](../apps/backend/src/controllers/user.controller.ts) | `POST` and `DELETE /api/v1/users/push-token`, body `{ token }`. Saving a token removes it from every other account, so a shared phone only gets the last user's pushes. |

### Mobile

| Piece | File | Notes |
|---|---|---|
| Everything push | [utils/notifications.ts](../apps/mobile/utils/notifications.ts) | `configureNotifications`, `registerForPushNotifications`, `listenForNotifications`, `unregisterPushToken`, `setActivePushRoom`. No-ops on web. |
| Root wiring | [app/_layout.tsx](../apps/mobile/app/_layout.tsx) | Configures at startup; registers and listens once signed in; passes the active room. |
| Logout | [auth.context.tsx](../apps/mobile/context/auth.context.tsx) | Removes the token before signing out. |
| Native config | [app.json](../apps/mobile/app.json) | Plugins `@react-native-firebase/app` and `/messaging`, `expo-notifications`; iOS `useFrameworks: "dynamic"` (Firebase Apple SDK 13+ is Swift Package Manager only) and the `remote-notification` background mode. |

---

## What's sent

| `type` | Trigger | Who gets it | Title | Body | Channel |
|---|---|---|---|---|---|
| `message` | Chat message in a room | Members except the sender and anyone in the room | room name | `<username>: <text>` (100 chars) | messages |
| `visit` | A friend enters your personal room (not a reconnect; at most once per friend per 10 min; not if you're there) | Owner | room name | `<username> visited your room` | activity |
| `mail` | Mail left in a postbox | Readers not in the room | room name | `<username> left a mail: <text>` | activity |
| `added` | You're added to a room | Added users | room name | `<username> added you to the room` | social |
| `owner` | You're made an owner | That user | room name | (varies) | social |
| `friend_request` | Friend request received | Recipient | `Friends` | `<username> sent you a friend request` | social |
| `friend_accepted` | Your request accepted | Requester | `Friends` | `<username> accepted your friend request` | social |

A room's message pushes replace each other: you see the latest message per room, not a stack. Every push
carries `data: { type, senderUserId, roomId? }`.

`visit` and `mail` also reach the app by socket and show as an in-app toast.

Deliberately **not** sent: enter and exit (removed 2026-11-12, too noisy), disconnects, walking, sitting,
emotes, typing, avatar changes.

---

## Setup

What's needed, where it comes from, and where it goes. The two Firebase app files and the service account
are gitignored; never commit them.

| # | What | Where to get it | Where it goes |
|---|---|---|---|
| 1 | Android app config, `google-services.json` | Firebase console → Project settings → General → Your apps → Android app `com.kamico.chatapp` → download | `apps/mobile/google-services.json` |
| 2 | iOS app config, `GoogleService-Info.plist` | Same page → iOS app `com.kamico.chatapp` → download | `apps/mobile/GoogleService-Info.plist` |
| 3 | Backend service account | Firebase console → Project settings → Service accounts → Generate new private key | `apps/backend/firebase-service-account.json`, and `FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-service-account.json` in `apps/backend/.env` |
| 4 | APNs auth key (iOS only) | Apple Developer → Certificates, Identifiers & Profiles → Keys → new key with Apple Push Notifications service → download the `.p8` (once only), note the Key ID and Team ID | Upload in Firebase console → Project settings → Cloud Messaging → Apple app configuration |
| 5 | Push capability (iOS only) | Apple Developer → Identifiers → `com.kamico.chatapp` → enable Push Notifications | Expo prebuild / EAS adds the entitlement |

All of 1–3 must come from the **same** Firebase project, and the app IDs must match `com.kamico.chatapp`.

**Changing the app ID.** It's `com.kamico.chatapp`, set as `ios.bundleIdentifier` and `android.package` in
`app.json` (and the Play link under `extra.invite`). Before the app is in a store it can change freely: set the
new ID in those three places, register Android and iOS apps with the new ID in the same Firebase project,
download 1 and 2 again, enable Push Notifications for the new identifier at Apple (5; the APNs key in 4 works
for every app on the team), and rebuild. Installed builds under the old ID stay as a separate app. Once
published, a store listing's ID can never change: a new ID means a new app that users install separately.

Then build and run on a physical device: `npx expo prebuild --clean` once (the native config changed), then
`npx expo run:android` / `npx expo run:ios`, or an EAS dev build. Pushes don't work in Expo Go or on
simulators.

**Checking it works:** the backend logs `Firebase Admin ready for project …` on start. Log in on the phone and
allow notifications: the user's `pushTokens` in Mongo gets an entry. Send a friend request to that user from
another account with the app in the background: the push arrives. Then a chat message in a shared room with
the app closed, tap it, and the room opens.

---

## Left to do

- **Device testing** on both platforms, especially the two-library split (Android receiving service, iOS
  delegate forwarding) and cold-start taps.
- **Permission is asked right at login,** with no explanation first. On iOS a refusal is hard to reverse.
  Better: a short pre-prompt after joining a first room or sending a first friend request.
- **No user controls** beyond the Android channels in system settings: no global toggle, per-room mute or
  quiet hours.
- **Message pushes aren't debounced.** Each message replaces the room's notification but still buzzes and
  costs a send. See [known-issues](known-issues.md), backend issue 5.
- **The message is gone when you open it.** Chat is ephemeral, so a tapped message isn't shown in the room.
  The push shows the latest text, which is the best we have without storing chat.
- **No tests** for the service or the token routes.
- Scaling: skipping people in the room only sees this instance's presence (known-issues, scaling issue 13).

## Recommended next

Agreed 2026-11-12; none built yet. In the order we'd build them:

| # | What | Today | Decide first |
|---|---|---|---|
| 1 | **Grouped messages:** "3 new messages in *Lobby*", sent after a room goes quiet instead of per message | Partly: a room's push replaces its last one, but it shows only the latest message, sends on every message and has no count | Quiet period (suggest 1–2 min) |
| 2 | **Settings:** in-app toggle per kind (matching the Android channels), per-room mute, global off, quiet hours; stored on the user | Partly: Android channels can be silenced in phone settings; nothing in-app, nothing on iOS | |
| 3 | **"Friends are hanging out":** "Sara and 2 others are in *Lobby*" when friends gather in a room you can join | Not started. Needs 2 and rate limits first | How many friends make a gathering; how often it may push (suggest once per room per few hours) |
| 4 | **Ask for permission at a better moment:** a short Tide explanation screen after joining a first room or sending a first friend request, then the OS prompt | Not started; asks right at login | |
| 5 | **@mentions,** delivered even when the room's messages are muted | Not started; chat has no mention syntax | How a mention is typed and picked |
| 6 | **Visit summaries:** "4 friends visited your room today", as an option instead of a push per visit | Not started; one push per visit, at most every 10 min per friend | |
| 7 | **Badges** once there's server-side unread state; FCM can send silent updates for them | Not started | What counts as unread |
| 8 | **Shop and rewards,** opt-in only: new items, coin rewards | Waits on those features | |

Test what's built on a device before starting these.

Not planned: pushes for being removed from a room or a room being deleted. The in-app announcement is enough.
