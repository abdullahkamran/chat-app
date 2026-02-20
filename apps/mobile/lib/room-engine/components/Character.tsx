import { RoomCharacter } from "@chat-app/shared-types";
import { useEffect, useState } from "react";
import { Animated, View } from 'react-native';
import Bubble from './Bubble';
import UserCharacter from "../../../components/ui/UserCharacter";

let BUBBLE_KEY = 0;

interface BubbleProps {
  key?: string;
  message: string;
  duration: number;
}

interface CharacterProps extends Partial<RoomCharacter> {
  id?: string;
  posX?: number;
  posY?: number;
  animation?: Animated.ValueXY;
  bubble?: { message: string; duration?: number };
  isTyping?: boolean;
}

const Character = ({
  user,
  position,
  isTyping,
  id,
  posX,
  posY,
  bubble,
  animation: externalAnimation,
}: CharacterProps) => {
  const x = position?.x ?? posX ?? 0;
  const y = position?.y ?? posY ?? 0;
  const [animation, setAnimation] = useState(externalAnimation ?? new Animated.ValueXY({ x, y }));

  useEffect(() => {
    Animated.timing(animation, {
      toValue: { x, y },
      duration: user?.attributes?.speed ?? 500,
      useNativeDriver: false, // TODO: try to make it true
    }).start();
  }, [animation, x, y]);

  const [bubbles, setBubbles] = useState<Array<BubbleProps>>([]);

  useEffect(() => {
    if (bubble?.message) {
      const duration = bubble.duration ?? 3500;
      setBubbles(current => ([...current, { message: bubble.message, key: `${BUBBLE_KEY}`, duration }]));
      BUBBLE_KEY += 1;
    }
  }, [bubble]);

  function closeBubble() {
    setBubbles(current => current.toSpliced(0, 1));
  }

  return (
    <Animated.View style={[animation?.getLayout(), { position: 'absolute', zIndex: 1000 }]}>
      <View style={{ position: 'relative' }}>
        <View style={{ position: 'absolute', bottom: 160, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', left: 0 }}>
          {isTyping && <Bubble isTyping />}
          {bubbles.map((bubble) =>
            <Bubble
              key={bubble.key}
              message={bubble.message}
              duration={user?.attributes?.bubbleDuration ?? 3500}
              close={() => closeBubble()}
            />
          )}
        </View>
        <UserCharacter userId={user?._id ?? id ?? ''} />
      </View>
    </Animated.View >
  );
}

export default Character;
