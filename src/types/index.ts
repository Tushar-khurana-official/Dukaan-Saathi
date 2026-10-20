export type Language = 'hinglish' | 'hindi' | 'english';

export type ReminderTone = 'polite' | 'friendly' | 'firm';

export interface ShopProfile {
  name: string;
  owner: string;
  upi_id: string;
  language: Language;
  consent_accepted: boolean;
  phone?: string;
  address?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  note: string;
  created_at: string;
  avatar_color?: string;
}

export type TransactionType = 'credit' | 'payment';
export type TransactionSource = 'voice' | 'text' | 'manual' | 'photo';

export interface Transaction {
  id: string;
  customer_id: string;
  type: TransactionType;
  amount: number;
  note: string;
  date: string;
  source: TransactionSource;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  min_level: number;
  current_level?: number;
  unit: string;
  supplier_name: string;
  supplier_phone: string;
  mrp?: number;
}

export type StockStatus = 'ok' | 'low' | 'out' | 'unknown';

export interface DetectedProduct {
  name: string;
  matched_sku: string | null;
  status: StockStatus;
  confidence: number;
  note: string;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

export interface ShelfScan {
  id: string;
  image_thumbnail: string;
  created_at: string;
  overall_notes: string;
  quality_warning?: string | null;
  results: DetectedProduct[];
}

export interface ReorderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  supplier_name: string;
  supplier_phone: string;
}

export interface ReminderLog {
  id: string;
  customer_id: string;
  customer_name: string;
  sent_at: string;
  channel: 'whatsapp';
  amount: number;
  tone: ReminderTone;
  message_preview: string;
}

export interface AiParsedKhata {
  transcript: string;
  intent: 'add_credit' | 'add_payment' | 'query_balance' | 'list_overdue' | 'add_customer' | 'summary' | 'unknown';
  customer_name: string;
  matched_customer_id: string | null;
  amount: number | null;
  items_note: string | null;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
  bot_reply_text: string;
  isDemo?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  text?: string;
  audioBlobUrl?: string;
  audioDuration?: number;
  imagePreviewUrl?: string;
  parsedKhata?: AiParsedKhata;
  confirmed?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}
