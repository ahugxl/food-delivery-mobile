import { useLocalSearchParams } from 'expo-router';
import CatalogScreen from '../../features/catalog/CatalogScreen';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CatalogScreen key={id} restaurantId={id} />;
}
