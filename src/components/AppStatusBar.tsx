import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keep Android system icons readable on both Expo Go and edge-to-edge builds. */
export function AppStatusBar() {
  const insets = useSafeAreaInsets();
  return <>
    <StatusBar style={Platform.OS === 'android' ? 'light' : 'dark'} hidden={false} />
    {Platform.OS === 'android' && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#000000', zIndex: 100 }} />}
  </>;
}
