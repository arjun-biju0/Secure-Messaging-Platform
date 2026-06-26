"use client";

import { useState, useEffect } from "react";
import { Search, UserPlus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import type { UserPublic } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onContactAdded?: () => void;
}

export function AddContactModal({ open, onClose, onContactAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const { show } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<UserPublic[]>(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
      } catch {
        // silent - search failures shouldn't be loud
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleAdd(targetUser: UserPublic) {
    setAddingId(targetUser.id);
    try {
      await api.post("/api/contacts", { phone_number: targetUser.phone_number });
      show("Contact added", `${targetUser.display_name} is now in your contacts.`, "success");
      onContactAdded?.();
      setResults((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      show("Couldn't add contact", err instanceof ApiError ? err.detail : "Please try again.", "error");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a new contact">
      <div className="p-4">
        <p className="text-sm text-signal-text-secondary mb-3">
          Search by phone number or username to find someone on Signal Clone.
        </p>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-signal-text-tertiary" />
          <input
            autoFocus
            type="text"
            placeholder="Phone number or @username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-signal-bg-secondary text-sm outline-none focus:ring-2 focus:ring-signal-blue/30 transition-all"
          />
        </div>

        {loading && <p className="text-sm text-signal-text-secondary px-1 py-2">Searching\u2026</p>}

        {!loading && query.trim().length > 0 && results.length === 0 && (
          <p className="text-sm text-signal-text-secondary px-1 py-2">
            No one found matching "{query}".
          </p>
        )}

        <div className="flex flex-col gap-0.5 mt-1">
          {results
            .filter((u) => u.id !== user?.id)
            .map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-1 py-2 rounded-lg">
                <Avatar name={u.display_name} avatarUrl={u.avatar_url} color={u.avatar_color} size={42} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-signal-text-primary truncate">{u.display_name}</p>
                  <p className="text-xs text-signal-text-tertiary truncate">
                    {u.username ? `@${u.username}` : u.phone_number}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(u)}
                  disabled={addingId === u.id}
                  className="flex items-center gap-1 text-xs font-medium text-signal-blue hover:bg-signal-blue-tint px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-60 shrink-0"
                >
                  <UserPlus size={13} />
                  {addingId === u.id ? "Adding\u2026" : "Add"}
                </button>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
}
