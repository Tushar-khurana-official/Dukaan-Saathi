import { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, ReminderLog, ShopProfile, Transaction } from '../types';
import { initialCustomers, initialShopProfile, initialTransactions } from '../utils/seedData';
import { KEYS, migrateV1, newId, runStorageMigration, safeGet, safeSet } from '../lib/storage';
import {
  addDays,
  computeBalances,
  dailySeries,
  pendingAsOf,
  startOfDay,
  summarizeRange,
  topCustomersByCredit,
} from '../lib/ledger';

runStorageMigration();

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-indigo-600', 'bg-amber-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600',
];

export type NewTransaction = Pick<Transaction, 'customer_id' | 'type' | 'amount_paise' | 'note' | 'source'>;
export type NewCustomer = Pick<Customer, 'name' | 'phone' | 'note' | 'consent_given_at'>;

export function useLedger() {
  const [profile, setProfile] = useState<ShopProfile>(() => safeGet(KEYS.PROFILE, initialShopProfile));
  const [customers, setCustomers] = useState<Customer[]>(() => safeGet(KEYS.CUSTOMERS, initialCustomers));
  const [transactions, setTransactions] = useState<Transaction[]>(() => safeGet(KEYS.TRANSACTIONS, initialTransactions));
  const [reminders, setReminders] = useState<ReminderLog[]>(() => safeGet(KEYS.REMINDERS, []));
  const [lastAction, setLastAction] = useState<{ id: string; transaction: Transaction; timestamp: number } | null>(null);

  useEffect(() => safeSet(KEYS.PROFILE, profile), [profile]);
  useEffect(() => safeSet(KEYS.CUSTOMERS, customers), [customers]);
  useEffect(() => safeSet(KEYS.TRANSACTIONS, transactions), [transactions]);
  useEffect(() => safeSet(KEYS.REMINDERS, reminders), [reminders]);

  const customerBalances = useMemo(
    () => computeBalances(transactions, customers.map((c) => c.id)),
    [customers, transactions],
  );

  // Re-evaluated on every render so "today" rolls over at midnight without a reload.
  const today = startOfDay(new Date());
  const todayKey = today.getTime();

  /** Dashboard numbers for today, all derived from the same transaction log. */
  const todaySummary = useMemo(
    () => summarizeRange(transactions, new Date(todayKey), addDays(new Date(todayKey), 1)),
    [transactions, todayKey],
  );

  const totalUdhaar = useMemo(() => pendingAsOf(transactions, new Date(8.64e15)), [transactions]);

  const overdueCustomers = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    return customers.filter((c) => {
      const info = customerBalances.get(c.id);
      return Boolean(info && info.balance > 0 && info.lastTxDate && new Date(info.lastTxDate).getTime() < thirtyDaysAgo);
    });
  }, [customers, customerBalances]);

  const topDebtors = useMemo(
    () =>
      customers
        .map((c) => ({ ...c, balance: customerBalances.get(c.id)?.balance ?? 0 }))
        .filter((c) => c.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5),
    [customers, customerBalances],
  );

  const topCustomersThisWeek = useMemo(
    () => topCustomersByCredit(transactions, addDays(new Date(todayKey), -6), addDays(new Date(todayKey), 1)),
    [transactions, todayKey],
  );

  const cashFlow7Days = useMemo(() => dailySeries(transactions, 7), [transactions, todayKey]);

  /** Save a transaction. Callers must only call this after the owner has confirmed the entry. */
  const addTransaction = useCallback(
    (tx: NewTransaction) => {
      if (!Number.isInteger(tx.amount_paise) || tx.amount_paise <= 0) {
        throw new Error('amount_paise must be a positive integer');
      }
      if (tx.type !== 'sale' && !tx.customer_id) throw new Error('credit and payment need a customer');
      const newTx: Transaction = {
        ...tx,
        id: newId('tx'),
        shop_id: profile.id,
        confirmed_at: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      setLastAction({ id: newTx.id, transaction: newTx, timestamp: Date.now() });
      return newTx;
    },
    [profile.id],
  );

  const undoLastTransaction = useCallback(() => {
    if (!lastAction) return false;
    setTransactions((prev) => prev.filter((t) => t.id !== lastAction.id));
    setLastAction(null);
    return true;
  }, [lastAction]);

  const clearUndo = useCallback(() => setLastAction(null), []);

  /** Remove a wrong entry (owner confirms in the UI). Balances are recomputed from the log. */
  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setLastAction((prev) => (prev?.id === id ? null : prev));
  }, []);

  const addCustomer = useCallback(
    (data: NewCustomer) => {
      const phone = data.phone.replace(/\D/g, '').slice(-10);
      const customer: Customer = {
        id: newId('cust'),
        shop_id: profile.id,
        name: data.name.trim(),
        // DPDP: never store a phone number without the customer's consent.
        phone: data.consent_given_at ? phone : '',
        consent_given_at: phone && data.consent_given_at ? data.consent_given_at : null,
        note: data.note,
        created_at: new Date().toISOString(),
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      };
      setCustomers((prev) => [customer, ...prev]);
      return customer;
    },
    [profile.id],
  );

  const updateCustomer = useCallback((id: string, updates: Partial<Pick<Customer, 'name' | 'note'>>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  /** Store a phone number together with the date the customer agreed to it. */
  const recordConsent = useCallback((id: string, phone: string) => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, phone: digits, consent_given_at: new Date().toISOString() } : c)),
    );
  }, []);

  /** Customer withdrew consent: remove the phone number, keep the udhaar record. */
  const withdrawConsent = useCallback((id: string) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, phone: '', consent_given_at: null } : c)));
  }, []);

  /** DPDP erasure request: removes the customer, their transactions and their reminder history. */
  const deleteCustomer = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setTransactions((prev) => prev.filter((t) => t.customer_id !== id));
    setReminders((prev) => prev.filter((r) => r.customer_id !== id));
    setLastAction((prev) => (prev?.transaction.customer_id === id ? null : prev));
  }, []);

  /** DPDP access request: everything the shop holds about one customer. */
  const exportCustomerData = useCallback(
    (id: string) => {
      const customer = customers.find((c) => c.id === id);
      if (!customer) return null;
      return {
        purpose: 'Udhaar tracking and payment reminders only',
        shop: profile.name,
        exported_at: new Date().toISOString(),
        customer,
        balance_paise: customerBalances.get(id)?.balance ?? 0,
        transactions: transactions.filter((t) => t.customer_id === id),
        reminders: reminders.filter((r) => r.customer_id === id),
      };
    },
    [customers, transactions, reminders, customerBalances, profile.name],
  );

  /** Log that the owner opened a prefilled WhatsApp link. It does not mean the message was sent. */
  const logReminderOpened = useCallback(
    (log: Pick<ReminderLog, 'customer_id' | 'text' | 'amount_paise' | 'tone'>) => {
      setReminders((prev) => [
        { ...log, id: newId('rem'), shop_id: profile.id, channel: 'whatsapp', link_opened_at: new Date().toISOString() },
        ...prev,
      ]);
    },
    [profile.id],
  );

  const resetToDemo = useCallback(() => {
    setProfile({ ...initialShopProfile, consent_accepted: true });
    setCustomers(initialCustomers);
    setTransactions(initialTransactions);
    setReminders([]);
    setLastAction(null);
  }, []);

  /** Start with an empty ledger for a real shop (keeps the profile). */
  const clearAllData = useCallback(() => {
    setCustomers([]);
    setTransactions([]);
    setReminders([]);
    setLastAction(null);
  }, []);

  const exportData = useCallback(
    () => ({ version: 2, exported_at: new Date().toISOString(), profile, customers, transactions, reminders }),
    [profile, customers, transactions, reminders],
  );

  const importData = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.customers) || !Array.isArray(d.transactions)) return false;
    const migrated = migrateV1(d as Parameters<typeof migrateV1>[0]);
    if (migrated.profile) setProfile(migrated.profile);
    setCustomers(migrated.customers);
    setTransactions(migrated.transactions);
    setReminders(migrated.reminders);
    return true;
  }, []);

  return {
    profile,
    setProfile,
    customers,
    transactions,
    reminders,
    customerBalances,
    todaySummary,
    totalUdhaar,
    overdueCustomers,
    topDebtors,
    topCustomersThisWeek,
    cashFlow7Days,
    lastAction,
    addTransaction,
    undoLastTransaction,
    clearUndo,
    deleteTransaction,
    addCustomer,
    updateCustomer,
    recordConsent,
    withdrawConsent,
    deleteCustomer,
    exportCustomerData,
    logReminderOpened,
    resetToDemo,
    clearAllData,
    exportData,
    importData,
  };
}
