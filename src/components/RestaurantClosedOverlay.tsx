import { StyleSheet, Text, View } from 'react-native';

export function RestaurantClosedOverlay({ closed }: { closed: boolean }) {
  if (!closed) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }]}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: 'white', fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>Đóng cửa</Text>
  </View>;
}
