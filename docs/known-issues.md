# Known issues

Bugs we've found and deliberately deferred. Each entry says what you see, why it happens, and the likely fix.
Remove an entry when it's fixed and mention the commit.

---

## Room presence (sockets)

Found on 2026-10-10 while testing the Skia room engine with two devices. These are in the socket layer, not
the renderer. Two earlier entries (owners never hearing their own room, and rooms joined while connected
staying silent until a reconnect) were fixed on 2026-10-22 by joining a room's channel on `SEND_ENTER`
after a membership check.

### 1. People already in a room appear at the door and walk to where they are

**Seen:** Asad enters a room where Abdullah is already standing. Abdullah appears at the entry door and walks
to his spot.

**Why:** there is no server-side presence. A newcomer only learns who's there when each occupant replies to
its `RECEIVE_ENTER` (`announceMe` in `apps/mobile/hooks/useChat.ts`). This is fragile:

- the reply is a `SEND_POINT` (or, for a seated user, a `SEND_ACTION`), so the newcomer sees each occupant
  spawn at the entry door and walk to their spot or seat;
- it's broadcast to everyone in the room, not just the newcomer;
- an emote in progress isn't sent, and two users can take the same seat because nobody arbitrates.

**Fix (long term):** keep presence on the server (who is in each room, their position and current action) and
send the newcomer a snapshot on `SEND_ENTER`. This is the long-term item under *Known presence gaps* in the
[Room Engine Plan doc](https://claude.ai/code/artifact/cdf82cb3-27c4-48cb-a835-0e85e0fb48d1).

---

## Dev tooling

### Adding someone to a room needs their raw user ID

Create Room's member field takes MongoDB user IDs, and no screen shows a user's ID. Members can only be set
when a room is created, and there's no way to add them later. To test with two users, get the second user's
ID from the `userId` field of the `POST /api/v1/auth/login` response (test accounts are in
`apps/backend/src/catalog/test-users.catalog.ts`).

**Fix:** accept usernames in the member field, or add a dev-only "invite test users" action.
