import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import { accountApi } from '../services/account';
import { useAuthStore } from '../store/authStore';
export function ProfileAvatar({ path, size = 64 }: {
    path?: string | null;
    size?: number;
}) {
    const userId = useAuthStore(state => state.user?.id);
    const query = useQuery({ queryKey: ['profile-avatar', userId, path], queryFn: () => accountApi.avatarUrl(path!), enabled: !!userId && !!path, staleTime: 50 * 60000, refetchInterval: 50 * 60000 });
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [query.data, path]);
    return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF7EF' }}>
    {query.data && !failed ? <Image source={{ uri: query.data }} contentFit="cover" onError={() => setFailed(true)} style={{ width: size, height: size }} accessibilityLabel="Ảnh đại diện"/> : <Ionicons name="person-outline" size={size * .45} color="#008B45"/>}
  </View>;
}
