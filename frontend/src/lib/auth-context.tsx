"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import type { UserFull } from "@/lib/types";

interface AuthContextValue {
  user: UserFull | null;
  isLoading: boolean;
  setSession: (token: string, user: UserFull) => void;
  updateUser: (user: UserFull) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("signal_clone_token") : null;
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<UserFull>("/api/auth/me")
      .then((u) => setUser(u))
      .catch(() => {
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setSession = useCallback((token: string, u: UserFull) => {
    setToken(token);
    setUser(u);
  }, []);

  const updateUser = useCallback((u: UserFull) => {
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // best-effort
    }
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, setSession, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
