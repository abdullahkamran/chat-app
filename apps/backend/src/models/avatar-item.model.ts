import mongoose, { Document, Model, Schema } from 'mongoose';
import { AvatarItem, AvatarItemVariant } from '@chat-app/shared-types';

export const AvatarCategory = {
    EYE: 'eye',
    FACE: 'face',
    NOSE: 'nose',
    HAIR: 'hair',
    FACIAL_HAIR: 'facialHair',
    SKIN: 'skin',
    MOUTH: 'mouth',
    TOPS: 'tops',
    BOTTOMS: 'bottoms',
    HEADWEAR: 'headwear',
    FACEWEAR: 'facewear',
    WRISTWEAR: 'wristwear',
    FOOTWEAR: 'footwear',
} as const;

export type AvatarCategory = (typeof AvatarCategory)[keyof typeof AvatarCategory];

export interface IAvatarItem extends Omit<AvatarItem, '_id'>, Document {}

const AvatarItemVariantSchema = new Schema<AvatarItemVariant>(
    {
        name: { type: String, required: true },
        sourceUrl: { type: String, default: '' },
        price: {
            coins: { type: Number, default: 0 },
            cash: { type: Number, default: 0 },
            realMoney: { type: Number, default: 0 },
        },
        color: { type: String },
    },
    { _id: true }
);

interface IAvatarItemModel extends Model<IAvatarItem> {}

const AvatarItemSchema = new Schema<IAvatarItem, IAvatarItemModel>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        subCategory: { type: String, default: '' },
        category: {
            type: String,
            enum: Object.values(AvatarCategory),
            required: true,
            index: true,
        },
        variants: [AvatarItemVariantSchema],
        isOverlappable: { type: Boolean, default: false },
    },
    { timestamps: true, collection: 'avatar_items' }
);

const AvatarItemModel = mongoose.model<IAvatarItem, IAvatarItemModel>('AvatarItem', AvatarItemSchema);

export default AvatarItemModel;
