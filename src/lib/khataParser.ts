/**
 * Rule-based khata parser. Runs without any AI call, so it is:
 *  - the offline / no-API-key fallback,
 *  - a cross-check on Gemini output (amounts and customer ids are re-derived deterministically),
 *  - measurable on the utterance set in eval/utterances.json (`npm run eval`).
 */
import { extractAmount } from './hindiNumbers.js';
import { matchCustomer, MatchableCustomer } from './customerMatch.js';
import { normalizeText } from './textNormalize.js';
import { rupeesToPaise } from './money.js';

export type KhataIntent =
  | 'add_credit'
  | 'add_payment'
  | 'add_sale'
  | 'query_balance'
  | 'list_overdue'
  | 'add_customer'
  | 'summary'
  | 'unknown';

export interface ParsedKhata {
  transcript: string;
  intent: KhataIntent;
  customer_name: string;
  matched_customer_id: string | null;
  /** Ranked suggestions shown on the "Sahi hai?" card when the match is unsure. */
  candidate_customer_ids: string[];
  amount_paise: number | null;
  items_note: string | null;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
}

const CREDIT_PHRASES: Array<[RegExp, number]> = [
  [/\b(udhaar|udhar|udhari|udhaari|udhaar|credit|karz|karza)\b/, 2],
  [/\b(le gaye|le gaya|le gayi|le liya|liya|liye|lekar gaye)\b/, 2],
  [/\b(likh do|likho|likh dijiye|likh lo|likhna|khate mein|khaate mein|khata mein)\b/, 1.5],
  [/\bko\b/, 1],
  [/\b(baaki likh|baki likh|chadha do|chadhao|jod do|jodo)\b/, 1.5],
];

const PAYMENT_PHRASES: Array<[RegExp, number]> = [
  [/\b(jama|jamaa|payment|paid|pay kiya|pay kar diya|bhugtan|bhugataan)\b/, 3],
  [/\b(vasooli|wasooli|vasuli|wapas|vapas|lautaye|lautaya|lauta diye|chukaya|chuka diya|chukta|clear kiya|clear kar diya|settle)\b/, 3],
  [/\b(diye|diya|die|dia|de gaye|de gaya|de gayi|de diye|bheje|bheja|mile|mila|aaye|aaya|received|gpay|phonepe|paytm|upi se)\b/, 1.5],
  [/\bne\b/, 2],
];

const SALE_PHRASES = /\b(bikri|bikree|sale|sales|bika|bike|becha|bechi|beche|galla|nakad bikri|cash sale|counter sale)\b/;
const QUERY_PHRASES = /\b(kitna|kitne|kitni|kya hai|batao|bataiye|balance|hisaab batao|hisab batao|check)\b/;
const OVERDUE_PHRASES = /\b(kis kis|kaun kaun|sabka|sab ka|overdue|list|sabhi)\b/;
const NEW_CUSTOMER_PHRASES = /\b(naya grahak|naya customer|new customer|nayi grahak|add customer|customer add|grahak jodo)\b/;
const SUMMARY_PHRASES = /\b(summary|aaj ka hisaab|aaj ka hisab|report|din ka hisaab)\b/;

/** Words dropped from the note ("saman ka" -> "saman"). */
const NOTE_STOPWORDS = new Set([
  'ka', 'ki', 'ke', 'ko', 'ne', 'se', 'hai', 'tha', 'the', 'aur', 'bhi', 'udhaar', 'udhar', 'udhari', 'credit',
  'jama', 'payment', 'diye', 'diya', 'die', 'de', 'do', 'gaye', 'gaya', 'liya', 'liye', 'le', 'likh', 'likho',
  'rupaye', 'rupees', 'rupay', 'rs', '₹', 'khate', 'mein', 'me', 'kar', 'karo', 'umm', 'um', 'haan', 'accha',
  'arre', 'please', 'ji', 'jee', 'wapas', 'mile', 'mila', 'lena', 'dena', 'hua', 'hue', 'bhaiya', 'bhai',
]);

function scorePhrases(text: string, phrases: Array<[RegExp, number]>): number {
  return phrases.reduce((sum, [re, w]) => (re.test(text) ? sum + w : sum), 0);
}

/** The spoken name is usually the words before "ko" / "ne" / "ka" / "se", or before the amount. */
function extractNamePhrase(tokens: string[], amountStart: number | null): string {
  const markerIdx = tokens.findIndex((t) => t === 'ko' || t === 'ne' || t === 'ka' || t === 'ki' || t === 'se');
  let end = markerIdx >= 0 ? markerIdx : amountStart ?? tokens.length;
  if (amountStart !== null && amountStart < end) end = amountStart;
  const fillers = new Set(['umm', 'um', 'haan', 'accha', 'acha', 'arre', 'achha', 'ok', 'okay', 'woh', 'vo', 'bhaiya', 'suno', 'likho']);
  const words = tokens.slice(0, end).filter((w) => !fillers.has(w) && !/^\d/.test(w));
  return words.slice(-4).join(' ');
}

function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function extractNote(tokens: string[], amountEnd: number | null, nameWords: Set<string>): string | null {
  if (amountEnd === null) return null;
  const rest = tokens
    .slice(amountEnd)
    .filter((w) => !NOTE_STOPWORDS.has(w) && !nameWords.has(w) && w.length > 1);
  if (rest.length === 0) return null;
  const note = rest.join(' ');
  return note.charAt(0).toUpperCase() + note.slice(1);
}

export function parseKhataText<C extends MatchableCustomer>(text: string, customers: C[]): ParsedKhata {
  const normalized = normalizeText(text);
  const tokens = normalized.split(' ').filter(Boolean);
  const amount = extractAmount(text);
  const amountPaise = amount ? rupeesToPaise(amount.value) : null;

  // --- intent ---
  let intent: KhataIntent = 'unknown';
  let intentConfidence = 0.5;
  const credit = scorePhrases(normalized, CREDIT_PHRASES);
  const payment = scorePhrases(normalized, PAYMENT_PHRASES);

  if (NEW_CUSTOMER_PHRASES.test(normalized)) {
    intent = 'add_customer';
    intentConfidence = 0.9;
  } else if (amountPaise !== null && SALE_PHRASES.test(normalized)) {
    intent = 'add_sale';
    intentConfidence = 0.9;
  } else if (amountPaise === null && OVERDUE_PHRASES.test(normalized)) {
    intent = 'list_overdue';
    intentConfidence = 0.85;
  } else if (amountPaise === null && SUMMARY_PHRASES.test(normalized)) {
    intent = 'summary';
    intentConfidence = 0.85;
  } else if (amountPaise === null && (QUERY_PHRASES.test(normalized) || /\b(baaki|baki|bakaya)\b/.test(normalized))) {
    intent = 'query_balance';
    intentConfidence = 0.85;
  } else if (amountPaise !== null) {
    if (payment > credit) {
      intent = 'add_payment';
      intentConfidence = payment - credit >= 2 ? 0.92 : 0.75;
    } else if (credit > 0) {
      intent = 'add_credit';
      intentConfidence = credit - payment >= 2 ? 0.92 : 0.75;
    } else {
      // "Sharma ji 500" with no verb: udhaar is by far the most common entry, but ask.
      intent = 'add_credit';
      intentConfidence = 0.55;
    }
  }

  // --- customer ---
  const namePhrase = extractNamePhrase(tokens, amount ? amount.start : null);
  let match = matchCustomer(namePhrase || text, customers);
  if (!match.best && !match.ambiguous && namePhrase) {
    // name phrase heuristics failed; try the whole utterance
    const whole = matchCustomer(text, customers);
    if (whole.best || whole.candidates.length > match.candidates.length) match = whole;
  }
  const matched = match.best?.customer ?? null;
  const spokenName = matched ? matched.name : titleCase(namePhrase);

  // --- note ---
  const nameWords = new Set(namePhrase.split(' '));
  const note = intent === 'add_credit' || intent === 'add_payment' || intent === 'add_sale'
    ? extractNote(tokens, amount ? amount.end : null, nameWords)
    : null;

  // --- clarification ---
  const needsCustomer = intent === 'add_credit' || intent === 'add_payment' || intent === 'query_balance';
  let question: string | null = null;
  if (intent === 'unknown') {
    question = 'Samajh nahi aaya. Grahak ka naam aur rashi dobara boliye, jaise "Sharma ji ko 500 udhaar".';
  } else if ((intent === 'add_credit' || intent === 'add_payment' || intent === 'add_sale') && amountPaise === null) {
    question = 'Kitne rupaye? Rashi dobara boliye.';
  } else if (needsCustomer && match.ambiguous) {
    question = `Kaun se grahak? ${match.candidates.slice(0, 3).map((c) => c.customer.name).join(' / ')}`;
  } else if (needsCustomer && !matched) {
    question = match.candidates.length > 0
      ? `Kya aapka matlab ${match.candidates[0].customer.name} hai?`
      : `"${spokenName || 'Grahak'}" naam ka grahak nahi mila. Naya grahak banayein ya list se chunein.`;
  }

  const customerConfidence = needsCustomer ? (match.best?.score ?? 0.4) : 1;
  const confidence = Math.round(Math.min(intentConfidence, customerConfidence) * 100) / 100;

  return {
    transcript: text,
    intent,
    customer_name: spokenName,
    matched_customer_id: needsCustomer || intent === 'add_sale' ? matched?.id ?? null : null,
    candidate_customer_ids: match.candidates.map((c) => c.customer.id),
    amount_paise: amountPaise,
    items_note: note,
    confidence,
    needs_clarification: question !== null,
    clarification_question: question,
  };
}
