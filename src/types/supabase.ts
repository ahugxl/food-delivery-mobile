import type { Database, Json } from './database.types';

type Tables = Database['public']['Tables'];
type ForeignKey<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
};

// FK names from the provided CREATE TABLE statements. Keep database.types.ts intact.
type Relationships = {
  favorites: [ForeignKey<'favorites_restaurant_id_fkey', 'restaurant_id', 'restaurants'>];
  orders: [ForeignKey<'orders_restaurant_id_fkey', 'restaurant_id', 'restaurants'>];
  order_items: [ForeignKey<'order_items_order_id_fkey', 'order_id', 'orders'>];
  foods: [
    ForeignKey<'foods_restaurant_id_fkey', 'restaurant_id', 'restaurants'>,
    ForeignKey<'foods_category_id_fkey', 'category_id', 'categories'>,
  ];
  food_option_groups: [ForeignKey<'food_option_groups_food_id_fkey', 'food_id', 'foods'>];
  food_option_items: [ForeignKey<'food_option_items_group_id_fkey', 'group_id', 'food_option_groups'>];
};

export type SupabaseDatabase = {
  public: {
    Tables: { [Name in keyof Tables]: Tables[Name] & {
      Relationships: Name extends keyof Relationships ? Relationships[Name] : [];
    } };
    Views: Record<never, never>;
    Functions: {
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string | null; p_avatar_url: string | null };
        Returns: Tables['profiles']['Row'][];
      };
      save_my_address: {
        Args: { p_id: string; p_title: string; p_address: string; p_latitude: number; p_longitude: number; p_is_default: boolean; p_create?: boolean };
        Returns: Tables['user_addresses']['Row'][];
      };
      delete_my_address: { Args: { p_id: string }; Returns: undefined };
      create_food_order_at_location: {
        Args: { p_order_id: string; p_items: Json; p_address: string; p_voucher_code?: string | null; p_latitude: number; p_longitude: number };
        Returns: Tables['orders']['Row'][];
      };
      create_food_order: {
        Args: { p_order_id: string; p_items: Json; p_address: string; p_voucher_code?: string | null };
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
