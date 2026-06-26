"use client";

import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { formatMessageTimestamp, cx } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
  isOwn: boolean;
  showSenderName: boolean;
  showTail: boolean;
}

export function MessageBubble({ message, isOwn, showSenderName, showTail }: Props) {
  if (message.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-signal-text-tertiary bg-signal-bg-secondary px-3 py-1 rounded-full text-center max-w-[80%]">
          {message.content}
        </span>
      </div>
    );
  }

  const isDeleted = !!message.deleted_at;

  return (
    <div className={cx("flex w-full message-pop", isOwn ? "justify-end" : "justify-start")}>
      <div className={cx("max-w-[68%] flex flex-col", isOwn ? "items-end" : "items-start")}>
        {showSenderName && !isOwn && (
          <span
            className="text-xs font-medium px-3 mb-0.5"
            style={{ color: message.sender?.avatar_color || "#3a76f0" }}
          >
            {message.sender?.display_name}
          </span>
        )}
        <div
          className={cx(
            "px-3 py-2 rounded-2xl text-[14.5px] leading-snug break-words whitespace-pre-wrap",
            isOwn
              ? "bg-signal-blue text-white"
              : "bg-signal-bubble-incoming text-signal-text-primary",
            isOwn && showTail ? "rounded-br-md" : "",
            !isOwn && showTail ? "rounded-bl-md" : "",
            isDeleted && "italic opacity-70"
          )}
        >
          {isDeleted ? "This message was deleted" : message.content}
        </div>
        <div className={cx("flex items-center gap-1 mt-0.5 px-1", isOwn ? "flex-row-reverse" : "")}>
          <span className="text-[11px] text-signal-text-tertiary">
            {formatMessageTimestamp(message.created_at)}
          </span>
          {isOwn && <StatusIcon message={message} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ message }: { message: Message }) {
  if (message._failed) {
    return <AlertCircle size={12} className="text-signal-danger" />;
  }
  if (message._pending) {
    return <Clock size={11} className="text-signal-text-tertiary" />;
  }
  const status = message.aggregate_status;
  if (status === "read") return <CheckCheck size={13} className="text-signal-blue" />;
  if (status === "delivered") return <CheckCheck size={13} className="text-signal-text-tertiary" />;
  return <Check size={13} className="text-signal-text-tertiary" />;
}
