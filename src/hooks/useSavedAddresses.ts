import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../services/account';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
import { reconcileDeliveryAddress } from '../features/account/validation';
export function useSavedAddresses() {
    const userId = useAuthStore(state => state.user?.id);
    return useQuery({ queryKey: ['addresses', userId], queryFn: ({ signal }) => accountApi.addresses(userId!, signal), enabled: !!userId });
}
export function SavedAddressSync() {
    const userId = useAuthStore(state => state.user?.id);
    const query = useSavedAddresses();
    const current = useOrderStore(state => state.deliveryAddress);
    const locked = useCartStore(state => state.isCheckingOut);
    useEffect(() => {
        if (!query.isSuccess || !userId || useAuthStore.getState().user?.id !== userId || locked)
            return;
        const next = reconcileDeliveryAddress(current, query.data);
        if (next !== current)
            useOrderStore.getState().setDeliveryAddress(next);
    }, [query.data, query.isSuccess, userId, current, locked]);
    const refetch = query.refetch;
    useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state === 'active')
        void refetch(); }); return () => listener.remove(); }, [refetch]);
    return null;
}
