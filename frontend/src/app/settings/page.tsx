"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, Lock, Bell, Palette, Smartphone, HelpCircle,
  LogOut, ChevronRight, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import type { UserFull } from "@/lib/types";

const AVATAR_COLORS = [
  "#2C6BED", "#3A76F0", "#7B68EE", "#1FAEAE", "#2DB67C",
  "#E08A2E", "#D6516A", "#9C6ADE", "#4F8EF7", "#19998A",
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, updateUser, logout } = useAuth();
  const { show } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [color, setColor] = useState("#3a76f0");
  const [saving, setSaving] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setUsername(user.username || "");
      setAbout(user.about || "");
      setColor(user.avatar_color);
    }
  }, [user]);

  if (!user) return null;

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<UserFull>("/api/users/me", {
        display_name: displayName.trim(),
        username: username.trim() || null,
        about: about.trim() || null,
        avatar_color: color,
      });
      updateUser(updated);
      show("Profile updated", undefined, "success");
    } catch (err) {
      show("Couldn't save changes", err instanceof ApiError ? err.detail : undefined, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const updated = await api.postForm<UserFull>("/api/users/me/avatar", form);
      updateUser(updated);
      show("Profile photo updated", undefined, "success");
    } catch {
      show("Couldn't upload photo", undefined, "error");
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto signal-scroll bg-signal-bg-secondary">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-signal-text-secondary hover:text-signal-text-primary mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Back to chats
        </button>

        <h1 className="text-xl font-semibold text-signal-text-primary mb-5">Settings</h1>

        {/* Profile card */}
        <section className="bg-white rounded-2xl border border-signal-border p-6 mb-5">
          <form onSubmit={handleSaveProfile}>
            <div className="flex flex-col items-center mb-6">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="relative group">
                <Avatar name={displayName || user.display_name} avatarUrl={user.avatar_url} color={color} size={96} />
                <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-signal-blue flex items-center justify-center border-2 border-white group-hover:bg-signal-blue-dark transition-colors">
                  <Camera size={14} className="text-white" />
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              <div className="flex gap-1.5 mt-4">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
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

            <div className="grid gap-4">
              <div>
                <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">Display name</label>
                <input
                  type="text"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">Username</label>
                <div className="flex items-center rounded-lg border border-signal-border focus-within:border-signal-blue focus-within:ring-2 focus-within:ring-signal-blue/20 transition-all">
                  <span className="pl-3 text-signal-text-tertiary text-sm">@</span>
                  <input
                    type="text"
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                    className="flex-1 px-1.5 py-2.5 outline-none text-sm bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">About</label>
                <input
                  type="text"
                  maxLength={140}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Available"
                  className="w-full px-3 py-2.5 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">Phone number</label>
                <input
                  type="text"
                  disabled
                  value={user.phone_number}
                  className="w-full px-3 py-2.5 rounded-lg border border-signal-border bg-signal-bg-secondary text-sm text-signal-text-tertiary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-5 bg-signal-blue hover:bg-signal-blue-dark disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {saving ? "Saving\u2026" : "Save changes"}
            </button>
          </form>
        </section>

        {/* Placeholder settings sections */}
        <section className="bg-white rounded-2xl border border-signal-border divide-y divide-signal-border mb-5">
          <SettingsRow icon={Lock} label="Privacy" onClick={() => setComingSoon("Privacy settings")} />
          <SettingsRow icon={Bell} label="Notifications" onClick={() => setComingSoon("Notification settings")} />
          <SettingsRow icon={Palette} label="Appearance" onClick={() => setComingSoon("Appearance settings")} />
          <SettingsRow icon={Smartphone} label="Linked devices" onClick={() => setComingSoon("Linked devices")} />
          <SettingsRow icon={HelpCircle} label="Help" onClick={() => setComingSoon("Help center")} />
        </section>

        <section className="bg-white rounded-2xl border border-signal-border p-4 mb-8 flex items-start gap-3">
          <ShieldCheck size={18} className="text-signal-blue mt-0.5 shrink-0" />
          <p className="text-xs text-signal-text-secondary leading-relaxed">
            This is a demo clone of Signal built for educational purposes. Messages are stored in plain
            text and no real end-to-end encryption is performed — encryption is simulated for the
            purposes of this demonstration.
          </p>
        </section>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 text-signal-danger font-medium py-3 rounded-xl hover:bg-rose-50 transition-colors text-sm mb-8"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>

      <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />
    </div>
  );
}

function SettingsRow({ icon: Icon, label, onClick }: { icon: typeof Lock; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-signal-bg-secondary transition-colors text-left">
      <span className="w-8 h-8 rounded-full bg-signal-bg-secondary flex items-center justify-center text-signal-text-secondary shrink-0">
        <Icon size={16} />
      </span>
      <span className="flex-1 text-sm font-medium text-signal-text-primary">{label}</span>
      <ChevronRight size={16} className="text-signal-text-tertiary" />
    </button>
  );
}
