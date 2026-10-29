export type FoodVote = { food_id: string; is_liked: boolean };
export type ReviewStageInput = { stage: 'driver' | 'restaurant'; rating: number; feedback: string; imagePath?: string | null; votes?: FoodVote[] };
export const reviewCharacterCount = (text: string) => Array.from(text.trim()).length;
export const earnsReviewReward = (text: string, hasImage: boolean) => reviewCharacterCount(text) >= 50 && hasImage;

export function reviewStageArgs(orderId: string, userId: string, input: ReviewStageInput) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Vui lòng chọn từ 1 đến 5 sao.');
  if (reviewCharacterCount(input.feedback) > 2000) throw new Error('Nhận xét tối đa 2.000 ký tự.');
  if (input.imagePath && !input.imagePath.startsWith(`${userId}/${orderId}/`)) throw new Error('Ảnh không thuộc đơn hàng này.');
  const votes = input.votes ?? [];
  if (votes.length > 100 || votes.some(v => typeof v.is_liked !== 'boolean' || !v.food_id) || new Set(votes.map(v => v.food_id)).size !== votes.length) throw new Error('Đánh giá món không hợp lệ.');
  return { p_order_id: orderId, p_stage: input.stage, p_rating: input.rating, p_feedback: input.feedback.trim(),
    p_image_path: input.stage === 'restaurant' ? input.imagePath ?? null : null,
    p_food_votes: input.stage === 'restaurant' ? votes.map(v => ({ food_id: v.food_id, is_liked: v.is_liked })) : [],
  };
}
