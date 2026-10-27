import { normalizeSearch } from './normalizeSearch';
import { viLabel } from '../../utils/vietnamese';

// Display shortcuts are independent of restaurant-specific menu category IDs.
// Synonyms match real food names; they do not create restaurant/menu data.
export const foodCollections = [
  { id: 'do-an-vat', name: 'Đồ ăn vặt', icon: 'pizza-outline', terms: ['ăn vặt', 'bánh tráng', 'khoai tây chiên', 'cá viên', 'xúc xích', 'nem chua', 'bắp rang', 'snack', 'phô mai que', 'chân gà'] },
  { id: 'com', name: 'Cơm', icon: 'restaurant-outline', terms: ['cơm', 'rice'] },
  { id: 'tra-sua', name: 'Trà sữa', icon: 'cafe-outline', terms: ['trà sữa', 'milk tea', 'milktea', 'bubble tea', 'boba'] },
  { id: 'mon-hoa', name: 'Món Hoa', icon: 'restaurant-outline', terms: ['món hoa', 'dimsum', 'dim sum', 'há cảo', 'sủi cảo', 'hoành thánh', 'xíu mại', 'vịt quay', 'xá xíu', 'mì vịt tiềm', 'wonton', 'dumpling'] },
  { id: 'tra', name: 'Trà', icon: 'cafe-outline', terms: ['trà', 'tea'] },
  { id: 'mon-ga', name: 'Món gà', icon: 'restaurant-outline', terms: ['gà', 'chicken'] },
  { id: 'mon-my', name: 'Món Mỹ', icon: 'fast-food-outline', terms: ['burger', 'burgers', 'cheeseburger', 'hamburger', 'hamburgers', 'hotdog', 'hot dog', 'steak', 'bít tết', 'sandwich', 'bbq'] },
  { id: 'thuc-an-nhanh', name: 'Thức ăn nhanh', icon: 'fast-food-outline', terms: ['burger', 'burgers', 'cheeseburger', 'hamburger', 'hamburgers', 'hotdog', 'hot dog', 'pizza', 'gà rán', 'fried chicken', 'khoai tây chiên', 'french fries', 'sandwich'] },
  { id: 'mon-nhat', name: 'Món Nhật', icon: 'fish-outline', terms: ['sushi', 'sashimi', 'ramen', 'udon', 'maki', 'onigiri', 'takoyaki', 'tempura', 'teriyaki', 'miso', 'mì nhật'] },
  { id: 'mon-au', name: 'Món Âu', icon: 'restaurant-outline', terms: ['món âu', 'pasta', 'spaghetti', 'mì ý', 'pizza', 'steak', 'bít tết', 'risotto', 'lasagna', 'súp kem', 'cá hồi áp chảo'] },
  { id: 'ca-phe', name: 'Cà phê', icon: 'cafe-outline', terms: ['cà phê', 'cafe', 'coffee', 'espresso', 'americano', 'cappuccino', 'latte', 'bạc xỉu', 'macchiato', 'cold brew'] },
  { id: 'ga-ran', name: 'Gà rán', icon: 'fast-food-outline', terms: ['gà rán', 'gà chiên', 'fried chicken', 'cánh gà chiên', 'đùi gà chiên', 'gà giòn', 'gà sốt'] },
  { id: 'nuoc-ep', name: 'Nước ép', icon: 'water-outline', terms: ['nước ép', 'juice', 'ép cam', 'ép táo', 'ép dứa', 'ép thơm', 'ép cà rốt', 'ép cần tây'] },
  { id: 'mi', name: 'Mì', icon: 'restaurant-outline', terms: ['mì', 'noodle', 'noodles', 'ramen', 'udon', 'spaghetti', 'pasta'], excludePhrases: ['bánh mì'] },
  { id: 'mon-han', name: 'Món Hàn', icon: 'restaurant-outline', terms: ['món hàn', 'kim chi', 'kimchi', 'kimbap', 'gimbap', 'bibimbap', 'tokbokki', 'tteokbokki', 'bulgogi', 'cơm trộn hàn', 'bánh gạo hàn', 'gà hàn quốc'] },
  { id: 'do-uong', name: 'Đồ uống', icon: 'cafe-outline', terms: ['đồ uống', 'trà', 'tea', 'cà phê', 'coffee', 'espresso', 'americano', 'latte', 'cappuccino', 'sinh tố', 'smoothie', 'nước ép', 'juice', 'nước ngọt', 'nước suối', 'nước khoáng', 'nước dừa', 'soda', 'matcha', 'cacao', 'ca cao', 'đá xay', 'pepsi', 'coca', 'bạc xỉu'] },
  { id: 'trai-cay', name: 'Trái cây', icon: 'nutrition-outline', terms: ['trái cây', 'hoa quả', 'fruit', 'dĩa trái cây', 'đĩa trái cây', 'xoài', 'dưa hấu', 'dâu tây', 'thanh long', 'sầu riêng', 'mít', 'ổi', 'bưởi'] },
] as const;

export type FoodCollection = (typeof foodCollections)[number];
export function findFoodCollection(id?: string) { return foodCollections.find(item => item.id === id); }
const searchable = (text: string) => ` ${normalizeSearch(text).replace(/[^a-z0-9]+/g, ' ').trim()} `;
export function matchesFoodCollection(food: { name: string }, collection: FoodCollection) {
  let text = searchable(`${food.name} ${viLabel(food.name)}`);
  // Accent folding makes bánh mì and noodles share "mi"; omit the bread phrase.
  if ('excludePhrases' in collection) for (const phrase of collection.excludePhrases) text = text.replace(new RegExp(`\\b${searchable(phrase).trim()}\\b`, 'g'), ' ');
  return collection.terms.some(term => text.includes(searchable(term)));
}
