import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { KEYS, safeGet, safeSet } from '../lib/storage';

/**
 * Saathi chat conversations, kept in this browser (like the chat list in other AI apps).
 * - The open chat survives switching tabs inside the app and reloading the page.
 * - Old chats are listed in the history panel; the owner can reopen or delete them.
 * - Voice-note audio is only kept while the page is open (it is too big to store); its text stays.
 * Chats are removed on logout together with the rest of the local cache.
 */
export interface Conversation<D = unknown> {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  drafts: Record<string, D>;
}

interface Stored<D> {
  activeId: string | null;
  conversations: Conversation<D>[];
}

const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES = 300;

function newConversation<D>(welcome: ChatMessage): Conversation<D> {
  const now = new Date().toISOString();
  return { id: `chat-${Date.now().toString(36)}`, title: 'Naya chat', created_at: now, updated_at: now, messages: [welcome], drafts: {} };
}

function titleFrom(messages: ChatMessage[]): string | null {
  const first = messages.find((m) => m.sender === 'user' && m.text);
  if (!first?.text) return null;
  const t = first.text.replace(/^🎤\s*/, '').replace(/^"|"$/g, '').trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

/** Blob URLs die with the page; drop them before saving. */
function forStorage<D>(c: Conversation<D>): Conversation<D> {
  return {
    ...c,
    messages: c.messages.slice(-MAX_MESSAGES).map(({ audioBlobUrl: _a, ...m }) => m),
  };
}

export function useChatHistory<D>(makeWelcome: () => ChatMessage) {
  const [store, setStore] = useState<Stored<D>>(() => {
    const saved = safeGet<Stored<D>>(KEYS.CHATS, { activeId: null, conversations: [] });
    if (saved.conversations.length && saved.conversations.some((c) => c.id === saved.activeId)) return saved;
    const first = newConversation<D>(makeWelcome());
    return { activeId: first.id, conversations: [first, ...saved.conversations] };
  });

  // Save a moment after changes (chat updates can come in quick bursts).
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      safeSet(KEYS.CHATS, {
        activeId: store.activeId,
        // Chats that never got a user message are not worth keeping.
        conversations: store.conversations
          .filter((c) => c.id === store.activeId || c.messages.some((m) => m.sender === 'user'))
          .slice(0, MAX_CONVERSATIONS)
          .map(forStorage),
      });
    }, 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [store]);

  const active = useMemo(
    () => store.conversations.find((c) => c.id === store.activeId) ?? store.conversations[0],
    [store],
  );

  /** Update one conversation (the active one unless another id is given). */
  const update = useCallback((fn: (c: Conversation<D>) => Conversation<D>, id?: string) => {
    setStore((s) => {
      const target = id ?? s.activeId;
      const conversations = s.conversations.map((c) => {
        if (c.id !== target) return c;
        const next = fn(c);
        return { ...next, title: c.title === 'Naya chat' ? titleFrom(next.messages) ?? c.title : c.title, updated_at: new Date().toISOString() };
      });
      // most recently used first
      conversations.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return { ...s, conversations };
    });
  }, []);

  const setMessages = useCallback(
    (fn: (prev: ChatMessage[]) => ChatMessage[]) => update((c) => ({ ...c, messages: fn(c.messages) })),
    [update],
  );
  const setDrafts = useCallback(
    (fn: (prev: Record<string, D>) => Record<string, D>) => update((c) => ({ ...c, drafts: fn(c.drafts) })),
    [update],
  );

  const newChat = useCallback(() => {
    setStore((s) => {
      // Reuse an empty chat instead of piling up blank ones.
      const empty = s.conversations.find((c) => !c.messages.some((m) => m.sender === 'user'));
      if (empty) return { ...s, activeId: empty.id };
      const c = newConversation<D>(makeWelcome());
      return { activeId: c.id, conversations: [c, ...s.conversations] };
    });
  }, [makeWelcome]);

  const openChat = useCallback((id: string) => setStore((s) => ({ ...s, activeId: id })), []);

  const deleteChat = useCallback(
    (id: string) =>
      setStore((s) => {
        const rest = s.conversations.filter((c) => c.id !== id);
        if (rest.length === 0) {
          const c = newConversation<D>(makeWelcome());
          return { activeId: c.id, conversations: [c] };
        }
        return { activeId: s.activeId === id ? rest[0].id : s.activeId, conversations: rest };
      }),
    [makeWelcome],
  );

  return {
    conversations: store.conversations,
    activeId: active.id,
    messages: active.messages,
    drafts: active.drafts,
    setMessages,
    setDrafts,
    newChat,
    openChat,
    deleteChat,
  };
}
