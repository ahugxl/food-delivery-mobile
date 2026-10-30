import { recipientInput, type Recipient } from '../order/recipient';

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };

// Remember the confirmed recipient, not GPS coordinates which can change on restart.
export function createRecipientStorage(storage: Storage) {
  const key = (userId: string) => `delivery-recipient:v1:${encodeURIComponent(userId)}`;
  return {
    async read(userId: string): Promise<Recipient | null> {
      if (!userId) return null;
      try {
        const raw = await storage.getItem(key(userId));
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || !('recipientName' in value) || !('recipientPhone' in value)
          || typeof value.recipientName !== 'string' || typeof value.recipientPhone !== 'string') return null;
        return recipientInput({ recipientName: value.recipientName, recipientPhone: value.recipientPhone });
      } catch { return null; }
    },
    async save(userId: string, recipient: Recipient) {
      if (!userId) throw new Error('Vui lòng đăng nhập lại để lưu người nhận.');
      const value = recipientInput(recipient);
      try { await storage.setItem(key(userId), JSON.stringify(value)); }
      catch { throw new Error('Chưa lưu được người nhận trên thiết bị. Vui lòng thử lại.'); }
    },
  };
}
