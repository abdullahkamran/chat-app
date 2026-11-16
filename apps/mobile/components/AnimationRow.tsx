import React, { useCallback, useState } from 'react';
// From expo-router, not @react-navigation/native: the router keeps its own navigation context.
import { useIsFocused } from 'expo-router';
import { View } from 'react-native';
import { Animation, AnimationCategory, EmoteType } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { AppText, Skeleton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { emoteLabel } from '@/lib/room-engine/components/EmoteDrawer';
import { INTERACTIVE_EMOTES, MUTUAL_EMOTES } from '@/lib/room-engine/session/emotes';
import { CLIPS, type ClipId } from '@/lib/room-engine/engines/skia/skeleton/clips';
import AvatarPreview from './AvatarPreview';

/** Preview canvas: square, so sideways moves (moonwalk) and jumps stay in frame. */
const PREVIEW_SIZE = 96;

const CATEGORY_LABEL: Record<string, string> = {
    EMOTE: 'Emote',
    WALK: 'Walk',
    SIT: 'Sit',
};

/** "EMOTE" → "Emote", for tags and category chips. */
export function animationCategoryLabel(category: string): string {
    return CATEGORY_LABEL[category] ?? category;
}

const TYPE_LABEL: Partial<Record<EmoteType, string>> = {
    [EmoteType.MUTUAL]: 'With a friend',
    [EmoteType.INTERACTIVE]: 'Throwable',
};

/** The clip that shows off an animation: the asker's half of a mutual emote, the throw of a thrown one. */
export function previewClipOf(anim: Pick<Animation, 'name' | 'category'>): ClipId {
    if (anim.category === AnimationCategory.WALK) return 'walk';
    if (anim.category === AnimationCategory.SIT) return 'sit';
    const clip = MUTUAL_EMOTES[anim.name]?.initiatorClip ?? INTERACTIVE_EMOTES[anim.name]?.throwClip ?? anim.name;
    return clip in CLIPS ? (clip as ClipId) : 'idle';
}

/** "thumbsUp" → "Thumbs up". */
export function animationTitle(name: string): string {
    const label = emoteLabel(name);
    return label.charAt(0).toUpperCase() + label.slice(1);
}

const VIEWABILITY = { itemVisiblePercentThreshold: 30 };

/**
 * Which animations of a FlatList are on screen, by id, so only those previews animate: each
 * animated preview runs its own frame loop. Spread `listProps` onto the FlatList.
 *
 * Nothing counts as visible while `active` is false (another segment is open) or the screen
 * is out of focus (another app tab, or a screen pushed on top), so every preview stops. The
 * set is cleared then too, so a list mounted later starts still until it reports its rows.
 */
export function useVisibleIds(active: boolean) {
    const focused = useIsFocused();
    const live = active && focused;
    const [visible, setVisible] = useState<ReadonlySet<string>>(NONE);
    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Animation }[] }) => {
        setVisible(new Set(viewableItems.map(v => v.item._id)));
    }, []);
    // FlatList needs the same pair for its whole life.
    const [pairs] = useState(() => [{ viewabilityConfig: VIEWABILITY, onViewableItemsChanged }]);
    // Leaving the segment unmounts its list, which reports nothing more: forget its rows.
    if (!active && visible !== NONE) setVisible(NONE);
    return { visible: live ? visible : NONE, listProps: { viewabilityConfigCallbackPairs: pairs } };
}

const NONE: ReadonlySet<string> = new Set();

interface Props {
    animation: Animation;
    /** Play the preview; pass whether the row is on screen. */
    animated: boolean;
    /** Shown under the description: the shop's buy button. */
    action?: React.ReactNode;
}

/** An animation in the shop or inventory, played by the user's current avatar. */
export default function AnimationRow({ animation, animated, action }: Readonly<Props>) {
    const styles = useStyles();
    const { selectedAvatar } = useAuth();
    const typeLabel = animation.emoteType ? TYPE_LABEL[animation.emoteType] : undefined;
    const title = animationTitle(animation.name);

    return (
        <View style={styles.row}>
            <View style={styles.stage} accessible accessibilityLabel={`Your avatar doing ${title.toLowerCase()}`}>
                <AvatarPreview
                    avatar={selectedAvatar}
                    size={PREVIEW_SIZE}
                    width={PREVIEW_SIZE}
                    clip={previewClipOf(animation)}
                    animated={animated}
                />
            </View>
            <View style={styles.info}>
                <AppText variant="heading" numberOfLines={1}>{title}</AppText>
                {animation.description ? (
                    <AppText variant="caption" color="textSecondary" numberOfLines={3}>{animation.description}</AppText>
                ) : null}
                <View style={styles.tags}>
                    <Tag label={animationCategoryLabel(animation.category)} />
                    {typeLabel && <Tag label={typeLabel} />}
                </View>
                {action && <View style={styles.action}>{action}</View>}
            </View>
        </View>
    );
}

function Tag({ label }: Readonly<{ label: string }>) {
    const styles = useStyles();
    return (
        <View style={styles.tag}>
            <AppText variant="overline" color="textSecondary">{label}</AppText>
        </View>
    );
}

/** A placeholder row shaped like AnimationRow. */
export function AnimationRowSkeleton({ withAction = false }: Readonly<{ withAction?: boolean }>) {
    const styles = useStyles();
    return (
        <View style={[styles.row, styles.skeletonRow]}>
            <Skeleton width={PREVIEW_SIZE} height={PREVIEW_SIZE} radius="md" />
            <View style={[styles.info, styles.skeletonInfo]}>
                <Skeleton width="50%" height={16} radius="xs" />
                <Skeleton width="90%" height={10} radius="xs" />
                <Skeleton width="70%" height={10} radius="xs" />
                {withAction && <Skeleton width={96} height={36} radius="pill" />}
            </View>
        </View>
    );
}

const useStyles = makeStyles(t => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        marginHorizontal: t.space.lg,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
        ...t.shadows.sticker,
    },
    stage: {
        borderRadius: t.radius.md,
        backgroundColor: t.colors.surfaceElevated,
        overflow: 'hidden',
    },
    info: { flex: 1, gap: t.space.xs },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs, marginTop: 2 },
    tag: {
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        backgroundColor: t.colors.surfaceElevated,
    },
    action: { alignSelf: 'flex-start', marginTop: t.space.xs },
    skeletonRow: { borderColor: t.colors.surface },
    skeletonInfo: { gap: t.space.sm },
}));
