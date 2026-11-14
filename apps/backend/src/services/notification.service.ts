import { PUSH_CHANNEL_OF, type PushType } from '@chat-app/shared-types';
import type { MulticastMessage } from 'firebase-admin/messaging';
import admin from '../config/firebase';
import Room from '../models/room.model';
import User from '../models/user.model';
import { roomPresence } from '../sockets/roomPresence';

/** FCM takes at most this many tokens per multicast. */
const MULTICAST_LIMIT = 500;

/** Longest message or mail text a push shows before cutting it off with "…". */
export const PUSH_PREVIEW_LENGTH = 100;

export function pushPreview(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > PUSH_PREVIEW_LENGTH ? `${flat.slice(0, PUSH_PREVIEW_LENGTH)}…` : flat;
}

export interface PushPayload {
    title: string;
    body: string;
    type: PushType;
    /**
     * Pushes with the same key replace each other on the device instead of stacking, e.g. one
     * notification per room for chat, showing the latest message.
     */
    replaceKey?: string;
}

/**
 * Push a chat message to the room's members, skipping the sender and anyone in the room right now
 * (they're watching it happen). Titled with the room's name.
 */
export async function sendMessagePush(roomId: string, sender: { userId: string; username: string }, text: string): Promise<void> {
    try {
        if (!admin.apps.length) return;

        const room = await Room.findById(roomId).select('name members');
        if (!room) return;

        const away = room.members
            .map((id) => id.toString())
            .filter((id) => id !== sender.userId && !roomPresence.has(roomId, id));

        await sendPushToUsers(
            away,
            { title: room.name, body: `${sender.username}: ${pushPreview(text)}`, type: 'message', replaceKey: `message:${roomId}` },
            { roomId, senderUserId: sender.userId },
        );
    } catch (e) {
        console.error('Push notification error:', e);
    }
}

/** Push to these users' devices. `data` travels with the notification (with `type` added). */
export async function sendPushToUsers(
    userIds: string[],
    payload: PushPayload,
    data: Record<string, string>,
): Promise<void> {
    try {
        if (!admin.apps.length || userIds.length === 0) return;

        const users = await User.find({ _id: { $in: userIds } }).select('pushTokens');
        const tokens = [...new Set(users.flatMap((u) => u.pushTokens ?? []))];
        if (tokens.length === 0) return;

        const channelId = PUSH_CHANNEL_OF[payload.type];
        const groupId = data.roomId ?? payload.type;
        const message: Omit<MulticastMessage, 'tokens'> = {
            notification: { title: payload.title, body: payload.body },
            data: { ...data, type: payload.type },
            android: {
                priority: 'high',
                notification: { channelId, tag: payload.replaceKey },
            },
            apns: {
                headers: payload.replaceKey ? { 'apns-collapse-id': payload.replaceKey } : undefined,
                // thread-id groups a room's notifications together on iOS.
                payload: { aps: { sound: 'default', threadId: groupId } },
            },
        };

        const dead: string[] = [];
        for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
            const batch = tokens.slice(i, i + MULTICAST_LIMIT);
            const response = await admin.messaging().sendEachForMulticast({ ...message, tokens: batch });
            response.responses.forEach((resp, idx) => {
                const code = resp.error?.code;
                if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
                    dead.push(batch[idx]);
                } else if (resp.error) {
                    console.warn(`Push to a ${payload.type} recipient failed: ${code} ${resp.error.message}`);
                }
            });
        }

        if (dead.length > 0) {
            await User.updateMany({ pushTokens: { $in: dead } }, { $pull: { pushTokens: { $in: dead } } });
        }
    } catch (e) {
        console.error('Push notification error:', e);
    }
}
