import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { MapPanelProps } from './MapPanel.types';
import { validCoordinates } from '../../features/location/coordinates';
import { FlowButton } from '../FlowUI';

export default function MapPanel({ coordinate, onSelect, origin, driver, simulation }: MapPanelProps) {
  const [latitude, setLatitude] = useState(String(coordinate.latitude));
  const [longitude, setLongitude] = useState(String(coordinate.longitude));
  useEffect(() => { setLatitude(String(coordinate.latitude)); setLongitude(String(coordinate.longitude)); }, [coordinate.latitude, coordinate.longitude]);
  const point = { latitude: latitude.trim() ? Number(latitude) : NaN, longitude: longitude.trim() ? Number(longitude) : NaN };
  const total = origin ? Math.hypot(coordinate.latitude - origin.latitude, coordinate.longitude - origin.longitude) : 0;
  const progress = origin && driver && total ? Math.min(1, Math.max(0, Math.hypot(driver.latitude - origin.latitude, driver.longitude - origin.longitude) / total)) : 0;
  return <View className="gap-3 rounded-3xl border border-line bg-tealLight p-4">
    <Text className="font-semibold text-sm text-ink">{simulation ? 'Chuyến đi mô phỏng · đường thẳng' : 'Sơ đồ vị trí giao hàng'}</Text>
    <Svg width="100%" height={180} viewBox="0 0 360 180" accessibilityLabel="Sơ đồ từ nhà hàng đến điểm giao">
      {[40, 80, 120, 160].map(y => <Line key={y} x1={0} y1={y} x2={360} y2={y} stroke="#C9DAD5" />)}
      {[40, 100, 160, 220, 280, 340].map(x => <Line key={x} x1={x} y1={0} x2={x} y2={180} stroke="#C9DAD5" />)}
      <Path d="M 40 140 L 320 40" stroke="#159E98" strokeWidth={5} />
      {origin && <><Circle cx={40} cy={140} r={9} fill="#159E98" /><SvgText x={15} y={166} fontSize={12}>Nhà hàng</SvgText></>}
      <Circle cx={320} cy={40} r={9} fill="#FF6B55" /><SvgText x={275} y={24} fontSize={12}>Điểm giao</SvgText>
      {!!driver && <SvgText x={40 + progress * 280 - 12} y={140 - progress * 100} fontSize={27}>🏍️</SvgText>}
    </Svg>
    <Text className="font-regular text-xs text-muted">Sơ đồ không phải bản đồ đường phố. Mở Expo Go để kéo ghim trên bản đồ hệ điều hành.</Text>
    {onSelect ? <>
      <TextInput accessibilityLabel="Vĩ độ" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" className="min-h-11 rounded-xl bg-white px-3 text-ink" />
      <TextInput accessibilityLabel="Kinh độ" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" className="min-h-11 rounded-xl bg-white px-3 text-ink" />
      <FlowButton title="Chọn tọa độ này" disabled={!validCoordinates(point)} onPress={() => onSelect(point)} />
    </> : <Text className="text-xs text-muted">Điểm giao: {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Text>}
  </View>;
}
