import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Restaurant } from '../types';
import { useFavorites } from '../hooks/useFavorites';

type RestaurantCardProps = {
  restaurant: Restaurant;
  width: number;
  onPress: () => void;
};

export function RestaurantCard({
  restaurant,
  width,
  onPress,
}: RestaurantCardProps) {
  const colors = useColors();
  const favorites = useFavorites();
  const saved = favorites.favorites.some(item => item.id === restaurant.id);
  const busy = favorites.isPending || favorites.isUpdating(restaurant.id);

  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem quán ${restaurant.name}, đánh giá ${restaurant.rating.toFixed(1)} sao`}
        onPress={onPress}
        style={({ pressed }) => [
          { flex: 1 },
          pressed ? styles.pressed : undefined,
        ]}
      >
        <View style={styles.imageFrame}>
          <Image
            source={restaurant.image ? { uri: restaurant.image } : undefined}
            contentFit="cover"
            transition={180}
            style={styles.image}
            accessibilityLabel={`Ảnh quán ${restaurant.name}`}
          />
          <View
            style={[styles.deliveryBadge, { backgroundColor: colors.card }]}
          >
            <Ionicons name="time-outline" size={12} color={colors.foreground} />
            <Text style={[styles.deliveryText, { color: colors.foreground }]}>
              {restaurant.isOpen === false ? 'Đã đóng cửa' : restaurant.deliveryTime}
            </Text>
          </View>
        </View>
        <View style={styles.details}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: colors.foreground }]}
          >
            {restaurant.name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color={colors.primary} />
            <Text style={[styles.rating, { color: colors.foreground }]}>
              {restaurant.rating.toFixed(1)}
            </Text>
            <View
              style={[
                styles.metaDot,
                { backgroundColor: colors.mutedForeground },
              ]}
            />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {restaurant.openingHours ? (restaurant.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa') : 'Quán được yêu thích'}
            </Text>
          </View>
          <View style={styles.tagsRow}>
            {restaurant.tags.slice(0, 2).map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: colors.secondary }]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: colors.secondaryForeground },
                  ]}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${saved ? 'Bỏ yêu thích' : 'Yêu thích'} ${restaurant.name}`}
        accessibilityState={{ selected: saved, disabled: busy, busy }}
        disabled={busy}
        onPress={(event) => {
          event.stopPropagation();
          void favorites.toggle(restaurant);
        }}
        className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-white"
      >
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={22}
          color={colors.tabActive}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 13,
    height: 274,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  imageFrame: {
    height: 148,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deliveryBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deliveryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  details: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 8,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rating: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 1,
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tagText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },
});
