/**
 * Match free text ("namak", "Tata Salt 1kg", "maggi 4 pack") to catalog products using names and Hinglish aliases.
 */
import { jaroWinkler } from './customerMatch.js';
import { normalizeText, phoneticKey } from './textNormalize.js';

export interface MatchableProduct {
  id: string;
  name: string;
  aliases: string[];
}

const IGNORE = new Set(['pack', 'packet', 'pkt', 'kg', 'g', 'gm', 'ml', 'l', 'ltr', 'of', 'the', 'and', 'aur', 'ka', 'ki', 'ke']);

function keys(text: string): string[] {
  return normalizeText(text)
    .replace(/\d+\s*(kg|g|gm|ml|l|ltr)\b/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !IGNORE.has(w) && !/^\d/.test(w))
    .map(phoneticKey);
}

function phraseHit(text: string, phrase: string): boolean {
  const t = ` ${normalizeText(text)} `;
  return t.includes(` ${normalizeText(phrase)} `);
}

/** Best product for the text, or null. Alias phrases ("chai patti") count as exact hits. */
export function matchProduct<P extends MatchableProduct>(text: string, catalog: P[]): P | null {
  let best: { p: P; score: number } | null = null;
  const textKeys = keys(text);
  for (const p of catalog) {
    let score = 0;
    if (p.aliases.some((a) => phraseHit(text, a))) score = 1;
    else {
      const nameKeys = keys(p.name).slice(0, 2); // brand + first word carry the identity
      for (const nk of nameKeys) for (const tk of textKeys) score = Math.max(score, jaroWinkler(nk, tk));
    }
    if (score >= 0.92 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

/** Products mentioned most often in transaction notes (udhaar and sales), as a proxy for top sellers. */
export function topProductsFromNotes<P extends MatchableProduct>(notes: string[], catalog: P[], limit = 5) {
  const counts = new Map<string, number>();
  for (const note of notes) {
    // a note can mention several items: "Atta 10kg, Mustard Oil 2L"
    const seen = new Set<string>();
    for (const part of note.split(/,|&|\band\b|\baur\b/)) {
      const p = matchProduct(part, catalog);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([id, mentions]) => ({ product: catalog.find((p) => p.id === id)!, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit);
}

const GENERIC_NOTES = new Set(['udhaar saman', 'payment jama', 'counter bikri', 'din ki counter bikri', 'ration saman', 'saman', 'cash', 'upi']);

/** When notes do not match the catalog, show the most common item words people actually wrote. */
export function topNoteItems(notes: string[], limit = 5) {
  const counts = new Map<string, { label: string; mentions: number }>();
  for (const note of notes) {
    for (const raw of note.split(/,|&|\band\b|\baur\b/i)) {
      const label = raw.replace(/\d+(\.\d+)?\s*(kg|g|gm|ml|l|ltr|kilo|packet|pkt|pack|tray|bag|pcs)?\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const key = label.toLowerCase();
      if (key.length < 3 || GENERIC_NOTES.has(key) || /^(lene|dena|baaki|hai|ka|ki)( |$)/.test(key)) continue;
      const e = counts.get(key) ?? { label: label.charAt(0).toUpperCase() + label.slice(1), mentions: 0 };
      e.mentions++;
      counts.set(key, e);
    }
  }
  return [...counts.values()].sort((a, b) => b.mentions - a.mentions).slice(0, limit);
}
