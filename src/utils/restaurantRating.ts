export function restaurantRatingLabel(rating: number | null | undefined): string {
  return typeof rating === 'number' && Number.isFinite(rating) && rating >= 1 && rating <= 5
    ? rating.toFixed(1) : 'Chưa có đánh giá';
}
