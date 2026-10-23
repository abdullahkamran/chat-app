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
2026-10-23 in `df4f4c8` by server-side presence: the server sends a newcomer a snapshot and arbitrates seats
(`apps/backend/src/sockets/roomPresence.ts`). Visitors not seeing a saved layout, staying seated on furniture that moved, and ending up inside
furniture was fixed on 2026-10-23 by `RECEIVE_ROOM_ITEMS_CHANGED` (`announceRoomItemsChanged` in `socketHandler.ts`).

### 1. One user on two devices in the same room shows as one character

**Seen:** Abdullah opens the same room on a phone and a tablet. Others see one character, moved by whichever
device acted last.

**Why:** presence is keyed by user. The later device's enter takes over the entry, and the earlier device's
exit or disconnect is ignored so it can't remove the user (this is what keeps reconnects clean).

**Fix:** key presence by socket and draw one character per device, or refuse a second device in the same room.
Decide this before moving presence to Redis (scaling issue 2): the choice sets the Redis key layout.

### 2. A tap made just as the owner saves a layout can still use the old one

**Seen:** rarely. A visitor taps a chair the moment the owner saves a layout that moves it, and sits on the
chair's old spot. Or a visitor walks during the second before their client has loaded the new layout, and
stops inside furniture that just arrived there. Either lasts until they walk again.

**Why:** the server stands people up and moves them off furniture once, when the layout is saved. A sit is
checked against the room (a DB read) and then claimed, so a save landing between the two misses it (a
check-then-write race). Walk points are never checked against furniture at all; clients plan walks on the
layout they have, which is the old one until the refetch finishes. Found on 2026-10-23.

**Fix:** keep each room's blocked cells and seats in memory next to presence (`roomLayout.ts` already
computes them), refreshed on every save; check sits against them in the same synchronous step as the
claim, and move a walk point that lands on a blocked cell to the nearest free one before relaying it.

---

## Backend: affects the single instance we run today

Found on 2026-10-23 during a review of the backend for scaling. These hurt with one instance too; more
instances make them more likely or more costly.

### 1. Sockets trust the user ID the client sends

**Seen:** a socket connecting with `auth: { id: '<any user id>' }` is accepted as that user and can enter
their rooms, chat, walk and sit as them. It also joins their own channel (`user:<id>`), so it hears which
rooms they are added to and removed from, and when their friends or requests change.

**Why:** `authenticate` in `apps/backend/src/sockets/socketHandler.ts` reads `socket.handshake.auth.id` and
only checks that the user exists. No token is verified, unlike the REST routes (`requireAuth`).

**Fix:** send the JWT access token in the handshake and set `userId` from `verifyAccessToken`. Tokens last
15 minutes, so the client has to reconnect with a refreshed token when the connection is refused for expiry.

### 2. `POST /api/v1/dev/reset` wipes the database without auth

**Seen:** anyone who can reach the server can empty every collection.

**Why:** `devRouter` is mounted unconditionally in `apps/backend/src/index.ts`.

**Fix:** mount it only when `NODE_ENV !== 'production'` (and ideally behind `requireAuth`), or delete it
before the first real deploy.

### 3. Concurrent purchases can spend the same coins twice

**Seen:** two buy requests sent at the same moment both succeed and the balance goes negative.

**Why:** the shop, avatar-shop and animation-shop controllers read the user, check the balance in JS, then
`$inc`. Node interleaves the two requests at the awaits, so both pass the check before either deducts.

**Fix:** make the balance check part of the update, e.g.
`findOneAndUpdate({ _id, 'amount.coins': { $gte: price } }, { $inc: { 'amount.coins': -price }, ... })`, and
treat `null` as insufficient funds. Write the transaction log in the same Mongo session so a failure can't
leave a debit without a record.

### 4. The server starts without a database

**Seen:** if MongoDB is unreachable at boot, the server still listens and every request fails.

**Why:** `apps/backend/src/db/connect.ts` logs the error and returns instead of throwing.

**Fix:** exit the process when the connection fails so the process manager restarts it, and add a readiness
check (see scaling issue 4).

### 5. Push notifications run inline on every message and enter

**Seen:** nothing visible yet. Each chat message loads the room with its members, loads those users, and calls
FCM, inside the socket process. People already in the room are notified about what they're watching.

**Why:** `sendPushToRoom` in `apps/backend/src/services/notification.service.ts` is called from the
`SEND_MESSAGE`, `SEND_ENTER` and `SEND_EXIT` handlers with no batching.

**Fix:** skip users present in the room (room presence knows), debounce per room (e.g. one push per room per
user per minute), and with more traffic move sending to a queue (BullMQ on the scaling Redis).

### 6. No rate limiting

**Seen:** a client can flood `SEND_POINT`, `SEND_MESSAGE`, login or signup without limit.

**Fix:** a per-socket token bucket in the handler for socket events, and `express-rate-limit` on auth routes.
Past one instance the limits must be shared; see scaling issue 5.

### 7. Room membership can be left half-written, and room limits can be dodged

Found on 2026-10-23 while adding search-and-pick on Create Room, adding and removing members, and leaving.

**Seen:**
- If the server fails between two writes, a user can show as a member of a room in its member list but
  be refused at the door, or the other way round.
- A user removed at the same moment they enter can stay visible in the room until they walk out.
- A client can create a room with any `personLimit` and as many rooms as it likes.

**Why:**
- Membership is stored twice: `Room.members` and `User.rooms`. Create, add, remove and leave
  (`room.controller.ts`) write one, then the other, with no transaction. Entering checks `User.rooms`,
  while the member list and `getDetails` read `Room.members` or `User.rooms` depending on the route.
- `SEND_ENTER` checks membership in the DB, then awaits a seat check before it adds the user to presence.
  A removal that lands in that gap evicts nothing (`announceMemberRemoved`), and the enter adds them after.
  Nothing more is relayed to them once the client exits, and they can't re-enter.
- `createRoom` passes the client's `personLimit` to `resolveRoomDefaults` unchecked, and never checks
  `User.maxRooms`. The new member limit is only as strict as that number.

**Fix:**
- Write both sides in one Mongo transaction, or keep one source of truth: drop `User.rooms` and query
  `Room.members` for the room list and the door check.
- In `SEND_ENTER`, check membership again after the last await, or have removals mark the
  room/user pair so a pending enter is refused.
- Clamp `personLimit` to a server maximum, or ignore it until rooms can be upgraded, and refuse
  `createRoom` once `ownedRooms.length >= maxRooms`.

### 8. Smaller items

- **Logging:** every `SEND_POINT` and other room event is `console.log`ged, and morgan defaults to `dev`
  format. Under load that's slow and costly to store. Use a levelled logger (pino) and log room events at debug.
- **`refreshTokens` grows forever:** each login adds one to the user document, and only logout or refresh
  removes one. Drop expired tokens on login, or cap the array (`$push` with `$slice`).
- **CORS is open:** `cors()` allows every origin. Restrict it once there's a web client or admin page.

---

## Friends

Found on 2026-10-24 while adding friend requests, Quick Add, contact matching and inviting people.

### 1. No blocking

**Seen:** someone you don't want can request you again right after you decline, as often as they like
(there's deliberately no cooldown), and can still find you by username or in Quick Add.

**Why:** blocking was left out on purpose. The open question is what it means for rooms you both are in:
hide each other's characters and chat, remove one of you, or stop the owner from adding a blocked person.

**Fix:** decide the room behaviour first. Then store a block as a third `status` on the friendship document
(`blocked`, with `requester` as the blocker), so one record per pair still holds. Have search, Quick Add,
requests and the room member picker skip blocked pairs; every query already filters on `status`.

### 2. Many accounts together can still find which numbers are on the app

**Seen:** nothing yet. A script with many accounts could send numbers to `POST /friends/contacts/sync`
and learn which belong to users who allow being found by number.

**Why:** the cap is per account (10 syncs a day, 3000 numbers each), and signup doesn't verify the phone
number or limit how many accounts one person makes.

**Fix:** verify phone numbers with a one-time code at signup, rate-limit signup and sync per IP or device,
and watch for accounts that sync but never add anyone.

### 3. Numbers saved before E.164 normalization won't match contacts

**Seen:** a user created before 2026-10-24 whose number isn't stored as `+<country><number>` never shows up
as "In your contacts".

**Why:** signup now stores E.164 (`toE164` in `apps/backend/src/services/phone.service.ts`), but existing
documents weren't rewritten. The seeded test users are already E.164.

**Fix:** a one-off script that rewrites each `phoneNumber` with `toE164`, and reports the ones it can't parse
(those are missing a country code and need the user to fix them).

---

## Scaling past one backend instance

We run one instance and will fix these before running more. Nothing here shows today.

### 1. Socket.IO's long-polling handshake needs sticky sessions

**Seen (with two instances):** connections fail with "Session ID unknown" and reconnect in a loop.

**Why:** the client (`io(SERVER_ORIGIN, ...)` in `apps/mobile/components/RoomListScreen.tsx`) uses the default
transports, which start with HTTP long-polling and upgrade to WebSocket. The polling requests of one session
must reach the same instance, and a load balancer spreads them out.

**Fix:** set `transports: ['websocket']` on the client (React Native has native WebSockets, so polling buys
nothing), or enable sticky sessions on the load balancer.

### 2. Rooms only work with a single backend instance

**Seen (with two instances):** users in the same room stop seeing each other whenever they're connected to
different instances: no enters, walks or chat between them, snapshots missing people, and two users able to
take the same seat.

**Why:** two things live in one process's memory. Room presence (`apps/backend/src/sockets/roomPresence.ts`)
is a `Map` per process, so each instance only knows its own sockets. And Socket.IO's default adapter only
broadcasts to sockets on the same instance, so relays (`socket.to(roomId)`) never cross instances. The same goes for layout saves: `announceRoomItemsChanged` only places the people this instance knows and tells only its own sockets. And for membership and friends: the added, removed, members-changed and friends-changed events only reach this instance's sockets, and `announceMemberRemoved` only takes out a removed user standing in the room on this instance. On another instance, the removed user stays and is still relayed to until they exit. With the Redis adapter, evict with `io.in(userChannel).socketsLeave(roomId)` plus a broadcast that tells each instance to drop the user from presence and its sockets' `presentRoomIds`.

**Fix:** add Redis, decide room presence issue 1 first, and keep `roomPresence`'s API (made async) so the
handlers barely change:

- the Socket.IO Redis adapter (`@socket.io/redis-adapter`, or `@socket.io/redis-streams-adapter` to survive
  brief Redis outages without losing packets), so room broadcasts reach every instance;
- presence in a hash per room (`room:{id}:presence`, field = user, value = JSON with the owning socket id and
  instance id). `own` and `leave` become compare-and-set / compare-and-delete Lua scripts on the socket id;
- seats in a hash per room (`room:{id}:seats`): claim with `HSETNX`, which is atomic, so two instances can't
  both grant a seat; release with a "delete if still mine" Lua script;
- each instance refreshes a heartbeat key (`instance:{id}`, ~15 s TTL). Snapshots skip and clean up entries
  whose instance key has expired, so a crashed instance's users don't linger.

Ordering: the enter handler takes the snapshot and joins with no await in between. With Redis, presence reads
and writes are async, so another instance can broadcast in that gap. Join the channel first, then read the
snapshot, and make the client treat enter, point and exit as idempotent (an enter for someone already drawn
updates them; an exit for someone already gone is ignored).

### 3. Every instance runs the catalog sync on boot

**Seen (with N instances):** each deploy runs the sync N times at once, including
`grantDefaultAnimationsToAll()`, an `updateMany({})` over every user.

**Why:** `syncCatalog()` runs in `main()` in `apps/backend/src/index.ts`. Unique indexes on `name` and
`username` prevent duplicates, but the work and the full-collection update repeat.

**Fix:** run it as a one-off job or migration per deploy, or guard it with a Redis lock
(`SET catalog-sync <id> NX EX 120`).

### 4. No health checks or graceful shutdown

**Seen (with rolling deploys):** an orchestrator can't tell a booting or broken instance from a ready one, and
each deploy drops sockets abruptly. Once presence is in Redis, a stopped instance's users stay visible until the
heartbeat expires.

**Fix:** add `/healthz` (process alive) and `/readyz` (MongoDB and Redis connected). On SIGTERM: fail
readiness, stop accepting connections, `io.close()`, remove this instance's presence entries, then exit.

### 5. Rate limits and other per-process state must be shared

**Why:** a limit kept in one process's memory lets a client get N times the limit across N instances.

**Fix:** keep counters in Redis (`rate-limiter-flexible` supports both sockets and Express). Check any new
in-memory `Map`, cache or timer for the same problem.

### 6. Static assets served from instance disk

**Seen:** nothing; `/wearables` is in the image, so every instance has the same files.

**Fix:** with more traffic, put the atlases on object storage behind a CDN. They're already versioned
(`?v=<atlasVersion>`) and served as immutable, so the move only changes the base URL.

### 7. Username search reads every user

**Seen (with many users):** `GET /api/v1/users/search` gets slower as the user count grows, and the load
grows with every keystroke from every client searching.

**Why:** it matches `^<query>` case-insensitively (`$options: 'i'`). MongoDB can't use the `username`
index's bounds for a case-insensitive regex, so it scans the whole index. Found on 2026-10-23.

**Fix:** store a lowercased `usernameLower` with an index (set on signup, backfill once) and match
`^<lowercased query>` against it without `i`. That's an index range scan. Rate-limit search per user
(scaling issue 5).

### 8. Quick Add is worked out from scratch on every open

**Seen (with more users and friends):** `GET /api/v1/friends/suggestions` slows down, and it runs every time
someone opens Add Friends and after every friend change.

**Why:** `suggestionsFor` in `apps/backend/src/services/friend.service.ts` reads all of the user's friendships,
up to 5000 friendships of their friends, and every room they're in, then counts in memory. Found on 2026-10-24.

**Fix:** cache each user's list for a few minutes (in Redis once we have it, so every instance shares it) and
drop it when their friends, rooms or contact matches change. With much more traffic, compute suggestions in a
background job.
