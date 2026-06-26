"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type Step = "phone" | "otp";

const COUNTRY_CODE = "+1";

export default function LoginPage() {
  const router = useRouter();
  const { setSession, user, isLoading } = useAuth();
  const { show } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [rawPhone, setRawPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (step === "otp") {
      otpInputRef.current?.focus();
    }
  }, [step]);

  const phoneNumber = `${COUNTRY_CODE}${rawPhone.replace(/\D/g, "")}`;

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (rawPhone.replace(/\D/g, "").length < 7) {
      show("Enter a valid phone number", "Phone numbers need at least 7 digits.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; demo_otp: string }>("/api/auth/request-otp", {
        phone_number: phoneNumber,
      });
      setDemoOtp(res.demo_otp);
      setStep("otp");
      show("Verification code sent", `A code was sent to ${phoneNumber} (demo mode).`, "success");
    } catch (err) {
      show("Couldn't send code", err instanceof ApiError ? err.detail : "Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      show("Enter the 6-digit code", undefined, "error");
      return;
    }
    setSubmitting(true);
    try {
      const verifyRes = await api.post<{
        verified: boolean;
        account_exists: boolean;
        registration_token: string;
      }>("/api/auth/verify-otp", { phone_number: phoneNumber, code: otp });

      if (verifyRes.account_exists) {
        const loginRes = await api.post<{ access_token: string; user: any }>("/api/auth/login", {
          registration_token: verifyRes.registration_token,
          phone_number: phoneNumber,
        });
        setSession(loginRes.access_token, loginRes.user);
        show("Welcome back!", undefined, "success");
        router.push("/");
      } else {
        sessionStorage.setItem("signal_clone_reg_token", verifyRes.registration_token);
        sessionStorage.setItem("signal_clone_phone", phoneNumber);
        router.push("/onboarding");
      }
    } catch (err) {
      show("Verification failed", err instanceof ApiError ? err.detail : "Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-signal-bg-secondary px-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-signal-blue flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Lock className="text-white" size={30} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold text-signal-text-primary">Signal Clone</h1>
          <p className="text-signal-text-secondary text-sm mt-1">Privacy-focused messaging, simulated for demo</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-signal-border p-7">
          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit}>
              <h2 className="text-lg font-semibold text-signal-text-primary mb-1">Enter your phone number</h2>
              <p className="text-sm text-signal-text-secondary mb-5">
                We'll send a verification code. No real SMS is sent — this is a mocked OTP for demo purposes.
              </p>
              <div className="flex gap-2 mb-5">
                <div className="flex items-center justify-center px-3 rounded-lg border border-signal-border bg-signal-bg-secondary text-signal-text-primary font-medium text-sm">
                  {COUNTRY_CODE}
                </div>
                <input
                  type="tel"
                  autoFocus
                  inputMode="numeric"
                  placeholder="555 000 1234"
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none text-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-signal-blue hover:bg-signal-blue-dark text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? "Sending\u2026" : "Send code"}
                {!submitting && <ArrowRight size={16} />}
              </button>

              <div className="mt-6 pt-5 border-t border-signal-border">
                <p className="text-xs text-signal-text-tertiary text-center mb-2">Quick demo logins</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {["5550001", "5550002", "5550003", "5550004", "5550005", "5550006"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRawPhone(n)}
                      className="text-xs px-2 py-1 rounded-md bg-signal-bg-secondary hover:bg-signal-bg-tertiary text-signal-text-secondary transition-colors"
                    >
                      +1{n}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit}>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="flex items-center gap-1 text-sm text-signal-text-secondary hover:text-signal-text-primary mb-4 transition-colors"
              >
                <ArrowLeft size={15} /> Change number
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} className="text-signal-blue" />
                <h2 className="text-lg font-semibold text-signal-text-primary">Enter verification code</h2>
              </div>
              <p className="text-sm text-signal-text-secondary mb-1">
                Sent to <span className="font-medium text-signal-text-primary">{phoneNumber}</span>
              </p>
              {demoOtp && (
                <p className="text-xs text-signal-blue bg-signal-blue-tint inline-block px-2 py-1 rounded-md mt-2 mb-4">
                  Demo hint: your code is <span className="font-semibold">{demoOtp}</span>
                </p>
              )}
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full text-center text-2xl tracking-[0.4em] font-medium px-3 py-3 rounded-lg border border-signal-border focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/20 outline-none mb-5 mt-4 transition-all"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-signal-blue hover:bg-signal-blue-dark text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? "Verifying\u2026" : "Verify"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-signal-text-tertiary mt-6">
          This is a clone built for demonstration. No real verification or encryption is performed.
        </p>
      </div>
    </div>
  );
}
