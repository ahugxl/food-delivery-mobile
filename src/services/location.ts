import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { formatAddress, validCoordinates, type Coordinates } from '../features/location/coordinates';
import { acquireCoordinates, withLocationDeadline } from '../features/location/startupLocation';

export async function requireLocationPermission() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Chưa có quyền định vị. Hãy cấp quyền Vị trí cho Expo Go/ứng dụng trong Cài đặt Android, hoặc chọn địa chỉ thủ công.');
}
export async function currentCoordinates(): Promise<Coordinates> {
  await requireLocationPermission();
  return acquireCoordinates({
    servicesEnabled: () => Location.hasServicesEnabledAsync(),
    lastKnown: () => Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 }),
    current: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
  });
}
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  if (!validCoordinates({ latitude, longitude })) throw new Error('Tọa độ không hợp lệ.');
  if (Platform.OS === 'web') throw new Error('Trên web, hãy chọn địa chỉ đã lưu hoặc nhập địa chỉ cho ghim. Tự đổi tọa độ thành địa chỉ khả dụng trên điện thoại.');
  await requireLocationPermission();
  const results = await withLocationDeadline(Location.reverseGeocodeAsync({ latitude, longitude }), 12000,
    'Đã lấy được tọa độ nhưng dịch vụ địa chỉ Android chưa phản hồi. Hãy kiểm tra mạng hoặc nhập địa chỉ cho ghim.');
  const address = results[0] ? formatAddress(results[0]) : '';
  if (!address) throw new Error('Không tìm thấy địa chỉ cụ thể. Hãy nhập địa chỉ cho ghim đã chọn.');
  return address;
}
