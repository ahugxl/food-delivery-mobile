import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { MapPanelProps } from './MapPanel.types';
import SchematicMap from './SchematicMap';
import { FlowButton } from '../FlowUI';

export function LeafletFrame({ status, retry, mapProps, children }: {
  status: 'loading' | 'ready' | 'failed'; retry: () => void; mapProps: MapPanelProps; children: ReactNode;
}) {
  return <View className="gap-3">
    {status === 'failed' ? <>
      <Text accessibilityRole="alert" className="text-sm text-muted">Không tải được bản đồ đường phố. Bạn vẫn có thể dùng GPS hoặc nhập tọa độ trên sơ đồ.</Text>
      <FlowButton title="Tải lại bản đồ" onPress={retry} />
      <SchematicMap {...mapProps} />
    </> : <>
      <Text className="font-semibold text-sm text-ink">{mapProps.onSelect ? 'Chạm bản đồ hoặc kéo ghim để chọn điểm giao' : 'Từ quán đến điểm giao'}</Text>
      <View style={{ height: 340, borderRadius: 20, overflow: 'hidden', backgroundColor: '#EAF7EF' }}>
        {children}
        {status === 'loading' && <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 55, right: 10, borderRadius: 12, padding: 10, backgroundColor: 'white', flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator size="small" color="#008B45" /><Text className="text-xs text-muted">Đang tải bản đồ…</Text></View>}
      </View>
      {mapProps.simulation && <Text className="text-xs text-muted">Xe và tuyến đường đang mô phỏng theo đường thẳng, không phải chỉ đường giao thông.</Text>}
    </>}
  </View>;
}
