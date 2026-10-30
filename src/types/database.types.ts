// Public schema reconciled with Supabase on 2026-10-30.
// Literal unions also reflect verified SQL CHECK constraints. RPC client access is narrowed in supabase.ts.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      discovery_categories: {
        Row: { id: string; name: string; kind: 'food' | 'restaurant_tag'; restaurant_tag: string | null; image_url: string | null; sort_order: number; is_active: boolean };
        Insert: { id: string; name: string; kind: 'food' | 'restaurant_tag'; restaurant_tag?: string | null; image_url?: string | null; sort_order?: number; is_active?: boolean };
        Update: { id?: string; name?: string; kind?: 'food' | 'restaurant_tag'; restaurant_tag?: string | null; image_url?: string | null; sort_order?: number; is_active?: boolean };
      
        Relationships: [];
      };
      food_discovery_categories: {
        Row: { food_id: string; discovery_category_id: string };
        Insert: { food_id: string; discovery_category_id: string };
        Update: { food_id?: string; discovery_category_id?: string };
      
        Relationships: [
          {
            foreignKeyName: "food_discovery_categories_discovery_category_id_fkey"
            columns: ["discovery_category_id"]
            isOneToOne: false
            referencedRelation: "discovery_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_discovery_categories_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ];
      };
      banners: {
        Row: {
          id: string;
          image_url: string;
          link_url: string | null;
          is_active: boolean | null;
          position: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          image_url: string;
          link_url?: string | null;
          is_active?: boolean | null;
          position?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          image_url?: string;
          link_url?: string | null;
          is_active?: boolean | null;
          position?: number | null;
          created_at?: string | null;
        };
      
        Relationships: [];
      };
      calls: {
        Row: {
          id: string;
          order_id: string;
          caller_id: string;
          receiver_id: string;
          duration_seconds: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          caller_id: string;
          receiver_id: string;
          duration_seconds?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          caller_id?: string;
          receiver_id?: string;
          duration_seconds?: number | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          icon_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          icon_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          icon_url?: string | null;
          created_at?: string | null;
        };
      
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ];
      };
      food_option_groups: {
        Row: {
          id: string;
          food_id: string;
          name: string;
          is_required: boolean | null;
          allow_multiple: boolean | null;
        };
        Insert: {
          id?: string;
          food_id: string;
          name: string;
          is_required?: boolean | null;
          allow_multiple?: boolean | null;
        };
        Update: {
          id?: string;
          food_id?: string;
          name?: string;
          is_required?: boolean | null;
          allow_multiple?: boolean | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "food_option_groups_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ];
      };
      food_option_items: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          extra_price: number | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          extra_price?: number | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          extra_price?: number | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "food_option_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "food_option_groups"
            referencedColumns: ["id"]
          },
        ];
      };
      foods: {
        Row: {
          id: string;
          restaurant_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          original_price: number | null;
          image_url: string | null;
          is_available: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          original_price?: number | null;
          image_url?: string | null;
          is_available?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          original_price?: number | null;
          image_url?: string | null;
          is_available?: boolean | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "foods_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          order_id: string;
          sender_id: string;
          sender_type: "user" | "driver";
          message_type: "text" | "image" | null;
          content: string | null;
          image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          sender_id: string;
          sender_type: "user" | "driver";
          message_type?: "text" | "image" | null;
          content?: string | null;
          image_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          sender_id?: string;
          sender_type?: "user" | "driver";
          message_type?: "text" | "image" | null;
          content?: string | null;
          image_url?: string | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          content: string;
          image_url: string | null;
          type: string | null;
          is_read: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          content: string;
          image_url?: string | null;
          type?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          content?: string;
          image_url?: string | null;
          type?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
      
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          food_id: string;
          quantity: number;
          unit_price: number;
          options_snapshot: Json;
        };
        Insert: {
          id?: string;
          order_id: string;
          food_id: string;
          quantity?: number;
          unit_price: number;
          options_snapshot?: Json;
        };
        Update: {
          id?: string;
          order_id?: string;
          food_id?: string;
          quantity?: number;
          unit_price?: number;
          options_snapshot?: Json;
        };
      
        Relationships: [
          {
            foreignKeyName: "order_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ];
      };
      orders: {
        Row: {
          food_discount_amount: number;
          shipping_discount_amount: number;
          shipping_voucher_id: string | null;
          recipient_name: string | null;
          recipient_phone: string | null;
          id: string;
          user_id: string;
          restaurant_id: string;
          driver_id: string | null;
          status: string | null;
          subtotal: number;
          delivery_fee: number | null;
          voucher_id: string | null;
          discount_amount: number | null;
          total: number;
          payment_method: string | null;
          delivery_address: string;
          latitude: number | null;
          longitude: number | null;
          created_at: string | null;
        };
        Insert: {
          food_discount_amount?: number;
          shipping_discount_amount?: number;
          shipping_voucher_id?: string | null;
          recipient_name?: string | null;
          recipient_phone?: string | null;
          id?: string;
          user_id: string;
          restaurant_id: string;
          driver_id?: string | null;
          status?: string | null;
          subtotal: number;
          delivery_fee?: number | null;
          voucher_id?: string | null;
          discount_amount?: number | null;
          total: number;
          payment_method?: string | null;
          delivery_address: string;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
        };
        Update: {
          food_discount_amount?: number;
          shipping_discount_amount?: number;
          shipping_voucher_id?: string | null;
          recipient_name?: string | null;
          recipient_phone?: string | null;
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          driver_id?: string | null;
          status?: string | null;
          subtotal?: number;
          delivery_fee?: number | null;
          voucher_id?: string | null;
          discount_amount?: number | null;
          total?: number;
          payment_method?: string | null;
          delivery_address?: string;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_voucher_id_fkey"
            columns: ["shipping_voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: "user" | "driver" | "merchant" | null;
          loyalty_points: number | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "user" | "driver" | "merchant" | null;
          loyalty_points?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "user" | "driver" | "merchant" | null;
          loyalty_points?: number | null;
          created_at?: string | null;
        };
      
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          rating: number | null;
          image_url: string | null;
          is_active: boolean | null;
          is_open: boolean | null;
          opening_hours: string | null;
          price_range: string | null;
          promo_tags: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number | null;
          image_url?: string | null;
          is_active?: boolean | null;
          is_open?: boolean | null;
          opening_hours?: string | null;
          price_range?: string | null;
          promo_tags?: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number | null;
          image_url?: string | null;
          is_active?: boolean | null;
          is_open?: boolean | null;
          opening_hours?: string | null;
          price_range?: string | null;
          promo_tags?: Json;
          created_at?: string | null;
        };
      
        Relationships: [];
      };
      food_reviews: {
        Row: { review_id: string; food_id: string; is_liked: boolean; created_at: string };
        Insert: { review_id: string; food_id: string; is_liked: boolean; created_at?: string };
        Update: { review_id?: string; food_id?: string; is_liked?: boolean; created_at?: string };
      
        Relationships: [
          {
            foreignKeyName: "food_reviews_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_reviews_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ];
      };
      reviews: {
        Row: {
          driver_submitted_at: string | null;
          restaurant_submitted_at: string | null;
          restaurant_image_path: string | null;
          reward_points: number;
          id: string;
          order_id: string;
          user_id: string;
          restaurant_rating: number | null;
          restaurant_feedback: string | null;
          driver_rating: number | null;
          driver_tags: Json;
          driver_feedback: string | null;
          created_at: string | null;
        };
        Insert: {
          driver_submitted_at?: string | null;
          restaurant_submitted_at?: string | null;
          restaurant_image_path?: string | null;
          reward_points?: number;
          id?: string;
          order_id: string;
          user_id: string;
          restaurant_rating?: number | null;
          restaurant_feedback?: string | null;
          driver_rating?: number | null;
          driver_tags?: Json;
          driver_feedback?: string | null;
          created_at?: string | null;
        };
        Update: {
          driver_submitted_at?: string | null;
          restaurant_submitted_at?: string | null;
          restaurant_image_path?: string | null;
          reward_points?: number;
          id?: string;
          order_id?: string;
          user_id?: string;
          restaurant_rating?: number | null;
          restaurant_feedback?: string | null;
          driver_rating?: number | null;
          driver_tags?: Json;
          driver_feedback?: string | null;
          created_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ];
      };
      user_addresses: {
        Row: {
          recipient_name: string | null;
          recipient_phone: string | null;
          id: string;
          user_id: string;
          title: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          is_default: boolean | null;
        };
        Insert: {
          recipient_name?: string | null;
          recipient_phone?: string | null;
          id?: string;
          user_id: string;
          title: string;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean | null;
        };
        Update: {
          recipient_name?: string | null;
          recipient_phone?: string | null;
          id?: string;
          user_id?: string;
          title?: string;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean | null;
        };
      
        Relationships: [];
      };
      user_vouchers: {
        Row: {
          id: string;
          user_id: string;
          voucher_id: string;
          is_used: boolean | null;
          collected_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          voucher_id: string;
          is_used?: boolean | null;
          collected_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          voucher_id?: string;
          is_used?: boolean | null;
          collected_at?: string | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "user_vouchers_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ];
      };

      vouchers: {
        Row: {
          applies_to: 'food' | 'shipping';
          id: string;
          restaurant_id: string | null;
          code: string;
          discount_type: string;
          discount_value: number;
          min_order_value: number | null;
          expiry_date: string | null;
          is_active: boolean | null;
        };
        Insert: {
          applies_to?: 'food' | 'shipping';
          id?: string;
          restaurant_id?: string | null;
          code: string;
          discount_type: string;
          discount_value: number;
          min_order_value?: number | null;
          expiry_date?: string | null;
          is_active?: boolean | null;
        };
        Update: {
          applies_to?: 'food' | 'shipping';
          id?: string;
          restaurant_id?: string | null;
          code?: string;
          discount_type?: string;
          discount_value?: number;
          min_order_value?: number | null;
          expiry_date?: string | null;
          is_active?: boolean | null;
        };
      
        Relationships: [
          {
            foreignKeyName: "vouchers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ];
      };
    };
  
    Views: {
      [_ in never]: never
    };
    Functions: {
      signup_account_exists: { Args: { p_phone: string; p_email: string }; Returns: boolean }
      collect_my_voucher: {
        Args: { p_voucher_id: string }
        Returns: {
          applies_to: string
          code: string
          discount_type: string
          discount_value: number
          expiry_date: string | null
          id: string
          is_active: boolean | null
          min_order_value: number | null
          restaurant_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vouchers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_food_order:
        | {
            Args: {
              p_address: string
              p_items: Json
              p_order_id: string
              p_voucher_code?: string
            }
            Returns: {
              created_at: string | null
              delivery_address: string
              delivery_fee: number | null
              discount_amount: number | null
              driver_id: string | null
              food_discount_amount: number
              id: string
              latitude: number | null
              longitude: number | null
              payment_method: string | null
              recipient_name: string | null
              recipient_phone: string | null
              restaurant_id: string
              shipping_discount_amount: number
              shipping_voucher_id: string | null
              status: string | null
              subtotal: number
              total: number
              user_id: string
              voucher_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_address: string
              p_delivery_fee: number
              p_items: Json
              p_latitude: number
              p_longitude: number
              p_order_id: string
              p_voucher_code: string
            }
            Returns: {
              created_at: string | null
              delivery_address: string
              delivery_fee: number | null
              discount_amount: number | null
              driver_id: string | null
              food_discount_amount: number
              id: string
              latitude: number | null
              longitude: number | null
              payment_method: string | null
              recipient_name: string | null
              recipient_phone: string | null
              restaurant_id: string
              shipping_discount_amount: number
              shipping_voucher_id: string | null
              status: string | null
              subtotal: number
              total: number
              user_id: string
              voucher_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_address: string
              p_delivery_fee: number
              p_items: Json
              p_latitude: number
              p_longitude: number
              p_order_id: string
              p_recipient_name: string
              p_recipient_phone: string
              p_voucher_code: string
            }
            Returns: {
              created_at: string | null
              delivery_address: string
              delivery_fee: number | null
              discount_amount: number | null
              driver_id: string | null
              food_discount_amount: number
              id: string
              latitude: number | null
              longitude: number | null
              payment_method: string | null
              recipient_name: string | null
              recipient_phone: string | null
              restaurant_id: string
              shipping_discount_amount: number
              shipping_voucher_id: string | null
              status: string | null
              subtotal: number
              total: number
              user_id: string
              voucher_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_address: string
              p_delivery_fee: number
              p_items: Json
              p_latitude: number
              p_longitude: number
              p_order_id: string
              p_recipient_name: string
              p_recipient_phone: string
              p_shipping_voucher_code: string
              p_voucher_code: string
            }
            Returns: {
              created_at: string | null
              delivery_address: string
              delivery_fee: number | null
              discount_amount: number | null
              driver_id: string | null
              food_discount_amount: number
              id: string
              latitude: number | null
              longitude: number | null
              payment_method: string | null
              recipient_name: string | null
              recipient_phone: string | null
              restaurant_id: string
              shipping_discount_amount: number
              shipping_voucher_id: string | null
              status: string | null
              subtotal: number
              total: number
              user_id: string
              voucher_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      create_food_order_at_location: {
        Args: {
          p_address: string
          p_items: Json
          p_latitude?: number
          p_longitude?: number
          p_order_id: string
          p_voucher_code?: string
        }
        Returns: {
          created_at: string | null
          delivery_address: string
          delivery_fee: number | null
          discount_amount: number | null
          driver_id: string | null
          food_discount_amount: number
          id: string
          latitude: number | null
          longitude: number | null
          payment_method: string | null
          recipient_name: string | null
          recipient_phone: string | null
          restaurant_id: string
          shipping_discount_amount: number
          shipping_voucher_id: string | null
          status: string | null
          subtotal: number
          total: number
          user_id: string
          voucher_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_my_address: { Args: { p_id: string }; Returns: undefined }
      food_review_stats: {
        Args: { p_food_ids: string[] }
        Returns: {
          food_id: string
          like_count: number
          sold_count: number
        }[]
      }
      save_my_address:
        | {
            Args: {
              p_address: string
              p_create?: boolean
              p_id: string
              p_is_default: boolean
              p_latitude: number
              p_longitude: number
              p_title: string
            }
            Returns: {
              address: string
              id: string
              is_default: boolean | null
              latitude: number | null
              longitude: number | null
              recipient_name: string | null
              recipient_phone: string | null
              title: string
              user_id: string
            }[]
            SetofOptions: {
              from: "*"
              to: "user_addresses"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_address: string
              p_create: boolean
              p_id: string
              p_is_default: boolean
              p_latitude: number
              p_longitude: number
              p_recipient_name: string
              p_recipient_phone: string
              p_title: string
            }
            Returns: {
              address: string
              id: string
              is_default: boolean | null
              latitude: number | null
              longitude: number | null
              recipient_name: string | null
              recipient_phone: string | null
              title: string
              user_id: string
            }[]
            SetofOptions: {
              from: "*"
              to: "user_addresses"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      submit_order_review: {
        Args: {
          p_feedback: string
          p_food_votes?: Json
          p_image_path?: string
          p_order_id: string
          p_rating: number
          p_stage: string
        }
        Returns: {
          created_at: string | null
          driver_feedback: string | null
          driver_rating: number | null
          driver_submitted_at: string | null
          driver_tags: Json | null
          id: string
          order_id: string
          restaurant_feedback: string | null
          restaurant_image_path: string | null
          restaurant_rating: number | null
          restaurant_submitted_at: string | null
          reward_points: number
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_my_profile: {
        Args: { p_avatar_url: string; p_full_name: string; p_phone: string }
        Returns: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          loyalty_points: number | null
          phone: string | null
          role: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}
