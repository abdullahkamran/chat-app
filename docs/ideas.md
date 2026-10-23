# Ideas

Features we want later but haven't planned or built. Each entry says what it is, why we'd want it, and
anything already worked out. Move an idea into a plan (or delete it here) once work starts.

---

## Public posts in the postbox

**What:** a room's postbox can hold public posts as well as private mail. A public post can be read by anyone
who can visit the room. It works like a pinned message or a wall post, for example "Party here Friday 9pm" in a
group room, or a status line in someone's personal room that every friend sees.

**Why:** today a personal room's postbox is private. The owner reads everything, and each visitor sees only
the mail they wrote, so the owner has no way to say something to every friend who drops by.

**How it fits what exists (as of 2026-10-24):**

- Mail lives in `RoomMail` (`apps/backend/src/models/room-mail.model.ts`), and who reads it is decided by
  `visibleTo()` in `apps/backend/src/controllers/mail.controller.ts`. A public post could be a `visibility:
  'public' | 'private'` field on the same model, with `visibleTo()` matching `{ roomId, $or: [{ visibility:
  'public' }, <today's rule>] }`.
- The room owner can't post in their own personal room today (`canPost()`). Public posts would lift that, but
  only for public posts.
- In a group room all mail is already readable by everyone in the room, so "public" there only adds pinning.

**Open questions:**

- Who may make a public post: only the room owner, or any visitor (a guestbook)?
- Pinned or just listed? If pinned: one pin at a time, or several? Does a newer pin replace the old one?
- Shown where: at the top of the postbox popup, or in the room itself (a sign or bubble near the door)?
- Unread: does a new public post badge every visitor's postbox, and push them? Pushing every friend could be
  noisy.
- Expiry: do posts stay until deleted, or expire after a set time like a story?
- Moderation: can the owner delete someone else's public post (they can delete any mail today)?
