import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ReorderItem, ShelfScan } from '../types';
import { initialPastScans, initialProducts } from '../utils/seedData';
import { KEYS, newId, safeGet, safeSet } from '../lib/storage';
import { compareScans, sanitizeDetections, ScanChange } from '../lib/shelf';
import { matchProduct } from '../lib/productMatch';

export function useStock(shopId: string) {
  const [catalog, setCatalog] = useState<Product[]>(() => safeGet(KEYS.CATALOG, initialProducts));
  const [scans, setScans] = useState<ShelfScan[]>(() => safeGet(KEYS.SCANS, initialPastScans));
  const [reorderList, setReorderList] = useState<ReorderItem[]>(() => safeGet(KEYS.REORDER, []));

  useEffect(() => safeSet(KEYS.CATALOG, catalog), [catalog]);
  useEffect(() => safeSet(KEYS.SCANS, scans), [scans]);
  useEffect(() => safeSet(KEYS.REORDER, reorderList), [reorderList]);

  const lowStockProducts = useMemo(() => catalog.filter((p) => p.stock_status === 'low'), [catalog]);
  const outOfStockProducts = useMemo(() => catalog.filter((p) => p.stock_status === 'out'), [catalog]);

  /** Status changes between the latest scan and the one before it. */
  const latestChanges: ScanChange[] = useMemo(
    () => (scans[0] ? compareScans(scans[0].detected_items, scans[1]?.detected_items ?? null) : []),
    [scans],
  );

  /** Compare a product's status in a scan with the scan just before it. */
  const compareWithPreviousScan = useCallback(
    (scanId: string, productName: string, sku: string | null) => {
      const idx = scans.findIndex((s) => s.id === scanId);
      if (idx < 0) return null;
      const current = scans[idx].detected_items.find((d) => (sku && d.matched_sku === sku) || d.name === productName);
      if (!current) return null;
      const change = compareScans([current], scans[idx + 1]?.detected_items ?? null)[0];
      return change.trend === 'new' ? null : change;
    },
    [scans],
  );

  const addScan = useCallback(
    (scanData: Pick<ShelfScan, 'image_ref' | 'overall_notes' | 'quality_warning' | 'detected_items'>) => {
      const items = sanitizeDetections(scanData.detected_items);
      const newScan: ShelfScan = {
        ...scanData,
        detected_items: items,
        id: newId('scan'),
        shop_id: shopId,
        created_at: new Date().toISOString(),
      };
      setScans((prev) => [newScan, ...prev].slice(0, 30));

      // Update each product's last-seen status. Statuses only, never counts.
      setCatalog((prev) =>
        prev.map((p) => {
          const detected = items.find((d) => d.matched_sku === p.id) ??
            items.find((d) => !d.matched_sku && matchProduct(d.name, [p]) !== null);
          if (!detected || detected.status === 'unknown') return p;
          return { ...p, stock_status: detected.status, status_updated_at: newScan.created_at };
        }),
      );
      return newScan;
    },
    [shopId],
  );

  const updateProduct = useCallback((id: string, partial: Partial<Product>) => {
    setCatalog((prev) => prev.map((p) => (p.id === id ? { ...p, ...partial } : p)));
  }, []);

  const addProduct = useCallback(
    (data: Omit<Product, 'id' | 'shop_id'>) => {
      const product: Product = { ...data, id: newId('prod'), shop_id: shopId };
      setCatalog((prev) => [product, ...prev]);
      return product;
    },
    [shopId],
  );

  const addToReorder = useCallback((item: ReorderItem) => {
    setReorderList((prev) => {
      const idx = prev.findIndex((i) => i.product_id === item.product_id);
      if (idx < 0) return [...prev, item];
      return prev.map((i, n) => (n === idx ? { ...i, quantity: i.quantity + item.quantity } : i));
    });
  }, []);

  const updateReorderQty = useCallback((productId: string, quantity: number) => {
    setReorderList((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const removeFromReorder = useCallback((productId: string) => {
    setReorderList((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clearReorder = useCallback(() => setReorderList([]), []);

  /** Add every low / out product to the reorder list with its suggested order size. */
  const populateReorderFromLowStock = useCallback(() => {
    setReorderList((prev) => {
      const map = new Map(prev.map((i) => [i.product_id, { ...i }]));
      for (const p of catalog) {
        if ((p.stock_status === 'low' || p.stock_status === 'out') && !map.has(p.id)) {
          map.set(p.id, {
            product_id: p.id,
            product_name: p.name,
            quantity: Math.max(1, p.low_stock_threshold),
            unit: p.unit,
            supplier_name: p.supplier_name,
            supplier_phone: p.supplier_phone,
          });
        }
      }
      return Array.from(map.values());
    });
  }, [catalog]);

  const exportReorderCsv = useCallback(() => {
    if (reorderList.length === 0) return '';
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ['Product Name', 'Order Quantity', 'Unit', 'Supplier Name', 'Supplier Phone'];
    const rows = reorderList.map((i) => [q(i.product_name), i.quantity, q(i.unit), q(i.supplier_name), q(i.supplier_phone)]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }, [reorderList]);

  const resetStockToDemo = useCallback(() => {
    setCatalog(initialProducts);
    setScans(initialPastScans);
    setReorderList([]);
  }, []);

  return {
    catalog,
    scans,
    reorderList,
    lowStockProducts,
    outOfStockProducts,
    latestChanges,
    compareWithPreviousScan,
    addScan,
    updateProduct,
    addProduct,
    addToReorder,
    updateReorderQty,
    removeFromReorder,
    clearReorder,
    populateReorderFromLowStock,
    exportReorderCsv,
    resetStockToDemo,
  };
}
