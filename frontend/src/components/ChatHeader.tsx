"use client";

import { useState } from "react";
import { Phone, Video, Info, ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useChatStore } from "@/lib/store";
import { formatLastSeen, cx } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { ComingSoonModal } from "@/components/ComingSoonModal";

const EMPTY_TYPING: number[] = [];

interface Props {
  conversation: Conversation;
  onOpenInfo: () => void;
  onBack?: () => void;
}

export function ChatHeader({ conversation, onOpenInfo, onBack }: Props) {
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const typingUserIds = useChatStore((s) => s.typingByConversation[conversation.id] ?? EMPTY_TYPING);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const isDirect = conversation.type === "direct";
  const isOnline = isDirect && conversation.other_user ? onlineUserIds.has(conversation.other_user.id) : false;

  let subtitle: string;
  if (typingUserIds.length > 0) {
    subtitle = isDirect ? "Typing\u2026" : "Typing\u2026";
  } else if (isDirect && conversation.other_user) {
    subtitle = isOnline ? "Online" : formatLastSeen(conversation.other_user.last_seen_at);
  } else {
    subtitle = `${conversation.participants.length} members`;
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-signal-border bg-white shrink-0">
        <button
          onClick={onOpenInfo}
          className="flex items-center gap-3 min-w-0 hover:bg-signal-bg-secondary rounded-lg px-2 py-1 -ml-2 transition-colors"
        >
          {onBack && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              className="md:hidden -ml-1 mr-0.5 p-1 text-signal-text-secondary"
            >
              <ArrowLeft size={20} />
            </span>
          )}
          <Avatar
            name={conversation.name || "Unknown"}
            avatarUrl={conversation.avatar_url}
            color={conversation.avatar_color}
            size={38}
            isGroup={conversation.type === "group"}
            showOnlineDot={isDirect}
            isOnline={isOnline}
          />
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-signal-text-primary truncate">{conversation.name}</p>
            <p className={cx("text-xs truncate", typingUserIds.length > 0 ? "text-signal-blue font-medium" : "text-signal-text-secondary")}>
              {subtitle}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setComingSoon("Voice calls")}
            className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors"
            aria-label="Voice call"
          >
            <Phone size={19} />
          </button>
          <button
            onClick={() => setComingSoon("Video calls")}
            className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors"
            aria-label="Video call"
          >
            <Video size={20} />
          </button>
          <button
            onClick={onOpenInfo}
            className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors"
            aria-label="Conversation info"
          >
            <Info size={19} />
          </button>
        </div>
      </div>
      <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />
    </>
  );
}
