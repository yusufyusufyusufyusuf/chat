// Shared message types — imported by both client and server

export type ChatMessage = {
  type: "message";
  id: string;
  userId: string;
  username: string;
  text: string;
  at: number;
};

export type SystemMessage = {
  type: "system";
  id: string;
  text: string;
  at: number;
};

export type TypingEvent = {
  type: "typing";
  userId: string;
  username: string;
  isTyping: boolean;
};

export type OnlineCountEvent = {
  type: "online";
  count: number;
};

export type HistoryMessage = {
  type: "history";
  messages: (ChatMessage | SystemMessage)[];
};

export type IncomingClientMessage =
  | { type: "message"; text: string; username: string; userId: string }
  | { type: "typing"; username: string; userId: string; isTyping: boolean };

export type ServerMessage =
  | ChatMessage
  | SystemMessage
  | TypingEvent
  | OnlineCountEvent
  | HistoryMessage;
