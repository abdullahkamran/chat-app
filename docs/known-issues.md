# Known issues

Bugs we've found and deliberately deferred. Each entry says what you see, why it happens, and the likely fix.
Remove an entry when it's fixed and mention the commit.

---

## Room presence (sockets)

Found on 2026-10-10 while testing the Skia room engine with two devices. These are in the socket layer, not
the renderer: the legacy engine shows the same symptoms.

### 1. A room's owner never receives events from their own room

**Seen:** `abdullahk` owns a room and `asadk` is a member. Asad sees Abdullah walk, but Abdullah never sees Asad
at all: no character, no movement, no chat bubbles.

**Why:** on connect, `authenticate` in `apps/backend/src/sockets/socketHandler.ts` builds `memberRoomIds` from
`user.rooms` only, and the socket joins just those channels. Rooms a user owns are stored in `user.ownedRooms`,
so the owner's socket is never in their own room's channel. Sending still works (`socket.to(roomId)` doesn't
require the sender to be joined), which is why traffic flows one way only.

**Fix:** join `user.rooms` and `user.ownedRooms`. The REST side already treats both as membership
(`getDetails` in `room.controller.ts`).

### 2. People already in a room are invisible to a newcomer until they move

**Seen:** Asad enters a room where Abdullah is already standing. Abdullah doesn't appear until he walks.

**Why:** there is no server-side presence. A newcomer only learns who's there when each occupant replies to
its `RECEIVE_ENTER` with a `SEND_POINT` (`handleEnter` in `apps/mobile/hooks/useChat.ts`). In the case above
the reply never happens because of issue 1. Even once issue 1 is fixed, this is fragile:

- the reply is a `SEND_POINT`, so the newcomer sees each occupant spawn at the entry door and walk to where
  they actually are;
- it's broadcast to everyone in the room, not just the newcomer;
- current actions (sitting, emoting, from Phase 4 on) aren't sent at all.

**Fix (long term):** keep presence on the server (who is in each room, their position and current action) and
send the newcomer a snapshot on `SEND_ENTER`. This is already listed as the long-term item under *Known
presence gaps* in the [Room Engine Plan doc](https://claude.ai/code/artifact/cdf82cb3-27c4-48cb-a835-0e85e0fb48d1).

### 3. Joining or creating a room needs a reconnect before its events arrive

**Why:** the socket joins its room channels once, at connection time. A room created, or joined, while the
socket is connected isn't in that list, so its events don't reach this socket until the app reconnects.

**Fix:** join the channel on `SEND_ENTER` (after checking membership) instead of joining every member room up
front. That also stops sockets from receiving traffic for rooms they aren't looking at, which the client
currently filters out by `roomId`.

---

## Dev tooling

### Adding someone to a room needs their raw user ID

Create Room's member field takes MongoDB user IDs, and no screen shows a user's ID. Members can only be set
when a room is created, and there's no way to add them later. To test with two users, get the second user's
ID from the `userId` field of the `POST /api/v1/auth/login` response (test accounts are in
`apps/backend/src/catalog/test-users.catalog.ts`).

**Fix:** accept usernames in the member field, or add a dev-only "invite test users" action.
