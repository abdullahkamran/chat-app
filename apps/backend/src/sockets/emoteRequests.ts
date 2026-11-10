import { randomUUID } from 'node:crypto';
import { MUTUAL_EMOTE_REQUEST_MS } from '@chat-app/shared-types';

/** A mutual emote someone asked for and the other person hasn't answered yet. */
export interface EmoteRequest {
    id: string;
    roomId: string;
    fromUserId: string;
    toUserId: string;
    animation: string;
    expiresAt: number;
    /** Ends the request as `expired` when nobody answers in time. */
    timer: ReturnType<typeof setTimeout>;
}

/**
 * Pending mutual emote requests by id. A user has at most one outgoing request per room: asking again
 * replaces it. Each lapses after MUTUAL_EMOTE_REQUEST_MS.
 *
 * This lives in this process's memory, as do the expiry timers, so with several backend
 * instances a request made on one would be unknown to an answer arriving on another.
 * One instance is all we run today; see docs/known-issues.md.
 */
const requests = new Map<string, EmoteRequest>();

export const emoteRequests = {
    /**
     * Record a new request; `onExpire` runs if nobody answers in time. Returns the request
     * and the asker's earlier one that it replaces, if any (already removed).
     */
    create(
        fields: Omit<EmoteRequest, 'id' | 'expiresAt' | 'timer'>,
        onExpire: (request: EmoteRequest) => void,
    ): { request: EmoteRequest; replaced?: EmoteRequest } {
        const replaced = [...requests.values()].find(r => r.roomId === fields.roomId && r.fromUserId === fields.fromUserId);
        if (replaced) this.take(replaced.id);
        const id = randomUUID();
        const request: EmoteRequest = {
            ...fields,
            id,
            expiresAt: Date.now() + MUTUAL_EMOTE_REQUEST_MS,
            timer: setTimeout(() => {
                const expired = this.take(id);
                if (expired) onExpire(expired);
            }, MUTUAL_EMOTE_REQUEST_MS),
        };
        requests.set(id, request);
        return { request, replaced };
    },

    /** A pending request, left in place. */
    get(id: string): EmoteRequest | undefined {
        return requests.get(id);
    },

    /** Remove a request and stop its timer. Undefined when it already ended. */
    take(id: string): EmoteRequest | undefined {
        const request = requests.get(id);
        if (!request) return undefined;
        clearTimeout(request.timer);
        requests.delete(id);
        return request;
    },

    /** Remove every request in the room that the user made or was asked, and return them. */
    takeAllOf(roomId: string, userId: string): EmoteRequest[] {
        const ended = [...requests.values()].filter(r =>
            r.roomId === roomId && (r.fromUserId === userId || r.toUserId === userId));
        for (const r of ended) this.take(r.id);
        return ended;
    },
};
