"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, SquarePen, Settings, Archive } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ConversationListItem } from "@/components/ConversationListItem";
import { NewChatModal } from "@/components/NewChatModal";
import { NewGroupModal } from "@/components/NewGroupModal";
import { AddContactModal } from "@/components/AddContactModal";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/store";
import { cx } from "@/lib/utils";

export function Sidebar({ activeConversationId }: { activeConversationId: number | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const conversations = useChatStore((s) => s.conversations);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);

  const visibleConversations = useMemo(() => {
    const base = conversations.filter((c) => (showArchived ? c.is_archived : !c.is_archived));
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((c) => {
      const name = c.name?.toLowerCase() || "";
      const lastMsg = c.last_message?.content?.toLowerCase() || "";
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, search, showArchived]);

  const archivedCount = conversations.filter((c) => c.is_archived).length;

  if (!user) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-signal-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-signal-border shrink-0">
        <button onClick={() => router.push("/settings")} aria-label="Open settings">
          <Avatar name={user.display_name} avatarUrl={user.avatar_url} color={user.avatar_color} size={36} />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNewChatOpen(true)}
            className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors"
            aria-label="New conversation"
          >
            <SquarePen size={19} />
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors"
            aria-label="Settings"
          >
            <Settings size={19} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-signal-text-tertiary" />
          <input
            type="text"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-signal-bg-secondary text-sm outline-none focus:ring-2 focus:ring-signal-blue/30 transition-all"
          />
        </div>
      </div>

      {/* Archived toggle */}
      {archivedCount > 0 && (
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={cx(
            "flex items-center gap-2 px-4 py-2 text-sm shrink-0 transition-colors",
            showArchived ? "text-signal-blue font-medium" : "text-signal-text-secondary hover:bg-signal-bg-secondary"
          )}
        >
          <Archive size={15} />
          {showArchived ? "Back to inbox" : `Archived (${archivedCount})`}
        </button>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto signal-scroll px-2 pb-2">
        {visibleConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full px-6 py-10">
            <p className="text-sm text-signal-text-secondary">
              {search
                ? "No conversations match your search."
                : showArchived
                  ? "No archived conversations."
                  : "No conversations yet. Tap the pencil icon to start one."}
            </p>
          </div>
        ) : (
          visibleConversations.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeConversationId}
              currentUserId={user.id}
              onClick={() => router.push(`/c/${c.id}`)}
            />
          ))
        )}
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelectConversation={(id) => router.push(`/c/${id}`)}
        onStartNewGroup={() => setNewGroupOpen(true)}
        onAddContact={() => setAddContactOpen(true)}
      />
      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={(id) => router.push(`/c/${id}`)}
      />
      <AddContactModal open={addContactOpen} onClose={() => setAddContactOpen(false)} />
    </div>
  );
}
