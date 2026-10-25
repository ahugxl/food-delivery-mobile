import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowButton, FlowHeader, RadioMark, TEAL } from '../components/FlowUI';
import type { DeliveryAddress } from '../features/order/checkout';
import { useOrderStore } from '../store/orderStore';

export default function SelectLocationScreen() {
  const address = useOrderStore((state) => state.deliveryAddress);
  const setAddress = useOrderStore((state) => state.setDeliveryAddress);
  const [street, setStreet] = useState(address.street);
  const [label, setLabel] = useState<DeliveryAddress['label']>(address.label);
  const { height } = useWindowDimensions();

  const confirm = () => {
    if (street.trim().length < 5 || street.length > 500) return;
    setAddress({ street: street.trim(), label });
    if (router.canGoBack()) router.back();
    else router.replace('/checkout');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <StatusBar style="dark" />
      <FlowHeader title="Delivery location" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View
            style={{ height: Math.min(380, height * 0.4) }}
            className="items-center justify-center bg-tealLight"
          >
            <Image
              source={require('../../assets/maps/location-placeholder.svg')}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              contentFit="cover"
              accessibilityLabel="Illustrated map preview"
            />
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white/80">
              <Ionicons name="location" size={48} color={TEAL} />
            </View>
            <Text className="absolute bottom-4 rounded-full bg-white px-4 py-2 font-medium text-xs text-muted">
              Map preview · enter your address below
            </Text>
          </View>
          <View className="flex-1 gap-5 rounded-t-3xl bg-cream p-6">
            <Text className="font-bold text-xl text-ink">
              Where should we deliver?
            </Text>
            <View className="gap-2">
              <Text className="font-semibold text-sm text-ink">
                Street address
              </Text>
              <TextInput
                accessibilityLabel="Street address"
                value={street}
                onChangeText={setStreet}
                placeholder="House number and street name"
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                multiline
                maxLength={500}
                className="min-h-16 rounded-2xl border border-line bg-white px-4 py-4 font-regular text-base text-ink"
              />
            </View>
            <Text className="font-semibold text-sm text-ink">
              Save address as
            </Text>
            <View accessibilityRole="radiogroup" className="flex-row gap-3">
              {(['Home', 'Work', 'Other'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: label === value }}
                  onPress={() => setLabel(value)}
                  className={`min-h-14 flex-1 flex-row flex-wrap items-center justify-center gap-2 rounded-2xl border px-2 py-3 ${label === value ? 'border-teal bg-tealLight' : 'border-line bg-white'}`}
                >
                  <RadioMark selected={label === value} />
                  <Text className="font-medium text-sm text-ink">{value}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-auto pt-3">
              <FlowButton
                title="Confirm"
                onPress={confirm}
                disabled={street.trim().length < 5 || street.length > 500}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
