# Known issues

Bugs we've found and deliberately deferred. Each entry says what you see, why it happens, and the likely fix.
Remove an entry when it's fixed and mention the commit.

---

## Room presence (sockets)

Found on 2026-10-10 while testing the Skia room engine with two devices. These are in the socket layer, not
the renderer. Two earlier entries (owners never hearing their own room, and rooms joined while connected
staying silent until a reconnect) were fixed on 2026-10-22 by joining a room's channel on `SEND_ENTER`
after a membership check. A third (people already in a room appearing at the door and walking to their spot,
replies broadcast to the whole room, emotes in progress not sent, two users taking one seat) was fixed on
2026-10-23 by server-side presence: the server sends a newcomer a snapshot and arbitrates seats
(`apps/backend/src/sockets/roomPresence.ts`).

### 1. One user on two devices in the same room shows as one character

**Seen:** Abdullah opens the same room on a phone and a tablet. Others see one character, moved by whichever
device acted last.

**Why:** presence is keyed by user. The later device's enter takes over the entry, and the earlier device's
exit or disconnect is ignored so it can't remove the user (this is what keeps reconnects clean).

**Fix:** key presence by socket and draw one character per device, or refuse a second device in the same room.

### 2. Rooms only work with a single backend instance

**Seen:** nothing yet; we run one instance. Run two behind a load balancer and users in the same room stop
seeing each other whenever they're connected to different instances: no enters, walks or chat between them,
snapshots missing people, and two users able to take the same seat.

**Why:** two things live in one process's memory. Room presence (`apps/backend/src/sockets/roomPresence.ts`)
is a `Map` per process, so each instance only knows its own sockets. And Socket.IO's default adapter only
broadcasts to sockets on the same instance, so relays (`socket.to(roomId)`) never cross instances.

**Fix:** before running more than one instance, add Redis:

- the Socket.IO Redis adapter (`@socket.io/redis-adapter`), so room broadcasts reach every instance;
- presence in Redis, e.g. a hash per room keyed by user, with the owning socket id in each entry;
- the seat claim as one atomic Redis step (a Lua script or `WATCH`/`MULTI`), so two instances can't both
  grant a seat;
- clear a dead instance's entries, e.g. with a TTL refreshed while the socket is alive, or by listing the
  live sockets on startup.

The handler's ordering also relies on the in-memory adapter joining at once (no await between the snapshot
and the join). With Redis, `join` is async, so the snapshot and join need re-checking, e.g. join first and
drop relayed events the snapshot already covers.

---

## Dev tooling

### Adding someone to a room needs their raw user ID

Create Room's member field takes MongoDB user IDs, and no screen shows a user's ID. Members can only be set
when a room is created, and there's no way to add them later. To test with two users, get the second user's
ID from the `userId` field of the `POST /api/v1/auth/login` response (test accounts are in
`apps/backend/src/catalog/test-users.catalog.ts`).

**Fix:** accept usernames in the member field, or add a dev-only "invite test users" action.
