import { useState, useEffect, useCallback, useMemo } from 'react';
import { DetectedProduct, Product, ReorderItem, ShelfScan } from '../types';
import { initialPastScans, initialProducts } from '../utils/seedData';

const STOCK_STORAGE = {
  CATALOG: 'dukaan_saathi_catalog_v1',
  SCANS: 'dukaan_saathi_scans_v1',
  REORDER: 'dukaan_saathi_reorder_v1',
};

function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key}:`, e);
  }
}

export function useStock() {
  const [catalog, setCatalog] = useState<Product[]>(() => safeGet(STOCK_STORAGE.CATALOG, initialProducts));
  const [scans, setScans] = useState<ShelfScan[]>(() => safeGet(STOCK_STORAGE.SCANS, initialPastScans));
  const [reorderList, setReorderList] = useState<ReorderItem[]>(() => safeGet(STOCK_STORAGE.REORDER, []));

  useEffect(() => {
    safeSet(STOCK_STORAGE.CATALOG, catalog);
  }, [catalog]);

  useEffect(() => {
    safeSet(STOCK_STORAGE.SCANS, scans);
  }, [scans]);

  useEffect(() => {
    safeSet(STOCK_STORAGE.REORDER, reorderList);
  }, [reorderList]);

  // Derived: Low stock & out of stock products
  const lowStockProducts = useMemo(() => {
    return catalog.filter((p) => {
      const cur = p.current_level ?? 0;
      return cur > 0 && cur <= p.min_level;
    });
  }, [catalog]);

  const outOfStockProducts = useMemo(() => {
    return catalog.filter((p) => {
      const cur = p.current_level ?? 0;
      return cur === 0;
    });
  }, [catalog]);

  const latestScan = scans.length > 0 ? scans[0] : null;
  const previousScan = scans.length > 1 ? scans[1] : null;

  // Compare a product's current detection with its status in the previous scan
  const compareWithPreviousScan = useCallback(
    (productName: string, currentStatus: string): { label: string; changed: boolean } | null => {
      if (!previousScan) return null;
      const prevProd = previousScan.results.find(
        (r) => r.name.toLowerCase().includes(productName.toLowerCase()) || productName.toLowerCase().includes(r.name.toLowerCase())
      );
      if (!prevProd) return null;

      if (prevProd.status !== currentStatus) {
        return {
          label: `Pehle ${prevProd.status.toUpperCase()}, ab ${currentStatus.toUpperCase()}`,
          changed: true,
        };
      }
      return {
        label: `Status consistent (${currentStatus.toUpperCase()})`,
        changed: false,
      };
    },
    [previousScan]
  );

  const addScan = useCallback((scanData: Omit<ShelfScan, 'id' | 'created_at'>) => {
    const newScan: ShelfScan = {
      ...scanData,
      id: `scan-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setScans((prev) => [newScan, ...prev]);

    // Automatically flag items in catalog if detected as low or out
    setCatalog((prev) => {
      return prev.map((p) => {
        const detected = newScan.results.find(
          (r) => r.matched_sku === p.id || p.name.toLowerCase().includes(r.name.toLowerCase())
        );
        if (detected) {
          if (detected.status === 'out') {
            return { ...p, current_level: 0 };
          }
          if (detected.status === 'low') {
            return { ...p, current_level: Math.max(1, Math.floor(p.min_level * 0.4)) };
          }
          if (detected.status === 'ok') {
            return { ...p, current_level: Math.max(p.min_level + 5, p.current_level || p.min_level + 5) };
          }
        }
        return p;
      });
    });

    return newScan;
  }, []);

  const updateProduct = useCallback((id: string, partial: Partial<Product>) => {
    setCatalog((prev) => prev.map((p) => (p.id === id ? { ...p, ...partial } : p)));
  }, []);

  const addProduct = useCallback((prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: `prod-${Date.now()}`,
    };
    setCatalog((prev) => [newProd, ...prev]);
    return newProd;
  }, []);

  const addToReorder = useCallback((item: ReorderItem) => {
    setReorderList((prev) => {
      const idx = prev.findIndex((i) => i.product_id === item.product_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += item.quantity;
        return copy;
      }
      return [...prev, item];
    });
  }, []);

  const updateReorderQty = useCallback((productId: string, quantity: number) => {
    setReorderList((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.product_id !== productId);
      }
      return prev.map((i) => (i.product_id === productId ? { ...i, quantity } : i));
    });
  }, []);

  const removeFromReorder = useCallback((productId: string) => {
    setReorderList((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clearReorder = useCallback(() => {
    setReorderList([]);
  }, []);

  const populateReorderFromLowStock = useCallback(() => {
    const itemsToAdd: ReorderItem[] = [];
    catalog.forEach((p) => {
      const cur = p.current_level ?? 0;
      if (cur <= p.min_level) {
        const deficit = Math.max(5, p.min_level * 2 - cur);
        itemsToAdd.push({
          product_id: p.id,
          product_name: p.name,
          quantity: deficit,
          unit: p.unit,
          supplier_name: p.supplier_name,
          supplier_phone: p.supplier_phone,
        });
      }
    });

    setReorderList((prev) => {
      const map = new Map<string, ReorderItem>();
      prev.forEach((i) => map.set(i.product_id, { ...i }));
      itemsToAdd.forEach((i) => {
        if (!map.has(i.product_id)) {
          map.set(i.product_id, i);
        }
      });
      return Array.from(map.values());
    });
  }, [catalog]);

  const exportReorderCsv = useCallback(() => {
    if (reorderList.length === 0) return '';
    const headers = ['Product Name', 'Quantity', 'Unit', 'Supplier Name', 'Supplier Phone'];
    const rows = reorderList.map((i) => [
      `"${i.product_name.replace(/"/g, '""')}"`,
      i.quantity,
      `"${i.unit}"`,
      `"${i.supplier_name}"`,
      `"${i.supplier_phone}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }, [reorderList]);

  const resetStockToDemo = useCallback(() => {
    safeSet(STOCK_STORAGE.CATALOG, initialProducts);
    safeSet(STOCK_STORAGE.SCANS, initialPastScans);
    safeSet(STOCK_STORAGE.REORDER, []);
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
    latestScan,
    previousScan,
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
