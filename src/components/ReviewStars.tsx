import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';

export function ReviewStars({ value, onChange, disabled, label }: { value: number; onChange: (value: number) => void; disabled: boolean; label: string }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
    {[1,2,3,4,5].map(star => <AppPressable key={star} accessibilityRole="radio" accessibilityLabel={`${label}: ${star} sao`} accessibilityState={{ checked: value === star, disabled }} disabled={disabled} onPress={() => onChange(star)} style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={star <= value ? 'star' : 'star-outline'} size={43} color="#FFBB19" />
    </AppPressable>)}
  </View>;
}
