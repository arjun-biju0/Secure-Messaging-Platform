"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-signal-bubble-incoming rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-signal-text-tertiary inline-block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-signal-text-tertiary inline-block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-signal-text-tertiary inline-block" />
      </div>
    </div>
  );
}
