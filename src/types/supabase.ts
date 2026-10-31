import type { Database, Json } from './database.types';

type Tables = Database['public']['Tables'];
// Keep database metadata in one place. The client exposes only current RPCs,
// and explicitly types nullable arguments accepted by their SQL implementations.
export type SupabaseDatabase = {
  public: {
    Tables: Tables;
    Views: Database['public']['Views'];
    Enums: Database['public']['Enums'];
    CompositeTypes: Database['public']['CompositeTypes'];
    Functions: {
      restaurant_review_summary: Database['public']['Functions']['restaurant_review_summary'];
      restaurant_review_feed: Database['public']['Functions']['restaurant_review_feed'];
      order_delivery_progress: Database['public']['Functions']['order_delivery_progress'];
      order_driver_location: Database['public']['Functions']['order_driver_location'];
      signup_account_exists: { Args: { p_phone: string; p_email: string }; Returns: boolean };
      submit_order_review: { Args: { p_order_id: string; p_stage: string; p_rating: number; p_feedback: string; p_image_path?: string | null; p_food_votes?: Json }; Returns: Tables['reviews']['Row'][] };
      food_review_stats: { Args: { p_food_ids: string[] }; Returns: { food_id: string; sold_count: number; like_count: number }[] };
      collect_my_voucher: { Args: { p_voucher_id: string }; Returns: Tables['vouchers']['Row'][] };
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string | null; p_avatar_url: string | null };
        Returns: Tables['profiles']['Row'][];
      };
      save_my_address: {
        Args: { p_id: string; p_title: string; p_address: string; p_latitude: number; p_longitude: number; p_is_default: boolean; p_create: boolean; p_recipient_name: string; p_recipient_phone: string };
        Returns: Tables['user_addresses']['Row'][];
      };
      delete_my_address: { Args: { p_id: string }; Returns: undefined };
      create_food_order: {
        Args: { p_order_id: string; p_items: Json; p_address: string; p_voucher_code: string | null; p_shipping_voucher_code: string | null; p_latitude: number; p_longitude: number; p_delivery_fee: number; p_recipient_name: string; p_recipient_phone: string };
        Returns: Tables['orders']['Row'][];
      };
    };
  };
};

export type Row<Name extends keyof Tables> = Tables[Name]['Row'];
export type FoodDetail = Row<'foods'> & {
  restaurants: Pick<Row<'restaurants'>, 'id' | 'name' | 'rating' | 'is_active' | 'is_open'>;
  food_option_groups: (Row<'food_option_groups'> & { food_option_items: Row<'food_option_items'>[] })[];
};
