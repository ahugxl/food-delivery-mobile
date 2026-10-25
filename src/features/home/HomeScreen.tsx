import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestaurantCard } from '../../components/RestaurantCard';
import { useColors } from '@/hooks/useColors';
import { useCartStore } from '../../store/cartStore';
import type { Restaurant } from '../../types';
import { Image } from 'expo-image';
import { Linking, RefreshControl } from 'react-native';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { toRestaurantCard } from './adapters';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import { TEAL } from '../../components/FlowUI';
import { useQuery } from '@tanstack/react-query';

import { RestaurantSkeleton } from '../../components/LoadingLayouts';
import { FlowButton } from '../../components/FlowUI';

export default function HomeScreen() {
  const colors = useColors();
  const {
    data: restaurants = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: catalogKeys.restaurants,
    queryFn: ({ signal }) => catalogApi.restaurants(signal),
  });
  const banners = useQuery({ queryKey: catalogKeys.banners, queryFn: ({ signal }) => catalogApi.banners(signal) });
  const categories = useQuery({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => catalogApi.categories(signal) });
  const { width } = useWindowDimensions();
  const cartItems = useCartStore((state) => state.items);
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const cardWidth = Math.min(278, width * 0.72);
  const cartButtonBottom = 18;

  return (
    <SafeAreaView
      className="flex-1 bg-cream"
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style="dark" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching || categories.isRefetching || banners.isRefetching}
          onRefresh={() => { void Promise.allSettled([refetch(), categories.refetch(), banners.refetch()]); }} />}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.locationRow}>
          <View style={styles.locationCopy}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              DELIVER TO
            </Text>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={17} color={colors.primary} />
              <Text style={[styles.address, { color: colors.foreground }]}>
                Your neighborhood
              </Text>
              <Ionicons
                name="chevron-down"
                size={15}
                color={colors.foreground}
              />
            </View>
          </View>
          <Pressable
            testID="open-account-from-home"
            accessibilityRole="button"
            accessibilityLabel="Open account"
            onPress={() => router.push('/account')}
            style={[styles.profileButton, { backgroundColor: colors.accent }]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={colors.accentForeground}
            />
          </Pressable>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          What are you craving?
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          accessibilityLabel="Search dishes or restaurants"
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={21}
            color={colors.mutedForeground}
          />
          <Text
            style={[
              styles.searchPlaceholder,
              { color: colors.mutedForeground },
            ]}
          >
            Search dishes, restaurants...
          </Text>
          <View
            style={[styles.searchDivider, { backgroundColor: colors.border }]}
          />
          <Ionicons
            name="options-outline"
            size={20}
            color={colors.foreground}
          />
        </Pressable>

        {categories.isPending ? (
          <SkeletonGroup label="Loading categories"><View className="mb-6 flex-row gap-4">{[0,1,2,3].map(key => <Skeleton key={key} height={80} width={65} />)}</View></SkeletonGroup>
        ) : categories.isError && !categories.data ? (
          <HomeMessage message="We couldn't load categories." retry={() => { void categories.refetch(); }} />
        ) : categories.data?.length === 0 ? <HomeMessage message="No categories available yet." /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
            {categories.data?.map(category => <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={
              'Browse ' + category.name} onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })} className="items-center gap-2">
              <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-tealLight">
                {category.icon_url ? <Image source={{ uri: category.icon_url }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <Ionicons name="restaurant-outline" size={28} color={TEAL} />}
              </View>
              <Text className="font-medium text-xs text-ink">{category.name}</Text>
            </Pressable>)}
          </ScrollView>
        )}

        {banners.isPending ? <SkeletonGroup label="Loading promotions"><View className="mb-6"><Skeleton height={145} radius={22} /></View></SkeletonGroup>
          : banners.isError && !banners.data ? <HomeMessage message="We couldn't load promotions." retry={() => { void banners.refetch(); }} />
          : banners.data?.length === 0 ? <HomeMessage message="No promotions right now." />
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {banners.data?.map((banner, index) => <Pressable key={banner.id} accessibilityRole={banner.link_url && /^https?:\/\//i.test(banner.link_url) ? 'link' : undefined}
              accessibilityLabel={'Promotion ' + (index + 1)}
              onPress={banner.link_url && /^https?:\/\//i.test(banner.link_url) ? () => { void Linking.openURL(banner.link_url!).catch(() => {}); } : undefined}>
              <Image source={{ uri: banner.image_url }} contentFit="cover" style={{ width: Math.max(240, width - 40), height: 145, borderRadius: 22 }} />
            </Pressable>)}
          </ScrollView>}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Recommended for you
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              A few local favorites to start with
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.primary} />
        </View>

        {isLoading ? (
          <RestaurantSkeleton cardWidth={cardWidth} />
        ) : isError ? (
          <View className="gap-4 rounded-2xl bg-white p-5">
            <Text className="font-regular text-sm text-muted">
              We couldn't load restaurants. Please try again.
            </Text>
            <FlowButton
              title="Try again"
              onPress={() => {
                void refetch();
              }}
            />
          </View>
        ) : (
          <FlashList<Restaurant>
            testID="recommended-restaurants"
            data={restaurants.map(toRestaurantCard)}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(restaurant) => restaurant.id}
            renderItem={({ item }) => (
              <RestaurantCard
                restaurant={item}
                width={cardWidth}
                onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.id } })}
              />
            )}
            ListEmptyComponent={<HomeMessage message="No restaurants available yet." />}
            contentContainerStyle={styles.restaurantListContent}
            style={styles.restaurantList}
          />
        )}
      </ScrollView>

      <Pressable
        testID="open-cart"
        accessibilityRole="button"
        accessibilityLabel={
          cartCount > 0 ? `Open cart, ${cartCount} items` : 'Open cart'
        }
        onPress={() => router.push('/cart')}
        className="bg-forest"
        style={[
          styles.cartButton,
          { bottom: cartButtonBottom, shadowColor: colors.foreground },
        ]}
      >
        <Ionicons
          name="bag-handle-outline"
          size={23}
          color={colors.primaryForeground}
        />
        {cartCount > 0 && (
          <View
            style={[
              styles.cartBadge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.cartBadgeText,
                { color: colors.primaryForeground },
              ]}
            >
              {cartCount > 99 ? '99+' : cartCount}
            </Text>
          </View>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

function HomeMessage({ message, retry }: { message: string; retry?: () => void }) {
  return <View className="mb-5 gap-3 rounded-2xl border border-line bg-card p-4">
    <Text accessibilityLiveRegion="polite" className="font-regular text-sm text-muted">{message}</Text>
    {retry && <FlowButton title="Try again" onPress={retry} />}
  </View>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 105,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  locationCopy: {
    gap: 5,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.15,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  address: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 35,
    marginBottom: 19,
  },
  searchBar: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 11,
    marginBottom: 22,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  searchDivider: {
    height: 21,
    width: 1,
    marginHorizontal: 2,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  restaurantList: {
    height: 290,
    flexGrow: 0,
    marginHorizontal: -20,
  },
  restaurantListContent: {
    paddingHorizontal: 20,
    paddingBottom: 5,
  },
  cartButton: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -3,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cartBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
});
