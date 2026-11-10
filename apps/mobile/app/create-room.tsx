import { useQueryClient } from '@tanstack/react-query';
import { usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import UserPicker from '@/components/UserPicker';
import { AppText, Button, ScreenHeader, TextField } from '@/components/ui';
import { makeStyles } from '@/constants/theme';
import { useAuth } from '@/context/auth.context';
import { api } from '@/lib/api';
import { PublicUser, Room } from '@chat-app/shared-types';

const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: t.space.sm,
    paddingBottom: t.space.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.borderStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: t.colors.primary,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: t.space.xl,
  },
  stepLabel: {
    marginBottom: t.space.md,
  },
  charCount: {
    marginTop: 6,
    marginBottom: t.space.xxl,
  },
  errorText: {
    marginBottom: t.space.md,
  },
  primaryBtn: {
    marginBottom: t.space.xl,
  },
}));

export default function CreateRoom() {
  const styles = useStyles();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { selectedAvatar } = useAuth();
  // Back from step 2 returns to step 1. Off while creating and for good once the room exists,
  // so the sheet can leave on success.
  usePreventRemove(step === 2 && !isCreating && !createdRoomId, () => setStep(1));

  // Leave only after the render that turned the guard off, so it can't catch this navigation.
  useEffect(() => {
    if (!createdRoomId) return;
    if (selectedAvatar) router.replace({ pathname: '/room/[roomId]', params: { roomId: createdRoomId } });
    else router.back(); // entering a room needs an avatar; the room list prompts for one
  }, [createdRoomId]);

  const createRoom = async () => {
    if (!name.trim() || isCreating || createdRoomId) return;
    setIsCreating(true);
    setError(null);
    try {
      const room = await api.post<Room>('/api/v1/rooms', { name: name.trim(), members: members.map((m) => m._id) });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setCreatedRoomId(room._id);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create room');
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader
        title={step === 1 ? 'New Room' : 'Add People'}
        onBack={() => (step === 2 ? setStep(1) : router.back())}
        backIcon={step === 1 ? 'close' : 'chevron-back'}
      />

      {/* Step dots */}
      <View style={styles.dots}>
        <View style={[styles.dot, step === 1 && styles.dotActive]} />
        <View style={[styles.dot, step === 2 && styles.dotActive]} />
      </View>

      {step === 1 ? (
        /* ── Step 1: Room name ── */
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom }]}>
          <AppText variant="overline" color="textMuted" style={styles.stepLabel}>Room name</AppText>
          <TextField
            size="lg"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Late night crew"
            autoFocus
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => { if (name.trim()) setStep(2); }}
          />
          <AppText variant="caption" color="textMuted" align="right" style={styles.charCount}>{name.length}/60</AppText>

          <Button title="Next" size="lg" fullWidth disabled={!name.trim()} onPress={() => setStep(2)} style={styles.primaryBtn} />
        </View>
      ) : (
        /* ── Step 2: Add people ── */
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom }]}>
          <UserPicker selected={members} onChange={setMembers} />

          {error ? <AppText variant="label" color="error" align="center" style={styles.errorText}>{error}</AppText> : null}

          <Button
            title={members.length ? `Create Room with ${members.length}` : 'Create Room'}
            size="lg"
            fullWidth
            loading={isCreating}
            onPress={createRoom}
            style={styles.primaryBtn}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
