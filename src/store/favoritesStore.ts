import { create } from 'zustand';
import type { Restaurant } from '../types';

type FavoritesState = {
  favorites: Restaurant[];
  toggleFavorite: (restaurant: Restaurant) => void;
  removeFavorite: (id: string) => void;
};

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: [],
  toggleFavorite: (restaurant) =>
    set((state) => ({
      favorites: state.favorites.some((item) => item.id === restaurant.id)
        ? state.favorites.filter((item) => item.id !== restaurant.id)
        : [...state.favorites, restaurant],
    })),
  removeFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.filter((item) => item.id !== id),
    })),
}));
