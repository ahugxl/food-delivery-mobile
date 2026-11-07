import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import { UsageAnalytics } from '../features/analytics/usage';

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const environment = process.env.EXPO_PUBLIC_ANALYTICS_ENVIRONMENT?.trim()
  || (__DEV__ ? 'development' : 'production');

function createClient(): PostHog | null {
  if (!key?.startsWith('phc_') || process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'false') return null;
  try {
    const url = new URL(host);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return new PostHog(key, {
      host: url.origin,
      customStorage: AsyncStorage,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      errorTracking: { autocapture: false },
      disableGeoip: true,
      personProfiles: 'identified_only',
      flushAt: 20,
      flushInterval: 30_000,
      maxQueueSize: 100,
      fetchRetryCount: 1,
    });
  } catch { return null; }
}

export const analytics = new UsageAnalytics(createClient(), {
  app: 'soopifood-customer', environment, platform: Platform.OS, event_version: 1,
});
