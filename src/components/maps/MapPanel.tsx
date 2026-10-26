import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import MapView, { Marker, MapMarker, Polyline } from 'react-native-maps';
import type { MapPanelProps } from './MapPanel.types';

export default function MapPanel({ coordinate, onSelect, origin, driver, simulation }: MapPanelProps) {
  const map = useRef<MapView>(null);
  const marker = useRef<MapMarker>(null);
  const [initial] = useState(driver ?? origin ?? coordinate);
  const [animated] = useState(() => new Animated.ValueXY({ x: initial.latitude, y: initial.longitude }));
  useEffect(() => {
    if (origin) map.current?.fitToCoordinates([origin, coordinate], { edgePadding: { top: 55, bottom: 55, left: 50, right: 50 }, animated: true });
    else map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 300);
  }, [coordinate.latitude, coordinate.longitude, origin?.latitude, origin?.longitude]);
  useEffect(() => {
    if (!driver) return;
    if (Platform.OS === 'android') marker.current?.animateMarkerToCoordinate(driver, 950);
    else {
      const animation = Animated.timing(animated, { toValue: { x: driver.latitude, y: driver.longitude }, duration: 950, useNativeDriver: false });
      animation.start();
      return () => animation.stop();
    }
  }, [driver?.latitude, driver?.longitude, animated]);
  return <View style={{ height: 320, overflow: 'hidden', borderRadius: 20 }}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={{ ...coordinate, latitudeDelta: 0.018, longitudeDelta: 0.018 }}
      onPress={onSelect ? event => onSelect(event.nativeEvent.coordinate) : undefined}>
      <Marker coordinate={coordinate} draggable={!!onSelect} onDragEnd={event => onSelect?.(event.nativeEvent.coordinate)} title="Địa chỉ giao hàng" pinColor="#FF6B55" />
      {origin && <Marker coordinate={origin} title="Nhà hàng" pinColor="#159E98" />}
      {origin && <Polyline coordinates={[origin, ...(driver ? [driver] : []), coordinate]} strokeColor="#159E98" strokeWidth={5} />}
      {driver && <Marker.Animated ref={marker} coordinate={Platform.OS === 'android' ? initial : { latitude: animated.x, longitude: animated.y }} title="Xe mô phỏng">
        <View style={{ backgroundColor: 'white', padding: 8, borderRadius: 24 }}><Text style={{ fontSize: 25 }}>🏍️</Text></View>
      </Marker.Animated>}
    </MapView>
    {!!simulation && <Text style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'white', padding: 8, borderRadius: 10 }}>Chuyến đi mô phỏng · đường thẳng</Text>}
  </View>;
}
