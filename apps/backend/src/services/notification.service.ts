import admin from '../config/firebase';
import Room from '../models/room.model';
import User from '../models/user.model';

export async function sendPushToRoom(
    roomId: string,
    senderUserId: string,
    payload: { title: string; body: string; type: string }
): Promise<void> {
    try {
        if (!admin.apps.length) return;

        const room = await Room.findById(roomId).select('members');
        if (!room) return;

        const memberIds = room.members
            .map((id) => id.toString())
            .filter((id) => id !== senderUserId);

        await sendPushToUsers(memberIds, payload, { roomId, senderUserId });
    } catch (e) {
        console.error('Push notification error:', e);
    }
}

/** Push to these users' devices. `data` travels with the notification (with `type` added). */
export async function sendPushToUsers(
    userIds: string[],
    payload: { title: string; body: string; type: string },
    data: Record<string, string>,
): Promise<void> {
    try {
        if (!admin.apps.length || userIds.length === 0) return;

        const users = await User.find({ _id: { $in: userIds } }).select('pushTokens');
        const tokens = users.flatMap((u) => u.pushTokens ?? []);

        if (tokens.length === 0) return;

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: { ...data, type: payload.type },
            tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        if (response.failureCount > 0) {
            const invalidTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code;
                    if (
                        code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered'
                    ) {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                await User.updateMany(
                    { pushTokens: { $in: invalidTokens } },
                    { $pull: { pushTokens: { $in: invalidTokens } } }
                );
            }
        }
    } catch (e) {
        console.error('Push notification error:', e);
    }
}
