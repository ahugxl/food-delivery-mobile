import { FoodPrice } from '../../components/FoodPrice';
import { FoodReviewStats } from '../../components/FoodReviewStats';
import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { FoodOptions } from '../../features/food-detail/FoodOptions';
import { cartLineId, missingRequiredGroups, optionUnitPrice, selectedOptions, toggleOption, type Selection } from '../../features/food-detail/selection';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { FoodDetailSkeleton } from '../../components/LoadingLayouts';
import { FlowButton, FlowHeader } from '../../components/FlowUI';
import { useCartStore } from '../../store/cartStore';
import { currency } from '../../features/order/checkout';
import { viLabel } from '../../utils/vietnamese';
import { foodDiscountPercent } from '../../features/catalog/foodPricing';



export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FoodDetailContent key={id} id={id} />;
}

function FoodDetailContent({ id }: { id: string }) {
  const colors = useColors();
  const {
    data: food,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: catalogKeys.food(id),
    queryFn: ({ signal }) => catalogApi.food(id, signal),
  });
  const insets = useSafeAreaInsets();
  const addToCart = useCartStore((state) => state.addToCart);
  const [selection, setSelection] = useState<Selection>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const addedToCart = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const foodInfoY = useRef(0);
  const optionsY = useRef(0);
  const groupPositions = useRef<Record<string, number>>({});
  const [attemptedAdd, setAttemptedAdd] = useState(false);

  const groups = food?.food_option_groups ?? [];
  const options = selectedOptions(groups, selection);
  const missing = missingRequiredGroups(groups, selection);
  const available = !!food?.is_available && !!food?.restaurants.is_open;
  const unitPrice = food ? optionUnitPrice(food, options) : 0;
  const orderTotal = Math.round(unitPrice * quantity * 100) / 100;
  const discountPercent = food ? foodDiscountPercent(food) : null;

  const handleAddToCart = () => {
    if (!food || !available || addedToCart.current) return;
    if (missing.length > 0) {
      setAttemptedAdd(true);
      Keyboard.dismiss();
      scrollRef.current?.scrollTo({ y: Math.max(0, foodInfoY.current + optionsY.current + (groupPositions.current[missing[0].id] ?? 0) - 16), animated: true });
      return;
    }
    addedToCart.current = true;

    const error = addToCart({
      id: food.id, name: food.name, price: Number(food.price), image: food.image_url ?? '',
      foodId: food.id, basePrice: Number(food.price), note,
      restaurantId: food.restaurant_id,
      restaurantName: food.restaurants.name,
      lineId: cartLineId(food.id, options, note),
      options,
      quantity,
      unitPrice,
    });
    if (error) {
      addedToCart.current = false;
      Toast.show({ type: 'error', text1: 'Không thêm được món', text2: error });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Toast.show({
      type: 'success',
      text1: 'Đã thêm vào giỏ hàng!',
      text2: `${quantity} × ${viLabel(food.name)}`,
    });
    router.canGoBack() ? router.back() : router.replace('/(tabs)');
  };

  if (isLoading) return <FoodDetailSkeleton />;

  if (isError)
    return (
      <SafeAreaView className="flex-1 bg-cream">
        <FlowHeader title="Chi tiết món ăn" />
        <View className="flex-1 justify-center gap-5 px-5">
          <Text className="text-center font-medium text-base text-ink">
            Không tải được món ăn.
          </Text>
          <FlowButton
            title="Thử lại"
            onPress={() => {
              void refetch();
            }}
          />
        </View>
      </SafeAreaView>
    );

  if (!food) {
    return (
      <SafeAreaView className="flex-1 bg-cream" style={styles.notFound}>
        <Text className="text-ink" style={styles.notFoundTitle}>
          Không tìm thấy món ăn
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          className="bg-forest"
          style={styles.backToHome}
        >
          <Text
            style={[styles.addButtonText, { color: colors.primaryForeground }]}
          >
            Quay lại
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={food.image_url ? { uri: food.image_url } : undefined}
            contentFit="cover"
            transition={220}
            style={styles.heroImage}
            accessibilityLabel={viLabel(food.name)}
          />
          <Pressable
            testID="food-detail-back"
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={21} color={colors.foreground} />
          </Pressable>
          <View
            style={[styles.imagePill, { backgroundColor: colors.foreground }]}
          >
            <Ionicons name="star" size={13} color={colors.primaryForeground} />
            <Text
              style={[
                styles.imagePillText,
                { color: colors.primaryForeground },
              ]}
            >
              {Number(food.restaurants.rating ?? 0).toFixed(1)} · {food.restaurants.name}
            </Text>
          </View>
        </View>

        <View style={styles.foodInfo} onLayout={event => { foodInfoY.current = event.nativeEvent.layout.y; }}>
          <View style={styles.namePriceRow}>
            <View style={styles.nameCopy}>
              <Text className="text-ink" style={styles.foodName}>
                {viLabel(food.name)}
              </Text>
              <Text
                style={[styles.foodSubtitle, { color: colors.mutedForeground }]}
              >
                Được chuẩn bị bởi {food.restaurants.name}.
              </Text>
            </View>
            <View style={{ maxWidth: '48%' }}><FoodPrice food={food} detail /></View>
          </View>

          {discountPercent !== null && <View style={[styles.basePriceHint, { backgroundColor: '#FFF3E8' }]}>
            <Ionicons
              name="pricetag-outline"
              size={14}
              color="#F47721"
            />
            <Text
              style={[
                styles.basePriceHintText,
                { color: '#BA5418' },
              ]}
            >
              Giảm {discountPercent}%
            </Text>
          </View>}

          <FoodReviewStats foodId={food.id} />
          {!!food.description && <Text className="mb-5 font-regular text-sm leading-6 text-muted">{viLabel(food.description)}</Text>}
          <FoodOptions groups={groups} selection={selection}
            invalidGroupIds={attemptedAdd ? missing.map(group => group.id) : []}
            onLayout={event => { optionsY.current = event.nativeEvent.layout.y; }}
            onGroupLayout={(groupId, y) => { groupPositions.current[groupId] = y; }}
            onToggle={(group, itemId) => setSelection(current => toggleOption(current, group, itemId))} />
          {!available && <Text accessibilityRole="alert" className="mt-4 font-medium text-sm text-coral">{food.is_available ? 'Quán hiện đang đóng cửa.' : 'Món này hiện ngừng bán.'}</Text>}
          {missing.length > 0 && <Text accessibilityLiveRegion="polite" className="mt-4 font-regular text-sm text-muted">Vui lòng chọn: {missing.map(group => viLabel(group.name)).join(', ')}.</Text>}
          <Text className="mb-2 mt-5 font-semibold text-sm text-ink">Ghi chú cho quán</Text>
          <TextInput accessibilityLabel="Ghi chú cho quán" value={note} onChangeText={setNote} maxLength={500} multiline
            placeholder="Ít muối, không hành…" className="min-h-20 rounded-2xl border border-line bg-card px-4 py-3 font-regular text-sm text-ink" />
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={[styles.quantityControl, { borderColor: colors.border }]}>
          <Pressable
            testID="decrease-food-quantity"
            accessibilityRole="button"
            accessibilityLabel="Giảm số lượng"
            accessibilityState={{ disabled: quantity <= 1 }}
            disabled={quantity <= 1}
            onPress={() => setQuantity((current) => Math.max(1, current - 1))}
            style={styles.quantityButton}
          >
            <Ionicons
              name="remove"
              size={18}
              color={quantity <= 1 ? colors.mutedForeground : colors.foreground}
            />
          </Pressable>
          <Text style={[styles.quantityText, { color: colors.foreground }]}>
            {quantity}
          </Text>
          <Pressable
            testID="increase-food-quantity"
            accessibilityRole="button"
            accessibilityLabel="Tăng số lượng"
            onPress={() => setQuantity((current) => current + 1)}
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={18} color={colors.foreground} />
          </Pressable>
        </View>
        <Pressable
          testID="add-to-cart"
          accessibilityRole="button"
          disabled={!available}
          accessibilityState={{ disabled: !available }}
          onPress={handleAddToCart}
          className="bg-teal"
          style={styles.addButton}
        >
          <Text
            style={[styles.addButtonText, { color: colors.primaryForeground }]}
          >
            Thêm vào giỏ · {currency(orderTotal)}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={17}
            color={colors.primaryForeground}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 22,
  },
  hero: {
    height: 310,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 18,
    top: 15,
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePill: {
    position: 'absolute',
    right: 17,
    bottom: 16,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  imagePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  foodInfo: {
    paddingHorizontal: 20,
    paddingTop: 21,
  },
  namePriceRow: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  nameCopy: {
    flex: 1,
  },
  foodName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    letterSpacing: -0.7,
    marginBottom: 6,
  },
  foodSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  basePrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    marginTop: 4,
  },
  basePriceHint: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 0,
    marginBottom: 23,
  },
  basePriceHintText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  quantityControl: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minWidth: 124,
  },
  quantityButton: {
    width: 38,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    minWidth: 18,
    textAlign: 'center',
  },
  addButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  addButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  notFoundTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  backToHome: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
