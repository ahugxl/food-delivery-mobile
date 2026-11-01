export const REWARD_TIERS = [
  { amount: 10000, points: 10000 },
  { amount: 20000, points: 19000 },
  { amount: 30000, points: 28000 },
  { amount: 50000, points: 47000 },
] as const;
export type RewardAmount = typeof REWARD_TIERS[number]['amount'];
export type RewardRequest = { id: string; amount: RewardAmount };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const rewardRequestKey = (userId: string) => `loyalty-redemption:${userId}`;
export function parseRewardRequest(value: unknown): RewardRequest | null {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !uuid.test(value.id) || !('amount' in value)) return null;
  const tier = REWARD_TIERS.find(t => t.amount === value.amount);
  return tier ? { id: value.id, amount: tier.amount } : null;
}
