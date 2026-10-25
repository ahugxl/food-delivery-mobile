import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DriverAvatar } from '../../components/DriverAvatar';
import { driverProfile } from '../../features/order/orderData';
import { useColors } from '@/hooks/useColors';

export default function InboxScreen() {
  const colors = useColors();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text className="text-ink" style={styles.title}>
          Inbox
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Messages about your orders.
        </Text>
      </View>

      <Pressable
        testID="driver-conversation"
        accessibilityRole="button"
        accessibilityLabel={`Open conversation with ${driverProfile.name}`}
        onPress={() => router.push('/chat')}
        style={({ pressed }) => [
          styles.conversation,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed ? styles.pressed : undefined,
        ]}
      >
        <View style={styles.avatarWrap}>
          <DriverAvatar size={54} />
          <View
            style={[
              styles.activeDot,
              {
                backgroundColor: colors.tabActive,
                borderColor: colors.background,
              },
            ]}
          />
        </View>
        <View style={styles.conversationCopy}>
          <View style={styles.nameRow}>
            <Text className="text-ink" style={styles.driverName}>
              {driverProfile.name}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              Now
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.preview, { color: colors.mutedForeground }]}
          >
            Thanks for understanding — I’m on my way.
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name="bicycle-outline"
              size={13}
              color={colors.tabActive}
            />
            <Text style={[styles.statusText, { color: colors.tabActive }]}>
              Your delivery
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={17}
          color={colors.mutedForeground}
        />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 21,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  conversation: {
    marginHorizontal: 18,
    borderRadius: 17,
    borderWidth: 1,
    minHeight: 94,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pressed: {
    opacity: 0.85,
  },
  avatarWrap: {
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  conversationCopy: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  time: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
  preview: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
});
