import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import ServerTracking from '../features/order/ServerTracking';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { DriverAvatar } from '../components/DriverAvatar';
import { driverProfile, trackingMapImage } from '../features/order/orderData';
import { useOrderStore } from '../store/orderStore';
import { FlowButton } from '../components/FlowUI';
import { useColors } from '@/hooks/useColors';

export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return orderId ? <ServerTracking key={orderId} orderId={orderId} /> : <LegacyTrackingScreen />;
}

function LegacyTrackingScreen() {
  const deliveryAddress = useOrderStore(
    (state) => state.deliveryAddress.street,
  );
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapHeight = Math.min(430, Math.max(310, height * 0.46));

  const handleCallDriver = () => {
    Alert.alert(
      'Call driver',
      'Phone calls are not connected in this preview.',
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={[styles.mapArea, { height: mapHeight }]}>
        <Image
          source={{ uri: trackingMapImage }}
          contentFit="cover"
          transition={250}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Map preview of the delivery route"
        />
        <View style={[styles.routeLine, { backgroundColor: colors.primary }]} />
        <View
          style={[
            styles.mapMarker,
            styles.pickupMarker,
            { backgroundColor: colors.card, borderColor: colors.primary },
          ]}
        >
          <Ionicons name="restaurant" size={17} color={colors.primary} />
        </View>
        <View
          style={[
            styles.mapMarker,
            styles.destinationMarker,
            { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="location"
            size={19}
            color={colors.primaryForeground}
          />
        </View>
        <View style={styles.mapTopBar}>
          <Pressable
            testID="tracking-back"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[styles.roundButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <View style={[styles.previewBadge, { backgroundColor: colors.card }]}>
            <View
              style={[styles.liveDot, { backgroundColor: colors.primary }]}
            />
            <Text
              style={[styles.previewBadgeText, { color: colors.foreground }]}
            >
              ORDER TRACKING
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View
          style={[styles.sheetHandle, { backgroundColor: colors.border }]}
        />
        <View style={styles.etaRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              ESTIMATED ARRIVAL
            </Text>
            <Text className="text-ink" style={styles.etaText}>
              15-20 mins
            </Text>
          </View>
          <View
            style={[styles.onTheWayBadge, { backgroundColor: colors.accent }]}
          >
            <Ionicons
              name="bicycle-outline"
              size={17}
              color={colors.accentForeground}
            />
            <Text
              style={[styles.onTheWayText, { color: colors.accentForeground }]}
            >
              On the way
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.addressCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.addressIcon, { backgroundColor: colors.secondary }]}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.addressCopy}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              DELIVERING TO
            </Text>
            <Text style={[styles.addressText, { color: colors.foreground }]}>
              {deliveryAddress}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.driverRow}>
          <DriverAvatar size={52} />
          <View style={styles.driverCopy}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              YOUR DRIVER
            </Text>
            <Text className="text-ink" style={styles.driverName}>
              {driverProfile.name}
            </Text>
            <Text
              style={[styles.driverStatus, { color: colors.mutedForeground }]}
            >
              4.9 · {driverProfile.status}
            </Text>
          </View>
          <Pressable
            testID="call-driver"
            accessibilityRole="button"
            accessibilityLabel="Call driver"
            onPress={handleCallDriver}
            style={[styles.driverAction, { backgroundColor: colors.secondary }]}
          >
            <Ionicons
              name="call-outline"
              size={19}
              color={colors.accentForeground}
            />
          </Pressable>
          <Pressable
            testID="message-driver"
            accessibilityRole="button"
            accessibilityLabel="Message driver"
            onPress={() => router.push('/chat')}
            className="bg-forest"
            style={styles.driverAction}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={19}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
        <View className="mt-5">
          <FlowButton
            title="Rate your delivery"
            onPress={() => router.push('/rating')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mapArea: {
    position: 'relative',
    overflow: 'hidden',
  },
  routeLine: {
    position: 'absolute',
    width: 5,
    height: 155,
    left: '48%',
    top: '33%',
    borderRadius: 3,
    opacity: 0.9,
    transform: [{ rotate: '36deg' }],
  },
  mapMarker: {
    position: 'absolute',
    width: 37,
    height: 37,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  pickupMarker: {
    left: '29%',
    top: '40%',
  },
  destinationMarker: {
    right: '23%',
    top: '62%',
  },
  mapTopBar: {
    position: 'absolute',
    top: 13,
    left: 17,
    right: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    minHeight: 35,
    borderRadius: 18,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  previewBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  sheet: {
    flex: 1,
    marginTop: -23,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 17,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  etaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  onTheWayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  onTheWayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  addressCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  addressIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCopy: {
    flex: 1,
  },
  addressText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverCopy: {
    flex: 1,
  },
  driverName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginBottom: 3,
  },
  driverStatus: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  driverAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
