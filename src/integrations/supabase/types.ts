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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          target: string
          type: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          id?: string
          target?: string
          type?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          target?: string
          type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      backorders: {
        Row: {
          available_qty: number
          created_at: string
          customer: string
          expected_date: string | null
          id: string
          missing_qty: number
          order_id: string
          priority: string
          product: string
          reason: string
          sku: string
          status: string
          suggested: number
          updated_at: string
        }
        Insert: {
          available_qty?: number
          created_at?: string
          customer?: string
          expected_date?: string | null
          id: string
          missing_qty?: number
          order_id: string
          priority?: string
          product?: string
          reason?: string
          sku: string
          status?: string
          suggested?: number
          updated_at?: string
        }
        Update: {
          available_qty?: number
          created_at?: string
          customer?: string
          expected_date?: string | null
          id?: string
          missing_qty?: number
          order_id?: string
          priority?: string
          product?: string
          reason?: string
          sku?: string
          status?: string
          suggested?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backorders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backorders_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      carriers: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string
          country: string
          created_at: string
          credit_status: string
          id: string
          name: string
          segment: string
          updated_at: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          credit_status?: string
          id: string
          name: string
          segment?: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          credit_status?: string
          id?: string
          name?: string
          segment?: string
          updated_at?: string
        }
        Relationships: []
      }
      docks: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          allocated: number
          available: number
          created_at: string
          id: string
          location: string
          product: string
          reserved: number
          sku: string
          updated_at: string
          warehouse: string
          zone: string
        }
        Insert: {
          allocated?: number
          available?: number
          created_at?: string
          id: string
          location?: string
          product?: string
          reserved?: number
          sku: string
          updated_at?: string
          warehouse: string
          zone?: string
        }
        Update: {
          allocated?: number
          available?: number
          created_at?: string
          id?: string
          location?: string
          product?: string
          reserved?: number
          sku?: string
          updated_at?: string
          warehouse?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
          {
            foreignKeyName: "inventory_warehouse_fkey"
            columns: ["warehouse"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["code"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          severity: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          severity?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          severity?: string
          title?: string
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          allocated: number
          created_at: string
          id: string
          location: string
          order_id: string
          picked: number
          product: string
          quantity: number
          sku: string
          updated_at: string
        }
        Insert: {
          allocated?: number
          created_at?: string
          id?: string
          location?: string
          order_id: string
          picked?: number
          product?: string
          quantity?: number
          sku: string
          updated_at?: string
        }
        Update: {
          allocated?: number
          created_at?: string
          id?: string
          location?: string
          order_id?: string
          picked?: number
          product?: string
          quantity?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      packing_records: {
        Row: {
          carton: string
          created_at: string
          dimensions: string
          id: string
          label_number: string
          material: string
          operator: string
          order_id: string
          package_type: string
          station: string
          status: string
          updated_at: string
          wave_id: string | null
          weight_kg: number
        }
        Insert: {
          carton?: string
          created_at?: string
          dimensions?: string
          id: string
          label_number?: string
          material?: string
          operator?: string
          order_id: string
          package_type?: string
          station?: string
          status?: string
          updated_at?: string
          wave_id?: string | null
          weight_kg?: number
        }
        Update: {
          carton?: string
          created_at?: string
          dimensions?: string
          id?: string
          label_number?: string
          material?: string
          operator?: string
          order_id?: string
          package_type?: string
          station?: string
          status?: string
          updated_at?: string
          wave_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "packing_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_records_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lines: {
        Row: {
          barcode: string
          created_at: string
          id: string
          location: string
          order_id: string | null
          picked_qty: number
          picker: string
          product: string
          quantity: number
          serial: string
          sku: string
          status: string
          updated_at: string
          verified: boolean
          wave_id: string | null
          zone: string
        }
        Insert: {
          barcode?: string
          created_at?: string
          id: string
          location?: string
          order_id?: string | null
          picked_qty?: number
          picker?: string
          product?: string
          quantity?: number
          serial?: string
          sku: string
          status?: string
          updated_at?: string
          verified?: boolean
          wave_id?: string | null
          zone?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          location?: string
          order_id?: string | null
          picked_qty?: number
          picker?: string
          product?: string
          quantity?: number
          serial?: string
          sku?: string
          status?: string
          updated_at?: string
          verified?: boolean
          wave_id?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lines_sku_fkey"
            columns: ["sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
          {
            foreignKeyName: "pick_lines_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string
          category: string
          created_at: string
          name: string
          sku: string
          uom: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          barcode: string
          category?: string
          created_at?: string
          name: string
          sku: string
          uom?: string
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          barcode?: string
          category?: string
          created_at?: string
          name?: string
          sku?: string
          uom?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
      routes: {
        Row: {
          code: string
          created_at: string
        }
        Insert: {
          code: string
          created_at?: string
        }
        Update: {
          code?: string
          created_at?: string
        }
        Relationships: []
      }
      sales_orders: {
        Row: {
          carrier: string
          created_at: string
          customer: string
          delivery_date: string
          id: string
          order_date: string
          priority: string
          route: string
          status: string
          updated_at: string
          validation: string
          value_usd: number
          warehouse: string
        }
        Insert: {
          carrier: string
          created_at?: string
          customer: string
          delivery_date?: string
          id: string
          order_date?: string
          priority?: string
          route?: string
          status?: string
          updated_at?: string
          validation?: string
          value_usd?: number
          warehouse: string
        }
        Update: {
          carrier?: string
          created_at?: string
          customer?: string
          delivery_date?: string
          id?: string
          order_date?: string
          priority?: string
          route?: string
          status?: string
          updated_at?: string
          validation?: string
          value_usd?: number
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_fkey"
            columns: ["customer"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_fkey"
            columns: ["warehouse"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["code"]
          },
        ]
      }
      shipment_orders: {
        Row: {
          created_at: string
          order_id: string
          shipment_id: string
        }
        Insert: {
          created_at?: string
          order_id: string
          shipment_id: string
        }
        Update: {
          created_at?: string
          order_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string
          container: string
          created_at: string
          destination: string
          dispatch: string
          dock: string
          driver: string
          id: string
          load_verified: boolean
          scheduled_at: string | null
          seal: string
          status: string
          tracking_no: string
          updated_at: string
          vehicle: string | null
          verification_checklist: Json
        }
        Insert: {
          carrier?: string
          container?: string
          created_at?: string
          destination?: string
          dispatch?: string
          dock?: string
          driver?: string
          id: string
          load_verified?: boolean
          scheduled_at?: string | null
          seal?: string
          status?: string
          tracking_no?: string
          updated_at?: string
          vehicle?: string | null
          verification_checklist?: Json
        }
        Update: {
          carrier?: string
          container?: string
          created_at?: string
          destination?: string
          dispatch?: string
          dock?: string
          driver?: string
          id?: string
          load_verified?: boolean
          scheduled_at?: string | null
          seal?: string
          status?: string
          tracking_no?: string
          updated_at?: string
          vehicle?: string | null
          verification_checklist?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shipments_vehicle_fkey"
            columns: ["vehicle"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_pallets: number
          created_at: string
          driver: string
          id: string
          plate: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity_pallets?: number
          created_at?: string
          driver: string
          id: string
          plate: string
          type: string
          updated_at?: string
        }
        Update: {
          capacity_pallets?: number
          created_at?: string
          driver?: string
          id?: string
          plate?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          city: string
          code: string
          created_at: string
          name: string
          updated_at: string
          zones: string[]
        }
        Insert: {
          city?: string
          code: string
          created_at?: string
          name: string
          updated_at?: string
          zones?: string[]
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          name?: string
          updated_at?: string
          zones?: string[]
        }
        Relationships: []
      }
      wave_orders: {
        Row: {
          created_at: string
          order_id: string
          wave_id: string
        }
        Insert: {
          created_at?: string
          order_id: string
          wave_id: string
        }
        Update: {
          created_at?: string
          order_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_orders_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      waves: {
        Row: {
          capacity: number
          carrier: string
          created_at: string
          created_by: string
          delivery_date: string | null
          id: string
          lines: number
          name: string
          priority: string
          reservation_confirmed: boolean
          route: string
          status: string
          updated_at: string
          warehouse: string
          zone: string
        }
        Insert: {
          capacity?: number
          carrier?: string
          created_at?: string
          created_by?: string
          delivery_date?: string | null
          id: string
          lines?: number
          name: string
          priority?: string
          reservation_confirmed?: boolean
          route?: string
          status?: string
          updated_at?: string
          warehouse: string
          zone?: string
        }
        Update: {
          capacity?: number
          carrier?: string
          created_at?: string
          created_by?: string
          delivery_date?: string | null
          id?: string
          lines?: number
          name?: string
          priority?: string
          reservation_confirmed?: boolean
          route?: string
          status?: string
          updated_at?: string
          warehouse?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "waves_warehouse_fkey"
            columns: ["warehouse"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["code"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_order: { Args: { p_id: string }; Returns: Json }
      authorize_dispatch: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_id: string
          p_role: string
        }
        Returns: string
      }
      complete_order_picking: { Args: { p_order: string }; Returns: string }
      confirm_pick: {
        Args: {
          p_barcode: string
          p_id: string
          p_picker: string
          p_qty: number
        }
        Returns: Json
      }
      confirm_wave_reservation: { Args: { p_id: string }; Returns: boolean }
      create_manual_pick_list: {
        Args: { p_actor?: string; p_order: string }
        Returns: Json
      }
      create_sales_order: { Args: { p: Json }; Returns: string }
      create_shipment: { Args: { p: Json }; Returns: string }
      create_wave: { Args: { p: Json }; Returns: string }
      generate_pick_lists: { Args: { p_wave: string }; Returns: number }
      next_code: {
        Args: {
          p_column: string
          p_pad: number
          p_prefix: string
          p_table: string
        }
        Returns: string
      }
      release_wave: { Args: { p_id: string }; Returns: string }
      reserve_order: { Args: { p_id: string }; Returns: string }
      resolve_backorder: {
        Args: { p_action: string; p_id: string }
        Returns: Json
      }
      set_shipment_status: {
        Args: { p_actor?: string; p_id: string; p_status: string }
        Returns: string
      }
      update_sales_order: { Args: { p: Json; p_id: string }; Returns: string }
      update_shipment: { Args: { p: Json; p_id: string }; Returns: string }
      update_wave: { Args: { p: Json; p_id: string }; Returns: string }
      validate_sales_order: { Args: { p_id: string }; Returns: Json }
      verify_load: {
        Args: { p_actor: string; p_checklist: Json; p_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
