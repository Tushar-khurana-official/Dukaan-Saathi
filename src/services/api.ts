import { AiParsedKhata, Customer, DetectedProduct, Language, Product } from '../types';
import { parseKhataText } from '../lib/khataParser';
import { confirmationText } from '../lib/replies';
import { sanitizeDetections } from '../lib/shelf';

/**
 * Parse a voice note or typed message. The server never receives customer phone numbers:
 * only ids and names are sent. If the server is unreachable the same rule-based parser runs locally.
 */
/**
 * The rule-based parse is good enough to show the "Sahi hai?" card without asking the AI when the
 * intent is known and (for money entries) the amount was found. A missing or ambiguous customer name
 * is fine: the card lets the owner pick the customer, and the AI could not tell two "Paras" apart either.
 */
export function goodEnoughLocally(p: { intent: string; amount_paise: number | null }): boolean {
  if (p.intent === 'unknown') return false;
  const money = p.intent === 'add_credit' || p.intent === 'add_payment' || p.intent === 'add_sale';
  return !money || p.amount_paise !== null;
}

export async function parseKhataMessage(params: {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  customers: Customer[];
  language: Language;
}): Promise<AiParsedKhata> {
  const customers = params.customers.map((c) => ({ id: c.id, name: c.name }));
  const local = (text: string, isDemo: boolean): AiParsedKhata => {
    const parsed = parseKhataText(text, customers);
    const name = customers.find((c) => c.id === parsed.matched_customer_id)?.name ?? null;
    return { ...parsed, bot_reply_text: confirmationText(parsed, name, params.language), isDemo };
  };

  // Fast path: if the words (typed, or the phone's own speech-to-text) are clear, answer instantly
  // on the phone. No network round trip, no AI cost. The owner still confirms on the "Sahi hai?" card.
  const text = params.text?.trim() ?? '';
  if (text) {
    const quick = local(text, false);
    if (goodEnoughLocally(quick)) return quick;
  }

  // Otherwise ask the server (Gemini), but never wait forever on a slow network.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch('/api/gemini/parse-khata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: params.text,
        audioBase64: params.audioBase64,
        audioMimeType: params.audioMimeType,
        customers,
        language: params.language,
      }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return (await res.json()) as AiParsedKhata;
  } catch {
    return local(text, true);
  } finally {
    window.clearTimeout(timer);
  }
}

export interface ShelfAnalysis {
  image_quality_warning?: string | null;
  overall_notes: string;
  products: DetectedProduct[];
  isDemo?: boolean;
  /** Set when the photo could not be analysed. Nothing should be saved or shown as a result then. */
  error?: string;
}

export async function analyzeShelfImage(params: {
  imageBase64: string;
  imageMimeType?: string;
  catalog: Product[];
  previousScanSummary?: string;
}): Promise<ShelfAnalysis> {
  const failed = (error: string): ShelfAnalysis => ({ overall_notes: '', products: [], error });
  let res: Response;
  try {
    res = await fetch('/api/gemini/analyze-shelf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        imageMimeType: params.imageMimeType,
        previousScanSummary: params.previousScanSummary,
        catalog: params.catalog.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases })),
      }),
    });
  } catch {
    return failed('Internet ya server se connect nahi ho paya. Dobara koshish karein.');
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401) return failed('Shelf photo AI se check karne ke liye login karein (demo mein yeh band hai).');
  if (!res.ok || !body) {
    return failed(
      (body && typeof body.message === 'string' && body.message) ||
        (res.status === 404 ? 'Server (API) chalu nahi hai, isliye photo check nahi ho sakti.' : 'Photo analyse nahi ho payi.'),
    );
  }
  const data = body as ShelfAnalysis;
  return { ...data, products: sanitizeDetections(data.products) };
}

export async function getFestivalStockSuggestions(festival: string) {
  try {
    const res = await fetch('/api/gemini/festival-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ festival }),
    });
    if (!res.ok) throw new Error('Festival API failed');
    return await res.json();
  } catch {
    return {
      festival,
      summary: '',
      items: [],
      isDemo: true,
    };
  }
}
