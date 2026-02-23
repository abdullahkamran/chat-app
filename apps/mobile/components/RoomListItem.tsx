import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const RoomListItem = ({
  name,
  subtitle,
  onPress,
}: {
  name: string;
  subtitle?: string;
  onPress?: () => void;
}) => {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: avatarColor(name) }]}>
        <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarLetter: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
});

export default RoomListItem;
