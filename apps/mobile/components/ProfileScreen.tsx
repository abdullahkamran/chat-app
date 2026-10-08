import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, User } from '@chat-app/shared-types';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { theme } from '@/constants/theme';
import UserCharacter from '@/components/ui/UserCharacter';

// ── Data fetching helpers ──────────────────────────────────────────────────────

function fetchUser(userId: string) {
    return api.get<User>(`/api/v1/users/${userId}`);
}

function fetchAvatars() {
    return api.get<{ avatars: Avatar[]; selectedAvatar: string | null }>('/api/v1/avatar/');
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: number }) {
    return (
        <View style={styles.statChip}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ── Currency row ──────────────────────────────────────────────────────────────

function CurrencyRow({ coins, cash }: { coins: number; cash: number }) {
    return (
        <View style={styles.currencyRow}>
            <View style={styles.currencyChip}>
                <Text style={styles.currencyIcon}>🪙</Text>
                <Text style={styles.currencyValue}>{coins.toLocaleString()}</Text>
                <Text style={styles.currencyLabel}>Coins</Text>
            </View>
            <View style={styles.currencyChip}>
                <Text style={styles.currencyIcon}>💵</Text>
                <Text style={styles.currencyValue}>{cash.toLocaleString()}</Text>
                <Text style={styles.currencyLabel}>Cash</Text>
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
    return (
        <View style={[styles.avatarCard, isDefault && styles.avatarCardDefault]}>
            {isDefault && (
                <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
            )}
            <View style={styles.avatarPreview}>
                <UserCharacter avatar={avatar} size={140} />
            </View>
            <Text style={styles.avatarName}>Avatar {index + 1}</Text>

            <View style={styles.avatarActions}>
                {!isDefault && (
                    <Pressable
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={onSetDefault}
                        disabled={isSettingDefault}
                    >
                        {isSettingDefault ? (
                            <ActivityIndicator size="small" color={theme.colors.primaryText} />
                        ) : (
                            <Text style={styles.actionBtnPrimaryText}>Set Default</Text>
                        )}
                    </Pressable>
                )}
                <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={onEdit}>
                    <Text style={styles.actionBtnSecondaryText}>Edit</Text>
                </Pressable>
                {canDelete && (
                    <Pressable
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        onPress={onDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <ActivityIndicator size="small" color={theme.colors.error} />
                        ) : (
                            <Text style={styles.actionBtnDangerText}>Delete</Text>
                        )}
                    </Pressable>
                )}
            </View>
        </View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
    const { userId, selectedAvatar, logout, setSelectedAvatar } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    const userQuery = useQuery({
        queryKey: ['user', userId],
        queryFn: () => fetchUser(userId!),
        enabled: !!userId,
    });

    const avatarsQuery = useQuery({
        queryKey: ['avatars'],
        queryFn: fetchAvatars,
    });

    const setDefaultMutation = useMutation({
        mutationFn: (avatarId: string) =>
            api.put<void>(`/api/v1/avatar/${avatarId}/set-default`, {}),
        onSuccess: (_, avatarId) => {
            const avatar = avatars.find((a) => a._id === avatarId);
            if (avatar) setSelectedAvatar(avatar);
            queryClient.invalidateQueries({ queryKey: ['avatars'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (avatarId: string) => api.delete(`/api/v1/avatar/${avatarId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['avatars'] });
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
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <>
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.username}>{user?.username ?? '—'}</Text>
                {user && (
                    <Text style={styles.location}>
                        {[user.city, user.state, user.country].filter(Boolean).join(', ')}
                    </Text>
                )}
            </View>

            {/* Stats */}
            {user && (
                <View style={styles.statsRow}>
                    <StatChip label="Level" value={user.level} />
                    <StatChip label="Popularity" value={user.popularity} />
                    <StatChip label="Drip" value={user.drip} />
                    <StatChip label="Respecc" value={user.respecc} />
                </View>
            )}

            {/* Currency */}
            {user && (
                <CurrencyRow coins={user.amount.coins} cash={user.amount.cash} />
            )}

            {/* Avatars */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Avatars</Text>
                <Pressable
                    style={styles.createBtn}
                    onPress={() => router.push('/(avatar)/create')}
                >
                    <Text style={styles.createBtnText}>+ New</Text>
                </Pressable>
            </View>

            {avatarsQuery.isLoading ? (
                <ActivityIndicator color={theme.colors.primary} style={styles.avatarLoader} />
            ) : avatars.length === 0 ? (
                <Text style={styles.emptyText}>No avatars yet. Create one!</Text>
            ) : (
                <View style={styles.avatarGrid}>
                    {avatars.map((avatar, index) => (
                        <AvatarCard
                            key={avatar._id}
                            avatar={avatar}
                            index={index}
                            isDefault={avatar._id === defaultAvatarId}
                            onSetDefault={() => setDefaultMutation.mutate(avatar._id)}
                            onEdit={() => router.push(`/(avatar)/edit/${avatar._id}`)}
                            onDelete={() => handleDelete(avatar)}
                            canDelete={avatars.length > 1}
                            isSettingDefault={
                                setDefaultMutation.isPending &&
                                setDefaultMutation.variables === avatar._id
                            }
                            isDeleting={
                                deleteMutation.isPending &&
                                deleteMutation.variables === avatar._id
                            }
                        />
                    ))}
                </View>
            )}

            {/* Logout */}
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
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
                    <Text style={styles.modalTitle}>Log out?</Text>
                    <Text style={styles.modalSubtitle}>You&apos;ll need to sign in again to access your account.</Text>
                    <View style={styles.modalActions}>
                        <Pressable
                            style={[styles.modalBtn, styles.modalBtnCancel]}
                            onPress={() => setLogoutModalVisible(false)}
                        >
                            <Text style={styles.modalBtnCancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.modalBtn, styles.modalBtnConfirm]}
                            onPress={() => { setLogoutModalVisible(false); logout(); }}
                        >
                            <Text style={styles.modalBtnConfirmText}>Log out</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
        </>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 40,
        gap: 24,
    },
    centered: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Header
    header: {
        alignItems: 'center',
        gap: 4,
    },
    username: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.colors.text,
        letterSpacing: 0.3,
    },
    location: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
    },
    statChip: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.primary,
    },
    statLabel: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Currency
    currencyRow: {
        flexDirection: 'row',
        gap: 12,
    },
    currencyChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8,
    },
    currencyIcon: {
        fontSize: 20,
    },
    currencyValue: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    currencyLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 'auto',
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
    },
    createBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    createBtnText: {
        color: theme.colors.primaryText,
        fontWeight: '700',
        fontSize: 14,
    },

    // Avatar grid
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    avatarLoader: {
        marginTop: 20,
    },
    emptyText: {
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginTop: 8,
    },

    // Avatar card
    avatarCard: {
        width: '47%',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: theme.colors.border,
        alignItems: 'center',
        paddingBottom: 12,
    },
    avatarCardDefault: {
        borderColor: theme.colors.primary,
    },
    defaultBadge: {
        backgroundColor: theme.colors.primary,
        width: '100%',
        paddingVertical: 4,
        alignItems: 'center',
    },
    defaultBadgeText: {
        color: theme.colors.primaryText,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    avatarPreview: {
        paddingTop: 12,
        paddingBottom: 4,
        alignItems: 'center',
    },
    avatarName: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginBottom: 10,
    },
    avatarActions: {
        width: '100%',
        paddingHorizontal: 10,
        gap: 6,
    },
    actionBtn: {
        borderRadius: 8,
        paddingVertical: 7,
        alignItems: 'center',
    },
    actionBtnPrimary: {
        backgroundColor: theme.colors.primary,
    },
    actionBtnPrimaryText: {
        color: theme.colors.primaryText,
        fontWeight: '700',
        fontSize: 13,
    },
    actionBtnSecondary: {
        backgroundColor: theme.colors.surfaceElevated,
    },
    actionBtnSecondaryText: {
        color: theme.colors.text,
        fontSize: 13,
    },
    actionBtnDanger: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.error,
    },
    actionBtnDangerText: {
        color: theme.colors.error,
        fontSize: 13,
    },

    // Logout modal
    modalOverlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    modalBox: {
        width: '100%',
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: 20,
        padding: 24,
        gap: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 8,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    modalBtn: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalBtnCancel: {
        backgroundColor: theme.colors.surface,
    },
    modalBtnCancelText: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 15,
    },
    modalBtnConfirm: {
        backgroundColor: theme.colors.error,
    },
    modalBtnConfirmText: {
        color: theme.colors.text,
        fontWeight: '700',
        fontSize: 15,
    },

    // Logout
    logoutBtn: {
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.error,
        alignItems: 'center',
    },
    logoutText: {
        color: theme.colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
});
