import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavorites } from '../../hooks/useFavorites';
import { FlowButton } from '../../components/FlowUI';
import { RestaurantSkeleton } from '../../components/LoadingLayouts';
import { EmptyState } from '../../components/EmptyState';
import type { Restaurant } from '../../types';
import { useColors } from '@/hooks/useColors';
import { viLabel, viHours } from '../../utils/vietnamese';

export default function FavoritesScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const query = useFavorites();
  const favorites = query.favorites;
  const cardWidth = ((Platform.OS === 'web' ? Math.min(width, 520) : width) - 52) / 2;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text className="text-ink" style={styles.title}>
          Yêu thích
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Những quán ngon bạn đã lưu.
        </Text>
      </View>

      {query.isPending ? <RestaurantSkeleton cardWidth={cardWidth} /> : query.isError && !query.data ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được yêu thích.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }} /></View> : <FlatList<Restaurant>
        testID="favorite-restaurants"
        data={favorites}
        refreshing={query.isRefetching}
        onRefresh={() => { void query.refetch(); }}
        numColumns={2}
        keyExtractor={(restaurant) => restaurant.id}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          favorites.length === 0 && { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View
            style={[
              styles.favoriteCard,
              {
                width: cardWidth,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mở quán ${item.name}`}
              onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.id } })}
              style={styles.imagePressable}
            >
              <Image
                source={{ uri: item.image }}
                contentFit="cover"
                transition={180}
                accessibilityLabel={`Ảnh quán ${item.name}`}
                style={[
                  styles.restaurantImage,
                  { backgroundColor: colors.accent },
                ]}
              />
            </Pressable>
            <Pressable
              testID={`remove-favorite-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Bỏ yêu thích ${item.name}`}
              disabled={query.isUpdating(item.id)}
              accessibilityState={{ disabled: query.isUpdating(item.id), busy: query.isUpdating(item.id) }}
              onPress={() => { void query.toggle(item); }}
              style={[styles.favoriteButton, { backgroundColor: colors.card }]}
            >
              <Ionicons name="heart" size={18} color={colors.destructive} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.id } })}
              style={styles.cardDetails}
            >
              <Text
                className="text-ink"
                numberOfLines={1}
                style={styles.restaurantName}
              >
                {item.name}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={13} color={colors.tabActive} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {item.rating.toFixed(1)}
                </Text>
                <Text style={[styles.dot, { color: colors.mutedForeground }]}>
                  ·
                </Text>
                <Text
                  style={[styles.metaText, { color: colors.mutedForeground }]}
                >
                  {viHours(item.deliveryTime)}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.tags, { color: colors.mutedForeground }]}
              >
                {item.tags.map(viLabel).join(' · ')}
              </Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có quán yêu thích"
            description="Chạm vào trái tim ở thẻ quán để lưu quán yêu thích tại đây."
          />
        }
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 17,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  gridContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  favoriteCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePressable: {
    width: '100%',
  },
  restaurantImage: {
    width: '100%',
    height: 117,
  },
  favoriteButton: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  restaurantName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },
  dot: {
    fontSize: 12,
    marginHorizontal: 1,
  },
  tags: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
});
