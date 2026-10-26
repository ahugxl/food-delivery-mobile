import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { chatApi } from '../services/chat';
import { useAuthStore } from '../store/authStore';
import { mergeMessages, parseMessage, type Message } from '../features/chat/messages';

export function useChatRealtime(orderId: string) {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const [incoming, setIncoming] = useState<Message[]>([]);
  const [connection, setConnection] = useState('connecting');
  const query = useQuery({ queryKey: ['messages', userId, orderId], queryFn: ({ signal }) => chatApi.history(orderId, signal), enabled: !!userId && !!orderId,
    refetchInterval: connection === 'connected' ? false : 15000,
  });
  useEffect(() => {
    setIncoming([]); setConnection('connecting');
    if (!supabase || !orderId || !userId) return;
    let active = true;
    const refresh = () => { void client.invalidateQueries({ queryKey: ['messages', userId, orderId] }); };
    const channel = supabase.channel(`chat:${userId}:${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` }, payload => {
        const message = parseMessage(payload.new);
        if (active && message?.order_id === orderId) setIncoming(current => mergeMessages(current, [message]));
      }).subscribe(status => {
        if (!active) return;
        setConnection(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting');
        if (status === 'SUBSCRIBED') refresh();
      });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; appState.remove(); void supabase?.removeChannel(channel); };
  }, [orderId, userId, client]);
  return { ...query, messages: mergeMessages(query.data ?? [], incoming).filter(message => message.order_id === orderId), connection,
    acceptSent: (message: Message) => setIncoming(current => mergeMessages(current, [message])),
  };
}
