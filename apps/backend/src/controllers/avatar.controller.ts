import { Request, Response } from 'express';
import { AVATAR_NAME_MAX_LENGTH, Avatar, AvatarItem, MAX_AVATARS, WearableAsset } from '@chat-app/shared-types';
import AvatarModel, { IAvatar } from '../models/avatar.model';
import AvatarItemModel from '../models/avatar-item.model';
import User from '../models/user.model';
import { AVATAR_DEFAULTS_CATALOG } from '../catalog/avatar-defaults.catalog';

const REQUIRED_PARTS = ['eye', 'face', 'nose', 'skin', 'mouth', 'tops', 'bottoms'] as const;
const OPTIONAL_PARTS = ['hair', 'facialHair', 'headwear', 'facewear', 'wristwear', 'neckwear', 'footwear'] as const;
const ALL_PARTS = [...REQUIRED_PARTS, ...OPTIONAL_PARTS] as const;

type AvatarPartKey = (typeof ALL_PARTS)[number];

const avatarLimitMessage = `You can have up to ${MAX_AVATARS} avatars. Delete one to make a new one.`;

type AvatarBody = Record<string, unknown> & { name?: unknown };

/**
 * The `name` in a create or edit body: `undefined` when the body has none (leave it as is),
 * `null` when it's blank (clear it), the trimmed name otherwise. Throws a user-facing message
 * when it isn't a string or is too long.
 */
function parseAvatarName(body: AvatarBody): string | null | undefined {
    if (body.name === undefined) return undefined;
    if (body.name !== null && typeof body.name !== 'string') throw new Error('Name must be text');
    const name = (body.name ?? '').trim();
    if (name.length > AVATAR_NAME_MAX_LENGTH) throw new Error(`Name can be at most ${AVATAR_NAME_MAX_LENGTH} characters`);
    return name || null;
}

// Populate all body-part item refs and transform to the shared Avatar type.
// Each body-part's variants array is filtered down to the single selected variant
// so the client sees `avatar.eye.variants[0]` as the active variant.
export async function populateAvatar(avatar: IAvatar): Promise<Avatar> {
    const populatePaths = ALL_PARTS.map((p) => ({ path: `${p}.item` }));
    const populated = await avatar.populate(populatePaths);

    const result: Record<string, unknown> = { _id: avatar._id.toString() };
    if (avatar.name) result.name = avatar.name;

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
    // GET /avatar/defaults — resolve default item+variant ids for each required part
    getDefaults: async (_req: Request, res: Response): Promise<void> => {
        try {
            // rigAsset lets the editor's Skia preview draw the defaults before anything is saved.
            const result: Record<string, { itemId: string; variantId: string; sourceUrl: string | null; color: string | null; rigAsset: WearableAsset | null }> = {};
            for (const [category, name] of Object.entries(AVATAR_DEFAULTS_CATALOG)) {
                const item = await AvatarItemModel.findOne({ name });
                if (!item) continue;
                const variant = item.variants[0] as unknown as { _id: { toString(): string }; sourceUrl?: string; color?: string; rigAsset?: WearableAsset };
                result[category] = {
                    itemId:    item._id.toString(),
                    variantId: variant._id.toString(),
                    sourceUrl: variant.sourceUrl ?? null,
                    color:     variant.color ?? null,
                    rigAsset:  variant.rigAsset ?? null,
                };
            }
            res.send(result);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    },

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

            let name: string | null | undefined;
            try { name = parseAvatarName(req.body as AvatarBody); } catch (e) {
                res.status(400).send({ error: (e as Error).message });
                return;
            }

            for (const p of REQUIRED_PARTS) {
                if (!parts[p]?.itemId || !parts[p]?.variantId) {
                    res.status(400).send({ error: `${p} is required` });
                    return;
                }
            }

            const avatarData: Partial<Record<AvatarPartKey, { item: string; variantId: string }>> & { name?: string } = {};
            for (const p of ALL_PARTS) {
                if (parts[p]) {
                    avatarData[p] = { item: parts[p].itemId, variantId: parts[p].variantId };
                }
            }
            if (name) avatarData.name = name;

            const user = await User.findById(userId).select('avatars selectedAvatar');
            if (!user) { res.sendStatus(404); return; }
            if (user.avatars.length >= MAX_AVATARS) {
                res.status(400).send({ error: avatarLimitMessage });
                return;
            }
            const isFirstAvatar = !user.selectedAvatar;

            const avatar = await AvatarModel.create(avatarData);

            // The limit is part of the filter so two creates racing past the check above
            // can't both land: only one matches while the array still has room.
            const added = await User.findOneAndUpdate(
                { _id: userId, [`avatars.${MAX_AVATARS - 1}`]: { $exists: false } },
                {
                    $push: { avatars: avatar._id },
                    ...(isFirstAvatar ? { selectedAvatar: avatar._id } : {}),
                },
            );
            if (!added) {
                await AvatarModel.findByIdAndDelete(avatar._id);
                res.status(400).send({ error: avatarLimitMessage });
                return;
            }

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

            let name: string | null | undefined;
            try { name = parseAvatarName(req.body as AvatarBody); } catch (e) {
                res.status(400).send({ error: (e as Error).message });
                return;
            }

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

            const update: Record<string, unknown> = { $set: { ...updateData, ...(name ? { name } : {}) } };
            if (name === null) update.$unset = { name: 1 };

            const avatar = await AvatarModel.findByIdAndUpdate(id, update, { new: true, runValidators: true });
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
