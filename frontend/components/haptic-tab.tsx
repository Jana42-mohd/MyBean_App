import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';

// Tab bar button that gives a soft haptic tap on iOS.
export function HapticTab({ children, onPressIn, ...props }: any) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}>
      {children}
    </Pressable>
  );
}
