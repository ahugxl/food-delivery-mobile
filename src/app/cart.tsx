import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCartStore } from '../store/cartStore';
import type { CartItem } from '../types';
import { purchaseTotals } from '../features/order/purchase';
import { useOrderStore } from '../store/orderStore';
import { EmptyState } from '../components/EmptyState';
import { currency } from '../features/order/checkout';
import { viLabel } from '../utils/vietnamese';
import { useShippingQuote } from '../hooks/useShippingQuote';



function CartRow({
  item,
  onIncrease,
  onDecrease,
}: {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const colors = useColors();
  const locked = useCartStore(state => state.isCheckingOut);
  const [note, setNote] = useState(item.note);
  useEffect(() => setNote(item.note), [item.note]);
  const optionDescription = item.options.map(option => `${viLabel(option.groupName)}: ${viLabel(option.label)}`).join(' · ') || 'Mặc định';

  return (
    <View
      style={[
        styles.cartRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Image
        source={{ uri: item.image }}
        contentFit="cover"
        transition={180}
        style={styles.foodThumbnail}
        accessibilityLabel={viLabel(item.name)}
      />
      <View style={styles.itemDetails}>
        <Text numberOfLines={1} className="text-ink" style={styles.itemName}>
          {viLabel(item.name)}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.itemOptions, { color: colors.mutedForeground }]}
        >
          {optionDescription}
        </Text>
        <TextInput accessibilityLabel={`Ghi chú cho ${viLabel(item.name)}`} value={note} onChangeText={setNote} editable={!locked} maxLength={500}
          onEndEditing={event => { const error = useCartStore.getState().setNote(item.lineId, event.nativeEvent.text); if (error) { setNote(item.note); Toast.show({ type: 'error', text1: error }); } }} placeholder="Thêm ghi chú…"
          className="my-2 min-h-11 rounded-xl border border-line px-3 font-regular text-xs text-ink" />
        <View style={styles.itemBottomRow}>
          <Text className="text-coral" style={styles.itemPrice}>
            {currency(item.unitPrice * item.quantity)}
          </Text>
          <View style={[styles.stepper, { borderColor: colors.border }]}>
            <Pressable
              testID={`cart-decrease-${item.lineId}`}
              accessibilityRole="button"
              accessibilityLabel={`Giảm số lượng ${viLabel(item.name)}`}
              onPress={onDecrease}
              disabled={locked}
              style={styles.stepperButton}
            >
              <Ionicons name="remove" size={15} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.quantity, { color: colors.foreground }]}>
              {item.quantity}
            </Text>
            <Pressable
              testID={`cart-increase-${item.lineId}`}
              accessibilityRole="button"
              accessibilityLabel={`Tăng số lượng ${viLabel(item.name)}`}
              onPress={onIncrease}
              disabled={locked || item.quantity >= 99}
              style={styles.stepperButton}
            >
              <Ionicons name="add" size={15} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const items = useCartStore((state) => state.items);
  const incrementQuantity = useCartStore((state) => state.incrementQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const appliedVoucher = useOrderStore((state) => state.checkoutVoucher);
  const locked = useCartStore(state => state.isCheckingOut);
  const isEmpty = items.length === 0;
  const address = useOrderStore(state => state.deliveryAddress);
  const shipping = useShippingQuote(items[0]?.restaurantId, address);
  const shippingReady = isEmpty || shipping.deliveryFee !== null;
  const { subtotal, deliveryFee, discount, total } = purchaseTotals(items, appliedVoucher, Date.now(), shipping.deliveryFee ?? 0);

  const handleOrder = () => {
    if (isEmpty) return;
    router.push('/checkout');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      
      <View style={styles.header}>
        <Pressable
          testID="cart-back"
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: colors.card }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text className="text-ink" style={styles.title}>
            Giỏ hàng
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {items.length} món trong giỏ hàng
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Xóa giỏ hàng" disabled={locked || isEmpty} onPress={() => { useCartStore.getState().clearCart(); useOrderStore.getState().setCheckoutVoucher(null); }} className="min-h-11 justify-center px-2"><Text className="font-semibold text-sm text-coral">Xóa</Text></Pressable>
      </View>

      <FlashList<CartItem>
        testID="cart-items"
        data={items}
        keyExtractor={(item) => item.lineId}
        renderItem={({ item }) => (
          <CartRow
            item={item}
            onIncrease={() => incrementQuantity(item.lineId)}
            onDecrease={() => removeFromCart(item.lineId)}
          />
        )}
        contentContainerStyle={{
          ...styles.listContent,
          ...(isEmpty ? { flexGrow: 1 } : {}),
        }}
        ListEmptyComponent={
          <EmptyState
            title="Giỏ hàng đang trống"
            description="Khám phá các quán ngon, chọn món yêu thích và thêm vào giỏ hàng nhé."
          />
        }
      />

      {!isEmpty && (
        <View
          style={[
            styles.checkoutPanel,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Text className="text-ink" style={styles.paymentTitle}>
            Chi tiết thanh toán
          </Text>
          {!!shipping.error && <Text className="mb-3 text-xs text-muted">{shipping.error}</Text>}
          <View style={styles.paymentRow}>
            <Text
              style={[styles.paymentLabel, { color: colors.mutedForeground }]}
            >
              Tạm tính
            </Text>
            <Text style={[styles.paymentValue, { color: colors.foreground }]}>
              {currency(subtotal)}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text
              style={[styles.paymentLabel, { color: colors.mutedForeground }]}
            >
              Phí giao hàng
            </Text>
            <Text style={[styles.paymentValue, { color: colors.foreground }]}>
              {shippingReady ? currency(deliveryFee) : 'Chọn điểm giao để tính phí'}
            </Text>
          </View>
          {discount > 0 && (
            <View style={styles.paymentRow}>
              <Text className="font-medium text-xs text-teal">
                Giảm giá
              </Text>
              <Text className="font-semibold text-xs text-teal">
                -{currency(discount)}
              </Text>
            </View>
          )}
          <View
            style={[styles.paymentDivider, { backgroundColor: colors.border }]}
          />
          <View style={styles.paymentRow}>
            <Text className="text-ink" style={styles.totalLabel}>
              Tổng cộng
            </Text>
            <Text className="text-ink" style={styles.totalValue}>
              {shippingReady ? currency(total) : 'Chưa xác định'}
            </Text>
          </View>
          <Pressable
            testID="order-now"
            accessibilityRole="button"
            accessibilityState={{ disabled: isEmpty }}
            disabled={isEmpty || locked}
            onPress={handleOrder}
            className={isEmpty ? 'bg-sage' : 'bg-teal'}
            style={styles.orderButton}
          >
            <Text
              style={[
                styles.orderButtonText,
                {
                  color: isEmpty
                    ? colors.accentForeground
                    : colors.primaryForeground,
                },
              ]}
            >
              {shippingReady ? `Thanh toán · ${currency(total)}` : 'Tiếp tục thanh toán'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={
                isEmpty ? colors.accentForeground : colors.primaryForeground
              }
            />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonSpacer: {
    width: 42,
  },
  headerCopy: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 5,
    paddingBottom: 14,
  },
  cartRow: {
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 11,
  },
  foodThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  itemOptions: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  itemPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  stepper: {
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 29,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    minWidth: 14,
    textAlign: 'center',
  },
  checkoutPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  paymentTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    marginBottom: 13,
  },
  paymentRow: {
    minHeight: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  paymentValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  paymentDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 9,
  },
  totalLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  totalValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  orderButton: {
    minHeight: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 13,
    paddingHorizontal: 14,
  },
  orderButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
});
