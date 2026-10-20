import { Language, Transaction } from '../types';

/**
 * Format numbers according to Indian grouping system: ₹1,25,000
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  const isNegative = amount < 0;
  const absVal = Math.round(Math.abs(amount));
  const s = absVal.toString();

  let formatted = '';
  if (s.length <= 3) {
    formatted = s;
  } else {
    const lastThree = s.substring(s.length - 3);
    const otherNumbers = s.substring(0, s.length - 3);
    const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = `${withCommas},${lastThree}`;
  }

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Format relative dates with friendly text: "Aaj", "Kal", "3 din pehle"
 */
export function formatRelativeDate(dateStr: string, language: Language = 'hinglish'): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (language === 'hindi') {
      if (diffDays === 0) return 'आज';
      if (diffDays === 1) return 'कल';
      if (diffDays < 7) return `${diffDays} दिन पहले`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} हफ़्ते पहले`;
      return `${Math.floor(diffDays / 30)} महीने पहले`;
    }

    if (language === 'english') {
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} wks ago`;
      return `${Math.floor(diffDays / 30)} mos ago`;
    }

    // Hinglish (default)
    if (diffDays === 0) return 'Aaj';
    if (diffDays === 1) return 'Kal';
    if (diffDays < 7) return `${diffDays} din pehle`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafte pehle`;
    return `${Math.floor(diffDays / 30)} mahine pehle`;
  } catch {
    return dateStr;
  }
}

/**
 * Format time e.g. "10:30 AM"
 */
export function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/**
 * Categorize balance age for color coding:
 * red = overdue > 30 days
 * amber = 8 to 30 days
 * green = settled or <= 7 days
 */
export function getOverdueSeverity(lastTxDate: string | undefined, balance: number): {
  color: 'green' | 'amber' | 'red';
  days: number;
  label: string;
} {
  if (balance <= 0) {
    return { color: 'green', days: 0, label: 'Settled' };
  }
  if (!lastTxDate) {
    return { color: 'green', days: 0, label: 'Recent' };
  }

  const diffMs = Date.now() - new Date(lastTxDate).getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (days > 30) {
    return { color: 'red', days, label: `Overdue (${days} din)` };
  }
  if (days >= 8) {
    return { color: 'amber', days, label: `Pending (${days} din)` };
  }
  return { color: 'green', days, label: `Recent (${days || 1} din)` };
}

/**
 * Calculate Bharosa Score (0 - 100)
 * Simple heuristic from repayment speed and on-time repayment ratio
 */
export function calculateBharosaScore(transactions: Transaction[]): {
  score: number;
  badge: 'Bharosemand' | 'Theek' | 'Dhyaan do';
  color: string;
  repaymentRatio: number;
} {
  if (!transactions || transactions.length === 0) {
    return { score: 70, badge: 'Theek', color: 'text-amber-700 bg-amber-50 border-amber-200', repaymentRatio: 70 };
  }

  const totalCredit = transactions
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPaid = transactions
    .filter((t) => t.type === 'payment')
    .reduce((sum, t) => sum + t.amount, 0);

  if (totalCredit === 0) {
    return { score: 95, badge: 'Bharosemand', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', repaymentRatio: 100 };
  }

  const rawRatio = Math.min(1.2, totalPaid / totalCredit);
  // Scale from 40 to 98
  let score = Math.round(40 + rawRatio * 50);
  if (transactions.length > 5) score = Math.min(99, score + 5);

  if (score >= 80) {
    return { score, badge: 'Bharosemand', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', repaymentRatio: Math.round(rawRatio * 100) };
  }
  if (score >= 60) {
    return { score, badge: 'Theek', color: 'text-amber-700 bg-amber-50 border-amber-200', repaymentRatio: Math.round(rawRatio * 100) };
  }
  return { score, badge: 'Dhyaan do', color: 'text-rose-700 bg-rose-50 border-rose-200', repaymentRatio: Math.round(rawRatio * 100) };
}
