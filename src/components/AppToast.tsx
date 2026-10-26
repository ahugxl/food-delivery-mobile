import Toast, { type ToastConfig } from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { AppPressable } from './AppPressable';

const toastConfig: ToastConfig = {
  success: ({ text1, text2, hide, isVisible }) => (
    <View
      aria-hidden={!isVisible}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        width: '92%',
        maxWidth: 440,
        borderLeftWidth: 4,
        borderLeftColor: '#16A34A',
        elevation: 8,
        shadowColor: '#17241B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}
      className="flex-row items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"
    >
      <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-sm leading-5 text-green-900">
          {text1}
        </Text>
        {text2 ? (
          <Text className="font-regular text-xs leading-5 text-green-800">
            {text2}
          </Text>
        ) : null}
      </View>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel="Đóng thông báo"
        onPress={() => hide()}
        hitSlop={8}
        className="h-11 w-9 items-center justify-center"
      >
        <Ionicons name="close" size={20} color="#166534" />
      </AppPressable>
    </View>
  ),
};

export function AppToast() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Toast
      config={toastConfig}
      topOffset={insets.top + 12}
      visibilityTime={3500}
      animationConfig={{ type: 'timing', duration: reducedMotion ? 0 : 180 }}
    />
  );
}
