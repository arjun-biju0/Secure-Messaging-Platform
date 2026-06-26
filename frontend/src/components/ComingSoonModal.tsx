"use client";

import { Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";

const COPY: Record<string, string> = {
  "Voice calls": "Voice calling isn't implemented in this demo. In a real Signal client, this would start an end-to-end encrypted call.",
  "Video calls": "Video calling isn't implemented in this demo. In a real Signal client, this would start an end-to-end encrypted video call.",
  "Stories": "Stories aren't implemented in this demo build.",
  "Linked devices": "Multi-device linking isn't implemented in this demo build.",
};

export function ComingSoonModal({ feature, onClose }: { feature: string | null; onClose: () => void }) {
  return (
    <Modal open={!!feature} onClose={onClose} title={feature || ""} maxWidth="max-w-sm">
      <div className="p-6 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-signal-blue-tint flex items-center justify-center mb-4">
          <Sparkles className="text-signal-blue" size={24} />
        </div>
        <h3 className="font-semibold text-signal-text-primary mb-1">Coming soon</h3>
        <p className="text-sm text-signal-text-secondary">
          {feature ? COPY[feature] || `${feature} isn't implemented in this demo build.` : ""}
        </p>
      </div>
    </Modal>
  );
}
