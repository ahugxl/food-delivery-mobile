import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuthStore } from '@/src/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { fetchProfile } from '@/src/services/profile';
import { userMessage } from '../../utils/userMessage';

const accountLinks = [
  { label: 'Địa chỉ đã lưu', icon: 'location-outline', route: '/addresses' },
  { label: 'Phương thức thanh toán', icon: 'card-outline', route: null },
  { label: 'Mã ưu đãi', icon: 'ticket-outline', route: null },
  { label: 'Cài đặt', icon: 'settings-outline', route: null },
  { label: 'Trung tâm trợ giúp', icon: 'help-circle-outline', route: null },
] as const;

export default function AccountScreen() {
  const colors = useColors();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const profile = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: ({ signal }) => fetchProfile(user!.id, signal),
    enabled: !!user?.id,
  });
  const name = profile.data?.full_name || user?.name || 'Tài khoản của bạn';
  const avatar = profile.data ? profile.data.avatar_url : user?.avatar;

  const showComingSoon = (label: string) => {
    Alert.alert(
      label,
      'Tính năng này đang được phát triển.',
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-ink" style={styles.pageTitle}>
          Tài khoản
        </Text>

        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ProfileAvatar path={avatar} size={58} />
          <View style={styles.profileCopy}>
            <Text className="text-ink" style={styles.userName}>
              {name}
            </Text>
            <Text style={[styles.phone, { color: colors.mutedForeground }]}>
              {user?.email ?? ''}
            </Text>
            {!!profile.data?.phone && <Text style={[styles.phone, { color: colors.mutedForeground }]}>{profile.data.phone}</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa hồ sơ"
            onPress={() => router.push('/profile')}
            style={[styles.editButton, { backgroundColor: colors.accent }]}
          >
            <Ionicons
              name="create-outline"
              size={17}
              color={colors.accentForeground}
            />
          </Pressable>
        </View>

        {profile.isError && (
          <Pressable accessibilityRole="button" onPress={() => { void profile.refetch(); }} className="mb-4 rounded-xl bg-sage p-4">
            <Text className="text-sm text-forest">Không tải được hồ sơ. Chạm để thử lại.</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          TÀI KHOẢN CỦA BẠN
        </Text>
        <View
          style={[
            styles.linksCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {accountLinks.map((item, index) => (
            <Pressable
              key={item.label}
              testID={`account-link-${item.label.toLowerCase().replaceAll(' ', '-')}`}
              accessibilityRole="button"
              onPress={() => item.route ? router.push(item.route) : showComingSoon(item.label)}
              style={[
                styles.linkRow,
                index < accountLinks.length - 1
                  ? {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    }
                  : undefined,
              ]}
            >
              <View
                style={[styles.linkIcon, { backgroundColor: colors.secondary }]}
              >
                <Ionicons
                  name={item.icon}
                  size={17}
                  color={colors.accentForeground}
                />
              </View>
              <Text className="text-ink" style={styles.linkLabel}>
                {item.label}
              </Text>
              {!item.route && <Text className="text-xs text-muted">Sắp có</Text>}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="account-logout"
          accessibilityRole="button"
          disabled={isLoading}
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          onPress={() => { void logout().catch((error: unknown) => Alert.alert('Không đăng xuất được', userMessage(error))); }}
          style={[styles.logoutButton, { borderColor: colors.destructive }]}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={colors.destructive}
          />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            Đăng xuất
          </Text>
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Giao đồ ăn · Phiên bản 1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  pageTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    letterSpacing: -0.6,
    marginBottom: 19,
  },
  profileCard: {
    minHeight: 91,
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 25,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  profileCopy: {
    flex: 1,
    gap: 5,
  },
  userName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  phone: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  editButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
  linksCard: {
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  linkRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  logoutButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  version: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 16,
  },
});
