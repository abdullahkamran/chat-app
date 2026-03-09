import mongoose, { Document, Model, Schema } from 'mongoose';
import { Item, ItemPlacement, ItemAction, ItemState } from '@chat-app/shared-types';

// Override _id and states: the const object (typeof ItemState) can't be stored in Mongo; we store the active state as a string
export interface IItem extends Omit<Item, '_id' | 'states'>, Document {
    states: string;
}

interface IItemModel extends Model<IItem> {
    getAll(): Promise<IItem[]>;
}

const ItemSchema = new Schema<IItem, IItemModel>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        category: { type: String, required: true, index: true },
        placement: {
            type: String,
            enum: Object.values(ItemPlacement),
            required: true,
        },
        dimensions: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            z: { type: Number, default: 0 },
        },
        price: {
            coins: { type: Number, default: 0 },
            cash: { type: Number, default: 0 },
            realMoney: { type: Number, default: 0 },
        },
        variant: {
            name: { type: String, default: '' },
            description: { type: String, default: '' },
        },
        action: {
            type: String,
            enum: Object.values(ItemAction),
            default: ItemAction.NONE,
        },
        states: { type: String, enum: Object.values(ItemState), default: ItemState.NONE },
        isOverlappable: { type: Boolean, default: false },
        assetUrl: { type: String, default: '' },
        canOwnMultiple: { type: Boolean, default: false },
    },
    { timestamps: true, collection: 'items' }
);

ItemSchema.statics.getAll = function () {
    return this.find({});
};

const ItemModel = mongoose.model<IItem, IItemModel>('Item', ItemSchema);

export default ItemModel;
