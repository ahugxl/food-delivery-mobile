import { useEffect, type PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function Skeleton({
  width = '100%',
  height,
  radius = 12,
}: {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#E2E7E5',
      }}
    />
  );
}

export function SkeletonGroup({
  children,
  label,
}: PropsWithChildren<{ label: string }>) {
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!reducedMotion) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 650 }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
      );
    }
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={animatedStyle}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        pointerEvents="none"
      >
        {children}
      </Animated.View>
    </View>
  );
}
