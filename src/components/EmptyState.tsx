import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { FlowButton } from './FlowUI';

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-8">
      <Image
        source={require('../../assets/images/empty-bag.svg')}
        contentFit="contain"
        style={{ width: 240, height: 204, maxWidth: '100%' }}
        accessibilityLabel="A smiling takeout bag with a little heart"
      />
      <Text
        accessibilityRole="header"
        className="mt-6 text-center font-bold text-2xl text-ink"
      >
        {title}
      </Text>
      <Text className="mb-6 mt-3 max-w-xs text-center font-regular text-sm leading-6 text-muted">
        {description}
      </Text>
      <View className="w-full max-w-xs">
        <FlowButton
          title="Go to Menu"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </View>
  );
}
