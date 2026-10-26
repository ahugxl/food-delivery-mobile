import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { driverApi } from '../services/drivers';

export function useOrderDriver(orderId: string, assignedId: string | null | undefined) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: ['order-driver', userId, orderId, assignedId],
    queryFn: ({ signal }) => driverApi.forOrder(orderId, userId!, signal),
    enabled: !!userId && !!orderId && assignedId !== undefined,
    staleTime: 0,
    refetchInterval: 30000,
  });
}
