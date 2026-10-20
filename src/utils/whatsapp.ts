/**
 * WhatsApp deep-link utilities and UPI URI builders
 */

export function cleanIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits || '919876543210';
}

export function createWhatsAppUrl(phone: string, text: string): string {
  const cleanedPhone = cleanIndianPhone(phone);
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(text)}`;
}

export function createUpiUri(upiId: string, shopName: string, amount: number, note = 'Dukaan_Udhaar'): string {
  const cleanUpi = upiId.trim() || 'shopexample@upi';
  const cleanName = shopName.trim() || 'Kirana Store';
  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

export function createDistributorOrderText(
  supplierName: string,
  shopName: string,
  items: Array<{ product_name: string; quantity: number; unit: string }>
): string {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const itemsText = items
    .map((item, index) => `${index + 1}. ${item.product_name}: *${item.quantity} ${item.unit}*`)
    .join('\n');

  return `*Dukaan Saathi - Stock Order (${dateStr})*
Namaste ${supplierName} bhai,
${shopName} se stock order kripya dispatch karwayein:

${itemsText}

*Delivery location:* ${shopName}
Shukriya!`;
}
