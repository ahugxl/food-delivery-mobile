import type { Food, FoodOption } from '../../types';

export const featuredFood: Food = {
  id: '1',
  name: 'Fried Chicken',
  price: 15,
  image:
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1400&q=90',
};

export const sizeOptions: FoodOption[] = [
  { id: 'S', label: 'S', price: 0 },
  { id: 'M', label: 'M', price: 5 },
  { id: 'L', label: 'L', price: 10 },
];

export const toppingOptions: FoodOption[] = [
  { id: 'corn', label: 'Corn', price: 2 },
  { id: 'cheese', label: 'Cheese', price: 5 },
];
