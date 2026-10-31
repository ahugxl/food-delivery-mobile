import { useLocalSearchParams } from 'expo-router';
import RestaurantReviews from '../features/reviews/RestaurantReviews';
export default function RestaurantReviewsScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId?: string }>();
  return <RestaurantReviews key={restaurantId} restaurantId={restaurantId || ''} />;
}
