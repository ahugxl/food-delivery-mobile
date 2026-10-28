import '../../global.css';
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AppStatusBar } from '../components/AppStatusBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/src/store/authStore';
import { AppToast } from '@/src/components/AppToast';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/src/services/supabase';
import { useCartStore } from '@/src/store/cartStore';
import { SavedAddressSync } from '../hooks/useSavedAddresses';
import { StartupLocationSync } from '../hooks/useStartupLocation';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        statusBarStyle: Platform.OS === 'android' ? 'light' : 'dark',
        statusBarHidden: false,
        navigationBarHidden: false,
      }}
    >
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="food/[id]" />
        <Stack.Screen name="restaurant/[id]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="search" />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="select-location" />
        <Stack.Screen name="select-offer" />
        <Stack.Screen name="campaign" />
        <Stack.Screen name="voucher-wallet" />
        <Stack.Screen name="tracking" />
        <Stack.Screen name="rating" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="address-form" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const [cartReady, setCartReady] = useState(false);
  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) queryClient.clear();
  }), []);
  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    void Promise.resolve(useCartStore.persist.rehydrate()).finally(() => {
      if (!active) return;
      const unsubscribe = useAuthStore.getState().initialize();
      setCartReady(true);
      if (Platform.OS === 'web' || !supabase) { cleanup = unsubscribe; return; }
      const client = supabase;
      const refresh = (state: string) => {
        if (state === 'active') client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      };
      refresh(AppState.currentState);
      const listener = AppState.addEventListener('change', refresh);
      cleanup = () => { unsubscribe(); listener.remove(); client.auth.stopAutoRefresh(); };
    });
    return () => {
      active = false;
      cleanup();
    };
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && isInitialized && cartReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isInitialized, cartReady]);

  if ((!fontsLoaded && !fontError) || !isInitialized || !cartReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, width: '100%', backgroundColor: '#FFFFFF', maxWidth: Platform.OS === 'web' ? 520 : undefined, alignSelf: 'center' }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
            <ErrorBoundary>
              <SavedAddressSync />
              <StartupLocationSync />
              <RootLayoutNav />
              <AppStatusBar />
              <AppToast />
            </ErrorBoundary>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
