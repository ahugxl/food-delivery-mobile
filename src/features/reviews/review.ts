import type { Database } from '../../types/database.types';

export const REVIEW_TAGS = ['Friendly', 'Supportive', 'On-time'] as const;
export type ReviewInput = {
  restaurantRating: number;
  driverRating: number;
  restaurantFeedback: string;
  driverFeedback: string;
  tags: string[];
};
export function reviewPayload(orderId: string, userId: string, input: ReviewInput): Database['public']['Tables']['reviews']['Insert'] {
  if (![input.restaurantRating, input.driverRating].every(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5)) throw new Error('Vui lòng chọn từ 1 đến 5 sao cho cả quán ăn và tài xế.');
  if (input.restaurantFeedback.trim().length > 2000 || input.driverFeedback.trim().length > 2000) throw new Error('Mỗi nhận xét được tối đa 2.000 ký tự.');
  if (input.tags.some(tag => !REVIEW_TAGS.some(allowed => allowed === tag))) throw new Error('Nhãn đánh giá không hợp lệ.');
  return { order_id: orderId, user_id: userId, restaurant_rating: input.restaurantRating, driver_rating: input.driverRating,
    restaurant_feedback: input.restaurantFeedback.trim() || null, driver_feedback: input.driverFeedback.trim() || null, driver_tags: [...new Set(input.tags)],
  };
}
