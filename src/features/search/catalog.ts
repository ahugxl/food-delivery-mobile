import type { Food } from '../../types';
import { featuredFood } from '../food-detail/food';

export const categories = [
  { id: 'fastfood', name: 'Fast Food', icon: 'fast-food-outline' },
  { id: 'drink', name: 'Drink', icon: 'cafe-outline' },
  { id: 'healthy', name: 'Healthy', icon: 'leaf-outline' },
  { id: 'asian', name: 'Asian', icon: 'restaurant-outline' },
] as const;

export type CatalogItem = {
  food: Food;
  restaurant: string;
  categoryId: string;
  rating: number;
  distanceKm: number;
  deliveryTime: string;
  freeDelivery: boolean;
  favorite: boolean;
};

export const catalog: CatalogItem[] = [
  {
    food: featuredFood,
    restaurant: 'Crispy House',
    categoryId: 'fastfood',
    rating: 4.8,
    distanceKm: 0.8,
    deliveryTime: '15–25 min',
    freeDelivery: true,
    favorite: true,
  },
  {
    food: {
      id: 'chicken-burger',
      name: 'Fried Chicken Burger',
      price: 12.5,
      image:
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=85',
    },
    restaurant: 'Burger Corner',
    categoryId: 'fastfood',
    rating: 4.6,
    distanceKm: 2.4,
    deliveryTime: '20–30 min',
    freeDelivery: false,
    favorite: false,
  },
  {
    food: {
      id: 'iced-latte',
      name: 'Iced Latte',
      price: 5,
      image:
        'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=85',
    },
    restaurant: 'Daily Coffee',
    categoryId: 'drink',
    rating: 4.9,
    distanceKm: 0.5,
    deliveryTime: '10–20 min',
    freeDelivery: true,
    favorite: true,
  },
  {
    food: {
      id: 'green-salad',
      name: 'Garden Salad',
      price: 11,
      image:
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=85',
    },
    restaurant: 'The Green Fork',
    categoryId: 'healthy',
    rating: 4.8,
    distanceKm: 1.2,
    deliveryTime: '15–25 min',
    freeDelivery: true,
    favorite: false,
  },
  {
    food: {
      id: 'salmon-sushi',
      name: 'Salmon Sushi',
      price: 18,
      image:
        'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=700&q=85',
    },
    restaurant: 'Miso & Flame',
    categoryId: 'asian',
    rating: 4.9,
    distanceKm: 2.8,
    deliveryTime: '20–30 min',
    freeDelivery: false,
    favorite: true,
  },
  {
    food: {
      id: 'crispy-chicken',
      name: 'Spicy Fried Chicken',
      price: 16,
      image: featuredFood.image,
    },
    restaurant: 'Flame Kitchen',
    categoryId: 'fastfood',
    rating: 4.7,
    distanceKm: 1.6,
    deliveryTime: '15–25 min',
    freeDelivery: true,
    favorite: false,
  },
];

export type SearchFilters = {
  freeship: boolean;
  favorite: boolean;
  nearby: boolean;
  sort: 'recommended' | 'rating' | 'distance';
};
export const defaultFilters: SearchFilters = {
  freeship: false,
  favorite: false,
  nearby: false,
  sort: 'recommended',
};

export function searchCatalog(
  query: string,
  categoryId: string | undefined,
  filters: SearchFilters,
  savedRestaurants?: string[],
) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = catalog.filter((item) => {
    const text =
      `${item.food.name} ${item.restaurant} ${categories.find((category) => category.id === item.categoryId)?.name}`.toLowerCase();
    return (
      (!categoryId || item.categoryId === categoryId) &&
      words.every((word) => text.includes(word)) &&
      (!filters.freeship || item.freeDelivery) &&
      (!filters.favorite ||
        (savedRestaurants
          ? savedRestaurants.includes(item.restaurant)
          : item.favorite)) &&
      (!filters.nearby || item.distanceKm <= 2)
    );
  });
  if (filters.sort === 'rating') results.sort((a, b) => b.rating - a.rating);
  if (filters.sort === 'distance')
    results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}
