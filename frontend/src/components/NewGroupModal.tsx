"use client";

import { useState, useEffect } from "react";
import { Search, Check, Users2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { api, ApiError } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { cx } from "@/lib/utils";
import type { Contact, Conversation } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

const GROUP_COLORS = ["#2DB67C", "#9C6ADE", "#E08A2E", "#2C6BED", "#D6516A", "#1FAEAE"];

export function NewGroupModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<"members" | "details">("members");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const { show } = useToast();
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  useEffect(() => {
    if (!open) {
      setStep("members");
      setSelected(new Set());
      setQuery("");
      setGroupName("");
      setColor(GROUP_COLORS[0]);
      return;
    }
    api.get<Contact[]>("/api/contacts").then(setContacts).catch(() => {});
  }, [open]);

  const filtered = contacts.filter((c) => {
    const label = c.nickname || c.user.display_name;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  function toggle(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (!groupName.trim()) {
      show("Name your group", undefined, "error");
      return;
    }
    setSubmitting(true);
    try {
      const convo = await api.post<Conversation>("/api/conversations/group", {
        name: groupName.trim(),
        member_ids: Array.from(selected),
        avatar_color: color,
      });
      upsertConversation(convo);
      show("Group created", `“${convo.name}” is ready.`, "success");
      onClose();
      onCreated(convo.id);
    } catch (err) {
      show("Couldn't create group", err instanceof ApiError ? err.detail : "Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "members" ? "New group" : "Group details"}
      footer={
        step === "members" ? (
          <button
            onClick={() => setStep("details")}
            disabled={selected.size === 0}
            className="w-full bg-signal-blue hover:bg-signal-blue-dark disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Next ({selected.size} selected)
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setStep("members")}
              className="flex-1 bg-signal-bg-secondary hover:bg-signal-bg-tertiary text-signal-text-primary font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-1 bg-signal-blue hover:bg-signal-blue-dark disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {submitting ? "Creating\u2026" : "Create group"}
            </button>
          </div>
        )
      }
    >
      {step === "members" ? (
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
          {contacts.length === 0 && (
            <p className="text-sm text-signal-text-secondary px-1 py-3">
              You need at least one contact to start a group.
            </p>
          )}
          <div className="flex flex-col">
            {filtered.map((c) => {
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
                    {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-col items-center mb-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: color }}>
              <Users2 size={32} className="text-white" />
            </div>
            <div className="flex gap-1.5">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    transform: color === c ? "scale(1.25)" : "scale(1)",
                    boxShadow: color === c ? "0 0 0 2px white, 0 0 0 3.5px " + c : "none",
                  }}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">Group name</label>
          <input
            autoFocus
            type="text"
            maxLength={80}
            placeholder="e.g. Weekend Trip"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none text-sm mb-4 transition-all"
          />
          <p className="text-xs text-signal-text-tertiary">
            {selected.size} member{selected.size !== 1 ? "s" : ""} selected, plus you
          </p>
        </div>
      )}
    </Modal>
  );
}
