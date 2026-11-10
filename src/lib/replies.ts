/**
 * Bot reply text for a parsed entry, in the shop's language. Deterministic so the "Sahi hai?"
 * question always states exactly what will be saved.
 */
import type { ParsedKhata } from './khataParser';
import { formatPaise } from './money';

export type ReplyLanguage = 'hindi' | 'english' | 'hinglish';

export function confirmationText(p: ParsedKhata, customerName: string | null, lang: ReplyLanguage): string {
  const amount = p.amount_paise !== null ? formatPaise(p.amount_paise) : '?';
  const who = customerName ?? p.customer_name ?? '?';
  if (p.needs_clarification && p.clarification_question) return p.clarification_question;

  switch (p.intent) {
    case 'add_credit':
      return lang === 'hindi'
        ? `${who} के खाते में ${amount} उधार लिखूँ? सही है?`
        : lang === 'english'
          ? `Add ${amount} credit (udhaar) to ${who}? Is this right?`
          : `${who} ke khate mein ${amount} udhaar likhun? Sahi hai?`;
    case 'add_payment':
      return lang === 'hindi'
        ? `${who} से ${amount} जमा लिखूँ? सही है?`
        : lang === 'english'
          ? `Record ${amount} payment received from ${who}? Is this right?`
          : `${who} se ${amount} jama likhun? Sahi hai?`;
    case 'add_sale':
      return lang === 'hindi'
        ? `आज की बिक्री में ${amount} जोड़ूँ? सही है?`
        : lang === 'english'
          ? `Add ${amount} to today's sales? Is this right?`
          : `Aaj ki bikri mein ${amount} jodun? Sahi hai?`;
    case 'add_customer':
      return lang === 'english'
        ? 'Open the Khata tab to add a new customer (their consent is needed to save a phone number).'
        : 'Naya grahak Khata tab se jodiye (phone number save karne ke liye grahak ki sehmati zaroori hai).';
    default:
      return lang === 'english'
        ? 'Sorry, I did not understand. Try: "Sharma ji ko 500 udhaar".'
        : 'Samajh nahi aaya. Aise boliye: "Sharma ji ko 500 udhaar".';
  }
}
