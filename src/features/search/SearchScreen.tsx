import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { searchLiveCatalog, type Coordinates } from './liveCatalog';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowButton, FlowHeader, TEAL } from '../../components/FlowUI';
import { currency } from '../order/checkout';
import { useFavorites } from '../../hooks/useFavorites';
import {
  defaultFilters,
  type SearchFilters,
} from './catalog';

export default function SearchScreen({ categoryId, restaurantId }: { categoryId?: string; restaurantId?: string }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const foods = useQuery({ queryKey: catalogKeys.foods(categoryId, restaurantId), queryFn: ({ signal }) => catalogApi.foods({ categoryId, restaurantId }, signal) });
  const categories = useQuery({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => catalogApi.categories(signal) });
  const restaurants = useQuery({ queryKey: catalogKeys.restaurants, queryFn: ({ signal }) => catalogApi.restaurants(signal), enabled: !!restaurantId });
  const { favorites } = useFavorites();
  const savedRestaurants = useMemo(
    () => favorites.map((restaurant) => restaurant.id),
    [favorites],
  );
  const category = categories.data?.find((entry) => entry.id === categoryId);
  const restaurant = restaurants.data?.find((entry) => entry.id === restaurantId);
  const results = useMemo(
    () => searchLiveCatalog(foods.data ?? [], query, filters, savedRestaurants, location),
    [foods.data, query, filters, savedRestaurants, location],
  );
  const locate = async () => {
    if (locating) return false;
    if (location) return true;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission is needed to find nearby restaurants.');
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(result.coords);
      return true;
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Location unavailable', text2: error instanceof Error ? error.message : 'Please try again.' });
      return false;
    } finally { setLocating(false); }
  };
  const filterTags = [
    {
      label:
        filters.sort === 'rating'
          ? 'Sort by: Top rated'
          : filters.sort === 'distance'
            ? 'Sort by: Distance'
            : 'Sort by',
      active: filters.sort !== 'recommended',
      onPress: async () => {
        if (filters.sort === 'rating' && !(await locate())) return;
        setFilters((current) => ({
          ...current,
          sort:
            current.sort === 'recommended'
              ? 'rating'
              : current.sort === 'rating'
                ? 'distance'
                : 'recommended',
        }));
      },
    },
    ...(
      [
        { key: 'freeship', label: 'Freeship' },
        { key: 'favorite', label: 'Favorite' },
        { key: 'nearby', label: 'Near you' },
      ] as const
    ).map(({ key, label }) => ({
      label,
      active: filters[key],
      onPress: async () => {
        if (key === 'nearby' && !filters.nearby && !(await locate())) return;
        setFilters((current) => ({ ...current, [key]: !current[key] }));
      },
    })),
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <StatusBar style="dark" />
      <FlowHeader
        title={restaurantId ? (restaurant?.name ?? 'Restaurant menu') : categoryId ? (category?.name ?? 'Category') : 'Search'}
      />
      <View className="mx-5 mb-4 min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-white px-4">
        <Ionicons name="search-outline" size={22} color={TEAL} />
        <TextInput
          accessibilityLabel="Search dishes or restaurants"
          placeholder={
            category ? `Search in ${category.name}` : 'Fried Chicken'
          }
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          className="min-h-14 flex-1 py-3 font-regular text-base text-ink"
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            className="h-11 w-9 items-center justify-center"
          >
            <Ionicons name="close-circle" size={21} color={TEAL} />
          </Pressable>
        )}
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 10,
            paddingBottom: 16,
          }}
        >
          {filterTags.map((tag, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityState={{ selected: tag.active }}
              onPress={tag.onPress}
              disabled={locating}
              className={`min-h-11 flex-row items-center gap-2 rounded-full border px-4 py-3 ${tag.active ? 'border-teal bg-tealLight' : 'border-line bg-white'}`}
            >
              <Text
                className={`font-medium text-sm ${tag.active ? 'text-teal' : 'text-ink'}`}
              >
                {tag.label}
              </Text>
              {index === 0 && (
                <Ionicons name="chevron-down" size={15} color={TEAL} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        className="mb-4 px-5 font-semibold text-sm text-muted"
      >
        {results.length} results{filters.nearby ? ' · within 2 km' : ''}
      </Text>
      {foods.isPending ? <SkeletonGroup label="Loading dishes"><View className="gap-4 px-5">{[0, 1, 2].map(key => <Skeleton key={key} height={130} />)}</View></SkeletonGroup>
      : foods.isError && !foods.data ? <View className="gap-4 p-5"><Text className="text-ink">We couldn't load dishes.</Text><FlowButton title="Try again" onPress={() => { void foods.refetch(); }} /></View>
      : <FlashList
        data={results}
        keyExtractor={(item) => item.food.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={foods.isRefetching}
        onRefresh={() => { void foods.refetch(); }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.food.name} from ${item.restaurant}, ${currency(item.food.price)}`}
            onPress={() =>
              router.push({
                pathname: '/food/[id]',
                params: { id: item.food.id },
              })
            }
            className="mb-4 flex-row items-center gap-4 rounded-3xl border border-line bg-white p-3 active:opacity-80"
          >
            <Image
              source={item.food.image ? { uri: item.food.image } : undefined}
              style={{ width: 92, height: 108, borderRadius: 18 }}
              contentFit="cover"
              accessibilityLabel={item.food.name}
            />
            <View className="flex-1 gap-2">
              <Text className="font-bold text-base text-ink">
                {item.food.name}
              </Text>
              <Text className="font-regular text-xs text-muted">
                {item.restaurant}
              </Text>
              <View className="flex-row flex-wrap items-center gap-1">
                <Ionicons name="star" size={13} color={TEAL} />
                <Text className="font-medium text-xs text-ink">
                  {item.rating}{item.distanceKm !== null ? ` · ${item.distanceKm.toFixed(1)} km` : ''} · {item.isOpen ? item.deliveryTime : 'Closed'}
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="font-bold text-base text-teal">
                  {currency(item.food.price)}
                </Text>
                {item.freeDelivery && (
                  <Text className="rounded-full bg-tealLight px-2 py-1 font-medium text-xs text-teal">
                    Freeship
                  </Text>
                )}
              </View>
            </View>
            {savedRestaurants.includes(item.restaurantId) && (
              <Ionicons name="heart" size={16} color={TEAL} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center gap-5 px-5 py-12">
            <Ionicons name="search-outline" size={44} color={TEAL} />
            <Text className="text-center font-bold text-lg text-ink">
              {categoryId && categories.isSuccess && !category
                ? 'Category not found'
                : 'No matches yet'}
            </Text>
            <Text className="text-center font-regular text-sm leading-6 text-muted">
              Try another keyword or clear the filters.
            </Text>
            <FlowButton
              title="Clear search & filters"
              onPress={() => {
                setQuery('');
                setFilters(defaultFilters);
              }}
            />
          </View>
        }
      />}
    </SafeAreaView>
  );
}
