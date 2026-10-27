import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';
import type { FoodCollection } from '../features/search/foodCollections';
import { categoryIconUrl } from '../services/categoryIcons';
import { useDiscoveryCategories } from '../hooks/useDiscoveryCategories';

const fallbackIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'tra-sua': 'cafe-outline', 'do-an-vat': 'fast-food-outline', 'mon-chay': 'leaf-outline', com: 'restaurant-outline',
  'bun-mi-pho': 'restaurant-outline', 'mon-han': 'restaurant-outline', 'quan-moi': 'sparkles-outline', 'quan-tru-danh': 'ribbon-outline',
};

function CollectionIcon({ item, size, refreshKey }: { item: FoodCollection; size: number; refreshKey?: number }) {
  const uri = item.image_url && /^https:\/\//i.test(item.image_url) ? item.image_url : categoryIconUrl(item.id);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri, refreshKey]);
  return uri && !failed ? <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk" onError={() => setFailed(true)} style={{ width: size, height: size }} accessibilityLabel={item.name} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F0F6EF', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={fallbackIcons[item.id] ?? 'restaurant-outline'} size={size * .47} color="#008B45" /></View>;
}

export function FoodCollectionStrip({ selectedId, onSelect, refreshKey, grid = false }: {
  selectedId?: string; onSelect: (id: string) => void; refreshKey?: number; grid?: boolean;
}) {
  const query = useDiscoveryCategories();
  const foodCollections = query.data ?? [];
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);
  const availableWidth = viewportWidth || Math.min(width, 520) - 32;
  // Four complete cards fit the actual container; the last four fit at the end.
  const cardWidth = grid ? Math.floor((Math.min(width, 520) - 80) / 4) : Math.max(48, (availableWidth - 48) / 4);
  const iconSize = Math.min(grid ? 76 : 54, cardWidth - 10);
  const scrollToSelected = useCallback(() => {
    const index = foodCollections.findIndex(item => item.id === selectedId);
    if (index >= 0) scroll.current?.scrollTo({ x: Math.max(0, index * (cardWidth + 8) - cardWidth), animated: true });
  }, [selectedId, cardWidth, query.data]);
  useEffect(scrollToSelected, [scrollToSelected]);
  if (query.isPending) return <Text className="px-5 pb-5 text-sm text-muted">Đang tải nhóm khám phá…</Text>;
  if (query.isError) return <AppPressable accessibilityRole="button" onPress={() => { void query.refetch(); }} className="px-5 pb-5"><Text className="text-sm text-coral">Không tải được nhóm khám phá. Chạm để thử lại.</Text></AppPressable>;
  const cards = foodCollections.map(item => {
      const selected = item.id === selectedId;
      return <AppPressable key={item.id} accessibilityRole="button" accessibilityLabel={item.kind === 'food' ? `Tìm quán bán ${item.name}` : `Tìm ${item.name.toLowerCase()}`} accessibilityState={{ selected }} onPress={() => onSelect(item.id)} style={{ width: cardWidth, flexShrink: 0, alignItems: 'center', gap: 5 }}>
        <View style={{ padding: 5, width: iconSize + 10, height: iconSize + 10 }}>
          <View style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2, overflow: 'hidden' }}><CollectionIcon item={item} size={iconSize} refreshKey={refreshKey} /></View>
          {selected && <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: (iconSize + 10) / 2, borderWidth: 2, borderColor: '#008B45' }} />}
          {selected && <View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -2, borderRadius: 12, backgroundColor: '#008B45', padding: 2, borderWidth: 2, borderColor: 'white' }}><Ionicons name="checkmark" color="white" size={14} /></View>}
        </View>
        <Text numberOfLines={2} style={{ width: '100%', minHeight: grid ? 40 : 34, textAlign: 'center', fontSize: grid ? 14 : 12, lineHeight: grid ? 20 : 17, color: selected ? '#008B45' : '#17241B', fontWeight: selected ? '700' : '500' }}>{item.name}</Text>
      </AppPressable>;
    });
  if (grid) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, columnGap: 8, rowGap: 18 }}>{cards}</View>;
  return <ScrollView ref={scroll} horizontal onLayout={event => setViewportWidth(event.nativeEvent.layout.width)} style={{ flexGrow: 0, height: iconSize + 53 }} snapToInterval={cardWidth + 8} decelerationRate="fast" onContentSizeChange={scrollToSelected} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 2, gap: 8, alignItems: 'flex-start' }}>{cards}</ScrollView>;
}
