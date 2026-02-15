import { Avatar, AvatarEye, AvatarHair, AvatarMouth, AvatarSkin, User } from "@chat-app/shared-types";
import { myFetch } from "@/utils/fetch";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from 'react-native';

enum AvatarPartName {
  SKIN = 'skin',
  HAIR = 'hair',
  EYE = 'eye',
  MOUTH = 'mouth',
}

interface UserCharacterProps {
  userId: User['_id'];
  avatarId?: Avatar['_id'];
}

const SkeletonPlaceholder = () => {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHead} />
      <View style={styles.skeletonBody} />
      <View style={styles.skeletonLegs} />
    </View>
  );
};

interface BodyPartProps {
  part: AvatarEye | AvatarHair | AvatarSkin | AvatarMouth;
  partName: AvatarPartName;
}

const BodyPart = ({ part, partName }: BodyPartProps) => {
  // Render each body part based on its properties
  // Adjust based on actual Avatar part structure when properties are defined
  const partStyle = styles[`${partName}Part` as keyof typeof styles] || styles.bodyPart;
  
  // When avatar parts have properties, render them here
  // Example: If parts have imageUrl property
  // const partWithUrl = part as { imageUrl?: string };
  // if (partWithUrl.imageUrl) {
  //   return (
  //     <Image source={{ uri: partWithUrl.imageUrl }} style={partStyle} />
  //   );
  // }
  
  // Example: If parts have color property
  // const partWithColor = part as { color?: string };
  // if (partWithColor.color) {
  //   return (
  //     <View style={[partStyle, { backgroundColor: partWithColor.color }]} />
  //   );
  // }
  
  // Placeholder rendering until avatar part properties are defined
  return (
    <View style={partStyle}>
      {/* Body part will be rendered here when properties are available */}
    </View>
  );
};

const UserCharacter = ({
  userId,
  avatarId,
}: UserCharacterProps) => {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await myFetch(`/api/v1/users/${userId}/avatar/${avatarId}`); // gets default avatar when !avatarId
        
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar: ${response.statusText}`);
        }
        
        const avatarData: Avatar = await response.json();
        setAvatar(avatarData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load avatar');
        console.error('Error fetching avatar:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [userId, avatarId]);

  if (loading) {
    return <SkeletonPlaceholder />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (!avatar) {
    return null;
  }

  return (
    <View style={styles.avatarContainer}>
      {/* Render avatar body parts in proper z-order (back to front) */}
      {/* Skin/base layer first */}
      <BodyPart part={avatar.eye} partName={AvatarPartName.SKIN} />
      {/* Then hair */}
      {avatar.hair && <BodyPart part={avatar.hair} partName={AvatarPartName.HAIR} />}
      {/* Then facial features */}
      <BodyPart part={avatar.eye} partName={AvatarPartName.EYE} />
      <BodyPart part={avatar.mouth} partName={AvatarPartName.MOUTH} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    width: 150,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonHead: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    marginBottom: 10,
  },
  skeletonBody: {
    width: 80,
    height: 100,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    marginBottom: 10,
  },
  skeletonLegs: {
    width: 60,
    height: 40,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
  },
  avatarContainer: {
    position: 'relative',
    width: 150,
    height: 200,
  },
  bodyPart: {
    position: 'absolute',
  },
  skinPart: {
    position: 'absolute',
    width: 150,
    height: 200,
    zIndex: 1,
  },
  hairPart: {
    position: 'absolute',
    top: 0,
    width: 150,
    height: 80,
    zIndex: 2,
  },
  eyePart: {
    position: 'absolute',
    top: 40,
    width: 150,
    height: 30,
    zIndex: 3,
  },
  mouthPart: {
    position: 'absolute',
    top: 70,
    width: 150,
    height: 20,
    zIndex: 3,
  },
  partImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  partColor: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    width: 150,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default UserCharacter;
