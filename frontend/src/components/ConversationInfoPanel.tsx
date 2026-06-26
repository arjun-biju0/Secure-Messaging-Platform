"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BellOff, Bell, Archive, ArchiveRestore, Pin, PinOff, UserMinus,
  UserPlus, Shield, LogOut, X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { cx } from "@/lib/utils";
import type { Conversation, Contact } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
}

export function ConversationInfoPanel({ open, onClose, conversation }: Props) {
  const { user } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isGroup = conversation.type === "group";
  const myParticipant = conversation.participants.find((p) => p.user.id === user?.id);
  const isAdmin = myParticipant?.role === "admin";

  async function toggleSetting(key: "is_muted" | "is_archived" | "is_pinned") {
    setBusy(true);
    try {
      const updated = await api.patch<Conversation>(`/api/conversations/${conversation.id}/settings`, {
        [key]: !conversation[key],
      });
      upsertConversation(updated);
    } catch {
      show("Couldn't update setting", undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId: number, name: string) {
    if (!confirm(`Remove ${name} from the group?`)) return;
    setBusy(true);
    try {
      const updated = await api.del<Conversation>(`/api/conversations/${conversation.id}/members/${userId}`);
      upsertConversation(updated);
      show("Member removed", `${name} was removed from the group.`, "success");
    } catch (err) {
      show("Couldn't remove member", err instanceof ApiError ? err.detail : undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveGroup() {
    if (!user) return;
    if (!confirm(`Leave "${conversation.name}"?`)) return;
    setBusy(true);
    try {
      await api.del(`/api/conversations/${conversation.id}/members/${user.id}`);
      removeConversation(conversation.id);
      onClose();
      router.push("/");
      show("Left group", undefined, "success");
    } catch {
      show("Couldn't leave group", undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-signal-border shrink-0">
          <h2 className="text-base font-semibold text-signal-text-primary">
            {isGroup ? "Group info" : "Contact info"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto signal-scroll flex-1">
          <div className="flex flex-col items-center py-6 px-4 border-b border-signal-border">
            <Avatar
              name={conversation.name || "Unknown"}
              avatarUrl={conversation.avatar_url}
              color={conversation.avatar_color}
              size={88}
              isGroup={isGroup}
            />
            <h3 className="text-lg font-semibold text-signal-text-primary mt-3">{conversation.name}</h3>
            {isGroup ? (
              <p className="text-sm text-signal-text-secondary mt-0.5">
                {conversation.participants.length} member{conversation.participants.length !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-sm text-signal-text-secondary mt-0.5">
                {conversation.other_user?.username ? `@${conversation.other_user.username}` : conversation.other_user?.phone_number}
              </p>
            )}
            {isGroup && conversation.description && (
              <p className="text-sm text-signal-text-secondary mt-2 text-center">{conversation.description}</p>
            )}
            {!isGroup && conversation.other_user?.about && (
              <p className="text-sm text-signal-text-secondary mt-2 text-center italic">"{conversation.other_user.about}"</p>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex justify-center gap-6 py-4 border-b border-signal-border">
            <ActionButton
              icon={conversation.is_muted ? Bell : BellOff}
              label={conversation.is_muted ? "Unmute" : "Mute"}
              onClick={() => toggleSetting("is_muted")}
              disabled={busy}
            />
            <ActionButton
              icon={conversation.is_pinned ? PinOff : Pin}
              label={conversation.is_pinned ? "Unpin" : "Pin"}
              onClick={() => toggleSetting("is_pinned")}
              disabled={busy}
            />
            <ActionButton
              icon={conversation.is_archived ? ArchiveRestore : Archive}
              label={conversation.is_archived ? "Unarchive" : "Archive"}
              onClick={() => toggleSetting("is_archived")}
              disabled={busy}
            />
          </div>

          {/* Members (groups only) */}
          {isGroup && (
            <div className="py-2">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-xs font-medium text-signal-text-tertiary uppercase tracking-wide">
                  {conversation.participants.length} Members
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setAddMemberOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium text-signal-blue hover:bg-signal-blue-tint px-2 py-1 rounded-full transition-colors"
                  >
                    <UserPlus size={13} /> Add
                  </button>
                )}
              </div>
              {conversation.participants.map((p) => (
                <div key={p.user.id} className="flex items-center gap-3 px-4 py-2 hover:bg-signal-bg-secondary group">
                  <Avatar name={p.user.display_name} avatarUrl={p.user.avatar_url} color={p.user.avatar_color} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-signal-text-primary truncate flex items-center gap-1.5">
                      {p.user.id === user?.id ? "You" : p.user.display_name}
                      {p.role === "admin" && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-signal-blue bg-signal-blue-tint px-1.5 py-0.5 rounded-full">
                          <Shield size={9} /> Admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-signal-text-tertiary truncate">
                      {p.user.username ? `@${p.user.username}` : p.user.phone_number}
                    </p>
                  </div>
                  {isAdmin && p.user.id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(p.user.id, p.user.display_name)}
                      disabled={busy}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-rose-50 text-signal-danger transition-all"
                      aria-label={`Remove ${p.user.display_name}`}
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleLeaveGroup}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-3 mt-2 text-signal-danger hover:bg-rose-50 transition-colors"
              >
                <LogOut size={17} />
                <span className="text-sm font-medium">Leave group</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AddMemberModal
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        conversation={conversation}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon, label, onClick, disabled,
}: { icon: typeof Bell; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-50"
    >
      <span className="w-11 h-11 rounded-full bg-signal-bg-secondary flex items-center justify-center text-signal-blue hover:bg-signal-blue-tint transition-colors">
        <Icon size={18} />
      </span>
      <span className="text-xs text-signal-text-secondary">{label}</span>
    </button>
  );
}

function AddMemberModal({ open, onClose, conversation }: { open: boolean; onClose: () => void; conversation: Conversation }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { show } = useToast();
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  useState(() => {
    if (open) {
      api.get<Contact[]>("/api/contacts").then(setContacts).catch(() => {});
    }
  });

  const existingIds = new Set(conversation.participants.map((p) => p.user.id));
  const eligible = contacts.filter((c) => !existingIds.has(c.user.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    setSubmitting(true);
    try {
      const updated = await api.post<Conversation>(`/api/conversations/${conversation.id}/members`, {
        member_ids: Array.from(selected),
      });
      upsertConversation(updated);
      show("Members added", undefined, "success");
      setSelected(new Set());
      onClose();
    } catch (err) {
      show("Couldn't add members", err instanceof ApiError ? err.detail : undefined, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add members"
      footer={
        <button
          onClick={handleAdd}
          disabled={selected.size === 0 || submitting}
          className="w-full bg-signal-blue hover:bg-signal-blue-dark disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {submitting ? "Adding\u2026" : `Add ${selected.size > 0 ? `(${selected.size})` : ""}`}
        </button>
      }
    >
      <div className="p-4">
        {eligible.length === 0 && (
          <p className="text-sm text-signal-text-secondary px-1 py-3">
            All of your contacts are already in this group.
          </p>
        )}
        <div className="flex flex-col">
          {eligible.map((c) => {
            const isSelected = selected.has(c.user.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.user.id)}
                className="w-full flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-signal-bg-secondary transition-colors"
              >
                <Avatar name={c.nickname || c.user.display_name} avatarUrl={c.user.avatar_url} color={c.user.avatar_color} size={40} />
                <span className="flex-1 text-left text-sm font-medium text-signal-text-primary truncate">
                  {c.nickname || c.user.display_name}
                </span>
                <span
                  className={cx(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-signal-blue border-signal-blue" : "border-signal-border"
                  )}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
