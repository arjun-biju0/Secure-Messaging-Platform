// Types mirroring the FastAPI backend's Pydantic schemas.
// Keeping these in sync manually is fine at this project's scale -
// see backend/app/schemas/*.py for the source of truth.

export interface UserPublic {
  id: number;
  display_name: string;
  username: string | null;
  phone_number: string;
  avatar_url: string | null;
  avatar_color: string;
  about: string | null;
  is_online: boolean;
  last_seen_at: string;
}

export interface UserFull extends UserPublic {}

export interface MessageStatusEntry {
  user_id: number;
  status: "sent" | "delivered" | "read";
  updated_at: string;
}

export type MessageType = "text" | "system";

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender: UserPublic | null;
  type: MessageType;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  client_id: string | null;
  aggregate_status: "sent" | "delivered" | "read" | null;
  statuses: MessageStatusEntry[];
  // Client-only field used for optimistic sending before server ack
  _pending?: boolean;
  _failed?: boolean;
}

export type ConversationType = "direct" | "group";

export interface Participant {
  user: UserPublic;
  role: "member" | "admin";
  joined_at: string;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  avatar_color: string;
  description: string | null;
  created_at: string;
  last_activity_at: string;
  last_message: Message | null;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  participants: Participant[];
  other_user: UserPublic | null;
  typing_user_ids: number[];
}

export interface Contact {
  id: number;
  nickname: string | null;
  created_at: string;
  user: UserPublic;
}

export interface MessagePage {
  messages: Message[];
  has_more: boolean;
}

// ---- WebSocket event payloads ----

export type WsEvent =
  | { type: "message:new"; payload: Message }
  | { type: "message:status"; payload: Message }
  | { type: "conversation:new"; payload: Conversation }
  | { type: "conversation:updated"; payload: Conversation }
  | { type: "conversation:removed"; payload: { conversation_id: number } }
  | { type: "presence:update"; payload: { user_id: number; is_online: boolean; last_seen_at?: string } }
  | { type: "typing:update"; payload: { conversation_id: number; user_id: number; is_typing: boolean } }
  | { type: "pong"; payload?: undefined };
