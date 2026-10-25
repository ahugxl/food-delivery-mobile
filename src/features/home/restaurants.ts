import type { Restaurant } from '../../types';

export const recommendedRestaurants: Restaurant[] = [
  {
    id: 'miso-and-flame',
    name: 'Miso & Flame',
    rating: 4.9,
    deliveryTime: '20–30 min',
    tags: ['Japanese', 'Grill'],
    image:
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'the-green-fork',
    name: 'The Green Fork',
    rating: 4.8,
    deliveryTime: '15–25 min',
    tags: ['Fresh', 'Healthy'],
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'little-napoli',
    name: 'Little Napoli',
    rating: 4.7,
    deliveryTime: '25–35 min',
    tags: ['Italian', 'Pasta'],
    image:
      'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85',
  },
];
