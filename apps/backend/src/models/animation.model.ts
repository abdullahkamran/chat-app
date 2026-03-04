import mongoose, { Document, Schema } from 'mongoose';
import { Animation, AnimationCategory } from '@chat-app/shared-types';

export interface IAnimation extends Omit<Animation, '_id'>, Document {}

const AnimationSchema = new Schema<IAnimation>(
    {
        name: { type: String, required: true, unique: true },
        category: {
            type: String,
            enum: Object.values(AnimationCategory),
            required: true,
        },
        price: {
            coins: { type: Number, default: 0 },
            cash: { type: Number, default: 0 },
            realMoney: { type: Number, default: 0 },
        },
    },
    {
        collection: 'animations',
    }
);

const AnimationModel = mongoose.model<IAnimation>('Animation', AnimationSchema);

export default AnimationModel;
