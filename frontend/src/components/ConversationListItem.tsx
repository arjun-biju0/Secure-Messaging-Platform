"use client";

import { Check, CheckCheck, BellOff, Pin } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatConversationTimestamp, truncate, cx } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/lib/store";

const EMPTY_TYPING: number[] = [];

interface Props {
  conversation: Conversation;
  isActive: boolean;
  currentUserId: number;
  onClick: () => void;
}

export function ConversationListItem({ conversation, isActive, currentUserId, onClick }: Props) {
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const typingMap = useChatStore((s) => s.typingByConversation[conversation.id] ?? EMPTY_TYPING);

  const name = conversation.name || "Unknown";
  const isOnline = conversation.other_user ? onlineUserIds.has(conversation.other_user.id) : false;
  const isTyping = typingMap.length > 0;

  const lastMessage = conversation.last_message;
  const isOwnLastMessage = lastMessage?.sender_id === currentUserId;

  let preview = "No messages yet";
  if (isTyping) {
    preview = conversation.type === "group" ? "Someone is typing\u2026" : "Typing\u2026";
  } else if (lastMessage) {
    if (lastMessage.type === "system") {
      preview = lastMessage.content;
    } else {
      const prefix = conversation.type === "group" && !isOwnLastMessage && lastMessage.sender
        ? `${lastMessage.sender.display_name.split(" ")[0]}: `
        : isOwnLastMessage
          ? "You: "
          : "";
      preview = `${prefix}${lastMessage.content}`;
    }
  }

  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group",
        isActive ? "bg-signal-blue-tint" : "hover:bg-signal-bg-secondary"
      )}
    >
      <Avatar
        name={name}
        avatarUrl={conversation.avatar_url}
        color={conversation.avatar_color}
        size={48}
        isGroup={conversation.type === "group"}
        showOnlineDot={conversation.type === "direct"}
        isOnline={isOnline}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cx("text-sm truncate", conversation.unread_count > 0 ? "font-semibold text-signal-text-primary" : "font-medium text-signal-text-primary")}>
            {name}
          </p>
          <span className={cx("text-xs shrink-0", conversation.unread_count > 0 ? "text-signal-blue font-medium" : "text-signal-text-tertiary")}>
            {formatConversationTimestamp(conversation.last_activity_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cx(
            "text-[13px] truncate flex items-center gap-1",
            isTyping ? "text-signal-blue font-medium" : conversation.unread_count > 0 ? "text-signal-text-primary" : "text-signal-text-secondary"
          )}>
            {isOwnLastMessage && lastMessage?.type !== "system" && !isTyping && (
              <ReceiptIcon status={lastMessage?.aggregate_status} />
            )}
            <span className="truncate">{truncate(preview, 38)}</span>
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {conversation.is_muted && <BellOff size={13} className="text-signal-text-tertiary" />}
            {conversation.is_pinned && <Pin size={12} className="text-signal-text-tertiary" />}
            {conversation.unread_count > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-signal-blue text-white text-[11px] font-semibold flex items-center justify-center">
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ReceiptIcon({ status }: { status?: string | null }) {
  if (!status) return null;
  if (status === "read") return <CheckCheck size={14} className="text-signal-blue shrink-0" />;
  if (status === "delivered") return <CheckCheck size={14} className="text-signal-text-tertiary shrink-0" />;
  return <Check size={14} className="text-signal-text-tertiary shrink-0" />;
}
