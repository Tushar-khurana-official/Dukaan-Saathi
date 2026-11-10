/**
 * Fuzzy matching of a spoken customer name to the shop's customer list.
 *
 *   "Sharma ji"       -> "Sharma Ji (Gali 3)"
 *   "sunita varma"    -> "Sunita Verma"
 *   "शर्मा जी"         -> "Sharma Ji (Gali 3)"
 *   "tailor wale"     -> "Manoj Tailor"
 *
 * Uses Jaro-Winkler similarity on phonetic keys, weighted by how identifying each name token is.
 * When two customers score almost the same the result is marked ambiguous so the owner is asked.
 */
import { normalizeText, phoneticKey } from './textNormalize';

export interface MatchableCustomer {
  id: string;
  name: string;
}

export interface CustomerMatch<C extends MatchableCustomer = MatchableCustomer> {
  customer: C;
  score: number; // 0..1
}

export interface MatchResult<C extends MatchableCustomer = MatchableCustomer> {
  best: CustomerMatch<C> | null; // only set when confident and unambiguous
  candidates: CustomerMatch<C>[]; // ranked, score >= SUGGEST_THRESHOLD
  ambiguous: boolean;
}

/** Generic honorifics carry no identity ("Sharma ji" vs "Verma ji"). */
const GENERIC_HONORIFICS = new Set([
  'ji', 'jee', 'sahab', 'saab', 'sahib', 'sir', 'madam', 'mr', 'mrs', 'ms', 'shri', 'shree', 'smt',
  'wale', 'wala', 'wali', 'vale', 'vala', 'vali', 'waale', 'waala',
]);

/** Relationship honorifics can identify someone in a small shop ("Kavita Chachi" -> "chachi"). */
const RELATION_HONORIFICS = new Set([
  'bhai', 'bhaiya', 'bhaiyya', 'bhaiyaa', 'didi', 'chachi', 'chacha', 'bhabhi', 'aunty', 'auntie', 'uncle',
  'mausi', 'mausa', 'dadi', 'dada', 'nani', 'nana', 'kaka', 'kaki', 'tau', 'tai', 'amma', 'baba', 'beta',
]);

/** Spoken forms folded to one word before matching ("dr" / "daktar" -> "doctor"). */
const SYNONYMS: Record<string, string> = {
  dr: 'doctor', daktar: 'doctor', doctar: 'doctor', dactor: 'doctor',
  masterji: 'master', teacher: 'master',
};

function canon(word: string): string {
  return SYNONYMS[word] ?? word;
}

/** Words in an utterance that are never part of a name. */
const UTTERANCE_STOPWORDS = new Set([
  'ko', 'ne', 'ka', 'ki', 'ke', 'se', 'me', 'mein', 'main', 'par', 'pe', 'aur', 'and', 'the', 'to', 'is', 'hai',
  'ho', 'tha', 'thi', 'the', 'gaya', 'gaye', 'gayi', 'diye', 'diya', 'die', 'dia', 'de', 'do', 'dena', 'dijiye',
  'udhaar', 'udhar', 'udhari', 'udhaari', 'credit', 'jama', 'payment', 'paid', 'pay', 'kiya', 'kiye', 'baaki',
  'baki', 'bakaya', 'kitna', 'kitne', 'balance', 'hisaab', 'hisab', 'khata', 'khate', 'likho', 'likh', 'likhna',
  'saman', 'samaan', 'rupaye', 'rupees', 'rupay', 'rs', 'liya', 'liye', 'le', 'lo', 'wapas', 'vapas', 'vasooli',
  'mila', 'mile', 'aaj', 'kal', 'abhi', 'bhi', 'sirf', 'total', 'naya', 'nayi', 'customer', 'grahak', 'phone',
  'number', 'umm', 'um', 'haan', 'ha', 'accha', 'acha', 'achha', 'arre', 'are', 'matlab', 'woh', 'vo', 'yeh',
  'ye', 'please', 'plz', 'bhaisahab', 'sahi', 'ok', 'okay', 'hmm', 'uh', 'na', 'nahi', 'chukaya', 'chuka',
  'lautaye', 'bikri', 'sale', 'becha', 'cash', 'nakad', 'kar', 'karo', 'karna', 'wala', 'wale', 'ji', 'jee',
  'sau', 'hazaar', 'hazar', 'lakh', 'dedh', 'dhai', 'saade', 'sawa', 'paune', 'paanch', 'teen', 'chaar', 'ek',
  'das', 'bees', 'pachaas', '₹',
]);

const AUTO_MATCH_THRESHOLD = 0.9;
const SUGGEST_THRESHOLD = 0.72;
const AMBIGUITY_MARGIN = 0.04;

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length ? 1 : 0;
  if (!a.length || !b.length) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

interface NameToken {
  key: string;
  weight: number;
}

/** Break a stored customer name into weighted phonetic tokens. */
function customerTokens(name: string): NameToken[] {
  const out: NameToken[] = [];
  // Text in brackets ("Sharma Ji (Gali 3)") is a location hint, not the name itself.
  const inBrackets = new Set<string>();
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    for (const w of normalizeText(m[1]).split(' ')) inBrackets.add(w);
  }
  for (const word of normalizeText(name).split(' ')) {
    const raw = canon(word);
    if (!raw || /^\d+$/.test(raw) || GENERIC_HONORIFICS.has(raw)) continue;
    const key = phoneticKey(raw);
    if (key.length < 2) continue;
    let weight = 1;
    if (RELATION_HONORIFICS.has(raw) || raw === 'doctor') weight = 0.92;
    if (inBrackets.has(raw)) weight = 0.6;
    out.push({ key, weight });
  }
  return out;
}

/** Tokens from the utterance (or spoken name phrase) that could be part of a name. */
export function nameCandidateTokens(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w && !UTTERANCE_STOPWORDS.has(w) && !GENERIC_HONORIFICS.has(w) && !/\d/.test(w))
    .map((w) => phoneticKey(canon(w)))
    .filter((k) => k.length >= 3 || k.length === 2);
}

function scoreCustomer(spokenKeys: string[], tokens: NameToken[]): number {
  if (tokens.length === 0 || spokenKeys.length === 0) return 0;
  const values = tokens
    .map((t) => {
      let best = 0;
      for (const s of spokenKeys) {
        // very short keys must match exactly
        const sim = s.length < 3 || t.key.length < 3 ? (s === t.key ? 1 : 0) : jaroWinkler(s, t.key);
        if (sim > best) best = sim;
      }
      return best * t.weight;
    })
    .sort((x, y) => y - x);
  // The best single token decides; each extra strongly matching token ("sunita verma") adds a little.
  const extra = values.slice(1).filter((v) => v >= 0.85).length * 0.03;
  return Math.min(1, values[0] + extra);
}

export function matchCustomer<C extends MatchableCustomer>(spoken: string, customers: C[]): MatchResult<C> {
  const spokenKeys = nameCandidateTokens(spoken);
  const scored = customers
    .map((customer) => ({ customer, score: scoreCustomer(spokenKeys, customerTokens(customer.name)) }))
    .filter((m) => m.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  const ambiguous = Boolean(
    top && second && top.score >= AUTO_MATCH_THRESHOLD && top.score - second.score < AMBIGUITY_MARGIN,
  );
  const best = top && top.score >= AUTO_MATCH_THRESHOLD && !ambiguous ? top : null;

  return {
    best,
    candidates: scored.slice(0, 5).map((m) => ({ ...m, score: Math.round(m.score * 100) / 100 })),
    ambiguous,
  };
}
