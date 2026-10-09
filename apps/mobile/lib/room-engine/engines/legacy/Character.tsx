import { CharacterDirection, type ActorActionKind } from "@chat-app/shared-types";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from 'react-native';
import Bubble from './Bubble';
import UserCharacter from "@/components/ui/UserCharacter";
import { gridToScreen, type GridOrigin } from "@/constants/grid";
import type { ActorState, ChatBubble } from "../../core/contract";
import { facingToDirection } from "../../core/facing";

/** Character sprite height in dp. Equals 2 × TILE_H for correct YoWorld proportions. */
const CHAR_HEIGHT = 80;
const CHAR_WIDTH = Math.round(CHAR_HEIGHT * 2 / 3); // 53 dp

let BUBBLE_KEY = 0;

interface BubbleItem {
  key: string;
  message: string;
  duration: number;
}

interface CharacterProps {
  actor: ActorState;
  origin: GridOrigin;
  onActionComplete: (actorId: string, action: ActorActionKind) => void;
}

const Character = ({ actor, origin, onActionComplete }: CharacterProps) => {
  const { id, user, position, facing, isTyping, bubbles: messages, avatar } = actor;
  const gx = position.x;
  const gy = position.y;
  const gz = position.z;

  const screen = gridToScreen(gx, gy, gz, origin);

  // Store foot-center offset in animation so feet land exactly on the tile position.
  const animation = useRef(new Animated.ValueXY({
    x: screen.x - CHAR_WIDTH / 2,
    y: screen.y - CHAR_HEIGHT,
  })).current;

  // Track previous grid position to derive animation duration from Euclidean distance.
  // This ensures a segment spanning 4 cells takes 4× longer than a 1-cell step,
  // giving constant apparent walking speed regardless of waypoint spacing.
  const prevPosRef = useRef({ gx, gy });

  useEffect(() => {
    const target = gridToScreen(gx, gy, gz, origin);
    const dist = Math.hypot(gx - prevPosRef.current.gx, gy - prevPosRef.current.gy);
    prevPosRef.current = { gx, gy };
    const duration = Math.max(50, dist * (user?.attributes?.speed ?? 500));

    Animated.timing(animation, {
      toValue: { x: target.x - CHAR_WIDTH / 2, y: target.y - CHAR_HEIGHT },
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      // Interrupted animations (a new destination arrived) don't complete the walk.
      if (finished) onActionComplete(id, 'walk');
    });
  }, [gx, gy, gz, origin.x, origin.y]);

  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);

  // Push new messages as bubbles
  const prevMessagesRef = useRef<ChatBubble[]>([]);
  useEffect(() => {
    const prev = prevMessagesRef.current;
    const current = messages ?? [];
    if (current.length > prev.length) {
      const newMessages = current.slice(prev.length);
      for (const msg of newMessages) {
        setBubbles(b => [...b, { key: `${BUBBLE_KEY++}`, message: msg.text, duration: 3500 }]);
      }
    }
    prevMessagesRef.current = current;
  }, [messages]);

  function closeBubble() {
    setBubbles(current => current.slice(1));
  }

  const facingLeft = facingToDirection(facing) === CharacterDirection.LEFT;

  return (
    <Animated.View
      style={[
        animation.getLayout(),
        { position: 'absolute', zIndex: gx + gy },
      ]}
    >
      <View style={{ position: 'relative' }}>
        {/* Chat bubbles rendered above the character */}
        <View
          style={{
            position: 'absolute',
            bottom: CHAR_HEIGHT,
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            left: 0,
          }}
        >
          {isTyping && <Bubble isTyping />}
          {bubbles.map(bubble => (
            <Bubble
              key={bubble.key}
              message={bubble.message}
              duration={user?.attributes?.bubbleDuration ?? 3500}
              close={closeBubble}
            />
          ))}
        </View>

        {/* Character sprite — mirrored when facing left */}
        <View style={{ transform: [{ scaleX: facingLeft ? -1 : 1 }] }}>
          {avatar
            ? <UserCharacter avatar={avatar} size={CHAR_HEIGHT} />
            : <UserCharacter userId={user._id} size={CHAR_HEIGHT} />
          }
        </View>
      </View>
    </Animated.View>
  );
};

export default Character;
