import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { formatAddress, validCoordinates, type Coordinates } from '../features/location/coordinates';

export async function requireLocationPermission() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Quyền định vị bị từ chối. Bạn vẫn có thể chọn ghim và nhập địa chỉ.');
}
export async function currentCoordinates(): Promise<Coordinates> {
  await requireLocationPermission();
  const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: result.coords.latitude, longitude: result.coords.longitude };
}
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  if (!validCoordinates({ latitude, longitude })) throw new Error('Tọa độ không hợp lệ.');
  if (Platform.OS === 'web') throw new Error('Trên web, hãy nhập địa chỉ. Dịch ngược tự động khả dụng trong Expo Go.');
  await requireLocationPermission();
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const address = results[0] ? formatAddress(results[0]) : '';
  if (!address) throw new Error('Không tìm thấy địa chỉ cụ thể. Hãy nhập địa chỉ cho ghim đã chọn.');
  return address;
}
