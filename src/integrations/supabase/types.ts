export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accepted_trx: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          status: string
          trx_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          status?: string
          trx_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          status?: string
          trx_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      admin_event_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_key: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          state: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_key: string
          id?: string
          kind: string
          last_error?: string | null
          payload: Json
          sent_at?: string | null
          state?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          message: string
          start_date: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          message?: string
          start_date?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          message?: string
          start_date?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_demo: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_demo?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_demo?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          id: string
          is_enabled: boolean
          key: string
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          key: string
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Update: {
          id?: string
          is_enabled?: boolean
          key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          delivered_key: string | null
          id: string
          note: string | null
          package_id: string | null
          package_name: string | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string
          total: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_key?: string | null
          id?: string
          note?: string | null
          package_id?: string | null
          package_name?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_key?: string | null
          id?: string
          note?: string | null
          package_id?: string | null
          package_name?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          status: string
          trx_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          status?: string
          trx_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          trx_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_keys: {
        Row: {
          created_at: string
          id: string
          is_used: boolean
          key_value: string
          order_id: string | null
          package_id: string | null
          product_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_used?: boolean
          key_value: string
          order_id?: string | null
          package_id?: string | null
          product_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_used?: boolean
          key_value?: string
          order_id?: string | null
          package_id?: string | null
          product_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_keys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packages: {
        Row: {
          created_at: string
          duration: string
          id: string
          is_active: boolean
          name: string
          price: number
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          demo_url: string | null
          discount_price: number | null
          features: string[]
          full_description: string | null
          id: string
          image_url: string | null
          images: string[]
          is_active: boolean
          is_best_seller: boolean
          is_demo: boolean
          is_featured: boolean
          is_verified: boolean
          name: string
          price: number
          purchase_url: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          demo_url?: string | null
          discount_price?: number | null
          features?: string[]
          full_description?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_active?: boolean
          is_best_seller?: boolean
          is_demo?: boolean
          is_featured?: boolean
          is_verified?: boolean
          name: string
          price?: number
          purchase_url?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          demo_url?: string | null
          discount_price?: number | null
          features?: string[]
          full_description?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_active?: boolean
          is_best_seller?: boolean
          is_demo?: boolean
          is_featured?: boolean
          is_verified?: boolean
          name?: string
          price?: number
          purchase_url?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      support_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          amount: number | null
          attempts: number
          created_at: string
          id: string
          message: string
          source: string
          status: string
          subject: string
          trx_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          attempts?: number
          created_at?: string
          id?: string
          message: string
          source?: string
          status?: string
          subject: string
          trx_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          attempts?: number
          created_at?: string
          id?: string
          message?: string
          source?: string
          status?: string
          subject?: string
          trx_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_links: {
        Row: {
          id: string
          linked_at: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_sessions: {
        Row: {
          chat_id: number
          data: Json
          state: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          data?: Json
          state?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          data?: Json
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      uddoktapay_payments: {
        Row: {
          amount: number
          created_at: string
          credited_at: string | null
          id: string
          invoice_id: string
          payment_method: string | null
          raw: Json | null
          sender_number: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credited_at?: string | null
          id?: string
          invoice_id: string
          payment_method?: string | null
          raw?: Json | null
          sender_number?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          invoice_id?: string
          payment_method?: string | null
          raw?: Json | null
          sender_number?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: {
          p_amount: number
          p_description: string
          p_type?: string
          p_user_id: string
        }
        Returns: number
      }
      admin_refund_order: { Args: { p_order_id: string }; Returns: undefined }
      admin_stats: { Args: never; Returns: Json }
      credit_uddoktapay_payment: {
        Args: { p_invoice_id: string }
        Returns: string
      }
      ensure_profile: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      package_stock: {
        Args: { p_product_id: string }
        Returns: {
          available: number
          package_id: string
          sold: number
        }[]
      }
      purchase_package: { Args: { p_package_id: string }; Returns: string }
      purchase_product: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: string
      }
      verify_payment: {
        Args: { p_amount: number; p_method: string; p_trx: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin"],
    },
  },
} as const
