import { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, ReminderLog, ShopProfile, Transaction, TransactionType } from '../types';
import { initialCustomers, initialShopProfile, initialTransactions } from '../utils/seedData';

const STORAGE_KEYS = {
  PROFILE: 'dukaan_saathi_profile_v1',
  CUSTOMERS: 'dukaan_saathi_customers_v1',
  TRANSACTIONS: 'dukaan_saathi_transactions_v1',
  REMINDERS: 'dukaan_saathi_reminders_v1',
};

function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
  }
}

export function useLedger() {
  const [profile, setProfile] = useState<ShopProfile>(() => safeGet(STORAGE_KEYS.PROFILE, initialShopProfile));
  const [customers, setCustomers] = useState<Customer[]>(() => safeGet(STORAGE_KEYS.CUSTOMERS, initialCustomers));
  const [transactions, setTransactions] = useState<Transaction[]>(() => safeGet(STORAGE_KEYS.TRANSACTIONS, initialTransactions));
  const [reminders, setReminders] = useState<ReminderLog[]>(() => safeGet(STORAGE_KEYS.REMINDERS, []));

  // Undo stack
  const [lastAction, setLastAction] = useState<{
    id: string;
    transaction: Transaction;
    timestamp: number;
  } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    safeSet(STORAGE_KEYS.PROFILE, profile);
  }, [profile]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.TRANSACTIONS, transactions);
  }, [transactions]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.REMINDERS, reminders);
  }, [reminders]);

  // Derived: Customer balances
  const customerBalances = useMemo(() => {
    const map = new Map<string, { balance: number; lastTxDate?: string; creditTotal: number; paymentTotal: number }>();

    for (const c of customers) {
      map.set(c.id, { balance: 0, creditTotal: 0, paymentTotal: 0 });
    }

    // Sort transactions chronologically
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const tx of sorted) {
      const existing = map.get(tx.customer_id) || { balance: 0, creditTotal: 0, paymentTotal: 0 };
      if (tx.type === 'credit') {
        existing.balance += tx.amount;
        existing.creditTotal += tx.amount;
      } else {
        existing.balance -= tx.amount;
        existing.paymentTotal += tx.amount;
      }
      existing.lastTxDate = tx.date;
      map.set(tx.customer_id, existing);
    }

    return map;
  }, [customers, transactions]);

  // Overall KPIs
  const totalUdhaar = useMemo(() => {
    let sum = 0;
    customerBalances.forEach((val) => {
      if (val.balance > 0) sum += val.balance;
    });
    return sum;
  }, [customerBalances]);

  // Today's recovery
  const todayRecovery = useMemo(() => {
    const today = new Date().toDateString();
    return transactions
      .filter((t) => t.type === 'payment' && new Date(t.date).toDateString() === today)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Overdue customers count (> 30 days)
  const overdueCustomers = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return customers.filter((c) => {
      const info = customerBalances.get(c.id);
      if (!info || info.balance <= 0) return false;
      if (!info.lastTxDate) return false;
      return new Date(info.lastTxDate).getTime() < thirtyDaysAgo;
    });
  }, [customers, customerBalances]);

  // Top 5 debtors
  const topDebtors = useMemo(() => {
    return [...customers]
      .map((c) => ({
        ...c,
        balance: customerBalances.get(c.id)?.balance || 0,
      }))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [customers, customerBalances]);

  // 7-day cash flow for recharts
  const cashFlow7Days = useMemo(() => {
    const days: { [dateStr: string]: { date: string; credit: number; payment: number; displayDate: string } } = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      days[key] = { date: key, displayDate, credit: 0, payment: 0 };
    }

    for (const t of transactions) {
      const key = t.date.split('T')[0];
      if (days[key]) {
        if (t.type === 'credit') {
          days[key].credit += t.amount;
        } else {
          days[key].payment += t.amount;
        }
      }
    }

    return Object.values(days);
  }, [transactions]);

  // Actions
  const addTransaction = useCallback((tx: Omit<Transaction, 'id' | 'date'> & { date?: string }) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: tx.date || new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setLastAction({
      id: newTx.id,
      transaction: newTx,
      timestamp: Date.now(),
    });

    return newTx;
  }, []);

  const undoLastTransaction = useCallback(() => {
    if (!lastAction) return false;
    setTransactions((prev) => prev.filter((t) => t.id !== lastAction.id));
    setLastAction(null);
    return true;
  }, [lastAction]);

  const clearUndo = useCallback(() => {
    setLastAction(null);
  }, []);

  const addCustomer = useCallback((customerData: Omit<Customer, 'id' | 'created_at'>) => {
    const colors = [
      'bg-emerald-600',
      'bg-indigo-600',
      'bg-amber-600',
      'bg-rose-600',
      'bg-cyan-600',
      'bg-purple-600',
      'bg-teal-600',
      'bg-orange-600',
    ];
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      created_at: new Date().toISOString(),
      avatar_color: colors[Math.floor(Math.random() * colors.length)],
    };

    setCustomers((prev) => [newCust, ...prev]);
    return newCust;
  }, []);

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setTransactions((prev) => prev.filter((t) => t.customer_id !== id));
  }, []);

  const logReminder = useCallback((log: Omit<ReminderLog, 'id' | 'sent_at'>) => {
    const item: ReminderLog = {
      ...log,
      id: `rem-${Date.now()}`,
      sent_at: new Date().toISOString(),
    };
    setReminders((prev) => [item, ...prev]);
  }, []);

  const resetToDemo = useCallback(() => {
    safeSet(STORAGE_KEYS.PROFILE, initialShopProfile);
    safeSet(STORAGE_KEYS.CUSTOMERS, initialCustomers);
    safeSet(STORAGE_KEYS.TRANSACTIONS, initialTransactions);
    safeSet(STORAGE_KEYS.REMINDERS, []);
    setProfile(initialShopProfile);
    setCustomers(initialCustomers);
    setTransactions(initialTransactions);
    setReminders([]);
    setLastAction(null);
  }, []);

  const exportData = useCallback(() => {
    return {
      profile,
      customers,
      transactions,
      reminders,
      version: '1.0',
      exported_at: new Date().toISOString(),
    };
  }, [profile, customers, transactions, reminders]);

  const importData = useCallback((data: any) => {
    try {
      if (data.profile) setProfile(data.profile);
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.transactions)) setTransactions(data.transactions);
      if (Array.isArray(data.reminders)) setReminders(data.reminders);
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }, []);

  return {
    profile,
    setProfile,
    customers,
    transactions,
    reminders,
    customerBalances,
    totalUdhaar,
    todayRecovery,
    overdueCustomers,
    topDebtors,
    cashFlow7Days,
    lastAction,
    addTransaction,
    undoLastTransaction,
    clearUndo,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    logReminder,
    resetToDemo,
    exportData,
    importData,
  };
}
