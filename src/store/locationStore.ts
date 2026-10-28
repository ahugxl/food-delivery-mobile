import { create } from 'zustand';
import type { DeliveryAddress } from '../features/order/checkout';
import type { Coordinates } from '../features/location/coordinates';

export const useLocationStore = create<{
  status: 'idle' | 'locating' | 'ready' | 'error';
  detected: DeliveryAddress | null;
  coordinates: Coordinates | null;
  error: string;
  attempt: number;
  retry: () => void;
}>(set => ({ status: 'idle', detected: null, coordinates: null, error: '', attempt: 0,
  retry: () => set(state => ({ attempt: state.attempt + 1 })),
}));
