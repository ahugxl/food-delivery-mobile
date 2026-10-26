import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SavedAddress } from '../features/account/validation';
import type { DeliveryAddress } from '../features/order/checkout';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { accountApi } from '../services/account';
export function useAddressActions() {
    const userId = useAuthStore(state => state.user?.id);
    const client = useQueryClient();
    return useMutation({ retry: false, mutationFn: async (input: {
            kind: 'save';
            id: string;
            address: DeliveryAddress;
            isDefault: boolean;
            create: boolean;
        } | {
            kind: 'delete';
            id: string;
        }) => {
            if (!userId || useAuthStore.getState().user?.id !== userId)
                throw new Error('Vui lòng đăng nhập lại.');
            if (useCartStore.getState().isCheckingOut)
                throw new Error('Đang gửi đơn hàng. Vui lòng chờ.');
            if (input.kind === 'delete') {
                await accountApi.removeAddress(input.id);
                return null;
            }
            return accountApi.saveAddress(input.id, input.address, input.isDefault, input.create);
        }, onSuccess: (saved, input) => {
            if (useAuthStore.getState().user?.id !== userId)
                return;
            client.setQueryData<SavedAddress[]>(['addresses', userId], old => {
                const rows = (old ?? []).filter(row => row.id !== input.id).map(row => saved?.is_default ? { ...row, is_default: false } : row);
                return saved ? [saved, ...rows] : rows;
            });
            void client.invalidateQueries({ queryKey: ['addresses', userId] });
        } });
}
