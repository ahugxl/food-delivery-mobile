import type { FoodDetail, Row } from '../../types/supabase';

export type OptionGroup = FoodDetail['food_option_groups'][number];
export type Selection = Record<string, string[]>;
export type SelectedOption = {
  groupId: string;
  groupName: string;
  id: string;
  label: string;
  price: number;
};

export function toggleOption(selection: Selection, group: OptionGroup, itemId: string): Selection {
  if (!group.food_option_items.some(item => item.id === itemId)) return selection;
  const current = selection[group.id] ?? [];
  const ids = current.includes(itemId)
    ? current.filter(id => id !== itemId)
    : group.allow_multiple ? [...current, itemId] : [itemId];
  return { ...selection, [group.id]: ids };
}

export function selectedOptions(groups: OptionGroup[], selection: Selection): SelectedOption[] {
  return groups.flatMap(group => group.food_option_items
    .filter(item => (selection[group.id] ?? []).includes(item.id))
    .map(item => ({ groupId: group.id, groupName: group.name, id: item.id, label: item.name, price: Number(item.extra_price ?? 0) })));
}

export function missingRequiredGroups(groups: OptionGroup[], selection: Selection) {
  return groups.filter(group => group.is_required && !group.food_option_items.some(item => (selection[group.id] ?? []).includes(item.id)));
}

export function optionUnitPrice(food: Pick<Row<'foods'>, 'price'>, options: SelectedOption[]) {
  return Math.round((Number(food.price) + options.reduce((sum, item) => sum + item.price, 0)) * 100) / 100;
}

export function cartLineId(foodId: string, options: SelectedOption[], note = '') {
  return `${foodId}:${options.map(option => `${option.groupId}=${option.id}`).sort().join('|') || 'standard'}${note.trim() ? `:note=${encodeURIComponent(note.trim())}` : ''}`;
}
