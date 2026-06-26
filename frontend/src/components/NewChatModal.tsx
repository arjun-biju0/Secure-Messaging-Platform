"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, Users2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import type { Contact, Conversation } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectConversation: (id: number) => void;
  onStartNewGroup: () => void;
  onAddContact: () => void;
}

export function NewChatModal({ open, onClose, onSelectConversation, onStartNewGroup, onAddContact }: Props) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<Contact[]>("/api/contacts")
      .then(setContacts)
      .catch(() => show("Couldn't load contacts", undefined, "error"))
      .finally(() => setLoading(false));
  }, [open, show]);

  const filtered = contacts.filter((c) => {
    const label = c.nickname || c.user.display_name;
    const q = query.toLowerCase();
    return (
      label.toLowerCase().includes(q) ||
      c.user.username?.toLowerCase().includes(q) ||
      c.user.phone_number.includes(q)
    );
  });

  const handleSelect = useCallback(
    async (userId: number) => {
      try {
        const convo = await api.post<Conversation>("/api/conversations/direct", { user_id: userId });
        upsertConversation(convo);
        onClose();
        onSelectConversation(convo.id);
      } catch {
        show("Couldn't start conversation", undefined, "error");
      }
    },
    [onClose, onSelectConversation, show, upsertConversation]
  );

  return (
    <Modal open={open} onClose={onClose} title="New conversation">
      <div className="p-4">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-signal-text-tertiary" />
          <input
            autoFocus
            type="text"
            placeholder="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-signal-bg-secondary text-sm outline-none focus:ring-2 focus:ring-signal-blue/30 transition-all"
          />
        </div>

        <button
          onClick={() => {
            onClose();
            onStartNewGroup();
          }}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-signal-bg-secondary transition-colors mb-1"
        >
          <div className="w-10 h-10 rounded-full bg-signal-blue flex items-center justify-center shrink-0">
            <Users2 size={18} className="text-white" />
          </div>
          <span className="text-sm font-medium text-signal-text-primary">New group</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onAddContact();
          }}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-signal-bg-secondary transition-colors mb-3"
        >
          <div className="w-10 h-10 rounded-full bg-signal-online flex items-center justify-center shrink-0">
            <UserPlus size={18} className="text-white" />
          </div>
          <span className="text-sm font-medium text-signal-text-primary">Add a new contact</span>
        </button>

        <p className="text-xs font-medium text-signal-text-tertiary uppercase tracking-wide px-2 mb-1 mt-2">
          Contacts
        </p>

        {loading && <p className="text-sm text-signal-text-secondary px-2 py-3">Loading\u2026</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-signal-text-secondary px-2 py-3">
            {contacts.length === 0 ? "No contacts yet. Add one to get started." : "No contacts match your search."}
          </p>
        )}

        <div className="flex flex-col">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.user.id)}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-signal-bg-secondary transition-colors"
            >
              <Avatar
                name={c.nickname || c.user.display_name}
                avatarUrl={c.user.avatar_url}
                color={c.user.avatar_color}
                size={40}
              />
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-signal-text-primary truncate">
                  {c.nickname || c.user.display_name}
                </p>
                <p className="text-xs text-signal-text-tertiary truncate">
                  {c.user.username ? `@${c.user.username}` : c.user.phone_number}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
