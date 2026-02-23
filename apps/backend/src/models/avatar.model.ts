import mongoose, { Document, Schema } from 'mongoose';

// DB-level representation of a single avatar body-part selection.
// item   → ref to an AvatarItem catalog document
// variantId → which variant the user picked (used when serialising the avatar)
export interface IAvatarPart {
    item: mongoose.Types.ObjectId;
    variantId: string;
}

export interface IAvatar extends Document {
    eye: IAvatarPart;
    hair?: IAvatarPart;
    skin: IAvatarPart;
    mouth: IAvatarPart;
    tops: IAvatarPart;
    bottoms: IAvatarPart;
    headwear?: IAvatarPart;
    facewear?: IAvatarPart;
    wristwear?: IAvatarPart;
    footwear?: IAvatarPart;
}

const AvatarPartSchema = new Schema<IAvatarPart>(
    {
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'AvatarItem', required: true },
        variantId: { type: String, required: true },
    },
    { _id: false }
);

const AvatarSchema = new Schema<IAvatar>(
    {
        eye:      { type: AvatarPartSchema, required: true },
        skin:     { type: AvatarPartSchema, required: true },
        mouth:    { type: AvatarPartSchema, required: true },
        tops:     { type: AvatarPartSchema, required: true },
        bottoms:  { type: AvatarPartSchema, required: true },
        hair:      { type: AvatarPartSchema },
        headwear:  { type: AvatarPartSchema },
        facewear:  { type: AvatarPartSchema },
        wristwear: { type: AvatarPartSchema },
        footwear:  { type: AvatarPartSchema },
    },
    { timestamps: true, collection: 'avatars' }
);

const AvatarModel = mongoose.model<IAvatar>('Avatar', AvatarSchema);

export default AvatarModel;
