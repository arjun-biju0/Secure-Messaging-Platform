"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { Conversation, Message, WsEvent } from "@/lib/types";

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<number, Message[]>;
  hasMoreByConversation: Record<number, boolean>;
  typingByConversation: Record<number, number[]>; // conversation_id -> user_ids typing
  onlineUserIds: Set<number>;
  activeConversationId: number | null;

  setActiveConversation: (id: number | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: number, beforeId?: number) => Promise<void>;
  sendMessage: (conversationId: number, content: string) => Promise<void>;
  markRead: (conversationId: number) => Promise<void>;
  applyWsEvent: (event: WsEvent) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (conversationId: number) => void;
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });
}

let nextTempId = -1;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  hasMoreByConversation: {},
  typingByConversation: {},
  onlineUserIds: new Set(),
  activeConversationId: null,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  loadConversations: async () => {
    const data = await api.get<Conversation[]>("/api/conversations");
    set({ conversations: sortConversations(data) });
  },

  loadMessages: async (conversationId, beforeId) => {
    const qs = beforeId ? `?before_id=${beforeId}&limit=30` : "?limit=30";
    const page = await api.get<{ messages: Message[]; has_more: boolean }>(
      `/api/conversations/${conversationId}/messages${qs}`
    );
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      const merged = beforeId ? [...page.messages, ...existing] : page.messages;
      // de-dupe by id, preserve order
      const seen = new Set<number>();
      const deduped = merged.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      return {
        messagesByConversation: { ...state.messagesByConversation, [conversationId]: deduped },
        hasMoreByConversation: { ...state.hasMoreByConversation, [conversationId]: page.has_more },
      };
    });
  },

  sendMessage: async (conversationId, content) => {
    const tempId = nextTempId--;
    const clientId = `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: null, // filled by caller context if needed; UI checks _pending
      sender: null,
      type: "text",
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      client_id: clientId,
      aggregate_status: "sent",
      statuses: [],
      _pending: true,
    };

    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] || []), optimistic],
      },
    }));

    try {
      const saved = await api.post<Message>(`/api/conversations/${conversationId}/messages`, {
        content,
        client_id: clientId,
      });
      set((state) => {
        const list = state.messagesByConversation[conversationId] || [];
        const replaced = list.map((m) => (m.client_id === clientId ? saved : m));
        return {
          messagesByConversation: { ...state.messagesByConversation, [conversationId]: replaced },
        };
      });
    } catch {
      set((state) => {
        const list = state.messagesByConversation[conversationId] || [];
        const failed = list.map((m) =>
          m.client_id === clientId ? { ...m, _pending: false, _failed: true } : m
        );
        return {
          messagesByConversation: { ...state.messagesByConversation, [conversationId]: failed },
        };
      });
    }
  },

  markRead: async (conversationId) => {
    try {
      await api.post(`/api/conversations/${conversationId}/read`);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch {
      // best-effort
    }
  },

  upsertConversation: (conversation) => {
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conversation.id);
      let next: Conversation[];
      if (idx === -1) {
        next = [...state.conversations, conversation];
      } else {
        next = [...state.conversations];
        next[idx] = conversation;
      }
      return { conversations: sortConversations(next) };
    });
  },

  removeConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    }));
  },

  applyWsEvent: (event) => {
    const state = get();
    switch (event.type) {
      case "message:new": {
        const msg = event.payload;
        const list = state.messagesByConversation[msg.conversation_id] || [];
        // Reconcile with optimistic message if this is our own echoed send
        const hasClientMatch = msg.client_id && list.some((m) => m.client_id === msg.client_id);
        let nextList: Message[];
        if (hasClientMatch) {
          nextList = list.map((m) => (m.client_id === msg.client_id ? msg : m));
        } else if (list.some((m) => m.id === msg.id)) {
          nextList = list.map((m) => (m.id === msg.id ? msg : m));
        } else {
          nextList = [...list, msg];
        }
        set({
          messagesByConversation: { ...state.messagesByConversation, [msg.conversation_id]: nextList },
        });
        // Clear typing indicator for the sender in this conversation
        if (msg.sender_id) {
          const typers = state.typingByConversation[msg.conversation_id] || [];
          if (typers.includes(msg.sender_id)) {
            set((s) => ({
              typingByConversation: {
                ...s.typingByConversation,
                [msg.conversation_id]: typers.filter((id) => id !== msg.sender_id),
              },
            }));
          }
        }
        break;
      }
      case "message:status": {
        const msg = event.payload;
        const list = state.messagesByConversation[msg.conversation_id] || [];
        const nextList = list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
        set({
          messagesByConversation: { ...state.messagesByConversation, [msg.conversation_id]: nextList },
        });
        break;
      }
      case "conversation:new":
      case "conversation:updated": {
        get().upsertConversation(event.payload);
        break;
      }
      case "conversation:removed": {
        get().removeConversation(event.payload.conversation_id);
        break;
      }
      case "presence:update": {
        set((s) => {
          const next = new Set(s.onlineUserIds);
          if (event.payload.is_online) next.add(event.payload.user_id);
          else next.delete(event.payload.user_id);
          return { onlineUserIds: next };
        });
        break;
      }
      case "typing:update": {
        const { conversation_id, user_id, is_typing } = event.payload;
        set((s) => {
          const current = s.typingByConversation[conversation_id] || [];
          const next = is_typing
            ? Array.from(new Set([...current, user_id]))
            : current.filter((id) => id !== user_id);
          return {
            typingByConversation: { ...s.typingByConversation, [conversation_id]: next },
          };
        });
        break;
      }
      default:
        break;
    }
  },
}));
