import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from '../../components/AppPressable';
import type { OptionGroup, Selection } from './selection';
import { viLabel } from '../../utils/vietnamese';
import { currency } from '../order/checkout';

export function FoodOptions({ groups, selection, onToggle, invalidGroupIds = [], onLayout, onGroupLayout }: {
  groups: OptionGroup[];
  selection: Selection;
  onToggle: (group: OptionGroup, itemId: string) => void;
  invalidGroupIds?: string[];
  onLayout?: (event: LayoutChangeEvent) => void;
  onGroupLayout?: (groupId: string, y: number) => void;
}) {
  return <View className="gap-6" onLayout={onLayout}>
    {groups.map(group => {
      const invalid = invalidGroupIds.includes(group.id);
      return <View key={group.id} className="gap-3" onLayout={event => onGroupLayout?.(group.id, event.nativeEvent.layout.y)}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-bold text-base text-ink">{viLabel(group.name)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: invalid ? '#FFF0EB' : '#DCF8E5' }}>
          {invalid && <Ionicons name="alert-circle" size={13} color="#C94224" />}
          <Text accessibilityRole={invalid ? 'alert' : undefined} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: invalid ? '#C94224' : '#17603D' }}>
            {group.allow_multiple ? group.is_required ? 'Chọn ít nhất 1' : 'Chọn nhiều' : 'Chọn 1'}
          </Text>
        </View>
      </View>
      {group.food_option_items.length === 0
        ? <Text className="font-regular text-sm text-muted">Chưa có lựa chọn.</Text>
        : group.food_option_items.map(item => {
          const selected = (selection[group.id] ?? []).includes(item.id);
          return <AppPressable key={item.id} testID={`option-${item.id}`}
            accessibilityRole={group.allow_multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={`${viLabel(item.name)}, cộng ${currency(Number(item.extra_price ?? 0))}`}
            accessibilityState={{ checked: selected }}
            onPress={() => onToggle(group, item.id)}
            className={`min-h-14 flex-row items-center justify-between rounded-2xl border px-4 py-3 ${selected ? 'border-teal bg-tealLight' : 'border-line bg-card'}`}>
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-sm text-ink">{viLabel(item.name)}</Text>
              <Text className="font-regular text-xs text-muted">+{currency(Number(item.extra_price ?? 0))}</Text>
            </View>
            <Ionicons name={group.allow_multiple ? (selected ? 'checkbox' : 'square-outline') : (selected ? 'radio-button-on' : 'radio-button-off')} size={23} color="#008B45" />
          </AppPressable>;
        })}
    </View>; })}
  </View>;
}
