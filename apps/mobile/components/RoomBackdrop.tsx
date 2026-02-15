import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { RoomDetails } from '@chat-app/shared-types';

type Props = {
  roomDetails?: RoomDetails | null;
};

export function RoomBackdrop({ roomDetails }: Props) {
  const floorItem = roomDetails?.theme?.floor;
  const leftWallItem = roomDetails?.theme?.leftWall;
  const rightWallItem = roomDetails?.theme?.rightWall;

  return (
    <View style={styles.container}>
      <View style={styles.wallsRow}>
        {leftWallItem?.assetUrl && (
          <Image
            style={styles.wall}
            resizeMode="cover"
            source={{ uri: leftWallItem.assetUrl }}
          />
        )}
        {rightWallItem?.assetUrl && (
          <Image
            style={styles.wall}
            resizeMode="cover"
            source={{ uri: rightWallItem.assetUrl }}
          />
        )}
      </View>
      {floorItem?.assetUrl && (
        <Image
          style={styles.floor}
          resizeMode="cover"
          source={{ uri: floorItem.assetUrl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wallsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  wall: {
    flex: 1,
  },
  floor: {
    flex: 1,
  },
});
