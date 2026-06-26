"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/store";
import { useSignalSocket } from "@/hooks/useSignalSocket";
import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ConversationInfoPanel } from "@/components/ConversationInfoPanel";
import { formatDayDivider } from "@/lib/utils";
import type { Message } from "@/lib/types";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("signal_clone_token");
}

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_TYPING: number[] = [];

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = Number(params.id);
  const { user } = useAuth();

  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === conversationId));
  const messages = useChatStore((s) => s.messagesByConversation[conversationId] ?? EMPTY_MESSAGES);
  const hasMore = useChatStore((s) => s.hasMoreByConversation[conversationId] ?? false);
  const typingUserIds = useChatStore((s) => s.typingByConversation[conversationId] ?? EMPTY_TYPING);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markRead = useChatStore((s) => s.markRead);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const token = getToken();
  const lastReadSentinel = useRef<number | null>(null);

  const { send } = useSignalSocket({ token, onEvent: () => {} });

  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  useEffect(() => {
    setLoadingHistory(true);
    loadMessages(conversationId).finally(() => setLoadingHistory(false));
  }, [conversationId, loadMessages]);

  // Mark read whenever new messages arrive for this open conversation
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.id === lastReadSentinel.current) return;
    if (lastMsg.sender_id !== user?.id) {
      lastReadSentinel.current = lastMsg.id;
      markRead(conversationId);
    }
  }, [messages, conversationId, markRead, user?.id]);

  // Auto-scroll to bottom on new message / conversation switch
  useEffect(() => {
    if (!loadingHistory) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [conversationId, loadingHistory]);

  const prevLastIdRef = useRef<number | null>(null);
  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (lastId !== prevLastIdRef.current) {
      prevLastIdRef.current = lastId;
      const el = scrollRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 300) {
          requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
        }
      }
    }
  }, [messages]);

  const handleScroll = useCallback(async () => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 80) {
      setLoadingMore(true);
      const firstId = messages[0]?.id;
      const prevHeight = el.scrollHeight;
      await loadMessages(conversationId, firstId);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
        }
      });
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadMessages, loadingMore, messages]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(conversationId, text);
    },
    [conversationId, sendMessage]
  );

  const handleTypingStart = useCallback(() => {
    send({ type: "typing:start", conversation_id: conversationId });
  }, [send, conversationId]);

  const handleTypingStop = useCallback(() => {
    send({ type: "typing:stop", conversation_id: conversationId });
  }, [send, conversationId]);

  // Group messages with day dividers + consecutive-sender bubble grouping
  const renderItems = useMemo(() => {
    const items: Array<{ kind: "divider"; date: string } | { kind: "message"; message: typeof messages[number]; showSenderName: boolean; showTail: boolean }> = [];
    let lastDate: string | null = null;
    messages.forEach((m, idx) => {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDate) {
        items.push({ kind: "divider", date: m.created_at });
        lastDate = day;
      }
      const next = messages[idx + 1];
      const isLastInGroup = !next || next.sender_id !== m.sender_id || next.type === "system" || m.type === "system";
      const prev = messages[idx - 1];
      const isFirstInGroup = !prev || prev.sender_id !== m.sender_id || prev.type === "system" || m.type === "system" || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();
      items.push({
        kind: "message",
        message: m,
        showSenderName: isFirstInGroup && conversation?.type === "group",
        showTail: isLastInGroup,
      });
    });
    return items;
  }, [messages, conversation?.type]);

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center text-signal-text-secondary text-sm">
        Conversation not found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        conversation={conversation}
        onOpenInfo={() => setInfoOpen(true)}
        onBack={() => router.push("/")}
      />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto signal-scroll px-4 py-4 bg-signal-bg-secondary flex flex-col gap-1.5"
      >
        {loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full border-2 border-signal-blue border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 rounded-full border-2 border-signal-blue border-t-transparent animate-spin" />
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-sm text-signal-text-tertiary">
                No messages yet. Say hello!
              </div>
            )}
            {renderItems.map((item, idx) =>
              item.kind === "divider" ? (
                <div key={`divider-${idx}`} className="flex justify-center my-3">
                  <span className="text-xs font-medium text-signal-text-tertiary bg-white px-3 py-1 rounded-full shadow-sm">
                    {formatDayDivider(item.date)}
                  </span>
                </div>
              ) : (
                <MessageBubble
                  key={item.message.id ?? item.message.client_id}
                  message={item.message}
                  isOwn={item.message.sender_id === user?.id}
                  showSenderName={item.showSenderName}
                  showTail={item.showTail}
                />
              )
            )}
            {typingUserIds.length > 0 && <TypingIndicator />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <MessageComposer onSend={handleSend} onTypingStart={handleTypingStart} onTypingStop={handleTypingStop} />

      <ConversationInfoPanel
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversation={conversation}
      />
    </div>
  );
}
