/**
 * Money helpers. Every stored amount is an integer number of paise (1 rupee = 100 paise).
 * Rupees only appear at the edges: user input, display text, UPI links.
 */

export type Paise = number;

/** Convert a rupee value (possibly fractional, e.g. 1.5 for "dedh") to whole paise. */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Convert paise to a rupee number. Only use for display / external links. */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Parse a rupee string typed by a user ("500", "1,250.50", "₹ 99") to paise. Returns null if invalid. */
export function parseRupeeInput(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return rupeesToPaise(parseFloat(cleaned));
}

/** Amount string for a UPI link `am=` parameter: "500" or "500.50". */
export function paiseToUpiAmount(paise: Paise): string {
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? `${rupees}` : `${rupees}.${rest.toString().padStart(2, '0')}`;
}

/** Indian grouping: ₹1,25,000 or ₹1,250.50 (paise shown only when non-zero). */
export function formatPaise(paise: Paise | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return '₹0';
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100).toString();
  const rest = abs % 100;

  let grouped = rupees;
  if (rupees.length > 3) {
    const lastThree = rupees.slice(-3);
    const others = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${others},${lastThree}`;
  }
  const decimals = rest === 0 ? '' : `.${rest.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${grouped}${decimals}`;
}
