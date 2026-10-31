import { Fragment } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DELIVERY_MILESTONES, deliveryMilestoneProgress } from './deliveryProgress';

const icons = ['receipt-outline', 'restaurant-outline', 'bicycle-outline', 'home-outline'] as const;
export function DeliveryProgressBar({ step }: { step: number | null | undefined }) {
  const { position, completed } = deliveryMilestoneProgress(step);
  return <View
    accessible accessibilityRole="progressbar"
    accessibilityLabel="Tiến trình giao hàng"
    accessibilityValue={{ min: 0, max: 4, now: completed, text: completed ? `${completed} trên 4 mốc. ${DELIVERY_MILESTONES[completed - 1]}` : 'Chưa xác nhận tài xế nhận đơn' }}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, width: '100%' }}
  >
    {DELIVERY_MILESTONES.map((label, index) => <Fragment key={label}>
      <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons accessible={false} name={icons[index]} size={26} color={index < completed ? '#008B45' : '#CBD1CC'} />
      </View>
      {index < 3 && <View style={{ flex: 1, height: 4, borderRadius: 2, marginHorizontal: 8, backgroundColor: '#E8ECE8', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(1, Math.max(0, position - index)) * 100}%`, borderRadius: 2, backgroundColor: '#008B45' }} />
      </View>}
    </Fragment>)}
  </View>;
}
