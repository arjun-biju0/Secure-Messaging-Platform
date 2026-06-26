"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/store";
import { useSignalSocket } from "@/hooks/useSignalSocket";
import { Sidebar } from "@/components/Sidebar";
import { useToast } from "@/components/Toast";
import { MessageCircle } from "lucide-react";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("signal_clone_token");
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading, logout } = useAuth();
  const applyWsEvent = useChatStore((s) => s.applyWsEvent);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const { show } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);

  const activeConversationId = params?.id ? Number(params.id) : null;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    setToken(getToken());
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConversations()
      .then(() => setConversationsLoaded(true))
      .catch(() => show("Couldn't load conversations", "Check your connection and try again.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { connected } = useSignalSocket({
    token,
    onEvent: (event) => {
      applyWsEvent(event);
      if (event.type === "message:new" && event.payload.sender_id !== user?.id) {
        if (event.payload.conversation_id !== activeConversationId) {
          const senderName = event.payload.sender?.display_name?.split(" ")[0] || "Someone";
          if (event.payload.type !== "system") {
            show(senderName, event.payload.content, "info");
          }
        }
      }
    },
  });

  if (isLoading || !user || !conversationsLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-signal-bg-secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-signal-blue border-t-transparent animate-spin" />
          <p className="text-sm text-signal-text-secondary">Loading Signal Clone\u2026</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-white">
      <div className={`w-full md:w-[380px] shrink-0 h-full ${activeConversationId ? "hidden md:block" : "block"}`}>
        <Sidebar activeConversationId={activeConversationId} />
      </div>
      <div className={`flex-1 h-full ${activeConversationId ? "block" : "hidden md:block"}`}>
        {activeConversationId ? (
          children
        ) : (
          <EmptyState />
        )}
      </div>
      {!connected && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-full shadow-sm z-40">
          Reconnecting\u2026
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-signal-bg-secondary text-center px-8">
      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-5 shadow-sm">
        <MessageCircle size={36} className="text-signal-blue" strokeWidth={1.6} />
      </div>
      <h2 className="text-lg font-medium text-signal-text-primary mb-1.5">Select a conversation</h2>
      <p className="text-sm text-signal-text-secondary max-w-xs">
        Choose an existing chat from the list, or start a new conversation using the pencil icon.
      </p>
    </div>
  );
}
