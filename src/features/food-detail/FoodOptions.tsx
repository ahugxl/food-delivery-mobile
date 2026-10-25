import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from '../../components/AppPressable';
import type { OptionGroup, Selection } from './selection';

export function FoodOptions({ groups, selection, onToggle }: {
  groups: OptionGroup[];
  selection: Selection;
  onToggle: (group: OptionGroup, itemId: string) => void;
}) {
  return <View className="gap-6">
    {groups.map(group => <View key={group.id} className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-bold text-base text-ink">{group.name}</Text>
        <Text className="font-regular text-xs text-muted">
          {group.is_required ? 'Required' : 'Optional'} · {group.allow_multiple ? 'Choose any' : 'Select one'}
        </Text>
      </View>
      {group.food_option_items.length === 0
        ? <Text className="font-regular text-sm text-muted">No options available.</Text>
        : group.food_option_items.map(item => {
          const selected = (selection[group.id] ?? []).includes(item.id);
          return <AppPressable key={item.id} testID={`option-${item.id}`}
            accessibilityRole={group.allow_multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={`${item.name}, +$${Number(item.extra_price ?? 0).toFixed(2)}`}
            accessibilityState={{ checked: selected }}
            onPress={() => onToggle(group, item.id)}
            className={`min-h-14 flex-row items-center justify-between rounded-2xl border px-4 py-3 ${selected ? 'border-teal bg-tealLight' : 'border-line bg-card'}`}>
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-sm text-ink">{item.name}</Text>
              <Text className="font-regular text-xs text-muted">+${Number(item.extra_price ?? 0).toFixed(2)}</Text>
            </View>
            <Ionicons name={group.allow_multiple ? (selected ? 'checkbox' : 'square-outline') : (selected ? 'radio-button-on' : 'radio-button-off')} size={23} color="#159E98" />
          </AppPressable>;
        })}
    </View>)}
  </View>;
}
