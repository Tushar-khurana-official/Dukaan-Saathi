import { AiParsedKhata, Customer, DetectedProduct, Language, Product } from '../types';
import { parseKhataText } from '../lib/khataParser';
import { confirmationText } from '../lib/replies';
import { sanitizeDetections } from '../lib/shelf';

/**
 * Parse a voice note or typed message. The server never receives customer phone numbers:
 * only ids and names are sent. If the server is unreachable the same rule-based parser runs locally.
 */
export async function parseKhataMessage(params: {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  customers: Customer[];
  language: Language;
}): Promise<AiParsedKhata> {
  const customers = params.customers.map((c) => ({ id: c.id, name: c.name }));
  try {
    const res = await fetch('/api/gemini/parse-khata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const parsed = parseKhataText(params.text ?? '', customers);
    const name = customers.find((c) => c.id === parsed.matched_customer_id)?.name ?? null;
    return { ...parsed, bot_reply_text: confirmationText(parsed, name, params.language), isDemo: true };
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
      summary: 'Server se connect nahi ho paya. Apni pichli bikri dekh kar order karein.',
      items: [],
      isDemo: true,
    };
  }
}
