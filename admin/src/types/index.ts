// ── Auth ──────────────────────────────────────────────────────────────────────
export interface Token {
  access_token: string
  token_type: string
}

// ── Enums ─────────────────────────────────────────────────────────────────────
export type ItemStatus =
  | 'received' | 'inspected' | 'listed' | 'sold'
  | 'shipped' | 'delivered' | 'returned' | 'archived'

export type ItemCategory =
  | 'clothing' | 'furniture' | 'lactancy' | 'strollers'
  | 'toys' | 'accessories' | 'other'

export type ItemCondition = 'like_new' | 'good' | 'fair'

export type ItemGender = 'girl' | 'boy' | 'unisex'

export type OrderStatus =
  | 'pending_payment' | 'paid' | 'preparing'
  | 'shipped' | 'delivered' | 'closed' | 'cancelled' | 'refunded'

export type ShippingMethod = 'pickup' | 'delivery_cdmx' | 'parcel'

// ── Seller ────────────────────────────────────────────────────────────────────
export interface Seller {
  id: number
  full_name: string
  phone: string
  email?: string
  neighborhood?: string
  city: string
  bank_name?: string
  clabe?: string
  paypal_email?: string
  notes?: string
  rating?: number
  is_active: boolean
  created_at: string
}

export interface SellerCreate {
  full_name: string
  phone: string
  email?: string
  neighborhood?: string
  city?: string
  bank_name?: string
  clabe?: string
  paypal_email?: string
  notes?: string
}

// ── Buyer ─────────────────────────────────────────────────────────────────────
export interface Buyer {
  id: number
  full_name: string
  phone: string
  email?: string
  neighborhood?: string
  city: string
  notes?: string
  rating?: number
  is_active: boolean
  created_at: string
}

export interface BuyerCreate {
  full_name: string
  phone: string
  email?: string
  neighborhood?: string
  city?: string
}

// ── Item ──────────────────────────────────────────────────────────────────────
export interface Item {
  id: number
  sku: string
  title: string
  description?: string
  category: ItemCategory
  condition: ItemCondition
  gender?: ItemGender
  brand?: string
  size?: string
  color?: string
  original_price?: number
  selling_price: number
  seller_payout?: number
  commission?: number
  images?: string
  notes?: string
  status: ItemStatus
  is_featured: boolean
  no_seller: boolean
  seller_id?: number
  received_at?: string
  listed_at?: string
  sold_at?: string
  created_at: string
}

export interface ItemCreate {
  title: string
  description?: string
  category: ItemCategory
  condition: ItemCondition
  brand?: string
  size?: string
  color?: string
  original_price?: number
  selling_price: number
  seller_id: number
  notes?: string
  is_featured?: boolean
}

export interface ItemUpdate {
  title?: string
  description?: string
  category?: ItemCategory
  condition?: ItemCondition
  brand?: string
  size?: string
  color?: string
  original_price?: number
  selling_price?: number
  status?: ItemStatus
  notes?: string
  is_featured?: boolean
}

// ── Order ─────────────────────────────────────────────────────────────────────
export interface Order {
  id: number
  order_number: string
  buyer_id: number
  item_id: number
  amount: number
  commission_amount: number
  seller_payout_amount: number
  status: OrderStatus
  mp_payment_id?: string
  shipping_method?: ShippingMethod
  shipping_address?: string
  tracking_number?: string
  shipping_carrier?: string
  seller_paid: number
  seller_paid_at?: string
  notes?: string
  created_at: string
  updated_at?: string
  // Enriched
  buyer_name?: string
  buyer_phone?: string
  item_title?: string
  item_sku?: string
  seller_id?: number
  seller_name?: string
  seller_phone?: string
}

export interface OrderCreate {
  buyer_id: number
  item_id: number
  shipping_method?: ShippingMethod
  shipping_address?: string
  notes?: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardSummary {
  inventory: Record<ItemStatus, number>
  revenue: {
    total_gross: number
    total_commission: number
    month_gross: number
    month_commission: number
  }
  pending_seller_payouts: number
  totals: {
    sellers: number
    buyers: number
    orders: number
  }
}

export interface RevenueByMonth {
  month: string
  gross: number
  commission: number
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export interface WhatsAppMessage {
  id: number
  to_number: string
  body: string
  direction: 'outbound' | 'inbound'
  message_type: 'manual' | 'template' | 'marketing'
  twilio_sid?: string
  status?: string
  seller_id?: number
  buyer_id?: number
  order_id?: number
  created_at: string
}

export interface SendMessageRequest {
  to_number: string
  body: string
  message_type?: 'manual' | 'template' | 'marketing'
  seller_id?: number
  buyer_id?: number
  order_id?: number
}
