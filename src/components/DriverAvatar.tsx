import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

type DriverAvatarProps = {
  size: number;
  accessibilityLabel?: string;
};

const DRIVER_AVATAR =
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&h=320&q=85';

export function DriverAvatar({
  size,
  accessibilityLabel = 'Tài xế John Cooper',
}: DriverAvatarProps) {
  return (
    <Image
      source={{ uri: DRIVER_AVATAR }}
      contentFit="cover"
      transition={180}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E5F0E5',
  },
});
