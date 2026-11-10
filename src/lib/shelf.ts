/**
 * Shelf scanner output rules from the spec: report gaps and low stock, never exact unit counts.
 * The model is told this in the prompt; this sanitiser enforces it on whatever comes back
 * (and on demo/seed data), so a count can never reach the screen.
 */

export type ShelfStatus = 'ok' | 'low' | 'out' | 'unknown';

export interface ShelfDetection {
  name: string;
  matched_sku: string | null;
  status: ShelfStatus;
  confidence: number;
  note: string;
  box_2d?: [number, number, number, number];
}

const COUNT_WORDS =
  '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|char|paanch|panch|chhe|saat|aath|nau|das)';
const UNIT_WORDS =
  '(?:units?|pieces?|pcs|packets?|packs?|pkts?|pouch(?:es)?|bottles?|boxes?|bags?|tins?|jars?|bars?|tubes?|bricks?|items?|nos?|piece|packet|dabbe|thaili)';

const LEFT_WORDS = '(?:left|bach[aei]|bache|baki|baaki|visible|dikh rah[aei]|remaining)';

const COUNT_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:only|sirf|bas|just|about|around|lagbhag)?\\s*${COUNT_WORDS}\\s+${UNIT_WORDS}\\b(?:\\s+${LEFT_WORDS}\\b)?`, 'gi'),
  new RegExp(`\\b(?:only|sirf|bas|just)?\\s*${COUNT_WORDS}\\s+${LEFT_WORDS}\\b`, 'gi'),
  new RegExp(`\\b(?:count|qty|quantity)\\s*[:=]?\\s*\\d+\\b`, 'gi'),
];

export function stripUnitCounts(text: string): string {
  let out = text;
  for (const re of COUNT_PATTERNS) out = out.replace(re, ' thoda hi stock ');
  return out.replace(/(thoda hi stock\s*)+/g, 'thoda hi stock ').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
}

const VALID: ShelfStatus[] = ['ok', 'low', 'out', 'unknown'];

export function sanitizeDetections(items: unknown): ShelfDetection[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => {
      const status = VALID.includes(p.status as ShelfStatus) ? (p.status as ShelfStatus) : 'unknown';
      const confidence = typeof p.confidence === 'number' ? Math.min(1, Math.max(0, p.confidence)) : 0.5;
      const box = Array.isArray(p.box_2d) && p.box_2d.length === 4 && p.box_2d.every((n) => typeof n === 'number')
        ? (p.box_2d as [number, number, number, number])
        : undefined;
      return {
        name: stripUnitCounts(String(p.name ?? 'Unknown item')),
        matched_sku: typeof p.matched_sku === 'string' ? p.matched_sku : null,
        status,
        confidence,
        note: stripUnitCounts(String(p.note ?? '')),
        ...(box ? { box_2d: box } : {}),
      };
    });
}

export interface ScanChange {
  name: string;
  matched_sku: string | null;
  previous: ShelfStatus | null;
  current: ShelfStatus;
  trend: 'worse' | 'better' | 'same' | 'new';
}

const RANK: Record<ShelfStatus, number> = { ok: 2, low: 1, out: 0, unknown: -1 };

/** Compare a scan with the previous one by SKU (or by name when the SKU is missing). */
export function compareScans(current: ShelfDetection[], previous: ShelfDetection[] | null): ScanChange[] {
  return current.map((c) => {
    const prev = previous?.find((p) =>
      (c.matched_sku && p.matched_sku === c.matched_sku) || p.name.toLowerCase() === c.name.toLowerCase(),
    );
    if (!prev) return { name: c.name, matched_sku: c.matched_sku, previous: null, current: c.status, trend: 'new' as const };
    let trend: ScanChange['trend'] = 'same';
    if (c.status !== 'unknown' && prev.status !== 'unknown' && RANK[c.status] !== RANK[prev.status]) {
      trend = RANK[c.status] < RANK[prev.status] ? 'worse' : 'better';
    }
    return { name: c.name, matched_sku: c.matched_sku, previous: prev.status, current: c.status, trend };
  });
}
