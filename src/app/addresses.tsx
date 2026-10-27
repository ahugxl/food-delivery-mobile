import { useLocalSearchParams } from 'expo-router';
import AddressBookScreen from '../components/AddressBookScreen';

export default function AddressesScreen() {
  const { select } = useLocalSearchParams<{ select?: string }>();
  return <AddressBookScreen selectionMode={select === '1'} />;
}
