import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Item } from '@chat-app/shared-types';
import { AppText, Button, IconButton } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { resolveItemSource } from '@/constants/avatarAssets';
import { formatPrice } from '@/utils/formatPrice';

interface ItemDetailModalProps {
    item: Item | null;
    visible: boolean;
    onClose: () => void;
    onBuy?: (itemId: string) => void;
    isBuying?: boolean;
    /** Copies the user owns, free and placed. */
    ownedCount?: number;
    /** Of those, copies standing in rooms. */
    placedCount?: number;
}

/** "You own 3 (2 placed in rooms)." */
function ownedLine(owned: number, placed: number): string {
    const where = placed === 0 ? '' : placed === owned ? ` (${owned === 1 ? "it's" : 'all'} placed in rooms)` : ` (${placed} placed in rooms)`;
    return `You own ${owned}${where}.`;
}

const useStyles = makeStyles(t => ({
    overlay: {
        flex: 1,
        backgroundColor: t.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: t.space.xl,
    },
    dialog: {
        backgroundColor: t.colors.surfaceElevated,
        borderRadius: t.radius.xl,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        width: '100%',
        maxWidth: 360,
        overflow: 'hidden',
        ...t.shadows.floating,
    },
    imageStage: {
        height: 200,
        margin: t.space.md,
        marginBottom: 0,
        borderRadius: t.radius.lg,
        backgroundColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemImage: {
        width: '86%',
        height: '86%',
    },
    closeBtn: {
        position: 'absolute',
        top: t.space.lg + 4,
        right: t.space.lg + 4,
    },
    content: {
        padding: t.space.xl,
        paddingTop: t.space.lg,
        gap: t.space.md,
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: t.space.sm,
    },
    metaCell: {
        flexBasis: '47%',
        flexGrow: 1,
        gap: 2,
        padding: 10,
        borderRadius: t.radius.md,
        backgroundColor: t.colors.surface,
    },
    metaValue: {
        textTransform: 'capitalize',
    },
    ownedNotice: {
        borderRadius: t.radius.md,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        backgroundColor: t.colors.secondarySoft,
    },
}));

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
    const styles = useStyles();
    return (
        <View style={styles.metaCell}>
            <AppText variant="overline" color="textMuted">{label}</AppText>
            <AppText variant="label" style={styles.metaValue}>{value}</AppText>
        </View>
    );
}

export default function ItemDetailModal({ item, visible, onClose, onBuy, isBuying, ownedCount = 0, placedCount = 0 }: ItemDetailModalProps) {
    const styles = useStyles();
    const source = item ? resolveItemSource(item.assetUrl) : null;
    // Most items can be bought again; the rest only once.
    const canBuyMore = !!item?.canOwnMultiple || ownedCount === 0;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.dialog} onPress={() => {}}>
                    <View style={styles.imageStage}>
                        {source && <Image source={source} style={styles.itemImage} contentFit="contain" />}
                    </View>

                    <IconButton icon="close" variant="surface" size={36} style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close" />

                    {item && (
                        <View style={styles.content}>
                            <AppText variant="title">{item.name}</AppText>
                            {item.description ? (
                                <AppText color="textSecondary">{item.description}</AppText>
                            ) : null}

                            <View style={styles.metaGrid}>
                                <Meta label="Category" value={item.category} />
                                <Meta label="Placement" value={item.placement} />
                                <Meta label="Action" value={item.action} />
                                <Meta label="Size" value={`${item.dimensions.x} × ${item.dimensions.y} × ${item.dimensions.z}`} />
                            </View>

                            {/* How many the buyer already has, before they buy another */}
                            {onBuy && ownedCount > 0 && (
                                <View style={styles.ownedNotice}>
                                    <AppText variant="caption" color="secondary" align="center">
                                        {ownedLine(ownedCount, placedCount)}{' '}
                                        {canBuyMore ? 'Buying another adds a copy to your inventory.' : 'You can only have one.'}
                                    </AppText>
                                </View>
                            )}

                            {/* Buy button: only in the shop */}
                            {onBuy ? (
                                <Button
                                    title={canBuyMore ? `Buy · ${formatPrice(item.price)}` : 'Owned'}
                                    icon={canBuyMore ? undefined : 'checkmark'}
                                    variant={canBuyMore ? 'reward' : 'secondary'}
                                    size="lg"
                                    fullWidth
                                    loading={isBuying}
                                    disabled={!canBuyMore}
                                    onPress={() => onBuy(item._id)}
                                />
                            ) : (
                                <AppText variant="label" color="reward">{formatPrice(item.price)}</AppText>
                            )}
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
