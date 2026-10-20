import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Plus,
  Minus,
  Download,
  Share2,
  Trash2,
  Info,
  ExternalLink,
  History,
  TrendingDown,
  Edit2,
  X,
} from 'lucide-react';
import {
  DetectedProduct,
  Language,
  Product,
  ReorderItem,
  ShelfScan,
  ShopProfile,
  StockStatus,
} from '../../types';
import { translations } from '../../utils/translations';
import { analyzeShelfImage } from '../../services/api';
import { createDistributorOrderText, createWhatsAppUrl } from '../../utils/whatsapp';

interface StockScreenProps {
  profile: ShopProfile;
  language: Language;
  catalog: Product[];
  scans: ShelfScan[];
  reorderList: ReorderItem[];
  compareWithPreviousScan: (prodName: string, status: string) => { label: string; changed: boolean } | null;
  onAddScan: (scan: Omit<ShelfScan, 'id' | 'created_at'>) => ShelfScan;
  onUpdateProduct: (id: string, partial: Partial<Product>) => void;
  onAddProduct: (prod: Omit<Product, 'id'>) => Product;
  onAddToReorder: (item: ReorderItem) => void;
  onUpdateReorderQty: (prodId: string, qty: number) => void;
  onRemoveFromReorder: (prodId: string) => void;
  onClearReorder: () => void;
  onPopulateReorderFromLowStock: () => void;
  onExportReorderCsv: () => string;
}

export const StockScreen: React.FC<StockScreenProps> = ({
  profile,
  language,
  catalog,
  scans,
  reorderList,
  compareWithPreviousScan,
  onAddScan,
  onUpdateProduct,
  onAddProduct,
  onAddToReorder,
  onUpdateReorderQty,
  onRemoveFromReorder,
  onClearReorder,
  onPopulateReorderFromLowStock,
  onExportReorderCsv,
}) => {
  const t = translations[language].stock;

  const [activeTab, setActiveTab] = useState<'scan' | 'reorder' | 'catalog' | 'history'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanImage, setCurrentScanImage] = useState<string | null>(
    scans.length > 0 ? scans[0].image_thumbnail : null
  );
  const [currentScanResults, setCurrentScanResults] = useState<DetectedProduct[]>(
    scans.length > 0 ? scans[0].results : []
  );
  const [scanNotes, setScanNotes] = useState<string>(
    scans.length > 0 ? scans[0].overall_notes : ''
  );
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  // Edit SKU modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddSkuOpen, setIsAddSkuOpen] = useState(false);
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuCategory, setNewSkuCategory] = useState('Groceries');
  const [newSkuMin, setNewSkuMin] = useState(10);
  const [newSkuUnit, setNewSkuUnit] = useState('pkts');
  const [newSkuSupplier, setNewSkuSupplier] = useState('Local Agency');
  const [newSkuPhone, setNewSkuPhone] = useState('9811000000');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];

      setCurrentScanImage(dataUrl);
      setIsScanning(true);
      setQualityWarning(null);

      try {
        const analysis = await analyzeShelfImage({
          imageBase64: base64,
          imageMimeType: file.type,
          catalog,
          previousScanSummary: scans[0]?.overall_notes,
        });

        setCurrentScanResults(analysis.products);
        setScanNotes(analysis.overall_notes);
        setQualityWarning(analysis.image_quality_warning || null);

        // Save scan
        onAddScan({
          image_thumbnail: dataUrl,
          overall_notes: analysis.overall_notes,
          quality_warning: analysis.image_quality_warning,
          results: analysis.products,
        });
      } catch (err) {
        console.error('Scan failed:', err);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Group detected products
  const grouped = {
    out: currentScanResults.filter((p) => p.status === 'out'),
    low: currentScanResults.filter((p) => p.status === 'low'),
    ok: currentScanResults.filter((p) => p.status === 'ok'),
    unknown: currentScanResults.filter((p) => p.status === 'unknown'),
  };

  // Add detected low/out item to reorder list
  const handleAddDetectedToReorder = (item: DetectedProduct) => {
    const matched = catalog.find((c) => c.id === item.matched_sku) || catalog[0];
    onAddToReorder({
      product_id: matched.id,
      product_name: item.name,
      quantity: Math.max(10, matched.min_level * 2),
      unit: matched.unit || 'pkts',
      supplier_name: matched.supplier_name || 'Distributor',
      supplier_phone: matched.supplier_phone || '9811234567',
    });
  };

  // WhatsApp distributor order
  const handleSendWhatsAppOrder = (supplierPhone: string, supplierName: string, items: ReorderItem[]) => {
    const message = createDistributorOrderText(supplierName, profile.name, items);
    const url = createWhatsAppUrl(supplierPhone, message);
    window.open(url, '_blank');
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const csvContent = onExportReorderCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Dukaan_Saathi_Order_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveNewSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuName.trim()) return;

    onAddProduct({
      name: newSkuName.trim(),
      category: newSkuCategory,
      min_level: Number(newSkuMin) || 5,
      current_level: Number(newSkuMin) || 5,
      unit: newSkuUnit,
      supplier_name: newSkuSupplier,
      supplier_phone: newSkuPhone,
    });

    setNewSkuName('');
    setIsAddSkuOpen(false);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Disclaimer Banner (Honesty Rule from prompt) */}
      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900 shadow-xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0" />
        <p className="font-semibold leading-relaxed">
          <span className="font-bold">⚠️ {t.disclaimer}</span>
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-emerald-100 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'scan'
              ? 'bg-[#0B3D2E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-emerald-50'
          }`}
        >
          📷 Shelf Scanner
        </button>
        <button
          onClick={() => setActiveTab('reorder')}
          className={`px-4 py-2 rounded-xl transition-all relative ${
            activeTab === 'reorder'
              ? 'bg-[#0B3D2E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-emerald-50'
          }`}
        >
          <span>🛒 Reorder List</span>
          {reorderList.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#25D366] text-[#0B3D2E] text-[10px]">
              {reorderList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'catalog'
              ? 'bg-[#0B3D2E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-emerald-50'
          }`}
        >
          📦 Catalog ({catalog.length} SKUs)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'bg-[#0B3D2E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-emerald-50'
          }`}
        >
          🕒 Scan History ({scans.length})
        </button>
      </div>

      {/* TAB 1: SHELF SCANNER */}
      {activeTab === 'scan' && (
        <div className="space-y-5">
          {/* Action Row: Camera / Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#0B3D2E] to-[#1F7A5C] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-98 transition-all"
            >
              <Camera className="w-5 h-5 text-[#25D366]" />
              <span>{t.btnCapture}</span>
            </button>
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleProcessImage(e.target.files[0])}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-3.5 px-4 rounded-2xl bg-white hover:bg-emerald-50 text-[#0B3D2E] font-bold text-sm flex items-center justify-center gap-2.5 border border-emerald-200 shadow-xs active:scale-98 transition-all"
            >
              <Upload className="w-5 h-5 text-[#1F7A5C]" />
              <span>{t.btnUpload}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleProcessImage(e.target.files[0])}
            />
          </div>

          {/* Camera Tips card */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#25D366] shrink-0" />
            <p>{t.cameraTips}</p>
          </div>

          {/* Quality Warning if flagged by Gemini */}
          {qualityWarning && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <p>Photo warning: {qualityWarning}. Behtar results ke liye dobara kheenchein.</p>
            </div>
          )}

          {/* Scanner Visual Container */}
          {currentScanImage && (
            <div className="bg-white p-4 rounded-3xl shadow-xs border border-emerald-100">
              <div className="relative rounded-2xl overflow-hidden bg-black max-h-[380px] flex items-center justify-center">
                <img
                  src={currentScanImage}
                  alt="Shelf Scan"
                  className="w-full h-auto object-contain max-h-[380px]"
                />

                {/* Scanning active animation line */}
                {isScanning && (
                  <div className="absolute inset-0 bg-[#0B3D2E]/40 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                    <div className="w-12 h-12 rounded-full border-4 border-[#25D366] border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-bold">{t.scanning}</p>
                    <p className="text-xs text-emerald-200">Detecting shelf gaps & low inventory</p>
                  </div>
                )}

                {/* Normalized Bounding Box Overlays */}
                {!isScanning &&
                  currentScanResults.map((item, idx) => {
                    if (!item.box_2d) return null;
                    const [ymin, xmin, ymax, xmax] = item.box_2d;
                    const isOut = item.status === 'out';
                    const isLow = item.status === 'low';

                    return (
                      <div
                        key={idx}
                        className={`absolute border-2 pointer-events-none rounded-lg flex items-start p-1 ${
                          isOut
                            ? 'border-rose-500 bg-rose-500/20'
                            : isLow
                            ? 'border-amber-400 bg-amber-400/20'
                            : 'border-emerald-400 bg-emerald-400/10'
                        }`}
                        style={{
                          top: `${ymin / 10}%`,
                          left: `${xmin / 10}%`,
                          height: `${(ymax - ymin) / 10}%`,
                          width: `${(xmax - xmin) / 10}%`,
                        }}
                      >
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/80 text-white shadow-xs">
                          {item.name.split(' ')[0]} ({item.status.toUpperCase()})
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* Scan Notes */}
              {scanNotes && (
                <div className="mt-3.5 p-3 rounded-2xl bg-[#F2F8F5] border border-emerald-100 text-xs">
                  <span className="font-bold text-[#0B3D2E] block mb-0.5">AI Inspection Summary:</span>
                  <p className="text-[#123D31] font-devanagari">{scanNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Detected Products Grouped Cards */}
          <div className="space-y-4">
            {/* Out of Stock Group */}
            {grouped.out.length > 0 && (
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                      {t.statusOut} ({grouped.out.length} Items)
                    </h4>
                  </div>
                </div>
                <div className="space-y-2">
                  {grouped.out.map((item, idx) => {
                    const comparison = compareWithPreviousScan(item.name, item.status);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between shadow-2xs text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#123D31]">{item.name}</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                              {Math.round(item.confidence * 100)}% match
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.note}</p>
                          {comparison && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {comparison.label}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleAddDetectedToReorder(item)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 shadow-xs"
                        >
                          + Reorder
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Low Stock Group */}
            {grouped.low.length > 0 && (
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                      {t.statusLow} ({grouped.low.length} Items)
                    </h4>
                  </div>
                </div>
                <div className="space-y-2">
                  {grouped.low.map((item, idx) => {
                    const comparison = compareWithPreviousScan(item.name, item.status);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between shadow-2xs text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#123D31]">{item.name}</span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                              {Math.round(item.confidence * 100)}% match
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.note}</p>
                          {comparison && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {comparison.label}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleAddDetectedToReorder(item)}
                          className="px-3 py-1.5 rounded-xl bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] font-bold text-xs shrink-0 shadow-xs"
                        >
                          + Reorder
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OK Stock Group */}
            {grouped.ok.length > 0 && (
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-[#1F7A5C]" />
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    {t.statusOk} ({grouped.ok.length} Items)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {grouped.ok.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-emerald-100 text-xs flex justify-between items-center"
                    >
                      <span className="font-bold text-[#123D31] truncate">{item.name}</span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        Full Stock
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REORDER LIST BUILDER */}
      {activeTab === 'reorder' && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#0B3D2E]">{t.reorderList}</h3>
              <p className="text-xs text-[#5F7A6E]">
                Distributor WhatsApp link, quantity steppers, aur CSV export
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onPopulateReorderFromLowStock}
                className="px-3 py-1.5 rounded-xl bg-[#DDF3E7] hover:bg-[#c6ebd6] text-[#0B3D2E] text-xs font-bold transition-all"
              >
                + Low Stock SKUs Auto-Add
              </button>
              {reorderList.length > 0 && (
                <button
                  onClick={handleDownloadCsv}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
                  title="CSV Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Grouped by Supplier */}
          {reorderList.length > 0 ? (
            <div className="space-y-4">
              {/* Unique suppliers */}
              {Array.from(new Set(reorderList.map((i) => i.supplier_name))).map((supplier) => {
                const supplierItems = reorderList.filter((i) => i.supplier_name === supplier);
                const supplierPhone = supplierItems[0]?.supplier_phone || '9811234567';

                return (
                  <div
                    key={supplier}
                    className="p-4 rounded-2xl bg-[#F2F8F5] border border-emerald-100 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-extrabold text-[#0B3D2E]">{supplier}</h4>
                        <p className="text-[11px] text-[#5F7A6E]">Mobile: +91 {supplierPhone}</p>
                      </div>

                      <button
                        onClick={() =>
                          handleSendWhatsAppOrder(supplierPhone, supplier, supplierItems)
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-bold text-xs shadow-xs transition-transform active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp Bhejo</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {supplierItems.map((item) => (
                        <div
                          key={item.product_id}
                          className="p-2.5 rounded-xl bg-white border border-emerald-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-[#123D31] truncate max-w-[200px]">
                            {item.product_name}
                          </span>

                          <div className="flex items-center gap-3">
                            {/* Quantity Stepper */}
                            <div className="flex items-center border border-emerald-200 rounded-lg overflow-hidden bg-gray-50">
                              <button
                                onClick={() =>
                                  onUpdateReorderQty(item.product_id, item.quantity - 1)
                                }
                                className="p-1 hover:bg-emerald-100 text-gray-700"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 text-xs font-bold text-[#0B3D2E]">
                                {item.quantity} {item.unit}
                              </span>
                              <button
                                onClick={() =>
                                  onUpdateReorderQty(item.product_id, item.quantity + 1)
                                }
                                className="p-1 hover:bg-emerald-100 text-gray-700"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              onClick={() => onRemoveFromReorder(item.product_id)}
                              className="text-gray-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClearReorder}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Clear All Orders
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
              <Package className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm font-bold text-[#123D31]">Reorder list khali hai</p>
              <p className="text-xs text-[#5F7A6E]">
                Scanner se ya catalog se low stock items add karein.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRODUCT CATALOG (25 SKUs) */}
      {activeTab === 'catalog' && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#0B3D2E]">{t.catalogTab}</h3>
              <p className="text-xs text-[#5F7A6E]">
                Popular Indian FMCG kirana items with minimum stock levels
              </p>
            </div>

            <button
              onClick={() => setIsAddSkuOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B3D2E] text-white font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Naya SKU</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalog.map((prod) => {
              const cur = prod.current_level ?? 0;
              const isLow = cur > 0 && cur <= prod.min_level;
              const isOut = cur === 0;

              return (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-2xl bg-[#F2F8F5] border border-emerald-100 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-[#123D31] leading-tight">
                        {prod.name}
                      </h4>
                      <p className="text-[10px] text-[#5F7A6E] mt-0.5">
                        {prod.category} • MRP ₹{prod.mrp || 20}
                      </p>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isOut
                          ? 'bg-rose-100 text-rose-700'
                          : isLow
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Stock OK'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100/60">
                    <span className="text-[11px] text-gray-500">
                      Stock: <span className="font-bold text-[#0B3D2E]">{cur}</span> / Min:{' '}
                      {prod.min_level} {prod.unit}
                    </span>

                    <button
                      onClick={() =>
                        onAddToReorder({
                          product_id: prod.id,
                          product_name: prod.name,
                          quantity: Math.max(10, prod.min_level * 2),
                          unit: prod.unit,
                          supplier_name: prod.supplier_name,
                          supplier_phone: prod.supplier_phone,
                        })
                      }
                      className="text-xs font-bold text-[#1F7A5C] hover:underline"
                    >
                      + Order
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SCAN HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
          <h3 className="text-base font-extrabold text-[#0B3D2E]">{t.historyTab}</h3>

          <div className="space-y-3">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={scan.image_thumbnail}
                    alt="Scan thumbnail"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-200"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-[#123D31] block">
                      Scan: {new Date(scan.created_at).toLocaleString()}
                    </span>
                    <p className="text-[11px] text-[#5F7A6E] mt-0.5 line-clamp-2">
                      {scan.overall_notes}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-[#0B3D2E] block">
                    {scan.results.length} SKUs Identified
                  </span>
                  <button
                    onClick={() => {
                      setCurrentScanImage(scan.image_thumbnail);
                      setCurrentScanResults(scan.results);
                      setScanNotes(scan.overall_notes);
                      setActiveTab('scan');
                    }}
                    className="text-xs font-bold text-[#1F7A5C] hover:underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add SKU Modal */}
      {isAddSkuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveNewSku}
            className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border border-emerald-100 p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0B3D2E]">Naya Product SKU Add Karein</h3>
              <button
                type="button"
                onClick={() => setIsAddSkuOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Product Name</label>
              <input
                type="text"
                required
                value={newSkuName}
                onChange={(e) => setNewSkuName(e.target.value)}
                placeholder="e.g. Haldiram Bhujia 1kg"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Min Stock</label>
                <input
                  type="number"
                  value={newSkuMin}
                  onChange={(e) => setNewSkuMin(Number(e.target.value) || 5)}
                  className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Unit</label>
                <input
                  type="text"
                  value={newSkuUnit}
                  onChange={(e) => setNewSkuUnit(e.target.value)}
                  placeholder="pkts / kg / pouches"
                  className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Supplier / Distributor</label>
              <input
                type="text"
                value={newSkuSupplier}
                onChange={(e) => setNewSkuSupplier(e.target.value)}
                placeholder="Supplier name"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold text-xs"
              >
                Save SKU
              </button>
              <button
                type="button"
                onClick={() => setIsAddSkuOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
