/**
 * WhatsApp deep links. Everything opens a prefilled chat; the owner taps send. Nothing is sent automatically.
 */
export { createUpiUri, createWhatsAppShareUrl, createWhatsAppUrl } from '../lib/reminders';

export function createDistributorOrderText(
  supplierName: string,
  shopName: string,
  items: Array<{ product_name: string; quantity: number; unit: string }>,
): string {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const itemsText = items.map((item, i) => `${i + 1}. ${item.product_name}: *${item.quantity} ${item.unit}*`).join('\n');
  return `*Stock Order (${dateStr})*
Namaste ${supplierName} ji,
${shopName} ke liye yeh saman bhejiye:

${itemsText}

Shukriya!`;
}
