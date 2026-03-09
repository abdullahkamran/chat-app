import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { Room } from '@chat-app/shared-types';

export default function CreateRoom() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.includes(trimmed)) {
      setMemberInput('');
      return;
    }
    setMembers((prev) => [...prev, trimmed]);
    setMemberInput('');
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m !== id));
  };

  const createRoom = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      await api.post<Room>('/api/v1/rooms', { name: name.trim(), members });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => (step === 2 ? setStep(1) : router.back())} hitSlop={12}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{step === 1 ? 'New Room' : 'Add Members'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step dots */}
      <View style={styles.dots}>
        <View style={[styles.dot, step === 1 && styles.dotActive]} />
        <View style={[styles.dot, step === 2 && styles.dotActive]} />
      </View>

      {step === 1 ? (
        /* ── Step 1: Room name ── */
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom }]}>
          <Text style={styles.stepLabel}>Room name</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Late night crew"
            placeholderTextColor="#555"
            autoFocus
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => { if (name.trim()) setStep(2); }}
          />
          <Text style={styles.charCount}>{name.length}/60</Text>

          <Pressable
            style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
            onPress={() => setStep(2)}
            disabled={!name.trim()}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </Pressable>
        </View>
      ) : (
        /* ── Step 2: Add members ── */
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom }]}>
          <Text style={styles.stepLabel}>Add members by user ID</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.memberInput}
              value={memberInput}
              onChangeText={setMemberInput}
              placeholder="Paste user ID"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={addMember}
            />
            <Pressable
              style={[styles.addBtn, !memberInput.trim() && styles.addBtnDisabled]}
              onPress={addMember}
              disabled={!memberInput.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          <FlatList
            data={members}
            keyExtractor={(id) => id}
            style={styles.memberList}
            renderItem={({ item }) => (
              <View style={styles.memberRow}>
                <Text style={styles.memberId} numberOfLines={1}>{item}</Text>
                <Pressable onPress={() => removeMember(item)} hitSlop={8}>
                  <Text style={styles.removeBtn}>✕</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyMembers}>No members added yet — room will be private.</Text>
            }
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, isCreating && styles.primaryBtnDisabled]}
            onPress={createRoom}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Room</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: {
    color: '#FFFC00',
    fontSize: 18,
    fontWeight: '600',
    width: 64,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 64,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#FFFC00',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: '#111',
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  charCount: {
    color: '#444',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  memberInput: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#222',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  addBtn: {
    backgroundColor: '#FFFC00',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.35,
  },
  addBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  memberList: {
    flex: 1,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  memberId: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  removeBtn: {
    color: '#ff4d4d',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyMembers: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 20,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#FFFC00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 17,
  },
});
