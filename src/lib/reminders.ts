/**
 * Payment reminder templates.
 * DPDP rule from the spec: a reminder contains ONLY the amount, the shop name and the UPI link.
 * No customer name, phone number, item list or overdue history goes into the message.
 * Templates are deterministic (no AI call) so this rule can be tested and costs nothing per send.
 */
import { formatPaise, paiseToUpiAmount } from './money.js';

export type ReminderLanguage = 'hindi' | 'english' | 'hinglish';
export type ReminderToneKind = 'polite' | 'friendly' | 'firm';

export function createUpiUri(upiId: string, shopName: string, amountPaise: number, note = 'Udhaar payment'): string {
  const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, '@');
  return (
    `upi://pay?pa=${enc(upiId.trim())}&pn=${enc(shopName.trim())}` +
    `&am=${paiseToUpiAmount(amountPaise)}&cu=INR&tn=${enc(note)}`
  );
}

/** A UPI ID looks like name@bank. */
export function isValidUpiId(upiId: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(upiId.trim());
}

const TEMPLATES: Record<ReminderLanguage, Record<ReminderToneKind, (a: string, shop: string, link: string) => string>> = {
  hinglish: {
    polite: (a, shop, link) => `Namaste ji 🙏 ${shop} mein aapka ${a} baaki hai. Suvidha ho to UPI se pay kar dijiye: ${link}\nDhanyavaad!`,
    friendly: (a, shop, link) => `Namaste ji! ${shop} ka ${a} ka hisaab baaki hai. Time mile to UPI se clear kar dena: ${link}\nShukriya 😊`,
    firm: (a, shop, link) => `Namaste ji. ${shop} mein aapka ${a} kaafi samay se baaki hai. Kripya aaj hi UPI se payment karein: ${link}\nDhanyavaad.`,
  },
  hindi: {
    polite: (a, shop, link) => `नमस्ते जी 🙏 ${shop} में आपका ${a} बाकी है। सुविधा हो तो UPI से भुगतान कर दीजिए: ${link}\nधन्यवाद!`,
    friendly: (a, shop, link) => `नमस्ते जी! ${shop} का ${a} का हिसाब बाकी है। समय मिले तो UPI से चुका दीजिए: ${link}\nशुक्रिया 😊`,
    firm: (a, shop, link) => `नमस्ते जी। ${shop} में आपका ${a} काफ़ी समय से बाकी है। कृपया आज ही UPI से भुगतान करें: ${link}\nधन्यवाद।`,
  },
  english: {
    polite: (a, shop, link) => `Hello 🙏 A gentle reminder that ${a} is due at ${shop}. You can pay by UPI here: ${link}\nThank you!`,
    friendly: (a, shop, link) => `Hi! Your balance of ${a} at ${shop} is pending. Pay by UPI whenever convenient: ${link}\nThanks 😊`,
    firm: (a, shop, link) => `Hello. ${a} has been due at ${shop} for some time. Please pay today by UPI: ${link}\nThank you.`,
  },
};

export function buildReminderMessage(params: {
  amountPaise: number;
  shopName: string;
  upiId: string;
  language: ReminderLanguage;
  tone: ReminderToneKind;
}): string {
  const link = createUpiUri(params.upiId, params.shopName, params.amountPaise);
  const amount = formatPaise(params.amountPaise);
  return TEMPLATES[params.language][params.tone](amount, params.shopName.trim(), link);
}

/** wa.me link with prefilled text. Returns null when the phone number is not a valid Indian mobile. */
export function createWhatsAppUrl(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, '');
  let e164: string | null = null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) e164 = `91${digits}`;
  else if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) e164 = digits;
  else if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) e164 = `91${digits.slice(1)}`;
  if (!e164) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

/** wa.me link without a recipient: WhatsApp asks the owner to pick the chat (e.g. sharing to self). */
export function createWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
