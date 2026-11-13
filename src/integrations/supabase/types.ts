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
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          address_number: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          created_at: string
          district: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          created_at: string
          id: string
          is_merchandise: boolean
          kind: Database["public"]["Enums"]["finance_kind"]
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_merchandise?: boolean
          kind: Database["public"]["Enums"]["finance_kind"]
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_merchandise?: boolean
          kind?: Database["public"]["Enums"]["finance_kind"]
          name?: string
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          active: boolean
          created_at: string
          details: string | null
          id: string
          initial_balance: number
          name: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          details?: string | null
          id?: string
          initial_balance?: number
          name: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          details?: string | null
          id?: string
          initial_balance?: number
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          origin_id: string | null
          origin_type: string
          reversed_at: string | null
          reversed_by: string | null
          transfer_group: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          id?: string
          origin_id?: string | null
          origin_type: string
          reversed_at?: string | null
          reversed_by?: string | null
          transfer_group?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          origin_id?: string | null
          origin_type?: string
          reversed_at?: string | null
          reversed_by?: string | null
          transfer_group?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          discount: number
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          discount?: number
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          discount?: number
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string
          confirmed_at: string | null
          cost_total: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          id: string
          installments: number
          marketplace_fee: number
          notes: string | null
          number: number
          payment_fee: number
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          return_restocked: boolean
          shipping: number
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          stock_deducted: boolean
          subtotal: number
          total: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          confirmed_at?: string | null
          cost_total?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          installments?: number
          marketplace_fee?: number
          notes?: string | null
          number?: number
          payment_fee?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          return_restocked?: boolean
          shipping?: number
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          confirmed_at?: string | null
          cost_total?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          installments?: number
          marketplace_fee?: number
          notes?: string | null
          number?: number
          payment_fee?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          return_restocked?: boolean
          shipping?: number
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          document_ref: string | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["bill_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          document_ref?: string | null
          due_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          document_ref?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_cost: number
          new_price: number
          old_cost: number | null
          old_price: number | null
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost: number
          new_price: number
          old_cost?: number | null
          old_price?: number | null
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number
          new_price?: number
          old_cost?: number | null
          old_price?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          brand: string | null
          category_id: string | null
          code: string
          cost: number
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          length_cm: number | null
          margin: number | null
          min_stock: number
          name: string
          price: number
          sku: string | null
          stock_qty: number
          supplier_id: string | null
          updated_at: string
          variations: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          code?: string
          cost?: number
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          margin?: number | null
          min_stock?: number
          name: string
          price?: number
          sku?: string | null
          stock_qty?: number
          supplier_id?: string | null
          updated_at?: string
          variations?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          code?: string
          cost?: number
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          margin?: number | null
          min_stock?: number
          name?: string
          price?: number
          sku?: string | null
          stock_qty?: number
          supplier_id?: string | null
          updated_at?: string
          variations?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          due_date: string
          id: string
          installment_count: number
          installment_no: number
          notes: string | null
          order_id: string | null
          payment_method: string | null
          received_amount: number | null
          received_at: string | null
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          due_date: string
          id?: string
          installment_count?: number
          installment_no?: number
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_count?: number
          installment_no?: number
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          bank_details: string | null
          currency: string
          default_min_stock: number
          document: string | null
          due_alert_days: number
          email: string | null
          id: number
          logo_url: string | null
          notify_due_bills: boolean
          notify_low_stock: boolean
          notify_pending_orders: boolean
          payment_methods: string[]
          phone: string | null
          stale_order_days: number
          stock_deduct_on: string
          store_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          bank_details?: string | null
          currency?: string
          default_min_stock?: number
          document?: string | null
          due_alert_days?: number
          email?: string | null
          id?: number
          logo_url?: string | null
          notify_due_bills?: boolean
          notify_low_stock?: boolean
          notify_pending_orders?: boolean
          payment_methods?: string[]
          phone?: string | null
          stale_order_days?: number
          stock_deduct_on?: string
          store_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          bank_details?: string | null
          currency?: string
          default_min_stock?: number
          document?: string | null
          due_alert_days?: number
          email?: string | null
          id?: number
          logo_url?: string | null
          notify_due_bills?: boolean
          notify_low_stock?: boolean
          notify_pending_orders?: boolean
          payment_methods?: string[]
          phone?: string | null
          stale_order_days?: number
          stock_deduct_on?: string
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          products_supplied: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products_supplied?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products_supplied?: string | null
          updated_at?: string
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
    }
    Views: {
      account_balances: {
        Row: {
          active: boolean | null
          balance: number | null
          details: string | null
          id: string | null
          initial_balance: number | null
          name: string | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: []
      }
      customer_summary: {
        Row: {
          id: string | null
          last_purchase: string | null
          order_count: number | null
          total_spent: number | null
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          last_sold_at: string | null
          product_id: string | null
          profit: number | null
          qty_sold: number | null
          revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_order_effects: { Args: { p_order: string }; Returns: undefined }
      _apply_stock: {
        Args: {
          p_delta: number
          p_order: string
          p_product: string
          p_reason: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: number
      }
      create_order: { Args: { p: Json }; Returns: string }
      get_alerts: { Args: never; Returns: Json }
      get_cash_flow: {
        Args: { p_account?: string; p_end: string; p_start: string }
        Returns: Json
      }
      get_dashboard: { Args: { p_end: string; p_start: string }; Returns: Json }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      order_confirmed: {
        Args: {
          _pay: Database["public"]["Enums"]["payment_status"]
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      pay_payable: {
        Args: {
          p_account: string
          p_amount?: number
          p_date?: string
          p_id: string
          p_method?: string
        }
        Returns: undefined
      }
      receive_receivable: {
        Args: {
          p_account: string
          p_amount?: number
          p_date?: string
          p_id: string
        }
        Returns: undefined
      }
      register_stock_movement: {
        Args: {
          p_product: string
          p_quantity: number
          p_reason?: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: number
      }
      restock_returned_order: { Args: { p_order: string }; Returns: undefined }
      reverse_bill: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      today_br: { Args: never; Returns: string }
      transfer_between_accounts: {
        Args: {
          p_amount: number
          p_date?: string
          p_description?: string
          p_from: string
          p_to: string
        }
        Returns: string
      }
      update_order_status: {
        Args: {
          p_order: string
          p_payment_status?: Database["public"]["Enums"]["payment_status"]
          p_status: Database["public"]["Enums"]["order_status"]
          p_tracking?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "banco"
        | "caixa"
        | "pix"
        | "carteira_digital"
        | "mercado_pago"
        | "outro"
      app_role: "admin" | "financeiro" | "vendas"
      bill_status: "pendente" | "pago" | "cancelado"
      finance_kind: "receita" | "despesa"
      order_status:
        | "aguardando_pagamento"
        | "pagamento_aprovado"
        | "em_separacao"
        | "em_preparacao"
        | "enviado"
        | "entregue"
        | "cancelado"
        | "devolvido"
      payment_status: "pendente" | "pago" | "estornado"
      stock_movement_type:
        | "entrada"
        | "saida"
        | "venda"
        | "devolucao"
        | "ajuste"
        | "perda"
        | "cancelamento"
      transaction_type:
        | "entrada"
        | "saida"
        | "transferencia_entrada"
        | "transferencia_saida"
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
      account_type: [
        "banco",
        "caixa",
        "pix",
        "carteira_digital",
        "mercado_pago",
        "outro",
      ],
      app_role: ["admin", "financeiro", "vendas"],
      bill_status: ["pendente", "pago", "cancelado"],
      finance_kind: ["receita", "despesa"],
      order_status: [
        "aguardando_pagamento",
        "pagamento_aprovado",
        "em_separacao",
        "em_preparacao",
        "enviado",
        "entregue",
        "cancelado",
        "devolvido",
      ],
      payment_status: ["pendente", "pago", "estornado"],
      stock_movement_type: [
        "entrada",
        "saida",
        "venda",
        "devolucao",
        "ajuste",
        "perda",
        "cancelamento",
      ],
      transaction_type: [
        "entrada",
        "saida",
        "transferencia_entrada",
        "transferencia_saida",
      ],
    },
  },
} as const
