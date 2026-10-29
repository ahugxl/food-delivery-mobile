import type { Database } from '../../types/database.types';

type Category = Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name'>;

export function menuSections<T extends { id: string; name: string; category_id: string | null }>(foods: T[], categories: Category[]) {
  const known = new Map(categories.map(category => [category.id, category]));
  const groups = new Map<string, { key: string; title: string; foods: T[] }>();
  for (const food of foods) {
    const category = food.category_id ? known.get(food.category_id) : undefined;
    const key = category?.id ?? 'uncategorized';
    if (!groups.has(key)) groups.set(key, { key, title: category?.name ?? 'Món khác', foods: [] });
    groups.get(key)!.foods.push(food);
  }
  return [...groups.values()]
    .sort((a, b) => a.key === 'uncategorized' ? 1 : b.key === 'uncategorized' ? -1 : a.title.localeCompare(b.title, 'vi') || a.key.localeCompare(b.key))
    .map(group => {
      const sorted = [...group.foods].sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id));
      const data: T[][] = [];
      for (let i = 0; i < sorted.length; i += 2) data.push(sorted.slice(i, i + 2));
      return { key: group.key, title: group.title, count: sorted.length, data };
    });
}
