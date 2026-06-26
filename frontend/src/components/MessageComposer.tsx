"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from "react";
import { Send, Smile, Paperclip } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
}

const EMOJI_SHORTCUTS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}", "\u{1F389}", "\u{1F525}"];

export function MessageComposer({ onSend, onTypingStart, onTypingStop, disabled }: Props) {
  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (e.target.value.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart();
      }
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStop();
      }, 2000);
    } else {
      stopTyping();
    }
  }

  function stopTyping() {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    stopTyping();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-signal-border bg-white px-4 py-3 shrink-0 relative">
      {showEmoji && (
        <div className="absolute bottom-full left-4 mb-2 bg-white border border-signal-border rounded-xl shadow-lg p-2 flex gap-1 fade-in">
          {EMOJI_SHORTCUTS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setValue((v) => v + e);
                setShowEmoji(false);
                textareaRef.current?.focus();
              }}
              className="text-xl hover:bg-signal-bg-secondary rounded-lg p-1.5 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors shrink-0"
          aria-label="Emoji"
          type="button"
        >
          <Smile size={21} />
        </button>
        <button
          className="p-2 rounded-full hover:bg-signal-bg-secondary text-signal-text-secondary transition-colors shrink-0"
          aria-label="Attach file"
          type="button"
          onClick={() => setShowEmoji(false)}
          title="Attachments coming soon"
        >
          <Paperclip size={20} />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder={disabled ? "You can't message this conversation" : "Type a message"}
          disabled={disabled}
          className="flex-1 resize-none bg-signal-bg-secondary rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-signal-blue/30 transition-all max-h-[120px] leading-snug disabled:opacity-60"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="p-2.5 rounded-full bg-signal-blue hover:bg-signal-blue-dark disabled:opacity-40 disabled:hover:bg-signal-blue text-white transition-colors shrink-0"
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
