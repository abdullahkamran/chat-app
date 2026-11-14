/** What a push is about. Travels as `data.type`. */
export type PushType =
    | 'message'          // chat message in a room you belong to
    | 'visit'            // a friend visited your personal room
    | 'mail'             // mail left in a postbox you read
    | 'added'            // you were added to a room
    | 'owner'            // you were made a room owner
    | 'friend_request'   // someone sent you a friend request
    | 'friend_accepted'; // someone accepted yours

/**
 * Android notification channels, one per kind, so users can silence a kind in system settings.
 * The app creates them on start; the backend names one on every push.
 */
export type PushChannelId = 'messages' | 'activity' | 'social';

export const PUSH_CHANNEL_OF: Record<PushType, PushChannelId> = {
    message: 'messages',
    visit: 'activity',
    mail: 'activity',
    added: 'social',
    owner: 'social',
    friend_request: 'social',
    friend_accepted: 'social',
};

/** The `data` every push carries. FCM data values are strings only. */
export interface PushData {
    type: PushType;
    /** Set for room pushes; tapping opens this room. */
    roomId?: string;
    senderUserId?: string;
}
