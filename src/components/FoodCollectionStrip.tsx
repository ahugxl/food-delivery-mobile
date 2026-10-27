import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';
import { foodCollections, type FoodCollection } from '../features/search/foodCollections';
import { categoryIconUrl } from '../services/categoryIcons';

function CollectionIcon({ item, size, refreshKey }: { item: FoodCollection; size: number; refreshKey?: number }) {
  const uri = categoryIconUrl(item.id);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri, refreshKey]);
  return uri && !failed ? <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk" onError={() => setFailed(true)} style={{ width: size, height: size }} accessibilityLabel={item.name} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F0F6EF', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.icon} size={size * .47} color="#008B45" /></View>;
}

export function FoodCollectionStrip({ selectedId, onSelect, refreshKey }: {
  selectedId?: string; onSelect: (id: string) => void; refreshKey?: number;
}) {
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(84, Math.max(58, Math.floor((Math.min(width, 520) - 72) / 5)));
  const scrollToSelected = useCallback(() => {
    const index = foodCollections.findIndex(item => item.id === selectedId);
    if (index >= 0) scroll.current?.scrollTo({ x: Math.max(0, index * (cardWidth + 8) - cardWidth), animated: true });
  }, [selectedId, cardWidth]);
  useEffect(scrollToSelected, [scrollToSelected]);
  return <ScrollView ref={scroll} horizontal style={{ flexGrow: 0 }} onContentSizeChange={scrollToSelected} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 18, gap: 8 }}>
    {foodCollections.map(item => {
      const selected = item.id === selectedId;
      return <AppPressable key={item.id} accessibilityRole="button" accessibilityLabel={`Tìm quán bán ${item.name}`} accessibilityState={{ selected }} onPress={() => onSelect(item.id)} style={{ width: cardWidth, alignItems: 'center', gap: 7 }}>
        <View style={{ padding: 3, borderRadius: 40, borderWidth: 2, borderColor: selected ? '#008B45' : 'transparent' }}>
          <CollectionIcon item={item} size={Math.min(66, cardWidth - 10)} refreshKey={refreshKey} />
          {selected && <View style={{ position: 'absolute', top: -2, right: -2, borderRadius: 12, backgroundColor: '#008B45', padding: 2, borderWidth: 2, borderColor: 'white' }}><Ionicons name="checkmark" color="white" size={14} /></View>}
        </View>
        <Text numberOfLines={2} style={{ textAlign: 'center', fontSize: 12, lineHeight: 17, color: selected ? '#008B45' : '#17241B', fontWeight: selected ? '700' : '500' }}>{item.name}</Text>
      </AppPressable>;
    })}
  </ScrollView>;
}
