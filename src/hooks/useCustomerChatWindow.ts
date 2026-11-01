import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { purchaseApi } from '../services/purchase';
import { canSendCustomerMessage, customerChatClosedReason } from '../features/chat/chatWindow';

export function useCustomerChatWindow(orderId: string, userId?: string) {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [now, setNow] = useState(Date.now);
  const order = useQuery({
    queryKey: ['order', userId, orderId],
    queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal),
    enabled: !!userId,
    refetchInterval: foreground ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  const { refetch } = order;
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') { setNow(Date.now()); void refetch(); }
    });
    return () => listener.remove();
  }, [refetch]);
  useEffect(() => {
    setNow(Date.now());
    if (!foreground || order.data?.status !== 'completed') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [foreground, order.data?.status, order.data?.completed_at]);
  return { order, canSend: !!userId && !order.isError && canSendCustomerMessage(order.data, now),
    closedReason: order.isError ? 'Chưa xác minh được quyền gửi. Vui lòng tải lại cuộc trò chuyện.' : customerChatClosedReason(order.data) };
}
