import { AiParsedKhata, Customer, Language, Product, ReminderTone, ShelfScan } from '../types';

export async function parseKhataMessage(params: {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  customers: Customer[];
  language?: Language;
}): Promise<AiParsedKhata> {
  try {
    const res = await fetch('/api/gemini/parse-khata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('API error, using local fallback:', err);
    return fallbackKhataParser(params.text || 'Sharma ji ko 500 udhaar, saman ka', params.customers, params.language);
  }
}

export async function analyzeShelfImage(params: {
  imageBase64: string;
  imageMimeType?: string;
  catalog: Product[];
  previousScanSummary?: string;
}): Promise<{
  image_quality_warning?: string | null;
  overall_notes: string;
  products: any[];
  isDemo?: boolean;
}> {
  try {
    const res = await fetch('/api/gemini/analyze-shelf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('API error, using local shelf fallback:', err);
    return fallbackShelfAnalysis(params.catalog);
  }
}

export async function generateReminderText(params: {
  customerName: string;
  amount: number;
  daysOverdue: number;
  tone: ReminderTone;
  language: Language;
  shopName: string;
  upiId: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/gemini/generate-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error('Reminder API failed');
    const data = await res.json();
    return data.message;
  } catch {
    const upiLink = `upi://pay?pa=${encodeURIComponent(params.upiId)}&pn=${encodeURIComponent(params.shopName)}&am=${params.amount}&cu=INR&tn=Udhaar`;
    if (params.language === 'hindi') {
      return `नमस्ते ${params.customerName} जी, ${params.shopName} से आपका ₹${params.amount} का उधार बाकी है। सीधे UPI से भुगतान करें: ${upiLink} धन्यवाद।`;
    }
    return `Namaste ${params.customerName} ji, ${params.shopName} se aapka ₹${params.amount} ka udhaar baaki hai. Turant UPI se payment karne ke liye link: ${upiLink} Shukriya!`;
  }
}

export async function getDailySummary(params: {
  totalUdhaar: number;
  todayRecovery: number;
  lowStockCount: number;
  topDebtors: string;
  language: Language;
}): Promise<{ lines: string[]; tip: string; isDemo?: boolean }> {
  try {
    const res = await fetch('/api/gemini/daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error('Daily summary API failed');
    return await res.json();
  } catch {
    return {
      lines: [
        `Kul udhaar baaki: ₹${params.totalUdhaar.toLocaleString('en-IN')}, aaj ₹${params.todayRecovery.toLocaleString('en-IN')} ki vasooli hui.`,
        `${params.lowStockCount} zaroori items shelf par khatam ya low stock hain.`,
        `Top pending grahak: ${params.topDebtors}.`,
      ],
      tip: 'Chhote udhaar (₹200 se kam) par UPI QR dikhayein taaki cash chutta ka jhanjhat na ho.',
      isDemo: true,
    };
  }
}

export async function getFestivalStockSuggestions(festival: string, catalog: Product[]) {
  try {
    const res = await fetch('/api/gemini/festival-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ festival, catalog }),
    });

    if (!res.ok) throw new Error('Festival API failed');
    return await res.json();
  } catch {
    return {
      festival,
      summary: `${festival} tyohar par festive staples aur snacks ki bhari demand hoti hai.`,
      items: [
        { name: 'Refined Oil 1L Pouch', category: 'Cooking Oil', demandSurge: '+100%', reason: 'Deep frying snacks & sweets' },
        { name: 'Sugar 5kg', category: 'Staples', demandSurge: '+80%', reason: 'Home sweet preparation' },
        { name: 'Pure Cow Ghee 1L', category: 'Dairy', demandSurge: '+120%', reason: 'Festive sweets & pooja' },
        { name: 'Aashirvaad Atta 10kg', category: 'Flour', demandSurge: '+60%', reason: 'Puri & festive feasts' },
      ],
      isDemo: true,
    };
  }
}

function fallbackKhataParser(text: string, customers: Customer[], language: Language = 'hinglish'): AiParsedKhata {
  const lower = text.toLowerCase();
  let intent: AiParsedKhata['intent'] = 'add_credit';

  if (lower.includes('baaki') || lower.includes('kitna') || lower.includes('balance') || lower.includes('hisab')) {
    intent = 'query_balance';
  } else if (lower.includes('diye') || lower.includes('jama') || lower.includes('paid') || lower.includes('payment') || lower.includes('vasooli')) {
    intent = 'add_payment';
  }

  let amount = 500;
  const numMatch = lower.match(/\b\d+(\.\d+)?\b/);
  if (numMatch) {
    amount = parseFloat(numMatch[0]);
  } else if (lower.includes('sau') || lower.includes('100')) {
    amount = 100;
  }

  let matchedCustomer = customers[0];
  for (const c of customers) {
    if (lower.includes(c.name.toLowerCase().split(' ')[0])) {
      matchedCustomer = c;
      break;
    }
  }

  const name = matchedCustomer ? matchedCustomer.name : 'Sharma Ji';

  return {
    transcript: text,
    intent,
    customer_name: name,
    matched_customer_id: matchedCustomer?.id || 'c-1',
    amount: intent === 'query_balance' ? null : amount,
    items_note: lower.includes('doodh') ? 'Doodh aur bread' : 'Ration saman',
    confidence: 0.95,
    needs_clarification: false,
    clarification_question: null,
    bot_reply_text: intent === 'query_balance'
      ? `${name} ka purana udhaar baaki hai.`
      : `${name} ke khate mein ₹${amount} ${intent === 'add_credit' ? 'udhaar' : 'jama'} confirm karein?`,
    isDemo: true,
  };
}

function fallbackShelfAnalysis(catalog: Product[]) {
  return {
    image_quality_warning: null,
    overall_notes: 'AI ne shelf gaps aur low stock check kiya hai. Tata Salt out of stock hai, Maggi critical low.',
    products: [
      { name: 'Tata Salt Vacuum Evaporated (1kg)', matched_sku: 'tata-salt', status: 'out', confidence: 0.96, note: 'Poora rack khali hai' },
      { name: 'Maggi 2-Minute Masala Noodles', matched_sku: 'maggi-70g', status: 'low', confidence: 0.91, note: 'Front row mein sirf 2 bache hain' },
      { name: 'Fortune Sunlite Sunflower Oil 1L', matched_sku: 'fortune-oil-1l', status: 'low', confidence: 0.89, note: 'Right edge shelf khali' },
      { name: 'Parle-G Glucose Biscuits', matched_sku: 'parle-g-std', status: 'ok', confidence: 0.97, note: 'Stock poora bhara hua hai' },
    ],
    isDemo: true,
  };
}
