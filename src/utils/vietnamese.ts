/** Display translations keep database values and IDs unchanged. */
import { localizeCurrencyText } from '../features/order/checkout';
const labels: Record<string, string> = {
    Drink: 'Đồ uống', Fastfood: 'Đồ ăn nhanh', Healthy: 'Ăn lành mạnh', Rice: 'Cơm',
    Freeship: 'Miễn phí giao hàng', 'Near you': 'Gần bạn', 'Free delivery': 'Miễn phí giao hàng',
    Size: 'Kích cỡ', Topping: 'Món thêm', Spiciness: 'Độ cay', Small: 'Nhỏ', Medium: 'Vừa', Large: 'Lớn',
    'No spicy': 'Không cay', Mild: 'Ít cay', Hot: 'Cay', 'Extra spicy': 'Rất cay',
    Friendly: 'Thân thiện', Supportive: 'Nhiệt tình', 'On-time': 'Đúng giờ',
    Home: 'Nhà riêng', Work: 'Cơ quan', Other: 'Khác', Standard: 'Mặc định',
    'Fried Chicken': 'Gà rán', 'Chicken Salad': 'Salad gà', 'Sauté Chicken Rice': 'Cơm gà xào',
    'Black Milk Tea': 'Trà sữa truyền thống', 'Matcha Latte': 'Trà xanh sữa', 'Seafood Pizza': 'Pizza hải sản', 'Cheese Lover Pizza': 'Pizza phô mai',
    'Crispy fried wings, thigh': 'Cánh và đùi gà chiên giòn',
    'Fresh green lettuce with grilled chicken breast': 'Xà lách tươi cùng ức gà nướng',
    'Sauté chicken, Rice': 'Cơm ăn kèm gà xào thơm ngon', 'Classic black milk tea with pearls': 'Trà sữa truyền thống cùng trân châu',
    'Premium matcha with fresh milk': 'Trà xanh cao cấp cùng sữa tươi', 'Shrimp, squid, crab sticks with cheese crust': 'Tôm, mực, thanh cua cùng viền phô mai',
    'Double mozzarella cheese crust pizza': 'Pizza hai lớp phô mai mozzarella',
    S: 'Nhỏ', M: 'Vừa', L: 'Lớn', Corn: 'Bắp', 'Cheese Cheddar': 'Phô mai cheddar', 'Salted egg': 'Trứng muối', No: 'Không cay', 'Very hot': 'Rất cay',
    'Thêm Topping': 'Thêm món kèm', 'Chọn Mức Đường': 'Chọn mức đường', Pudding: 'Bánh pudding',
};
export function viLabel(value: string) {
    return localizeCurrencyText(labels[value] ?? value.replace(/\bFreeship\b/gi, 'Miễn phí giao hàng').replace(/\bNear you\b/gi, 'Gần bạn').replace(/\bDeal\b/gi, 'Ưu đãi').replace(/\bXtra\b/gi, 'mở rộng'));
}
export function viHours(value?: string | null) {
    return value ? value.replace(/(\d+)(?::(\d+))?\s*(am|pm)/gi, (_, h: string, m: string, period: string) => `${(Number(h) % 12) + (period.toLowerCase() === 'pm' ? 12 : 0)}:${m ?? '00'}`) : 'Chưa có giờ mở cửa';
}
