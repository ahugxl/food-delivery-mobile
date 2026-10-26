export type ChatMessage = {
  id: string;
  sender: 'driver' | 'user';
  text: string;
};

export const deliveryAddress = '128 Market Street, San Francisco, CA 94105';

export const trackingMapImage =
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1400&q=85';

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'driver-1',
    sender: 'driver',
    text: 'Hi, I might be 15 mins late.',
  },
  {
    id: 'user-1',
    sender: 'user',
    text: 'Sure! Thank you for letting me know.',
  },
  {
    id: 'driver-2',
    sender: 'driver',
    text: 'Thanks for understanding — I’m on my way.',
  },
];
