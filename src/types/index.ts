/**
 * Data model — mirrors the "Data model" table in the build spec.
 * Rules: every record belongs to one shop (shop_id); money is integer paise, never decimals.
 */
import type { KhataIntent, ParsedKhata } from '../lib/khataParser';
import type { ShelfStatus } from '../lib/shelf';

export type Language = 'hinglish' | 'hindi' | 'english';
export type ReminderTone = 'polite' | 'friendly' | 'firm';

/** Shop: one per kirana. */
export interface ShopProfile {
  id: string;
  name: string;
  owner: string;
  owner_phone: string;
  upi_id: string;
  language: Language;
  created_at: string;
  /** Owner accepted the data-use notice (udhaar tracking and payment reminders only). */
  consent_accepted: boolean;
  address?: string;
  /** Per-shop reminder settings. Sending is always manual in this prototype. */
  reminder_settings: {
    default_tone: ReminderTone;
    language: Language;
  };
}

/** Customer. Phone is personal data: it may only be stored with consent (consent_given_at). */
export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  /** ISO date when the customer agreed to their phone number being stored; null = no consent, no phone. */
  consent_given_at: string | null;
  note: string;
  created_at: string;
  avatar_color?: string;
  /** Customer agreed to get a WhatsApp receipt after each entry (owner still taps send). */
  receipts_opt_in?: boolean;
  /** Secret part of the customer's statement link; null/absent = link off. */
  statement_key?: string | null;
  /** Owner's own credit limit for this customer (the app only suggests one). */
  credit_limit_paise?: number | null;
}

export type TransactionType = 'credit' | 'payment' | 'sale';
export type TransactionSource = 'voice' | 'text' | 'manual';

/** Transaction. Saved only after the owner confirms, so confirmed_at is always set. */
export interface Transaction {
  id: string;
  shop_id: string;
  /** null for counter sales that are not tied to a customer */
  customer_id: string | null;
  type: TransactionType;
  amount_paise: number;
  note: string;
  source: TransactionSource;
  confirmed_at: string;
}

export type StockStatus = ShelfStatus;

/** Product. Aliases support Hinglish names ("namak" for Tata Salt). No unit counts are tracked. */
export interface Product {
  id: string;
  shop_id: string;
  name: string;
  aliases: string[];
  category: string;
  /** Suggested reorder size when the item is flagged low or out (an order quantity, not stock on hand). */
  low_stock_threshold: number;
  unit: string;
  supplier_name: string;
  supplier_phone: string;
  mrp_paise?: number;
  /** Last status seen on a shelf photo. */
  stock_status: StockStatus;
  status_updated_at?: string;
}

export interface DetectedProduct {
  name: string;
  matched_sku: string | null;
  status: StockStatus;
  confidence: number;
  note: string;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

/** ShelfScan: stores gaps and low-stock flags, not counts. */
export interface ShelfScan {
  id: string;
  shop_id: string;
  /** Image reference (a data URL in the prototype; an object-store key once there is a backend). */
  image_ref: string;
  detected_items: DetectedProduct[];
  overall_notes: string;
  quality_warning?: string | null;
  created_at: string;
}

export interface ReorderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  supplier_name: string;
  supplier_phone: string;
}

/** Reminder: records that the owner OPENED the WhatsApp link, not that a message was sent. */
export interface ReminderLog {
  id: string;
  shop_id: string;
  customer_id: string;
  channel: 'whatsapp';
  text: string;
  amount_paise: number;
  tone: ReminderTone;
  link_opened_at: string;
}

export type { KhataIntent };

/** Parser output as shown on the "Sahi hai?" card. */
export interface AiParsedKhata extends ParsedKhata {
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
  /** How the entry on this card was captured (stored as Transaction.source). */
  entrySource?: 'voice' | 'text';
  confirmed?: boolean;
  cancelled?: boolean;
  /** Bot confirmation of a saved entry: lets the owner send a WhatsApp receipt (opted-in customers only). */
  receipt?: { customerId: string; type: 'credit' | 'payment'; amountPaise: number; balancePaise: number; sent?: boolean };
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}
