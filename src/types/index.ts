export interface Restaurant {
  id: string;
  name: string;
  rating: number | null;
  deliveryTime: string;
  tags: string[];
  image: string;
  openingHours?: string;
  isOpen?: boolean;
}

export interface Food {
  id: string;
  name: string;
  price: number;
  image: string;
}

export interface FoodOption {
  id: string;
  label: string;
  price: number;
}

export interface CartItem extends Food {
  lineId: string;
  foodId: string;
  basePrice: number;
  quantity: number;
  unitPrice: number;
  restaurantId: string;
  restaurantName: string;
  options: import('../features/food-detail/selection').SelectedOption[];
  note: string;
}
