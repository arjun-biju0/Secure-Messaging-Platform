import { format, isToday, isYesterday, isThisYear } from "date-fns";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "M/d/yy");
}

export function formatMessageTimestamp(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

export function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "EEEE, MMMM d");
  return format(date, "MMMM d, yyyy");
}

export function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `last seen today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `last seen yesterday at ${format(date, "h:mm a")}`;
  return `last seen ${format(date, "MMM d")}`;
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}
