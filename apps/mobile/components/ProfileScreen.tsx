import React, { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, MAX_AVATARS } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/useMe';
import { MY_AVATARS_KEY, avatarLabel, useMyAvatars, useWearAvatar } from '@/hooks/useMyAvatars';
import { makeStyles, useTheme, type ThemeColors } from '@/constants/theme';
import AvatarPreview from '@/components/AvatarPreview';
import UserAvatar from '@/components/UserAvatar';
import { AppText, Button, Dialog, EmptyState, IconButton, Spinner, showDialog, showErrorDialog } from '@/components/ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, icon, color }: { label: string; value: number; icon: IconName; color: keyof ThemeColors }) {
    const t = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.statTile}>
            <Ionicons name={icon} size={16} color={t.colors[color]} />
            <AppText variant="title" color={color}>{value}</AppText>
            <AppText variant="overline" color="textMuted">{label}</AppText>
        </View>
    );
}

// ── Currency row ──────────────────────────────────────────────────────────────

function CurrencyTile({ label, value, icon, tone }: {
    label: string; value: number; icon: IconName; tone: 'reward' | 'secondary';
}) {
    const t = useTheme();
    const styles = useStyles();
    const c = tone === 'reward'
        ? { color: 'reward' as const, soft: t.colors.rewardSoft, on: t.colors.onReward }
        : { color: 'secondary' as const, soft: t.colors.secondarySoft, on: t.colors.onSecondary };
    return (
        <View style={[styles.currencyTile, { backgroundColor: c.soft, borderColor: t.colors[c.color] }]}>
            <View style={[styles.currencyIcon, { backgroundColor: t.colors[c.color] }]}>
                <Ionicons name={icon} size={16} color={c.on} />
            </View>
            <View>
                <AppText variant="heading" color={c.color}>{value.toLocaleString()}</AppText>
                <AppText variant="caption" color="textSecondary">{label}</AppText>
            </View>
        </View>
    );
}

// ── Avatar tile ───────────────────────────────────────────────────────────────

/** Tap wears it, long press deletes it (not the worn one), the corner icon edits it. */
function AvatarTile({ avatar, index, isWorn, isWearing, onWear, onEdit, onDelete }: {
    avatar: Avatar;
    index: number;
    isWorn: boolean;
    isWearing: boolean;
    onWear: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const styles = useStyles();
    const label = avatarLabel(avatar, index);
    return (
        <Pressable
            onPress={isWorn ? undefined : onWear}
            onLongPress={isWorn ? undefined : onDelete}
            style={[styles.avatarTile, isWorn && styles.avatarTileWorn]}
            accessibilityRole="button"
            accessibilityState={{ selected: isWorn }}
            accessibilityLabel={label}
            accessibilityHint={isWorn ? undefined : 'Tap to wear, hold to delete'}
        >
            <View>
                <AvatarPreview avatar={avatar} size={84} animated={false} />
                {isWearing && (
                    <View style={styles.tileSpinner}>
                        <Spinner size="small" />
                    </View>
                )}
            </View>
            <AppText variant="label" color={isWorn ? 'primary' : 'textSecondary'} numberOfLines={1} style={styles.tileName}>{label}</AppText>
            <IconButton
                icon="brush"
                variant="surface"
                size={30}
                style={styles.editBtn}
                onPress={onEdit}
                accessibilityLabel={`Edit ${label}`}
            />
        </Pressable>
    );
}

function NewAvatarTile({ onPress }: { onPress: () => void }) {
    const t = useTheme();
    const styles = useStyles();
    return (
        <Pressable onPress={onPress} style={[styles.avatarTile, styles.newTile]} accessibilityRole="button" accessibilityLabel="New avatar">
            <Ionicons name="add-circle" size={36} color={t.colors.primary} />
            <AppText variant="label" color="textSecondary">New</AppText>
        </Pressable>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
    const t = useTheme();
    const styles = useStyles();
    const { userId, selectedAvatar, logout } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const userQuery = useMe();

    const discoverableMutation = useMutation({
        mutationFn: (discoverableByPhone: boolean) => api.patch('/api/v1/users/me', { discoverableByPhone }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['user', userId] }),
        onError: (e: Error) => showErrorDialog(e, 'Could not save'),
    });

    const avatarsQuery = useMyAvatars();
    const setDefaultMutation = useWearAvatar();

    const deleteMutation = useMutation({
        mutationFn: (avatarId: string) => api.delete(`/api/v1/avatar/${avatarId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_AVATARS_KEY });
        },
        onError: (e: Error) => showErrorDialog(e, 'Could not delete'),
    });

    const handleDelete = (avatar: Avatar) => {
        showDialog({
            title: 'Delete this avatar?',
            message: "This can't be undone.",
            icon: 'trash',
            tone: 'error',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(avatar._id) },
            ],
        });
    };

    const handleLogout = () => setLogoutModalVisible(true);

    const user = userQuery.data;
    const avatarData = avatarsQuery.data;
    const avatars = avatarData?.avatars ?? [];
    const defaultAvatarId = selectedAvatar?._id ?? avatarData?.selectedAvatar ?? null;
    const canCreate = avatars.length < MAX_AVATARS;
    const createAvatar = () => router.push('/(avatar)/create');

    if (userQuery.isLoading) {
        return (
            <View style={styles.centered}>
                <Spinner size="large" />
            </View>
        );
    }

    const location = user ? [user.city, user.state, user.country].filter(Boolean).join(', ') : '';

    return (
        <>
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.header}>
                <UserAvatar username={user?.username ?? '?'} size={84} />
                <AppText variant="display" align="center">{user?.username ?? '—'}</AppText>
                {location ? (
                    <View style={styles.location}>
                        <Ionicons name="location-outline" size={14} color={t.colors.textSecondary} />
                        <AppText variant="label" color="textSecondary">{location}</AppText>
                    </View>
                ) : null}
            </View>

            {/* Stats */}
            {user && (
                <View style={styles.statsRow}>
                    <StatTile label="Level" value={user.level} icon="star" color="reward" />
                    <StatTile label="Popular" value={user.popularity} icon="heart" color="primary" />
                    <StatTile label="Drip" value={user.drip} icon="water" color="secondary" />
                    <StatTile label="Respecc" value={user.respecc} icon="thumbs-up" color="success" />
                </View>
            )}

            {/* Currency */}
            {user && (
                <View style={styles.currencyRow}>
                    <CurrencyTile label="Coins" value={user.amount.coins} icon="star" tone="reward" />
                    <CurrencyTile label="Cash" value={user.amount.cash} icon="cash" tone="secondary" />
                </View>
            )}

            {/* Avatars */}
            <View style={styles.sectionHeader}>
                <AppText variant="title">Avatars</AppText>
                <AppText variant="label" color="textMuted">{avatars.length}/{MAX_AVATARS}</AppText>
            </View>

            {avatarsQuery.isLoading ? (
                <Spinner style={styles.avatarLoader} />
            ) : avatars.length === 0 ? (
                <EmptyState
                    icon="happy-outline"
                    title="No avatars yet"
                    body="Create one to start hanging out."
                    action={<Button title="Create avatar" icon="add" onPress={createAvatar} />}
                />
            ) : (
                <View style={styles.avatarSection}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.avatarStrip}
                        style={styles.avatarStripScroll}
                    >
                        {avatars.map((avatar, index) => (
                            <AvatarTile
                                key={avatar._id}
                                avatar={avatar}
                                index={index}
                                isWorn={avatar._id === defaultAvatarId}
                                isWearing={setDefaultMutation.isPending && setDefaultMutation.variables?._id === avatar._id}
                                onWear={() => !setDefaultMutation.isPending && setDefaultMutation.mutate(avatar)}
                                onEdit={() => router.push(`/(avatar)/edit/${avatar._id}`)}
                                onDelete={() => !deleteMutation.isPending && handleDelete(avatar)}
                            />
                        ))}
                        {canCreate && <NewAvatarTile onPress={createAvatar} />}
                    </ScrollView>

                    <AppText variant="caption" color="textMuted" align="center">
                        {canCreate
                            ? 'Tap an avatar to wear it, hold to delete.'
                            : `You've reached ${MAX_AVATARS} avatars. Hold one to delete it.`}
                    </AppText>
                </View>
            )}

            {/* Privacy */}
            {user && (
                <View style={styles.settingRow}>
                    <View style={styles.settingText}>
                        <AppText variant="bodyStrong">Find me by my phone number</AppText>
                        <AppText variant="caption" color="textSecondary">
                            People who have your number in their contacts see you in Quick Add.
                        </AppText>
                    </View>
                    <Switch
                        value={discoverableMutation.isPending ? discoverableMutation.variables : user.discoverableByPhone}
                        onValueChange={(value) => discoverableMutation.mutate(value)}
                        trackColor={{ true: t.colors.primary, false: t.colors.switchTrackOff }}
                        thumbColor={t.colors.switchThumb}
                    />
                </View>
            )}

            {/* Logout */}
            <Button title="Log out" icon="log-out-outline" variant="danger" fullWidth onPress={handleLogout} />
        </ScrollView>

        {/* Logout confirmation modal */}
        <Dialog
            visible={logoutModalVisible}
            onClose={() => setLogoutModalVisible(false)}
            icon="log-out-outline"
            tone="error"
            title="Log out?"
            message="You'll need to sign in again to access your account."
            actions={
                <View style={styles.modalActions}>
                    <Button
                        title="Cancel"
                        variant="secondary"
                        style={styles.modalBtn}
                        onPress={() => setLogoutModalVisible(false)}
                    />
                    <Button
                        title="Log out"
                        variant="danger"
                        style={styles.modalBtn}
                        onPress={() => { setLogoutModalVisible(false); logout(); }}
                    />
                </View>
            }
        />
        </>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(t => ({
    container: {
        flex: 1,
        backgroundColor: t.colors.background,
    },
    content: {
        paddingHorizontal: t.space.lg,
        paddingBottom: 40,
        gap: t.space.xl,
    },
    centered: {
        flex: 1,
        backgroundColor: t.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Header
    header: {
        alignItems: 'center',
        gap: t.space.xs,
    },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: t.space.sm,
    },
    statTile: {
        flex: 1,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        paddingVertical: t.space.md,
        alignItems: 'center',
        gap: 2,
        ...t.shadows.sticker,
    },

    // Currency
    currencyRow: {
        flexDirection: 'row',
        gap: t.space.md,
    },
    currencyTile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        paddingHorizontal: 14,
        paddingVertical: t.space.md,
        gap: t.space.md,
    },
    currencyIcon: {
        width: 32,
        height: 32,
        borderRadius: t.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: -t.space.sm,
    },

    // Avatars
    avatarLoader: {
        marginTop: 20,
    },
    avatarSection: {
        gap: t.space.md,
    },
    // Bleed the strip to the screen edges so tiles scroll off-screen instead of clipping at the padding
    avatarStripScroll: {
        marginHorizontal: -t.space.lg,
    },
    avatarStrip: {
        paddingHorizontal: t.space.lg,
        paddingBottom: t.space.xs,
        gap: t.space.md,
    },
    avatarTile: {
        width: 116,
        alignItems: 'center',
        gap: t.space.xs,
        paddingTop: t.space.md,
        paddingBottom: t.space.sm,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
    },
    tileName: {
        paddingHorizontal: t.space.sm,
    },
    avatarTileWorn: {
        borderColor: t.colors.primary,
        backgroundColor: t.colors.primarySoft,
    },
    editBtn: {
        position: 'absolute',
        top: t.space.xs,
        right: t.space.xs,
    },
    tileSpinner: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.colors.overlay,
        borderRadius: t.radius.sm,
    },
    newTile: {
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderColor: t.colors.borderStrong,
        backgroundColor: 'transparent',
    },

    // Logout dialog
    modalActions: {
        flexDirection: 'row',
        gap: t.space.sm,
    },
    modalBtn: {
        flex: 1,
    },

    // Privacy
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        padding: t.space.lg,
    },
    settingText: {
        flex: 1,
        gap: 2,
    },
}));
