export type UsageProperties = Record<string, string | number | boolean>;
export interface UsageClient {
  capture: (event: string, properties: UsageProperties, options?: { uuid: string }) => void;
  identify: (id: string) => void;
  reset: () => void;
  flush: () => Promise<unknown>;
}

const screens: Record<string, string> = {
  '(tabs)': 'home', '(tabs)/index': 'home', '(tabs)/orders': 'orders',
  '(tabs)/favorites': 'favorites', '(tabs)/inbox': 'offers', '(tabs)/offers': 'offers',
  '(tabs)/account': 'account', '(auth)/welcome': 'welcome', '(auth)/login': 'login',
  '(auth)/register': 'register', '(auth)/forgot-password': 'forgot_password',
  'food/[id]': 'food_detail', 'restaurant/[id]': 'restaurant',
  'category/[id]': 'category', 'restaurant-reviews': 'restaurant_reviews',
  search: 'search', cart: 'cart', checkout: 'checkout', tracking: 'tracking',
  rating: 'rating', 'order-detail': 'order_detail', chat: 'order_chat',
  campaign: 'campaign', 'voucher-wallet': 'voucher_wallet', 'voucher-history': 'voucher_history',
  'select-offer': 'select_offer', 'ai-assistant': 'ai_assistant', profile: 'profile',
  addresses: 'addresses', 'address-form': 'address_form', 'delivery-location': 'delivery_location',
  'select-location': 'select_location', 'reset-password': 'reset_password',
  'oauth-callback': 'oauth_callback',
};

// Only static route names leave the device: never URLs, query strings or route IDs.
export function usageScreen(segments: readonly string[]): string {
  return screens[segments.join('/')] ?? 'other';
}

export class UsageAnalytics {
  private userId: string | null | undefined;
  private lastScreen: string | null = null;
  private opened = false;
  private backgroundAt: number | null = null;
  private checkoutVisit = false;
  private reportedOrders = new Set<string>();

  constructor(private client: UsageClient | null, private context: UsageProperties) {}

  private safely(action: () => unknown) {
    try {
      const value = action();
      if (value instanceof Promise) void value.catch(() => {});
    } catch { /* Analytics must never interrupt a purchase, navigation or authentication. */ }
  }

  private emit(event: string, properties: UsageProperties = {}, uuid?: string) {
    this.safely(() => this.client?.capture(event, {
      ...this.context, authenticated: !!this.userId, ...properties,
    }, uuid ? { uuid } : undefined));
  }

  syncUser(userId: string | null) {
    if (this.userId === userId) return;
    // Reset a persisted previous identity on startup and when switching/logout.
    // Anonymous events in this running session can still join a subsequent login.
    if (this.userId === undefined || this.userId !== null) this.safely(() => this.client?.reset());
    this.userId = userId;
    this.lastScreen = null;
    if (userId) this.safely(() => this.client?.identify(userId));
  }

  foreground(now = Date.now()) {
    if (!this.opened || (this.backgroundAt !== null && now - this.backgroundAt >= 30 * 60_000)) {
      this.emit('app_opened', { launch_type: this.opened ? 'resume' : 'cold_start' });
      // A user resuming the same screen on a new day must still count as active.
      if (this.opened && this.lastScreen) this.emit('screen_viewed', { screen_name: this.lastScreen });
      this.opened = true;
    }
    this.backgroundAt = null;
  }

  background(now = Date.now()) {
    if (this.backgroundAt === null) this.backgroundAt = now;
    this.flush();
  }

  screenViewed(screenName: string) {
    if (screenName === this.lastScreen) return;
    this.lastScreen = screenName;
    if (screenName !== 'checkout') this.checkoutVisit = false;
    this.emit('screen_viewed', { screen_name: screenName });
  }

  searchSubmitted(source: 'home' | 'search' | 'category', length: number, resultCount: number) {
    if (!Number.isInteger(length) || length < 1 || length > 600) return;
    this.emit('search_submitted', { source, query_length: length, result_count: Math.max(0, resultCount) });
  }

  foodAdded(foodId: string, restaurantId: string, quantity: number, unitPrice: number) {
    this.emit('food_added_to_cart', { food_id: foodId, restaurant_id: restaurantId,
      quantity, unit_price: unitPrice, currency: 'VND' });
  }

  checkoutStarted(itemCount: number, subtotal: number) {
    if (!itemCount || this.checkoutVisit) return;
    this.checkoutVisit = true;
    this.emit('checkout_started', { item_count: itemCount, subtotal, currency: 'VND' });
  }

  orderCreated(orderId: string, itemCount: number, total: number, foodVoucher: boolean, shippingVoucher: boolean) {
    if (this.reportedOrders.has(orderId)) return;
    this.reportedOrders.add(orderId);
    if (this.reportedOrders.size > 100) this.reportedOrders.delete(this.reportedOrders.values().next().value!);
    this.emit('order_created', { order_id: orderId, item_count: itemCount, total,
      food_voucher: foodVoucher, shipping_voucher: shippingVoucher, currency: 'VND' }, orderId);
    this.flush();
  }

  flush() { this.safely(() => this.client?.flush()); }
}
