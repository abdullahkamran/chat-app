import { PublicUser } from "./user.types";

/** A stored relationship between two users. */
export const FriendshipStatus = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
} as const;

export type FriendshipStatus = (typeof FriendshipStatus)[keyof typeof FriendshipStatus];

/** How another user relates to the viewer. Decides the button shown next to them. */
export type FriendRelation =
    /** Nothing between them: "Add". */
    | 'none'
    /** The viewer sent a request that is still pending: "Requested". */
    | 'requested'
    /** They sent the viewer a request: "Accept". */
    | 'incoming'
    | 'friends';

/** Another user, with how they relate to the viewer. */
export interface RelatedUser extends PublicUser {
    relation: FriendRelation;
}

/** Someone in the viewer's Quick Add (`GET /friends/suggestions`), with why they're suggested. */
export interface FriendSuggestion extends RelatedUser {
    /** Their number is in the viewer's contacts. */
    inContacts: boolean;
    mutualFriends: number;
    /** Rooms both are in. */
    sharedRooms: number;
}

/** A pending request someone sent the viewer (`GET /friends/requests`). */
export interface IncomingFriendRequest {
    user: PublicUser;
    sentAt: Date;
}
