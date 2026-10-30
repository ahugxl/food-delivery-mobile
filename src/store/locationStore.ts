import { create } from 'zustand';
import type { DeliveryAddress } from '../features/order/checkout';
import type { Coordinates } from '../features/location/coordinates';
import { confirmedDetectedDelivery } from '../features/location/confirmedDelivery';

export const useLocationStore = create<{
  status: 'idle' | 'locating' | 'ready' | 'error';
  detected: DeliveryAddress | null;
  coordinates: Coordinates | null;
  error: string;
  attempt: number;
  reminderDismissed: boolean;
  dismissReminder: () => void;
  retry: () => void;
  confirmDetected: (initial: DeliveryAddress, confirmed: DeliveryAddress) => void;
}>(set => ({ status: 'idle', detected: null, coordinates: null, error: '', attempt: 0,
  reminderDismissed: false,
  dismissReminder: () => set({ reminderDismissed: true }),
  retry: () => set(state => ({ attempt: state.attempt + 1 })),
  confirmDetected: (initial, confirmed) => set(state => ({ detected: confirmedDetectedDelivery(state.detected, initial, confirmed) })),
}));
