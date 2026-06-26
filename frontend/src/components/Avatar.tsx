"use client";

import { Users } from "lucide-react";
import { getInitials, cx } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  color?: string;
  size?: number;
  isGroup?: boolean;
  className?: string;
  showOnlineDot?: boolean;
  isOnline?: boolean;
}

export function Avatar({
  name,
  avatarUrl,
  color = "#3a76f0",
  size = 40,
  isGroup = false,
  className,
  showOnlineDot = false,
  isOnline = false,
}: AvatarProps) {
  const resolvedUrl = avatarUrl
    ? avatarUrl.startsWith("http")
      ? avatarUrl
      : `${API_BASE}${avatarUrl}`
    : null;

  return (
    <div className={cx("relative shrink-0", className)} style={{ width: size, height: size }}>
      {resolvedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedUrl}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover w-full h-full"
        />
      ) : (
        <div
          className="rounded-full w-full h-full flex items-center justify-center text-white font-medium select-none"
          style={{ backgroundColor: color, fontSize: size * 0.4 }}
        >
          {isGroup ? <Users size={size * 0.5} strokeWidth={2} /> : getInitials(name || "?")}
        </div>
      )}
      {showOnlineDot && isOnline && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-signal-online border-2 border-white"
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </div>
  );
}
