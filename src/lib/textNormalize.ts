/**
 * Text normalisation for Hindi / Hinglish / English shop speech.
 *
 * - Devanagari is transliterated to a rough Latin form so one rule set handles both scripts.
 * - `phoneticKey` folds common Hinglish spelling variants together
 *   ("paanch" / "panch", "sharma" / "sharmaa", "verma" / "werma").
 */

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o',
};

const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'dh', 'फ़': 'f',
};

const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CANDRABINDU = 'ँ';
const VISARGA = 'ः';

function isDevanagari(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x0900 && code <= 0x097f;
}

type Syllable = { cons: string; vowel: string | null; explicitVowel: boolean };

/**
 * Transliterate one Devanagari word to rough Latin with simple schwa deletion:
 * the inherent "a" is dropped at the end of a word ("उधार" -> "udhaar") and in the middle when the
 * next consonant carries a vowel sign ("कितना" -> "kitna", not "kitana").
 * Word-final long vowels are shortened to the usual Hinglish spelling ("बाकी" -> "baaki", "जी" -> "ji").
 */
function transliterateWord(word: string): string {
  const chars = Array.from(word.normalize('NFC'));
  const sylls: Syllable[] = [];
  let tail = '';

  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    if (chars[i + 1] === NUKTA) {
      ch = ch + NUKTA;
      i++;
    }
    const last = sylls[sylls.length - 1];
    if (CONSONANTS[ch] !== undefined) {
      sylls.push({ cons: CONSONANTS[ch], vowel: null, explicitVowel: false });
    } else if (MATRAS[ch] !== undefined && last && last.vowel === null) {
      last.vowel = MATRAS[ch];
      last.explicitVowel = true;
    } else if (ch === VIRAMA && last) {
      last.vowel = '';
      last.explicitVowel = true;
    } else if ((ch === ANUSVARA || ch === CANDRABINDU || ch === VISARGA) && last) {
      if (last.vowel === null) {
        last.vowel = 'a';
        last.explicitVowel = true;
      }
      last.vowel += ch === VISARGA ? 'h' : 'n';
    } else if (INDEPENDENT_VOWELS[ch] !== undefined) {
      sylls.push({ cons: '', vowel: INDEPENDENT_VOWELS[ch], explicitVowel: true });
    } else if (DEVANAGARI_DIGITS[ch] !== undefined) {
      tail += DEVANAGARI_DIGITS[ch];
    } else {
      tail += ch;
    }
  }

  let out = '';
  sylls.forEach((s, idx) => {
    let vowel = s.vowel;
    if (vowel === null) {
      const next = sylls[idx + 1];
      const isLast = idx === sylls.length - 1;
      const medialDeletable = idx > 0 && next && next.cons !== '' && next.explicitVowel && next.vowel !== '' && idx + 1 < sylls.length;
      vowel = isLast || (medialDeletable && sylls.length > 2) ? '' : 'a';
    }
    out += s.cons + vowel;
  });
  out = out.replace(/aa$/, 'a').replace(/ee$/, 'i');
  return out + tail;
}

/** Convert any Devanagari runs in the text to Latin. Latin text passes through unchanged. */
export function transliterate(text: string): string {
  let result = '';
  let buffer = '';
  for (const ch of Array.from(text)) {
    if (isDevanagari(ch) && ch !== '।' && ch !== '॥') {
      buffer += ch;
    } else {
      if (buffer) {
        result += transliterateWord(buffer);
        buffer = '';
      }
      result += ch === '।' || ch === '॥' ? '.' : ch;
    }
  }
  if (buffer) result += transliterateWord(buffer);
  return result;
}

/**
 * Lowercase, transliterate, normalise currency marks and digit separators.
 * Keeps ₹ as its own token so the amount parser can see it.
 */
export function normalizeText(text: string): string {
  return transliterate(text)
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1') // 1,500 -> 1500
    .replace(/\/-/g, ' ') // 500/- -> 500
    .replace(/₹/g, ' ₹ ')
    .replace(/\brs\.?(?=\s*\d)/g, ' ₹ ')
    .replace(/[“”"'`’‘]/g, '')
    .replace(/[?!,;:()[\]{}|]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  return norm ? norm.split(' ') : [];
}

/**
 * Phonetic key that folds common Hinglish spelling variants.
 * "paanch" & "panch" -> "panc"; "sharmaa" & "sharma" -> "sarma"; "verma" & "werma" -> "verma".
 */
export function phoneticKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!w) return '';
  w = w
    .replace(/chh/g, 'c')
    .replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/jh/g, 'j')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/y$/g, 'i');
  // collapse doubled letters ("aa" -> "a", "nn" -> "n")
  w = w.replace(/(.)\1+/g, '$1');
  // drop a trailing 'h' that only lengthens a vowel ("chhah" -> "cah" -> "ca")
  if (w.length > 2) w = w.replace(/([aeiou])h$/, '$1');
  return w;
}
