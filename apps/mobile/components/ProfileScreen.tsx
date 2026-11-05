import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/useMe';
import { MY_AVATARS_KEY, useMyAvatars, useWearAvatar } from '@/hooks/useMyAvatars';
import { makeStyles, useTheme, type ThemeColors } from '@/constants/theme';
import AvatarPreview from '@/components/AvatarPreview';
import UserAvatar from '@/components/UserAvatar';
import { AppText, Button, EmptyState, Spinner } from '@/components/ui';

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

// ── Avatar card ───────────────────────────────────────────────────────────────

function AvatarCard({
    avatar,
    index,
    isDefault,
    onSetDefault,
    onEdit,
    onDelete,
    canDelete,
    isSettingDefault,
    isDeleting,
}: {
    avatar: Avatar;
    index: number;
    isDefault: boolean;
    onSetDefault: () => void;
    onEdit: () => void;
    onDelete: () => void;
    canDelete: boolean;
    isSettingDefault: boolean;
    isDeleting: boolean;
}) {
    const styles = useStyles();
    return (
        <View style={[styles.avatarCard, isDefault && styles.avatarCardDefault]}>
            {isDefault && (
                <View style={styles.defaultBadge}>
                    <AppText variant="overline" color="onPrimary">Wearing</AppText>
                </View>
            )}
            <View style={styles.avatarPreview}>
                <AvatarPreview avatar={avatar} size={140} animated={false} />
            </View>
            <AppText variant="label" color="textSecondary" style={styles.avatarName}>Avatar {index + 1}</AppText>

            <View style={styles.avatarActions}>
                {!isDefault && (
                    <Button title="Wear" size="sm" fullWidth loading={isSettingDefault} onPress={onSetDefault} />
                )}
                <Button title="Edit" icon="brush-outline" variant="secondary" size="sm" fullWidth onPress={onEdit} />
                {canDelete && (
                    <Button title="Delete" variant="ghost" size="sm" fullWidth loading={isDeleting} onPress={onDelete} style={styles.deleteBtn} />
                )}
            </View>
        </View>
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
        onError: (e: Error) => Alert.alert('Could not save', e.message),
    });

    const avatarsQuery = useMyAvatars();
    const setDefaultMutation = useWearAvatar();

    const deleteMutation = useMutation({
        mutationFn: (avatarId: string) => api.delete(`/api/v1/avatar/${avatarId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_AVATARS_KEY });
        },
    });

    const handleDelete = (avatar: Avatar) => {
        Alert.alert(
            'Delete Avatar',
            'Are you sure you want to delete this avatar?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(avatar._id),
                },
            ],
        );
    };

    const handleLogout = () => setLogoutModalVisible(true);

    const user = userQuery.data;
    const avatarData = avatarsQuery.data;
    const avatars = avatarData?.avatars ?? [];
    const defaultAvatarId = selectedAvatar?._id ?? avatarData?.selectedAvatar ?? null;

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
                <Button title="New" icon="add" size="sm" onPress={() => router.push('/(avatar)/create')} />
            </View>

            {avatarsQuery.isLoading ? (
                <Spinner style={styles.avatarLoader} />
            ) : avatars.length === 0 ? (
                <EmptyState icon="happy-outline" title="No avatars yet" body="Create one to start hanging out." />
            ) : (
                <View style={styles.avatarGrid}>
                    {avatars.map((avatar, index) => (
                        <AvatarCard
                            key={avatar._id}
                            avatar={avatar}
                            index={index}
                            isDefault={avatar._id === defaultAvatarId}
                            onSetDefault={() => setDefaultMutation.mutate(avatar)}
                            onEdit={() => router.push(`/(avatar)/edit/${avatar._id}`)}
                            onDelete={() => handleDelete(avatar)}
                            canDelete={avatars.length > 1}
                            isSettingDefault={
                                setDefaultMutation.isPending &&
                                setDefaultMutation.variables?._id === avatar._id
                            }
                            isDeleting={
                                deleteMutation.isPending &&
                                deleteMutation.variables === avatar._id
                            }
                        />
                    ))}
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
        <Modal
            visible={logoutModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setLogoutModalVisible(false)}
        >
            <Pressable style={styles.modalOverlay} onPress={() => setLogoutModalVisible(false)}>
                <Pressable style={styles.modalBox} onPress={() => {}}>
                    <AppText variant="title" align="center">Log out?</AppText>
                    <AppText color="textSecondary" align="center">
                        You&apos;ll need to sign in again to access your account.
                    </AppText>
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
                </Pressable>
            </Pressable>
        </Modal>
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

    // Avatar grid
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: t.space.md,
    },
    avatarLoader: {
        marginTop: 20,
    },

    // Avatar card
    avatarCard: {
        width: '47%',
        flexGrow: 1,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        overflow: 'hidden',
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        alignItems: 'center',
        paddingBottom: t.space.md,
    },
    avatarCardDefault: {
        borderColor: t.colors.primary,
    },
    defaultBadge: {
        backgroundColor: t.colors.primary,
        width: '100%',
        paddingVertical: t.space.xs,
        alignItems: 'center',
    },
    avatarPreview: {
        paddingTop: t.space.md,
        paddingBottom: t.space.xs,
        alignItems: 'center',
    },
    avatarName: {
        marginBottom: 10,
    },
    avatarActions: {
        alignSelf: 'stretch',
        paddingHorizontal: 10,
        gap: t.space.sm,
    },
    deleteBtn: {
        height: 30,
    },

    // Logout modal
    modalOverlay: {
        flex: 1,
        backgroundColor: t.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: t.space.xxl,
    },
    modalBox: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: t.colors.surfaceElevated,
        borderRadius: t.radius.xl,
        borderWidth: t.borderWidth.thick,
        borderColor: t.colors.border,
        padding: t.space.xl,
        gap: t.space.sm,
        ...t.shadows.floating,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: t.space.md,
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
