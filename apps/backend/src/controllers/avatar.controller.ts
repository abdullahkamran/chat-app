import { Request, Response } from 'express';
import { Avatar, AvatarItem } from '@chat-app/shared-types';
import AvatarModel, { IAvatar } from '../models/avatar.model';
import AvatarItemModel from '../models/avatar-item.model';
import User from '../models/user.model';

const REQUIRED_PARTS = ['eye', 'face', 'nose', 'skin', 'mouth', 'tops', 'bottoms'] as const;
const OPTIONAL_PARTS = ['hair', 'facialHair', 'headwear', 'facewear', 'wristwear', 'footwear'] as const;
const ALL_PARTS = [...REQUIRED_PARTS, ...OPTIONAL_PARTS] as const;

type AvatarPartKey = (typeof ALL_PARTS)[number];

// Populate all body-part item refs and transform to the shared Avatar type.
// Each body-part's variants array is filtered down to the single selected variant
// so the client sees `avatar.eye.variants[0]` as the active variant.
export async function populateAvatar(avatar: IAvatar): Promise<Avatar> {
    const populatePaths = ALL_PARTS.map((p) => ({ path: `${p}.item` }));
    const populated = await avatar.populate(populatePaths);

    const result: Record<string, unknown> = { _id: avatar._id.toString() };

    for (const part of ALL_PARTS) {
        const partData = (populated as unknown as Record<string, { item: AvatarItem & { toObject(): AvatarItem }; variantId: string } | undefined>)[part];
        if (!partData) continue;

        const item = partData.item;
        const variantId = partData.variantId;
        const selectedVariant = item.variants.find((v) => (v as unknown as { _id: { toString(): string } })._id.toString() === variantId);

        result[part] = {
            ...item.toObject(),
            variants: selectedVariant ? [selectedVariant] : [],
        };
    }

    return result as unknown as Avatar;
}

const avatarController = {
    // GET /avatar/items?category=eye
    getCatalogItems: async (req: Request, res: Response): Promise<void> => {
        try {
            const { category } = req.query;
            const filter = category ? { category } : {};
            const items = await AvatarItemModel.find(filter);
            res.send(items);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    // GET /avatar — all avatars for the logged-in user
    getMyAvatars: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const user = await User.findById(userId).select('avatars selectedAvatar');
            if (!user) { res.sendStatus(404); return; }

            const avatars = await AvatarModel.find({ _id: { $in: user.avatars } });
            const populated = await Promise.all(avatars.map(populateAvatar));
            res.send({ avatars: populated, selectedAvatar: user.selectedAvatar?.toString() ?? null });
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    // POST /avatar — create a new avatar
    createAvatar: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const parts = req.body as Record<string, { itemId: string; variantId: string }>;

            for (const p of REQUIRED_PARTS) {
                if (!parts[p]?.itemId || !parts[p]?.variantId) {
                    res.status(400).send({ error: `${p} is required` });
                    return;
                }
            }

            const avatarData: Record<AvatarPartKey, { item: string; variantId: string }> = {} as never;
            for (const p of ALL_PARTS) {
                if (parts[p]) {
                    avatarData[p] = { item: parts[p].itemId, variantId: parts[p].variantId };
                }
            }

            const avatar = await AvatarModel.create(avatarData);

            const user = await User.findById(userId).select('selectedAvatar');
            const isFirstAvatar = !user?.selectedAvatar;

            await User.findByIdAndUpdate(userId, {
                $addToSet: { avatars: avatar._id },
                ...(isFirstAvatar ? { selectedAvatar: avatar._id } : {}),
            });

            const populated = await populateAvatar(avatar);
            res.status(201).send(populated);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    // PUT /avatar/:id — edit an existing avatar
    editAvatar: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;
            const parts = req.body as Record<string, { itemId: string; variantId: string }>;

            const user = await User.findById(userId).select('avatars');
            const ownsAvatar = user?.avatars.some((a) => a.toString() === id);
            if (!ownsAvatar) {
                res.status(403).send({ error: 'Not your avatar' });
                return;
            }

            const updateData: Partial<Record<AvatarPartKey, { item: string; variantId: string }>> = {};
            for (const p of ALL_PARTS) {
                if (parts[p]) {
                    updateData[p] = { item: parts[p].itemId, variantId: parts[p].variantId };
                }
            }

            const avatar = await AvatarModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
            if (!avatar) { res.sendStatus(404); return; }

            const populated = await populateAvatar(avatar);
            res.send(populated);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    // DELETE /avatar/:id — delete a non-default avatar
    deleteAvatar: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;

            const user = await User.findById(userId).select('avatars selectedAvatar');
            const ownsAvatar = user?.avatars.some((a) => a.toString() === id);
            if (!ownsAvatar) {
                res.status(403).send({ error: 'Not your avatar' });
                return;
            }
            if (user?.selectedAvatar?.toString() === id) {
                res.status(400).send({ error: 'Cannot delete your default avatar' });
                return;
            }

            await AvatarModel.findByIdAndDelete(id);
            await User.findByIdAndUpdate(userId, { $pull: { avatars: id } });
            res.sendStatus(200);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

    // PUT /avatar/:id/set-default — set an avatar as the default
    setDefault: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const { id } = req.params;

            const user = await User.findById(userId).select('avatars');
            const ownsAvatar = user?.avatars.some((a) => a.toString() === id);
            if (!ownsAvatar) {
                res.status(403).send({ error: 'Not your avatar' });
                return;
            }

            await User.findByIdAndUpdate(userId, { selectedAvatar: id });
            res.sendStatus(200);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },
};

export default avatarController;
