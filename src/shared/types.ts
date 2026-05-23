// ── Users ─────────────────────────────────────────────────────────────────────

export type UserStatus = "online" | "idle" | "dnd" | "offline";

export type User = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerColor: string;
  bio: string;
  isNitro: boolean;
  badges: string[];
  createdAt: number;
  status?: UserStatus;
};

export type AuthUser = User & { token: string };

// ── Servers ───────────────────────────────────────────────────────────────────

export type Server = {
  serverId: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  ownerId: string;
  inviteCode: string;
  boostCount: number;
  theme: string | null;
  createdAt: number;
};

export type ServerMember = {
  userId: string;
  serverId: string;
  role: "owner" | "admin" | "moderator" | "member";
  nickname: string | null;
  joinedAt: number;
};

// ── Channels ──────────────────────────────────────────────────────────────────

export type Channel = {
  channelId: string;
  serverId: string;
  name: string;
  type: "text" | "voice" | "announcement";
  category: string;
  position: number;
  topic: string | null;
};

// ── Messages ──────────────────────────────────────────────────────────────────

export type ChatMessage = {
  type: "message";
  id: string;
  channelId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isNitro: boolean;
  text: string;
  attachments: string[];
  reactions: Record<string, string[]>;
  editedAt: number | null;
  at: number;
};

export type SystemMessage = {
  type: "system";
  id: string;
  text: string;
  at: number;
};

// ── WebSocket events (server → client) ───────────────────────────────────────

export type TypingEvent     = { type: "typing";      userId: string; username: string; isTyping: boolean };
export type OnlineEvent     = { type: "online";       count: number; users: { userId: string; username: string; avatarUrl: string | null }[] };
export type HistoryEvent    = { type: "history";      messages: (ChatMessage | SystemMessage)[] };
export type ReactionEvent   = { type: "reaction";     messageId: string; emoji: string; userId: string; action: "add" | "remove" };
export type VoiceJoinEvent  = { type: "voice_join";   userId: string; username: string; channelId: string };
export type VoiceLeaveEvent = { type: "voice_leave";  userId: string; channelId: string };
export type VoiceStateEvent = { type: "voice_state";  channelId: string; users: { userId: string; username: string }[] };
export type SignalEvent     = { type: "signal";       from: string; to: string; data: unknown };

export type ServerEvent =
  | ChatMessage | SystemMessage
  | TypingEvent | OnlineEvent | HistoryEvent
  | ReactionEvent
  | VoiceJoinEvent | VoiceLeaveEvent | VoiceStateEvent
  | SignalEvent;

// ── WebSocket events (client → server) ───────────────────────────────────────

export type ClientSendMessage  = { type: "message";     text: string; userId: string; username: string; displayName: string; avatarUrl: string | null; isNitro: boolean; attachments?: string[] };
export type ClientTyping       = { type: "typing";      userId: string; username: string; isTyping: boolean };
export type ClientReaction     = { type: "reaction";    messageId: string; emoji: string; userId: string; action: "add" | "remove" };
export type ClientSignal       = { type: "signal";      from: string; to: string; data: unknown };
export type ClientVoiceJoin    = { type: "voice_join";  userId: string; username: string; channelId: string };
export type ClientVoiceLeave   = { type: "voice_leave"; userId: string; channelId: string };

export type ClientEvent =
  | ClientSendMessage | ClientTyping | ClientReaction
  | ClientSignal | ClientVoiceJoin | ClientVoiceLeave;

// ── DM ────────────────────────────────────────────────────────────────────────

export type DMConversation = {
  dmId: string;
  participants: string[];
};
