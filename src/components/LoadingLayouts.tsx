import { ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppPressable } from './AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Skeleton, SkeletonGroup } from './Skeleton';

export function RestaurantSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <SkeletonGroup label="Loading recommended restaurants">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ gap: 13 }}
        style={{ height: 290 }}
      >
        {[0, 1, 2].map((key) => (
          <View
            key={key}
            style={{
              width: cardWidth,
              height: 274,
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: 'white',
            }}
          >
            <Skeleton height={148} radius={0} />
            <View className="gap-3 p-3">
              <Skeleton height={18} width="75%" />
              <Skeleton height={12} width="55%" />
              <View className="flex-row gap-2">
                <Skeleton height={25} width={60} />
                <Skeleton height={25} width={60} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SkeletonGroup>
  );
}

export function FoodDetailSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SkeletonGroup label="Loading food details">
          <Skeleton height={310} radius={0} />
          <View className="gap-6 p-5">
            <View className="gap-3">
              <Skeleton height={28} width="70%" />
              <Skeleton height={14} width="90%" />
              <Skeleton height={22} width={80} />
            </View>
            <Skeleton height={20} width={140} />
            <View className="flex-row gap-3">
              {[0, 1, 2].map((key) => (
                <View key={key} className="flex-1">
                  <Skeleton height={76} />
                </View>
              ))}
            </View>
            <Skeleton height={20} width={130} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        </SkeletonGroup>
      </ScrollView>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/(tabs)')
        }
        className="absolute left-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-white"
      >
        <Ionicons name="arrow-back" size={21} color="#17241B" />
      </AppPressable>
      <View
        className="border-t border-line bg-white px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <SkeletonGroup label="Loading price">
          <View className="flex-row gap-3">
            <Skeleton height={52} width={95} />
            <View className="flex-1">
              <Skeleton height={52} />
            </View>
          </View>
        </SkeletonGroup>
      </View>
    </SafeAreaView>
  );
}
