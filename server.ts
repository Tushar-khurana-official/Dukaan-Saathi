import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI server-side with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

/**
 * 1. Parse Voice or Text Khata message
 * Handles Hindi number words ("paanch sau", "dedh sau", "dhai sau"), intent detection,
 * customer fuzzy matching, amount and item notes extraction.
 */
app.post('/api/gemini/parse-khata', async (req: Request, res: Response) => {
  try {
    const { text, audioBase64, audioMimeType, customers, language = 'hinglish' } = req.body;

    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'Text or audioBase64 required' });
    }

    // Fallback parser if no AI key configured or demo mode requested
    if (!ai) {
      return res.json(simulateKhataParsing(text, customers, language));
    }

    const customersContext = Array.isArray(customers)
      ? customers.map((c: any) => `ID: ${c.id}, Name: "${c.name}", Phone: "${c.phone}"`).join('\n')
      : 'None provided';

    const systemInstruction = `You are Dukaan Saathi, an intelligent Kirana shop ledger assistant in India.
Your job is to parse shopkeeper voice notes or text entries regarding customer udhaar (credit) and payments.
Indian colloquial context:
- "Sharma ji ko 500 udhaar, saman ka" -> intent: add_credit, customer: "Sharma ji", amount: 500, note: "saman ka"
- "Gupta ji ne 300 diye" -> intent: add_payment, customer: "Gupta ji", amount: 300, note: "payment"
- "Verma ji ka kitna baaki hai?" -> intent: query_balance, customer: "Verma ji"
- "Kis kis ka udhaar baaki hai?" -> intent: list_overdue
- "Naya customer Ramesh phone 9876543210" -> intent: add_customer
- Number words in Hindi: "sau" = 100, "paanch sau" = 500, "hazaar" = 1000, "dedh sau" = 150, "dhai sau" = 250, "dedh hazaar" = 1500, "dhai hazaar" = 2500, "ek sau pachaas" = 150.
Fuzzy match against the existing customer list. If match is strong, set matched_customer_id.
If customer name matches multiple people or is completely missing/ambiguous, set needs_clarification=true and ask a helpful question in clarification_question.
Always provide bot_reply_text in the requested language (${language}: 'hindi' (Devanagari), 'english', or 'hinglish' (conversational Latin script)).`;

    const contents: any[] = [];
    if (audioBase64) {
      contents.push({
        inlineData: {
          mimeType: audioMimeType || 'audio/webm',
          data: audioBase64,
        },
      });
      contents.push({
        text: `Transcribe this Indian kirana shopkeeper audio accurately, then extract ledger information. Existing customers:\n${customersContext}`,
      });
    } else {
      contents.push({
        text: `Parse this shopkeeper message: "${text}". Existing customers:\n${customersContext}`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING, description: 'Transcribed text or verbatim input' },
            intent: {
              type: Type.STRING,
              enum: ['add_credit', 'add_payment', 'query_balance', 'list_overdue', 'add_customer', 'summary', 'unknown'],
            },
            customer_name: { type: Type.STRING },
            matched_customer_id: { type: Type.STRING, nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            items_note: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER, description: 'Between 0.0 and 1.0' },
            needs_clarification: { type: Type.BOOLEAN },
            clarification_question: { type: Type.STRING, nullable: true },
            bot_reply_text: { type: Type.STRING },
          },
          required: ['transcript', 'intent', 'confidence', 'needs_clarification', 'bot_reply_text'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      ...parsed,
      isDemo: false,
    });
  } catch (err: any) {
    console.error('Gemini parse-khata error:', err);
    // Graceful fallback to demo logic so app never breaks
    const { text, customers, language = 'hinglish' } = req.body;
    return res.json(simulateKhataParsing(text || 'Audio message', customers, language));
  }
});

/**
 * 2. Analyze Shelf photo
 * Detects shelf gaps and low stock (NOT exact unit counts).
 */
app.post('/api/gemini/analyze-shelf', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageMimeType = 'image/jpeg', catalog, previousScanSummary } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!ai) {
      return res.json(simulateShelfAnalysis(catalog));
    }

    const catalogList = Array.isArray(catalog)
      ? catalog.map((p: any) => `${p.name} (Cat: ${p.category || 'General'}, Min: ${p.min_level || 5})`).join(', ')
      : 'Popular Indian Kirana items (Maggi, Parle-G, Tata Salt, Fortune Oil, Red Label Tea, Surf Excel, Colgate, Amul Butter, etc.)';

    const systemInstruction = `You are Dukaan Saathi's visual AI for Indian kirana grocery shelves.
CRITICAL HONESTY RULE:
You detect SHELF GAPS, EMPTY SPACES, and LOW STOCK relative to shelf occupancy, NOT exact unit counts.
Never claim exact counts.
Inspect the grocery shelf photo carefully.
Catalog SKUs to check against: ${catalogList}.
Previous scan context: ${previousScanSummary || 'None available'}.
For detected items/gaps:
- status: 'out' (empty gap/tag visible but no product), 'low' (only 1-2 items left or front edge sparse), 'ok' (full facing), or 'unknown' (blurry/unclear).
- confidence: between 0.5 and 1.0.
- note: short description (e.g. "Only 1 packet visible, large empty gap on right").
- box_2d: optional normalized bounding box [ymin, xmin, ymax, xmax] between 0 and 1000.
Flag image_quality_warning if photo is too dark, blurry, or badly angled.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64,
            },
          },
          {
            text: 'Analyze this kirana shelf for stock gaps, low inventory, and shelf occupancy. Compare with catalog.',
          },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            image_quality_warning: { type: Type.STRING, nullable: true },
            overall_notes: { type: Type.STRING },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  matched_sku: { type: Type.STRING, nullable: true },
                  status: { type: Type.STRING, enum: ['ok', 'low', 'out', 'unknown'] },
                  confidence: { type: Type.NUMBER },
                  note: { type: Type.STRING },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: '[ymin, xmin, ymax, xmax] 0-1000',
                  },
                },
                required: ['name', 'status', 'confidence', 'note'],
              },
            },
          },
          required: ['overall_notes', 'products'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return res.json({
      ...result,
      isDemo: false,
    });
  } catch (err: any) {
    console.error('Gemini analyze-shelf error:', err);
    return res.json(simulateShelfAnalysis(req.body.catalog));
  }
});

/**
 * 3. Generate Payment Reminder Message
 */
app.post('/api/gemini/generate-reminder', async (req: Request, res: Response) => {
  try {
    const { customerName, amount, daysOverdue, tone = 'polite', language = 'hinglish', shopName, upiId } = req.body;

    if (!ai) {
      return res.json({
        message: generateDefaultReminder(customerName, amount, tone, language, shopName, upiId),
        isDemo: true,
      });
    }

    const prompt = `Write a short WhatsApp payment reminder message for an Indian kirana shop.
Customer: "${customerName}"
Amount Due: ₹${amount}
Days Overdue: ${daysOverdue} days
Tone: "${tone}" (polite = warm and gentle, friendly = casual neighbourly, firm = direct reminder about pending ledger closure)
Language: "${language}" ('hinglish', 'hindi' in Devanagari, or 'english')
Shop Name: "${shopName || 'Hamari Dukaan'}"
UPI ID: "${upiId || 'shop@upi'}"
Include a clear call to action and mention the UPI payment option. Keep it concise, respectful, and suitable for WhatsApp.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return res.json({
      message: response.text?.trim() || generateDefaultReminder(customerName, amount, tone, language, shopName, upiId),
      isDemo: false,
    });
  } catch (err) {
    console.error('Gemini reminder error:', err);
    const { customerName, amount, tone, language, shopName, upiId } = req.body;
    return res.json({
      message: generateDefaultReminder(customerName, amount, tone, language, shopName, upiId),
      isDemo: true,
    });
  }
});

/**
 * 4. Generate Daily Summary
 */
app.post('/api/gemini/daily-summary', async (req: Request, res: Response) => {
  try {
    const { totalUdhaar, todayRecovery, lowStockCount, topDebtors, language = 'hinglish' } = req.body;

    if (!ai) {
      return res.json({
        lines: [
          `Kul udhaar baaki: ₹${totalUdhaar?.toLocaleString('en-IN') || 0}, aaj ₹${todayRecovery?.toLocaleString('en-IN') || 0} ki vasooli hui.`,
          `${lowStockCount || 3} zaroori items shelf par khatam ya low stock hain.`,
          `Top overdue grahak: ${topDebtors || 'Sharma ji, Verma ji'}.`,
        ],
        tip: 'Aaj shaam 6 se 8 baje ke beech reminder bhejne se 40% zyada log UPI se turant payment karte hain.',
        isDemo: true,
      });
    }

    const prompt = `Generate an AI kirana shop daily briefing.
Data:
- Total pending credit (Udhaar): ₹${totalUdhaar}
- Today's recovery: ₹${todayRecovery}
- Low stock items: ${lowStockCount}
- Top debtors: ${topDebtors}
Language: ${language}
Return JSON with exactly two fields:
1. "lines": array of exactly 3 short punchy bullet points
2. "tip": one actionable practical tip for today (e.g. reminder timing, stocking tip, festival advice)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lines: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tip: { type: Type.STRING },
          },
          required: ['lines', 'tip'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...parsed, isDemo: false });
  } catch (err) {
    console.error('Gemini daily-summary error:', err);
    return res.json({
      lines: [
        'Aaj kul udhaar baaki par nazar rakhein.',
        'Low stock items ki list distributor ko bhejein.',
        'Overdue grahakon ko shaam ko polite reminder bhejein.',
      ],
      tip: 'Chhote udhaar (₹200 se kam) par UPI QR dikhayein taaki cash chutta ka jhanjhat na ho.',
      isDemo: true,
    });
  }
});

/**
 * 5. Suggest Festival Stock
 */
app.post('/api/gemini/festival-stock', async (req: Request, res: Response) => {
  try {
    const { festival = 'Diwali', catalog } = req.body;

    if (!ai) {
      return res.json(simulateFestivalStock(festival));
    }

    const prompt = `You are Dukaan Saathi's inventory planner.
Suggest 8 essential kirana grocery items to stock up on for the upcoming Indian festival: "${festival}".
Explain why each item is critical and give an estimated demand surge percentage (e.g., "+70%").`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            festival: { type: Type.STRING },
            summary: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  demandSurge: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  recommendedQty: { type: Type.STRING },
                },
                required: ['name', 'category', 'demandSurge', 'reason'],
              },
            },
          },
          required: ['festival', 'summary', 'items'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...parsed, isDemo: false });
  } catch (err) {
    console.error('Gemini festival-stock error:', err);
    return res.json(simulateFestivalStock(req.body.festival || 'Diwali'));
  }
});

// Helper simulation functions for Demo Mode
function simulateKhataParsing(text: string = '', customers: any[] = [], language: string = 'hinglish') {
  const lower = text.toLowerCase();
  let intent: 'add_credit' | 'add_payment' | 'query_balance' | 'list_overdue' | 'add_customer' | 'summary' | 'unknown' = 'add_credit';

  if (lower.includes('baaki') || lower.includes('kitna') || lower.includes('balance') || lower.includes('hisab')) {
    intent = 'query_balance';
  } else if (lower.includes('diye') || lower.includes('jama') || lower.includes('payment') || lower.includes('vasooli') || lower.includes('paid')) {
    intent = 'add_payment';
  } else if (lower.includes('overdue') || lower.includes('sabka') || lower.includes('list')) {
    intent = 'list_overdue';
  } else if (lower.includes('naya') || lower.includes('customer') || lower.includes('add')) {
    intent = 'add_customer';
  } else if (lower.includes('summary') || lower.includes('aaj ka')) {
    intent = 'summary';
  }

  // Extract amount with regex or Hindi number words
  let amount = 0;
  const numMatch = lower.match(/\b\d+(\.\d+)?\b/);
  if (numMatch) {
    amount = parseFloat(numMatch[0]);
  } else if (lower.includes('paanch sau') || lower.includes('500')) {
    amount = 500;
  } else if (lower.includes('dedh sau') || lower.includes('150')) {
    amount = 150;
  } else if (lower.includes('dhai sau') || lower.includes('250')) {
    amount = 250;
  } else if (lower.includes('hazaar') || lower.includes('1000')) {
    amount = 1000;
  } else if (lower.includes('do hazaar') || lower.includes('2000')) {
    amount = 2000;
  } else if (lower.includes('sau') || lower.includes('100')) {
    amount = 100;
  }

  // Match customer
  let matchedCustomer = null;
  let detectedName = 'Sharma Ji';

  if (Array.isArray(customers) && customers.length > 0) {
    for (const c of customers) {
      const nameParts = c.name.toLowerCase().split(' ');
      if (nameParts.some((part: string) => part.length > 2 && lower.includes(part))) {
        matchedCustomer = c;
        detectedName = c.name;
        break;
      }
    }
    if (!matchedCustomer && customers.length > 0) {
      // Default to first customer if sample phrase matches "sharma"
      if (lower.includes('sharma')) {
        matchedCustomer = customers.find((c) => c.name.toLowerCase().includes('sharma')) || customers[0];
        detectedName = matchedCustomer?.name || 'Sharma Ji';
      } else if (lower.includes('gupta')) {
        matchedCustomer = customers.find((c) => c.name.toLowerCase().includes('gupta')) || customers[1];
        detectedName = matchedCustomer?.name || 'Gupta Ji';
      }
    }
  }

  let botReply = '';
  if (intent === 'add_credit') {
    botReply = language === 'hindi'
      ? `${detectedName} के खाते में ₹${amount || 500} का उधार जोड़ें? कृपया नीचे पुष्टि करें।`
      : `${detectedName} ke khate mein ₹${amount || 500} ka udhaar jod dein? Kripya neeche confirm karein.`;
  } else if (intent === 'add_payment') {
    botReply = language === 'hindi'
      ? `${detectedName} से ₹${amount || 300} का भुगतान प्राप्त हुआ दर्ज करें?`
      : `${detectedName} se ₹${amount || 300} jama payment record karein?`;
  } else if (intent === 'query_balance') {
    botReply = `${detectedName} ka pichla baaki ₹${matchedCustomer ? 1200 : 1200} hai.`;
  } else {
    botReply = `Maine suna: "${text || 'Sharma ji ko 500 udhaar'}". Entry verify karein.`;
  }

  return {
    transcript: text || 'Sharma ji ko 500 udhaar, saman ka',
    intent,
    customer_name: detectedName,
    matched_customer_id: matchedCustomer?.id || 'cust-1',
    amount: amount || (intent === 'query_balance' ? null : 500),
    items_note: lower.includes('doodh') ? 'Doodh & dahi' : lower.includes('atta') ? 'Atta & tel' : 'Ration saman',
    confidence: 0.94,
    needs_clarification: false,
    clarification_question: null,
    bot_reply_text: botReply,
    isDemo: true,
  };
}

function simulateShelfAnalysis(catalog: any[] = []) {
  return {
    image_quality_warning: null,
    overall_notes: 'Scanner ne shelf par 2 bade khali gaps aur 3 low stock items detect kiye hain. (Note: Gaps aur stock level estimate kiya gaya hai, exact unit count nahi).',
    products: [
      {
        name: 'Maggi 2-Minute Noodles',
        matched_sku: 'maggi-70g',
        status: 'low',
        confidence: 0.92,
        note: 'Front facing par sirf 2 packet bache hain, piche khali space hai.',
        box_2d: [120, 150, 420, 380],
      },
      {
        name: 'Tata Salt 1kg',
        matched_sku: 'tata-salt',
        status: 'out',
        confidence: 0.95,
        note: 'Salt shelf poori tarah se khali hai. Gap clearly visible.',
        box_2d: [140, 410, 430, 680],
      },
      {
        name: 'Fortune Sunlite Sunflower Oil 1L',
        matched_sku: 'fortune-oil-1l',
        status: 'low',
        confidence: 0.88,
        note: 'Pehle OK tha, ab sirf 1 pouch bacha hai.',
        box_2d: [480, 160, 820, 420],
      },
      {
        name: 'Parle-G Gold Biscuits',
        matched_sku: 'parle-g-std',
        status: 'ok',
        confidence: 0.96,
        note: 'Shelf stack full aur well-stocked hai.',
        box_2d: [490, 450, 830, 880],
      },
      {
        name: 'Surf Excel Quick Wash 1kg',
        matched_sku: 'surf-excel-1kg',
        status: 'low',
        confidence: 0.84,
        note: 'Detergent section mein stock khatam hone ki sthiti.',
        box_2d: [130, 710, 440, 920],
      },
    ],
    isDemo: true,
  };
}

function generateDefaultReminder(customerName: string, amount: number, tone: string, language: string, shopName = 'Hamari Dukaan', upiId = 'shop@upi') {
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=Udhaar_Payment`;
  if (language === 'hindi') {
    if (tone === 'firm') {
      return `नमस्ते ${customerName} जी, ${shopName} से आपका पुराना उधार ₹${amount} बाकी है। महीने के खाते का निपटारा करने के लिए कृपया आज ही भुगतान करें: ${upiLink} धन्यवाद।`;
    } else if (tone === 'friendly') {
      return `नमस्ते ${customerName} जी! आशा है सब कुशल मंगल है। आपकी दुकान ${shopName} का कुल हिसाब ₹${amount} बकाया है। जब भी समय मिले, UPI से पे कर दें: ${upiLink} शुभ दिन!`;
    }
    return `नमस्ते ${customerName} जी, ${shopName} से आपका ₹${amount} का हिसाब बाकी है। सुविधा के लिए सीधे UPI से पेमेंट करें: ${upiLink} आपका बहुत धन्यवाद।`;
  }

  if (language === 'english') {
    if (tone === 'firm') {
      return `Dear ${customerName}, your pending balance at ${shopName} is ₹${amount}. Please clear this today to keep your credit line active: ${upiLink} - Thank you.`;
    }
    return `Hello ${customerName}, a gentle reminder from ${shopName}. Your outstanding balance is ₹${amount}. You can pay directly via UPI: ${upiLink} - Have a great day!`;
  }

  // Hinglish (default)
  if (tone === 'firm') {
    return `Namaste ${customerName} ji, ${shopName} se aapka ₹${amount} ka purana udhaar baaki hai. Ledger close karne ke liye kripya aaj hi settle karein. UPI link: ${upiLink} Dhanyawad!`;
  } else if (tone === 'friendly') {
    return `Namaste ${customerName} ji! Asha hai sab theek hai. ${shopName} ka ₹${amount} ka hisab baaki chal raha tha. Time mile toh UPI se clear kar dena: ${upiLink} Have a good day!`;
  }
  return `Namaste ${customerName} ji, ${shopName} se aapka ₹${amount} ka udhaar bacha hai. Turant pay karne ke liye UPI link: ${upiLink} Shukriya!`;
}

function simulateFestivalStock(festival: string) {
  const itemsMap: Record<string, any[]> = {
    Diwali: [
      { name: 'Fortune Soya / Mustard Oil', category: 'Cooking Oil', demandSurge: '+120%', reason: 'Pakwan and festive cooking increase by 3x.', recommendedQty: '40 pouches' },
      { name: 'Madhur Pure Sugar 5kg', category: 'Staples', demandSurge: '+95%', reason: 'Heavy sweet making at every household.', recommendedQty: '50 packets' },
      { name: 'Aashirvaad Shudh Chakki Atta 10kg', category: 'Flour', demandSurge: '+60%', reason: 'Poori and festive meals bulk preparation.', recommendedQty: '35 bags' },
      { name: 'Cadbury Celebrations Gift Pack', category: 'Chocolates & Sweets', demandSurge: '+300%', reason: 'Top neighbourhood Diwali gifting choice.', recommendedQty: '60 boxes' },
      { name: 'Amul Pure Ghee 1L', category: 'Dairy & Ghee', demandSurge: '+140%', reason: 'Diyas and prasad cooking essential.', recommendedQty: '30 tins' },
      { name: 'Haldiram Soan Papdi 500g', category: 'Sweets', demandSurge: '+250%', reason: 'Traditional exchange gift SKU.', recommendedQty: '45 packs' },
      { name: 'Tata Tea Gold 500g', category: 'Beverages', demandSurge: '+50%', reason: 'Guest influx during Diwali week.', recommendedQty: '25 packs' },
      { name: 'Catch Garam Masala & Spices', category: 'Spices', demandSurge: '+80%', reason: 'Festive feasts and curry preparations.', recommendedQty: '40 boxes' },
    ],
    Holi: [
      { name: 'Madhur Sugar 5kg', category: 'Staples', demandSurge: '+110%', reason: 'Gujiya making sugar syrup demand.', recommendedQty: '50 packets' },
      { name: 'Amul Ghee 1L', category: 'Dairy', demandSurge: '+130%', reason: 'Mawa and gujiya frying in every house.', recommendedQty: '35 tins' },
      { name: 'Fortune Refined Oil 1L', category: 'Cooking Oil', demandSurge: '+90%', reason: 'Mathri and namkeen snack frying.', recommendedQty: '45 pouches' },
      { name: 'Haldiram Namkeen 400g (Aloo Bhujia)', category: 'Snacks', demandSurge: '+150%', reason: 'Holi party dry snacks for visitors.', recommendedQty: '50 packs' },
      { name: 'Rooh Afza Sharbat 750ml', category: 'Beverages', demandSurge: '+180%', reason: 'Thandai and Holi welcome drinks.', recommendedQty: '40 bottles' },
      { name: 'Coconut Hair Oil 200ml', category: 'Personal Care', demandSurge: '+200%', reason: 'Pre and post colour skin/hair protection.', recommendedQty: '60 bottles' },
      { name: 'Dettol Soap 4-pack', category: 'Soaps', demandSurge: '+140%', reason: 'Post colour cleanup essential.', recommendedQty: '40 packs' },
      { name: 'Surf Excel Matic 1kg', category: 'Detergents', demandSurge: '+110%', reason: 'Heavy cloth stain washing post Holi.', recommendedQty: '30 packs' },
    ],
  };

  const selectedItems = itemsMap[festival] || itemsMap['Diwali'];
  return {
    festival,
    summary: `${festival} par kirana bikri aamtaur par 40-70% tak badh jati hai. Saman pehle se stock karke achha munafa kamayein.`,
    items: selectedItems,
    isDemo: true,
  };
}

// In production, serve Vite build files. In dev, mount Vite middleware.
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Dukaan Saathi server running on http://localhost:${PORT}`);
  });
}

startServer();
