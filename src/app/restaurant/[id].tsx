import { useLocalSearchParams } from 'expo-router';
import RestaurantMenu from '../../features/catalog/RestaurantMenu';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RestaurantMenu key={id} restaurantId={id} />;
}
