-- =========================================================================
-- SẠCH SẼ HOÁ DATABASE CŨ (Xóa bảng theo thứ tự để tránh lỗi ràng buộc khóa ngoại)
-- =========================================================================
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.user_addresses CASCADE;
DROP TABLE IF EXISTS public.banners CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.food_option_items CASCADE;
DROP TABLE IF EXISTS public.food_option_groups CASCADE;
DROP TABLE IF EXISTS public.foods CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =========================================================================
-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG (Profiles - Liên kết trực tiếp với Auth của Supabase)
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'driver', 'merchant')), -- Phân biệt vai trò
  loyalty_points INTEGER DEFAULT 0, -- Tích điểm/xu
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật tính năng Row Level Security (RLS) để bảo mật
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. BẢNG DANH MỤC MÓN (Categories - Trà sữa, Gà rán, Bún đậu...)
-- =========================================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 3. BẢNG NHÀ HÀNG (Restaurants)
-- =========================================================================
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating NUMERIC(2, 1) DEFAULT 5.0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_open BOOLEAN DEFAULT TRUE, -- Quản lý đóng/mở cửa thực tế
  opening_hours TEXT DEFAULT '6am - 9pm',
  price_range TEXT DEFAULT '$5 - $50',
  promo_tags JSONB DEFAULT '[]'::jsonb, -- Các tag đỏ như ["Freeship", "Giảm 10%"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 4. BẢNG MÓN ĂN (Foods - Liên kết trực tiếp sang bảng categories)
-- =========================================================================
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL, -- Giá bán thực tế
  original_price NUMERIC(10, 2), -- Giá gốc để gạch ngang khi giảm giá
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 5. BẢNG NHÓM TÙY CHỌN MÓN ĂN (Ví dụ: nhóm "Chọn Size", "Topping")
-- =========================================================================
CREATE TABLE public.food_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Ví dụ: 'Size', 'Topping', 'Spiciness'
  is_required BOOLEAN DEFAULT FALSE,
  allow_multiple BOOLEAN DEFAULT FALSE
);

-- =========================================================================
-- 6. BẢNG CHI TIẾT TÙY CHỌN (Ví dụ: Size L cộng thêm $10, Corn cộng thêm $2)
-- =========================================================================
CREATE TABLE public.food_option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.food_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL, 
  extra_price NUMERIC(10, 2) DEFAULT 0.0
);

-- =========================================================================
-- 7. BẢNG VOUCHER (Hỗ trợ voucher hệ thống và voucher riêng từng quán)
-- =========================================================================
CREATE TABLE public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE, -- NULL nếu là voucher hệ thống
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL, -- 'percentage' hoặc 'fixed'
  discount_value NUMERIC(10, 2) NOT NULL,
  min_order_value NUMERIC(10, 2) DEFAULT 0.0,
  expiry_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- =========================================================================
-- 8. BẢNG ĐƠN HÀNG (Orders - Quản lý trạng thái và phương thức thanh toán)
-- =========================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Tài xế thực tế trong hệ thống
  status TEXT DEFAULT 'pending', -- pending, preparing, delivering, completed, cancelled
  subtotal NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) DEFAULT 0.0,
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10, 2) DEFAULT 0.0,
  total NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- 'cash', 'e-wallet'
  delivery_address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 9. BẢNG CHI TIẾT ĐƠN HÀNG (Order Items)
-- =========================================================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  options_snapshot JSONB DEFAULT '{}'::jsonb -- Lưu snapshot tùy chọn khách đã chọn
);

-- =========================================================================
-- 10. BẢNG TIN NHẮN CHAT (Messages - Hỗ trợ gửi hình ảnh)
-- =========================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'driver')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  content TEXT,
  image_url TEXT, -- Link ảnh từ Storage nếu có
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 11. BẢNG CUỘC GỌI THOẠI (Calls - Lưu vết lịch sử cuộc gọi)
-- =========================================================================
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 12. BẢNG THÔNG BÁO (Notifications - Tin tức & cập nhật đơn hàng)
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL nếu là thông báo chung cho toàn hệ thống
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  type TEXT DEFAULT 'system', -- 'system' hoặc 'order'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 13. BẢNG BANNERS (Quảng cáo trượt ở đầu trang chủ)
-- =========================================================================
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  link_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 14. BẢNG ĐỊA CHỈ NGƯỜI DÙNG (User Addresses - Sổ địa chỉ cá nhân)
-- =========================================================================
CREATE TABLE public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- 'Home', 'Work', 'Other'
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN DEFAULT FALSE
);

-- =========================================================================
-- 15. BẢNG YÊU THÍCH (Favorites)
-- =========================================================================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- =========================================================================
-- 16. BẢNG ĐÁNH GIÁ (Reviews - Tách biệt đánh giá Quán và Tài xế)
-- =========================================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Đánh giá quán ăn
  restaurant_rating INTEGER CHECK (restaurant_rating >= 1 AND restaurant_rating <= 5),
  restaurant_feedback TEXT,
  
  -- Đánh giá tài xế
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  driver_tags JSONB DEFAULT '[]'::jsonb, -- Ví dụ: ["Supportive", "Friendly"]
  driver_feedback TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
