import { useCallback, useEffect, useRef, useState } from 'react';
import { account, ApiError } from '../services/account';
import type { LocalShopData } from '../lib/storage';

export type SyncStatus = 'off' | 'saved' | 'saving' | 'pending' | 'error';

/** Big photos stay on this phone only; the server keeps the scan results and small thumbnails. */
const MAX_SYNCED_IMAGE_CHARS = 80_000;

function forServer(d: LocalShopData): LocalShopData {
  return {
    ...d,
    scans: d.scans.map((s) => (s.image_ref.length > MAX_SYNCED_IMAGE_CHARS ? { ...s, image_ref: '' } : s)),
  };
}

/**
 * Saves the shop's khata to the server a moment after every change (logged-in shops only).
 * The browser keeps working offline; the next change or a retry uploads everything again.
 */
export function useShopSync(enabled: boolean, data: LocalShopData) {
  const [status, setStatus] = useState<SyncStatus>(enabled ? 'saved' : 'off');
  const latest = useRef(data);
  const timer = useRef<number | null>(null);
  const first = useRef(true);
  latest.current = data;

  const save = useCallback(async () => {
    if (!enabled) return;
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setStatus('saving');
    try {
      await account.saveData(forServer(latest.current));
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError && err.status === 401) {
        // Session expired or account suspended: go back to the login screen.
        window.location.reload();
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      // Data was just loaded from the server; nothing to save yet.
      first.current = false;
      return;
    }
    setStatus('pending');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 1200);
  }, [enabled, save, data.profile, data.customers, data.transactions, data.reminders, data.catalog, data.scans, data.reorder]);

  // Retry when the phone comes back online.
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => save();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, save]);

  const flush = useCallback(async () => {
    if (enabled && (timer.current || status === 'pending' || status === 'error')) await save();
  }, [enabled, save, status]);

  return { status, flush, retry: save };
}
