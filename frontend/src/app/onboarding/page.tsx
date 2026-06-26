"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, ArrowRight, ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import { getInitials } from "@/lib/utils";

const AVATAR_COLORS = [
  "#2C6BED", "#3A76F0", "#7B68EE", "#1FAEAE", "#2DB67C",
  "#E08A2E", "#D6516A", "#9C6ADE", "#4F8EF7", "#19998A",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { show } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("signal_clone_phone");
    const regToken = sessionStorage.getItem("signal_clone_reg_token");
    if (!storedPhone || !regToken) {
      router.replace("/login");
      return;
    }
    setPhone(storedPhone);
  }, [router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (displayName.trim().length === 0) {
      show("Add your name", "A display name is required to continue.", "error");
      return;
    }
    const regToken = sessionStorage.getItem("signal_clone_reg_token");
    if (!regToken || !phone) {
      router.replace("/login");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ access_token: string; user: any }>("/api/auth/register", {
        registration_token: regToken,
        phone_number: phone,
        display_name: displayName.trim(),
        username: username.trim() || undefined,
        avatar_color: color,
      });
      setSession(res.access_token, res.user);

      if (avatarFile) {
        try {
          const form = new FormData();
          form.append("file", avatarFile);
          const updated = await api.postForm<any>("/api/users/me/avatar", form);
          setSession(res.access_token, updated);
        } catch {
          // Non-fatal: profile created, avatar upload can be retried in Settings
        }
      }

      sessionStorage.removeItem("signal_clone_reg_token");
      sessionStorage.removeItem("signal_clone_phone");
      show("Account created", `Welcome to Signal Clone, ${displayName.trim()}!`, "success");
      router.push("/");
    } catch (err) {
      show("Couldn't create account", err instanceof ApiError ? err.detail : "Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-signal-bg-secondary px-4">
      <div className="w-full max-w-[420px]">
        <button
          onClick={() => router.push("/login")}
          className="flex items-center gap-1 text-sm text-signal-text-secondary hover:text-signal-text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-signal-border p-7">
          <h1 className="text-xl font-semibold text-signal-text-primary mb-1">Set up your profile</h1>
          <p className="text-sm text-signal-text-secondary mb-6">
            This is how you'll appear to your contacts.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="flex flex-col items-center mb-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group"
                aria-label="Upload profile photo"
              >
                <Avatar
                  name={displayName || "?"}
                  avatarUrl={avatarPreview}
                  color={color}
                  size={88}
                />
                <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-signal-blue flex items-center justify-center border-2 border-white group-hover:bg-signal-blue-dark transition-colors">
                  <Camera size={13} className="text-white" />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              {!avatarPreview && (
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
                      aria-label={`Choose color ${c}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">
              Display name
            </label>
            <input
              autoFocus
              type="text"
              maxLength={50}
              placeholder="e.g. Jamie Rivera"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none text-sm mb-4 transition-all"
            />

            <label className="block text-xs font-medium text-signal-text-secondary mb-1.5">
              Username <span className="text-signal-text-tertiary">(optional)</span>
            </label>
            <div className="flex items-center rounded-lg border border-signal-border focus-within:border-signal-blue focus-within:ring-2 focus-within:ring-signal-blue/20 mb-6 transition-all">
              <span className="pl-3 text-signal-text-tertiary text-sm">@</span>
              <input
                type="text"
                maxLength={30}
                placeholder="jamie"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                className="flex-1 px-1.5 py-2.5 outline-none text-sm bg-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-signal-blue hover:bg-signal-blue-dark text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {submitting ? "Creating account\u2026" : "Continue"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
