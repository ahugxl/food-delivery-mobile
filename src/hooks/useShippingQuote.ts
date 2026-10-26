import { useQuery } from '@tanstack/react-query';
import type { DeliveryAddress } from '../features/order/checkout';
import { validCoordinates } from '../features/location/coordinates';
import { catalogApi, catalogKeys } from '../services/catalog';
import { haversineDistance, calculateShippingFee } from '../utils/distance';

export function useShippingQuote(restaurantId: string | undefined, address: DeliveryAddress) {
  const restaurant = useQuery({
    queryKey: catalogKeys.restaurant(restaurantId ?? ''),
    queryFn: ({ signal }) => catalogApi.restaurant(restaurantId!, signal),
    enabled: !!restaurantId,
    staleTime: 0,
  });
  // SavedAddressSync supplies the chosen user_addresses row's coordinates;
  // manually selected delivery pins use the same calculation.
  let error: string | null = null;
  let distanceKm: number | null = null;
  if (restaurantId) {
    if (restaurant.isPending) error = 'Đang tải vị trí quán để tính phí giao hàng…';
    else if (restaurant.isError) error = 'Không tải được vị trí quán. Vui lòng thử lại.';
    else if (!validCoordinates(restaurant.data)) error = 'Quán chưa có tọa độ hợp lệ để tính phí giao hàng.';
    else if (!validCoordinates(address)) error = 'Vui lòng chọn điểm giao để tính phí giao hàng.';
    else distanceKm = haversineDistance(restaurant.data, address);
  }
  return { distanceKm, deliveryFee: distanceKm === null ? null : calculateShippingFee(distanceKm), error,
    isFetching: restaurant.isFetching, refetch: restaurant.refetch };
}
