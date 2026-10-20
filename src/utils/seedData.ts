import { Customer, Product, ShelfScan, ShopProfile, Transaction } from '../types';

export const initialShopProfile: ShopProfile = {
  name: 'Gupta Kirana & General Store',
  owner: 'Ramesh Gupta',
  upi_id: 'guptakirana@okaxis',
  language: 'hinglish',
  consent_accepted: true,
  phone: '9811234567',
  address: 'Shop No. 4, Main Market, Gali No. 2, New Delhi',
};

export const initialCustomers: Customer[] = [
  { id: 'c-1', name: 'Sharma Ji (Gali 3)', phone: '9871234501', note: 'Regular customer, school teacher', created_at: '2026-09-01T10:00:00Z', avatar_color: 'bg-emerald-600' },
  { id: 'c-2', name: 'Sunita Verma', phone: '9811987602', note: 'Flat 204, pays 1st of every month', created_at: '2026-09-02T11:30:00Z', avatar_color: 'bg-indigo-600' },
  { id: 'c-3', name: 'Manoj Tailor', phone: '9822334403', note: 'Near Post Office', created_at: '2026-09-05T14:15:00Z', avatar_color: 'bg-amber-600' },
  { id: 'c-4', name: 'Pooja Tiwari', phone: '9711556604', note: 'House 12B, milk & dahi everyday', created_at: '2026-09-10T09:00:00Z', avatar_color: 'bg-rose-600' },
  { id: 'c-5', name: 'Rajesh Sweet Shop', phone: '9910445505', note: 'Bulk sugar & maida buyer', created_at: '2026-09-12T16:20:00Z', avatar_color: 'bg-cyan-600' },
  { id: 'c-6', name: 'Anil Auto Wale Bhaiya', phone: '9899112206', note: 'Corner auto stand', created_at: '2026-09-15T08:45:00Z', avatar_color: 'bg-purple-600' },
  { id: 'c-7', name: 'Dr. Ashok Pandey', phone: '9810887707', note: 'Clinic next door, pays on Sunday', created_at: '2026-09-18T18:00:00Z', avatar_color: 'bg-teal-600' },
  { id: 'c-8', name: 'Kavita Chachi', phone: '9873221108', note: 'Gali 1, monthly ration', created_at: '2026-09-20T12:00:00Z', avatar_color: 'bg-orange-600' },
  { id: 'c-9', name: 'Vikram Singh (Contractor)', phone: '9818665509', note: 'Construction site tea & snacks', created_at: '2026-09-22T17:30:00Z', avatar_color: 'bg-red-600' },
  { id: 'c-10', name: 'Deepak Barber', phone: '9870332210', note: 'Saloon nearby', created_at: '2026-09-25T11:00:00Z', avatar_color: 'bg-blue-600' },
  { id: 'c-11', name: 'Geeta Bhabhi', phone: '9958774411', note: 'Daily dairy & biscuits', created_at: '2026-10-01T10:10:00Z', avatar_color: 'bg-pink-600' },
  { id: 'c-12', name: 'Mohit Gym Trainer', phone: '9811443312', note: 'Brown bread, eggs, peanut butter', created_at: '2026-10-05T19:30:00Z', avatar_color: 'bg-lime-600' },
];

// Helper to make dates relative to current time
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const d = (daysAgo: number, hours = 10, minutes = 30) => {
  const dt = new Date(now - daysAgo * dayMs);
  dt.setHours(hours, minutes, 0, 0);
  return dt.toISOString();
};

export const initialTransactions: Transaction[] = [
  // Sharma Ji (c-1) - Overdue
  { id: 't-1', customer_id: 'c-1', type: 'credit', amount: 1200, note: 'Atta 10kg, Mustard Oil 2L', date: d(36), source: 'manual' },
  { id: 't-2', customer_id: 'c-1', type: 'payment', amount: 400, note: 'Cash payment', date: d(32), source: 'manual' },
  { id: 't-3', customer_id: 'c-1', type: 'credit', amount: 650, note: 'Surf Excel, Bath Soap, Toothpaste', date: d(28), source: 'voice' },
  { id: 't-4', customer_id: 'c-1', type: 'credit', amount: 350, note: 'Red Label Tea, Sugar 2kg', date: d(15), source: 'voice' },
  // Sunita Verma (c-2) - High pending
  { id: 't-5', customer_id: 'c-2', type: 'credit', amount: 2400, note: 'Monthly ration list 1', date: d(38), source: 'manual' },
  { id: 't-6', customer_id: 'c-2', type: 'payment', amount: 1500, note: 'UPI Google Pay', date: d(25), source: 'manual' },
  { id: 't-7', customer_id: 'c-2', type: 'credit', amount: 850, note: 'Fortune Refined oil, Biscuits', date: d(12), source: 'text' },
  { id: 't-8', customer_id: 'c-2', type: 'credit', amount: 450, note: 'Detergent & scrubber', date: d(5), source: 'voice' },
  // Manoj Tailor (c-3) - Overdue 35+ days
  { id: 't-9', customer_id: 'c-3', type: 'credit', amount: 1800, note: 'Groceries for shop opening', date: d(42), source: 'manual' },
  { id: 't-10', customer_id: 'c-3', type: 'payment', amount: 500, note: 'Cash', date: d(34), source: 'manual' },
  // Pooja Tiwari (c-4) - Regular
  { id: 't-11', customer_id: 'c-4', type: 'credit', amount: 320, note: 'Amul Butter, Bread, Milk', date: d(18), source: 'voice' },
  { id: 't-12', customer_id: 'c-4', type: 'payment', amount: 320, note: 'PhonePe paid', date: d(16), source: 'manual' },
  { id: 't-13', customer_id: 'c-4', type: 'credit', amount: 460, note: 'Eggs, Maggi 4 pack, Chips', date: d(4), source: 'voice' },
  // Rajesh Sweet Shop (c-5) - Large numbers
  { id: 't-14', customer_id: 'c-5', type: 'credit', amount: 6500, note: 'Sugar 50kg bag', date: d(22), source: 'manual' },
  { id: 't-15', customer_id: 'c-5', type: 'payment', amount: 4000, note: 'Bank transfer', date: d(10), source: 'manual' },
  { id: 't-16', customer_id: 'c-5', type: 'credit', amount: 2800, note: 'Refined Oil 15L tin', date: d(3), source: 'manual' },
  // Anil Auto (c-6) - Small daily
  { id: 't-17', customer_id: 'c-6', type: 'credit', amount: 180, note: 'Cigarette, Cold drink', date: d(20), source: 'voice' },
  { id: 't-18', customer_id: 'c-6', type: 'payment', amount: 180, note: 'Cash', date: d(18), source: 'manual' },
  { id: 't-19', customer_id: 'c-6', type: 'credit', amount: 240, note: 'Snacks & water bottle', date: d(2), source: 'voice' },
  // Dr. Ashok Pandey (c-7) - Settled & recent
  { id: 't-20', customer_id: 'c-7', type: 'credit', amount: 950, note: 'Dry fruits, Biscuits, Green tea', date: d(14), source: 'manual' },
  { id: 't-21', customer_id: 'c-7', type: 'payment', amount: 950, note: 'Paytm UPI full settlement', date: d(7), source: 'manual' },
  { id: 't-22', customer_id: 'c-7', type: 'credit', amount: 380, note: 'Tata Salt, Spices, Ghee 500g', date: d(1), source: 'voice' },
  // Kavita Chachi (c-8) - Overdue
  { id: 't-23', customer_id: 'c-8', type: 'credit', amount: 2150, note: 'Rice 10kg, Pulses, Masala', date: d(39), source: 'manual' },
  { id: 't-24', customer_id: 'c-8', type: 'payment', amount: 600, note: 'Part payment', date: d(27), source: 'manual' },
  { id: 't-25', customer_id: 'c-8', type: 'credit', amount: 480, note: 'Cooking oil 1L pouch', date: d(11), source: 'text' },
  // Vikram Contractor (c-9) - High overdue
  { id: 't-26', customer_id: 'c-9', type: 'credit', amount: 4200, note: 'Labour ration & tea supplies', date: d(44), source: 'manual' },
  { id: 't-27', customer_id: 'c-9', type: 'payment', amount: 1200, note: 'Cash part payment', date: d(31), source: 'manual' },
  { id: 't-28', customer_id: 'c-9', type: 'credit', amount: 1100, note: 'Biscuits cartons, sugar', date: d(17), source: 'manual' },
  // Deepak Barber (c-10) - Good payer
  { id: 't-29', customer_id: 'c-10', type: 'credit', amount: 520, note: 'Dettol liquid, Savlon, Cotton', date: d(15), source: 'manual' },
  { id: 't-30', customer_id: 'c-10', type: 'payment', amount: 520, note: 'UPI clear', date: d(8), source: 'manual' },
  { id: 't-31', customer_id: 'c-10', type: 'credit', amount: 340, note: 'Shaving foam & blades', date: d(2), source: 'voice' },
  // Geeta Bhabhi (c-11)
  { id: 't-32', customer_id: 'c-11', type: 'credit', amount: 780, note: 'Aashirvaad Atta 5kg, Haldi', date: d(9), source: 'voice' },
  { id: 't-33', customer_id: 'c-11', type: 'payment', amount: 500, note: 'Cash', date: d(3), source: 'manual' },
  // Mohit Gym (c-12)
  { id: 't-34', customer_id: 'c-12', type: 'credit', amount: 890, note: 'Oats 1kg, Peanut butter, Honey', date: d(6), source: 'text' },
  { id: 't-35', customer_id: 'c-12', type: 'credit', amount: 420, note: 'Eggs 2 tray, Bread', date: d(1), source: 'voice' },
  // Recent 7 days activity
  { id: 't-36', customer_id: 'c-1', type: 'payment', amount: 300, note: 'Payment received via UPI', date: d(0, 9, 15), source: 'manual' },
  { id: 't-37', customer_id: 'c-4', type: 'credit', amount: 150, note: 'Doodh 2 packet, Bread', date: d(0, 8, 30), source: 'voice' },
  { id: 't-38', customer_id: 'c-2', type: 'payment', amount: 400, note: 'Partial payment', date: d(1, 17, 20), source: 'manual' },
  { id: 't-39', customer_id: 'c-11', type: 'credit', amount: 260, note: 'Good Day biscuits, namkeen', date: d(0, 11, 45), source: 'voice' },
  { id: 't-40', customer_id: 'c-6', type: 'payment', amount: 200, note: 'Aaj ki vasooli', date: d(0, 12, 10), source: 'manual' },
];

export const initialProducts: Product[] = [
  { id: 'maggi-70g', name: 'Maggi 2-Minute Masala Noodles (70g)', category: 'Noodles & Pasta', min_level: 24, current_level: 4, unit: 'pkts', supplier_name: 'Nestle Agency Delhi', supplier_phone: '9811009988', mrp: 14 },
  { id: 'parle-g-std', name: 'Parle-G Glucose Biscuits (250g)', category: 'Biscuits', min_level: 30, current_level: 28, unit: 'pkts', supplier_name: 'Vikas Traders', supplier_phone: '9822110044', mrp: 20 },
  { id: 'tata-salt', name: 'Tata Salt Vacuum Evaporated (1kg)', category: 'Staples', min_level: 20, current_level: 0, unit: 'packets', supplier_name: 'Tata Consumer Distributor', supplier_phone: '9876500011', mrp: 28 },
  { id: 'aashirvaad-atta-10k', name: 'Aashirvaad Superior MP Atta (10kg)', category: 'Flour & Grains', min_level: 10, current_level: 3, unit: 'bags', supplier_name: 'ITC Foods Agency', supplier_phone: '9810123499', mrp: 460 },
  { id: 'fortune-oil-1l', name: 'Fortune Sunlite Refined Sunflower Oil (1L)', category: 'Cooking Oil', min_level: 15, current_level: 2, unit: 'pouches', supplier_name: 'Adani Wilmar Depot', supplier_phone: '9818822334', mrp: 145 },
  { id: 'red-label-tea-500g', name: 'Brooke Bond Red Label Tea (500g)', category: 'Beverages', min_level: 12, current_level: 5, unit: 'boxes', supplier_name: 'HUL Super Stockist', supplier_phone: '9819933445', mrp: 285 },
  { id: 'surf-excel-1kg', name: 'Surf Excel Easy Wash Detergent Powder (1kg)', category: 'Detergents', min_level: 12, current_level: 1, unit: 'pkts', supplier_name: 'HUL Super Stockist', supplier_phone: '9819933445', mrp: 140 },
  { id: 'colgate-strong-150g', name: 'Colgate Strong Teeth Toothpaste (150g)', category: 'Oral Care', min_level: 15, current_level: 9, unit: 'tubes', supplier_name: 'Colgate Palmolive Agency', supplier_phone: '9820011223', mrp: 110 },
  { id: 'lifebuoy-soap-100g', name: 'Lifebuoy Total Germ Protection Soap (4x100g)', category: 'Personal Care', min_level: 18, current_level: 14, unit: 'packs', supplier_name: 'HUL Super Stockist', supplier_phone: '9819933445', mrp: 120 },
  { id: 'amul-butter-500g', name: 'Amul Pasteurised Butter (500g)', category: 'Dairy & Cold', min_level: 10, current_level: 2, unit: 'bricks', supplier_name: 'Amul Dairy Van Point', supplier_phone: '9811445566', mrp: 275 },
  { id: 'good-day-cashew', name: 'Britannia Good Day Cashew Cookies (200g)', category: 'Biscuits', min_level: 20, current_level: 16, unit: 'pkts', supplier_name: 'Britannia Depot', supplier_phone: '9810556677', mrp: 35 },
  { id: 'haldiram-aloo-bhujia', name: 'Haldiram Aloo Bhujia Namkeen (400g)', category: 'Snacks', min_level: 15, current_level: 4, unit: 'pkts', supplier_name: 'Haldiram Snacks Hub', supplier_phone: '9873344556', mrp: 115 },
  { id: 'kurkure-masala-munch', name: 'Kurkure Masala Munch (80g)', category: 'Snacks', min_level: 25, current_level: 19, unit: 'pkts', supplier_name: 'PepsiCo Snack Line', supplier_phone: '9811667788', mrp: 20 },
  { id: 'dettol-liquid-250ml', name: 'Dettol Antiseptic Liquid (250ml)', category: 'Personal Care', min_level: 8, current_level: 6, unit: 'bottles', supplier_name: 'Reckitt Benckiser Stockist', supplier_phone: '9821122334', mrp: 148 },
  { id: 'vim-dishwash-bar-300g', name: 'Vim Dishwash Bar with Lemon (300g)', category: 'Cleaning', min_level: 30, current_level: 18, unit: 'bars', supplier_name: 'HUL Super Stockist', supplier_phone: '9819933445', mrp: 25 },
  { id: 'wagh-bakri-tea-500g', name: 'Wagh Bakri Premium Leaf Tea (500g)', category: 'Beverages', min_level: 10, current_level: 7, unit: 'pkts', supplier_name: 'Gujarat Tea Depot', supplier_phone: '9899114477', mrp: 290 },
  { id: 'catch-garam-masala-100g', name: 'Catch Super Garam Masala (100g)', category: 'Spices', min_level: 15, current_level: 3, unit: 'boxes', supplier_name: 'DS Group Spices', supplier_phone: '9811223388', mrp: 92 },
  { id: 'daawat-rozana-rice-5k', name: 'Daawat Rozana Super Basmati Rice (5kg)', category: 'Flour & Grains', min_level: 8, current_level: 5, unit: 'bags', supplier_name: 'LT Foods Agency', supplier_phone: '9810334455', mrp: 410 },
  { id: 'everest-turmeric-200g', name: 'Everest Turmeric / Haldi Powder (200g)', category: 'Spices', min_level: 16, current_level: 11, unit: 'boxes', supplier_name: 'Everest Masala Agency', supplier_phone: '9820445566', mrp: 68 },
  { id: 'kissan-mixed-fruit-500g', name: 'Kissan Mixed Fruit Jam (500g)', category: 'Breakfast', min_level: 8, current_level: 6, unit: 'jars', supplier_name: 'HUL Super Stockist', supplier_phone: '9819933445', mrp: 175 },
  { id: 'frooti-tetra-150ml', name: 'Frooti Mango Drink (150ml pack of 6)', category: 'Beverages', min_level: 20, current_level: 12, unit: 'trays', supplier_name: 'Parle Agro Line', supplier_phone: '9811889900', mrp: 60 },
  { id: 'harpic-toilet-cleaner-1l', name: 'Harpic Power Plus Toilet Cleaner (1L)', category: 'Cleaning', min_level: 10, current_level: 4, unit: 'bottles', supplier_name: 'Reckitt Benckiser Stockist', supplier_phone: '9821122334', mrp: 195 },
  { id: 'cadbury-dairy-milk-silky', name: 'Cadbury Dairy Milk Silk (60g)', category: 'Chocolates', min_level: 24, current_level: 15, unit: 'bars', supplier_name: 'Mondelez India Hub', supplier_phone: '9810778899', mrp: 85 },
  { id: 'bournvita-500g', name: 'Cadbury Bournvita Nutrition Drink (500g)', category: 'Beverages', min_level: 10, current_level: 3, unit: 'jars', supplier_name: 'Mondelez India Hub', supplier_phone: '9810778899', mrp: 240 },
  { id: 'colgate-maxfresh-150g', name: 'Colgate MaxFresh Spicy Fresh Gel (150g)', category: 'Oral Care', min_level: 12, current_level: 8, unit: 'tubes', supplier_name: 'Colgate Palmolive Agency', supplier_phone: '9820011223', mrp: 125 },
];

export const initialPastScans: ShelfScan[] = [
  {
    id: 'scan-1',
    created_at: d(6, 14, 0),
    image_thumbnail: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
    overall_notes: 'Section 1 (Staples & Noodles): Maggi and Parle-G were well stocked, Tata Salt running on last 3 packs.',
    quality_warning: null,
    results: [
      { name: 'Maggi 2-Minute Masala Noodles', matched_sku: 'maggi-70g', status: 'ok', confidence: 0.94, note: 'Front row full' },
      { name: 'Parle-G Glucose Biscuits', matched_sku: 'parle-g-std', status: 'ok', confidence: 0.98, note: 'Double stacked' },
      { name: 'Tata Salt Vacuum Evaporated', matched_sku: 'tata-salt', status: 'low', confidence: 0.88, note: 'Only 3 units visible' },
    ],
  },
  {
    id: 'scan-2',
    created_at: d(3, 11, 30),
    image_thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    overall_notes: 'Section 2 (Oils & Detergents): Fortune Oil getting depleted, Surf Excel empty gaps visible.',
    quality_warning: null,
    results: [
      { name: 'Fortune Sunlite Sunflower Oil 1L', matched_sku: 'fortune-oil-1l', status: 'low', confidence: 0.91, note: 'Gap on right side' },
      { name: 'Surf Excel Easy Wash', matched_sku: 'surf-excel-1kg', status: 'low', confidence: 0.86, note: 'Front row empty' },
      { name: 'Vim Dishwash Bar', matched_sku: 'vim-dishwash-bar-300g', status: 'ok', confidence: 0.95, note: 'Stock healthy' },
    ],
  },
  {
    id: 'scan-3',
    created_at: d(1, 16, 45),
    image_thumbnail: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=400&q=80',
    overall_notes: 'Section 1 Re-check: Tata Salt completely Out of Stock! Maggi decreased from OK to Low.',
    quality_warning: null,
    results: [
      { name: 'Tata Salt Vacuum Evaporated', matched_sku: 'tata-salt', status: 'out', confidence: 0.97, note: 'Empty gap on shelf' },
      { name: 'Maggi 2-Minute Masala Noodles', matched_sku: 'maggi-70g', status: 'low', confidence: 0.89, note: 'Down from OK to Low' },
      { name: 'Fortune Sunlite Sunflower Oil 1L', matched_sku: 'fortune-oil-1l', status: 'low', confidence: 0.92, note: 'Stock critical' },
    ],
  },
];
