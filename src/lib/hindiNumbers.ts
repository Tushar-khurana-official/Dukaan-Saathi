/**
 * Deterministic amount extraction from Hindi / Hinglish / English shop speech.
 *
 *   "paanch sau"            -> 500
 *   "dedh hazaar"           -> 1500
 *   "saade teen sau"        -> 350
 *   "do hazaar paanch sau"  -> 2500
 *   "₹1,200" / "1.5k"       -> 1200 / 1500
 *   "पाँच सौ" (Devanagari)  -> 500
 *
 * Returns rupees (may be fractional); callers convert to paise.
 */
import { normalizeText, phoneticKey } from './textNormalize.js';

type NumberToken =
  | { kind: 'unit'; value: number; ambiguous: boolean }
  | { kind: 'multiplier'; value: number }
  | { kind: 'fraction'; mode: 'dedh' | 'dhai' | 'saade' | 'sawa' | 'paune' };

const UNIT_WORDS: Array<[number, string[]]> = [
  [1, ['one']],
  [2, ['two']],
  [3, ['teen', 'three']],
  [4, ['chaar', 'char', 'four']],
  [5, ['paanch', 'panch', 'paach', 'five']],
  [6, ['chhe', 'chhah', 'chah', 'chhai', 'six']],
  [7, ['seven']],
  [8, ['aath', 'aat', 'eight']],
  [9, ['nau', 'nine']],
  [10, ['das', 'dus', 'ten']],
  [11, ['gyarah', 'gyara', 'igyarah', 'eleven']],
  [12, ['barah', 'baarah', 'bara', 'twelve']],
  [13, ['terah', 'tera', 'thirteen']],
  [14, ['chaudah', 'chauda', 'fourteen']],
  [15, ['pandrah', 'pandra', 'pandhrah', 'fifteen']],
  [16, ['solah', 'sola', 'sixteen']],
  [17, ['satrah', 'satra', 'seventeen']],
  [18, ['atharah', 'athara', 'eighteen']],
  [19, ['unnees', 'unnis', 'nineteen']],
  [20, ['bees', 'twenty']],
  [21, ['ikkees', 'ikkis']],
  [22, ['baais', 'baees']],
  [24, ['chaubees', 'chaubis']],
  [25, ['pachees', 'pachchees', 'pachis', 'pachchis']],
  [30, ['tees', 'thirty']],
  [35, ['paintees', 'paintis']],
  [40, ['chaalees', 'chalees', 'chalis', 'forty']],
  [45, ['paintaalees', 'paintalis']],
  [50, ['pachaas', 'pachas', 'pachaass', 'fifty']],
  [55, ['pachpan']],
  [60, ['sixty']],
  [70, ['sattar', 'seventy']],
  [75, ['pachhattar', 'pachattar']],
  [80, ['assi', 'assee', 'eighty']],
  [90, ['nabbe', 'nabbey', 'ninety']],
];

/** Words that are numbers only when a multiplier follows ("do sau" = 200, but "de do" = give). */
const AMBIGUOUS_UNITS: Array<[number, string[]]> = [
  [1, ['ek', 'ik', 'ekk']], // "ek baar" (once)
  [2, ['do', 'doo']], // "de do" (give)
  [7, ['saat', 'sat']],
  [60, ['saath', 'sath']], // "ke saath" (with)
  [9, ['no']],
];

const MULTIPLIERS: Array<[number, string[]]> = [
  [100, ['sau', 'so', 'hundred']],
  [1000, ['hazaar', 'hazar', 'hajaar', 'hajar', 'hazzar', 'thousand', 'k']],
  [100000, ['lakh', 'lac', 'laakh', 'lakhs']],
];

const FRACTIONS: Array<[NumberToken & { kind: 'fraction' }, string[]]> = [
  [{ kind: 'fraction', mode: 'dedh' }, ['dedh', 'derh', 'dehd', 'dhedh']],
  [{ kind: 'fraction', mode: 'dhai' }, ['dhai', 'dhaai', 'adhai', 'adhaai', 'dhaee']],
  [{ kind: 'fraction', mode: 'saade' }, ['saade', 'sade', 'saadhe', 'sadhe', 'saare']],
  [{ kind: 'fraction', mode: 'sawa' }, ['sawa', 'sava', 'savaa', 'sawaa']],
  [{ kind: 'fraction', mode: 'paune' }, ['paune', 'pone', 'paone']],
];

const exactLexicon = new Map<string, NumberToken>();
const phoneticLexicon = new Map<string, NumberToken>();

function register(words: string[], token: NumberToken, phonetic = true) {
  for (const w of words) {
    if (!exactLexicon.has(w)) exactLexicon.set(w, token);
    if (phonetic) {
      const key = phoneticKey(w);
      if (key.length >= 3 && !phoneticLexicon.has(key)) phoneticLexicon.set(key, token);
    }
  }
}

for (const [value, words] of UNIT_WORDS) register(words, { kind: 'unit', value, ambiguous: false });
for (const [value, words] of AMBIGUOUS_UNITS) register(words, { kind: 'unit', value, ambiguous: true }, false);
for (const [value, words] of MULTIPLIERS) register(words, { kind: 'multiplier', value }, value !== 100);
for (const [token, words] of FRACTIONS) register(words, token);
// "sau" must not be phonetically matched to short words, but "sao"/"saw" are common ASR slips.
register(['sao', 'saw'], { kind: 'multiplier', value: 100 }, false);

/** Quantity units: a number followed by one of these is a quantity ("2 kilo atta"), not money. */
const QUANTITY_UNITS = new Set([
  'kg', 'kilo', 'kilos', 'kilogram', 'g', 'gm', 'gram', 'grams', 'gms', 'l', 'ltr', 'litre', 'liter', 'litres',
  'liters', 'ml', 'packet', 'packets', 'pkt', 'pkts', 'paket', 'dozen', 'darjan', 'piece', 'pieces', 'pcs', 'pc',
  'bottle', 'bottles', 'botal', 'tray', 'trays', 'box', 'boxes', 'dabba', 'dabbe', 'bag', 'bags', 'bori', 'pouch',
  'pouches', 'thaili', 'tin', 'jar', 'bar', 'bars', 'ande', 'anda', 'egg', 'eggs', 'roti', 'loaf', 'pav',
]);

const CURRENCY_AFTER = new Set([
  'rupaye', 'rupaya', 'rupay', 'rupees', 'rupee', 'rupiya', 'rupiye', 'rupaiye', 'rupaiya', 'rs', 'inr', 'rupe',
  'rupye', 'ruppe', 'ruppee',
]);

function lookup(token: string): NumberToken | null {
  const exact = exactLexicon.get(token);
  if (exact) return exact;
  const key = phoneticKey(token);
  if (key.length >= 3) {
    const ph = phoneticLexicon.get(key);
    if (ph) return ph;
  }
  return null;
}

function parseDigitToken(token: string): number | null {
  const m = token.match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!m) return null;
  if (m[1].replace('.', '').length >= 7) return null; // phone numbers, ids
  const n = parseFloat(m[1]);
  return m[2] ? n * 1000 : n;
}

export interface AmountCandidate {
  value: number; // rupees
  start: number; // token index
  end: number; // exclusive
  currencyMarked: boolean;
  isQuantity: boolean;
  text: string;
}

function applyFraction(mode: NonNullable<FractionState>, current: number): number {
  switch (mode) {
    case 'dedh':
      return 1.5;
    case 'dhai':
      return 2.5;
    case 'saade':
      return (current || 0) + 0.5;
    case 'sawa':
      return (current || 1) + 0.25;
    case 'paune':
      return (current || 1) - 0.25;
  }
}

type FractionState = 'dedh' | 'dhai' | 'saade' | 'sawa' | 'paune' | null;

/** Find every number phrase in the text, in order. */
export function findAmountCandidates(text: string): AmountCandidate[] {
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  const out: AmountCandidate[] = [];

  let i = 0;
  while (i < tokens.length) {
    const start = i;
    let total = 0;
    let current = 0;
    let fraction: FractionState = null;
    let consumed = 0;
    let lastKind: 'unit' | 'multiplier' | 'fraction' | null = null;

    while (i < tokens.length) {
      const tok = tokens[i];
      const digit = parseDigitToken(tok);
      const word = digit === null ? lookup(tok) : null;
      const next = tokens[i + 1];
      const nextTok = next !== undefined ? (parseDigitToken(next) === null ? lookup(next) : null) : null;

      if (digit !== null) {
        if (lastKind === 'unit') break; // "500 20" -> two separate numbers
        if (/k$/.test(tok)) {
          total += digit;
          current = 0;
          lastKind = 'multiplier';
        } else {
          current += digit;
          lastKind = 'unit';
        }
      } else if (word && word.kind === 'unit') {
        const nextIsCurrency = next !== undefined && CURRENCY_AFTER.has(next);
        if (word.ambiguous && !nextIsCurrency && !(nextTok && nextTok.kind === 'multiplier')) break;
        if (lastKind === 'unit') break;
        current += word.value;
        lastKind = 'unit';
      } else if (word && word.kind === 'fraction') {
        if (lastKind === 'unit' || lastKind === 'fraction') break;
        // a fraction must be followed by a unit or multiplier to mean anything
        if (!nextTok || nextTok.kind === 'fraction') {
          if (!(next && parseDigitToken(next) !== null)) break;
        }
        fraction = word.mode;
        lastKind = 'fraction';
      } else if (word && word.kind === 'multiplier') {
        if (lastKind === null && word.value === 1000 && tok === 'k') break;
        if (lastKind === null && word.value === 100 && (tok === 'so' || tok === 'saw' || tok === 'sao')) break;
        let base = current;
        if (fraction) {
          base = applyFraction(fraction, current);
          fraction = null;
        } else if (!base) {
          base = 1;
        }
        if (word.value === 100) {
          current = base * 100;
        } else {
          total += base * word.value;
          current = 0;
        }
        lastKind = 'multiplier';
      } else {
        break;
      }
      consumed++;
      i++;
    }

    if (consumed === 0) {
      i++;
      continue;
    }

    const value = total + current;
    if (value > 0) {
      const before = tokens[start - 1];
      const after = tokens[i];
      out.push({
        value: Math.round(value * 100) / 100,
        start,
        end: i,
        currencyMarked: before === '₹' || (after !== undefined && CURRENCY_AFTER.has(after)),
        isQuantity: after !== undefined && QUANTITY_UNITS.has(after),
        text: tokens.slice(start, i).join(' '),
      });
    }
  }
  return out;
}

/**
 * Pick the money amount from an utterance.
 * Quantities ("2 kilo") are skipped. A currency-marked number ("₹500", "500 rupaye") wins;
 * otherwise the largest number, since incidental numbers ("gali 3") are usually small.
 */
export function extractAmount(text: string): AmountCandidate | null {
  const candidates = findAmountCandidates(text).filter((c) => !c.isQuantity);
  if (candidates.length === 0) return null;
  const marked = candidates.filter((c) => c.currencyMarked);
  const pool = marked.length > 0 ? marked : candidates;
  return pool.reduce((best, c) => (c.value > best.value ? c : best));
}

/** Convenience: rupee value or null. */
export function parseHindiAmount(text: string): number | null {
  return extractAmount(text)?.value ?? null;
}
