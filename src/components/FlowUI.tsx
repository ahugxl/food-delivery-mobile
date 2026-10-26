import { AppPressable as Pressable } from '@/src/components/AppPressable';
import type { PropsWithChildren } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

export const TEAL = '#008B45';

export function FlowHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-center gap-4 px-5 py-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/(tabs)')
        }
        className="h-12 w-12 items-center justify-center rounded-full border border-line bg-white active:opacity-70"
      >
        <Ionicons name="arrow-back" size={22} color={TEAL} />
      </Pressable>
      <Text
        accessibilityRole="header"
        className="flex-1 font-bold text-xl text-ink"
      >
        {title}
      </Text>
    </View>
  );
}

export function FlowButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 items-center justify-center rounded-2xl px-5 py-4 active:opacity-80 ${disabled ? 'bg-line' : 'bg-teal'}`}
    >
      <Text
        className={`font-semibold text-base ${disabled ? 'text-muted' : 'text-white'}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function RadioMark({ selected }: { selected: boolean }) {
  return (
    <Ionicons
      name={selected ? 'radio-button-on' : 'radio-button-off'}
      size={24}
      color={selected ? TEAL : '#827A71'}
    />
  );
}

export function FlowCard({ children }: PropsWithChildren) {
  return (
    <View className="mb-5 gap-4 rounded-3xl border border-line bg-white p-5">
      {children}
    </View>
  );
}
