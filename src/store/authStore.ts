import { supabase } from '../services/supabase';
import { createAuthStore } from './authState';
import { useCartStore } from './cartStore';
import { useOrderStore } from './orderStore';
import { useFavoritesStore } from './favoritesStore';

export type { User } from './authState';
export const useAuthStore = createAuthStore(supabase);

// Initial session restoration keeps the hydrated cart only for its original owner.
useAuthStore.subscribe((state, previous) => {
  if (!state.isInitialized || (previous.isInitialized && state.user?.id === previous.user?.id)) return;
  if (state.user) useCartStore.getState().setOwner(state.user.id);
  else if (previous.user) useCartStore.getState().setOwner(null);
  useOrderStore.setState(useOrderStore.getInitialState());
  useFavoritesStore.setState(useFavoritesStore.getInitialState());
  const cart = useCartStore.getState();
  if (state.user && cart.ownerId === state.user.id && cart.checkoutRequest?.context) {
    useOrderStore.setState({
      deliveryAddress: cart.checkoutRequest.context.address,
      checkoutVoucher: cart.checkoutRequest.context.voucher,
      shippingVoucher: cart.checkoutRequest.context.shippingVoucher ?? null,
    });
  }
});
