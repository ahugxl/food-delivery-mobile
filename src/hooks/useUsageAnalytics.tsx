import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { analytics } from '../services/analytics';
import { usageScreen } from '../features/analytics/usage';
import { useCartStore } from '../store/cartStore';

export function UsageAnalyticsSync() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const segments = useSegments();
  const screen = usageScreen(segments);
  useEffect(() => {
    analytics.syncUser(userId);
    if (AppState.currentState === 'active' || Platform.OS === 'web') analytics.foreground();
    analytics.screenViewed(screen);
    if (screen === 'checkout') {
      const items = useCartStore.getState().items;
      analytics.checkoutStarted(items.reduce((sum, item) => sum + item.quantity, 0),
        items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    }
  }, [userId, screen]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') analytics.foreground();
      else if (state === 'background') analytics.background();
    });
    // RN AppState does not reliably follow browser tab visibility.
    const visibility = () => {
      if (document.visibilityState === 'hidden') analytics.background();
      else analytics.foreground();
    };
    const pagehide = () => analytics.background();
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('pagehide', pagehide);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('pagehide', pagehide);
      }
    };
  }, []);
  return null;
}

// Live local search has no submit request. Treat a settled query as one search,
// with a per-visit dedupe and no raw keyword sent to the analytics service.
export function useSearchUsage(keyword: string, resultCount: number, ready: boolean,
  source: 'home' | 'search' | 'category') {
  const last = useRef('');
  const normalized = keyword.trim().toLocaleLowerCase('vi');
  useEffect(() => {
    if (!normalized) { last.current = ''; return; }
    if (!ready || normalized === last.current) return;
    const timer = setTimeout(() => {
      if (last.current === normalized) return;
      last.current = normalized;
      analytics.searchSubmitted(source, normalized.length, resultCount);
    }, 1_000);
    return () => clearTimeout(timer);
  }, [normalized, resultCount, ready, source]);
}
