import { create } from 'zustand';
import type { Restaurant } from '../types';

type FavoritesState = {
  pendingIds: string[];
  beginUpdate: (key: string) => boolean;
  endUpdate: (key: string) => void;
  favorites: Restaurant[];
  toggleFavorite: (restaurant: Restaurant) => void;
  removeFavorite: (id: string) => void;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  pendingIds: [],
  beginUpdate: (key) => {
    if (get().pendingIds.includes(key)) return false;
    set(state => ({ pendingIds: [...state.pendingIds, key] }));
    return true;
  },
  endUpdate: (key) => set(state => ({ pendingIds: state.pendingIds.filter(id => id !== key) })),
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
