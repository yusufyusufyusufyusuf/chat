import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import PartySocket from "partysocket";
import type {
  ChatMessage,
  SystemMessage,
  ServerMessage,
} from "../shared/types";
import { MessageBubble } from "./MessageBubble";
import type { Room } from "./App";

type DisplayMessage = ChatMessage | SystemMessage;

interface ChatRoomProps {
  room: Room;
  username: string;
  userId: string;
  onLeave: () => void;
}

const TYPING_DEBOUNCE = 1500; // ms before "stopped typing"

export function ChatRoom({ room, username, userId, onLeave }: ChatRoomProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typers, setTypers] = useState<Map<string, string>>(new Map()); // userId -> username

  const socketRef = useRef<PartySocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typers.size]);

  // Connect / reconnect when room changes
  useEffect(() => {
    const socket = new PartySocket({
      host: window.location.host,
      room: room.id,
      party: "chat",
    });

    socketRef.current = socket;
    setMessages([]);
    setConnected(false);
    setTypers(new Map());

    socket.addEventListener("open", () => setConnected(true));
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("error", () => setConnected(false));

    socket.addEventListener("message", (evt) => {
      const msg: ServerMessage = JSON.parse(evt.data);

      if (msg.type === "history") {
        setMessages(msg.messages);
        return;
      }

      if (msg.type === "online") {
        setOnlineCount(msg.count);
        return;
      }

      if (msg.type === "typing") {
        setTypers((prev) => {
          const next = new Map(prev);
          if (msg.isTyping) {
            next.set(msg.userId, msg.username);
          } else {
            next.delete(msg.userId);
          }
          return next;
        });
        return;
      }

      if (msg.type === "message" || msg.type === "system") {
        setMessages((prev) => {
          // Deduplicate by id
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Remove from typers when message arrives
        if (msg.type === "message") {
          setTypers((prev) => {
            const next = new Map(prev);
            next.delete((msg as ChatMessage).userId);
            return next;
          });
        }
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [room.id]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      socketRef.current?.send(
        JSON.stringify({ type: "typing", userId, username, isTyping })
      );
    },
    [userId, username]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(true);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTyping(false);
      }, TYPING_DEBOUNCE);
    },
    [sendTyping]
  );

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.send(
      JSON.stringify({ type: "message", text, username, userId })
    );

    setInput("");

    // Stop typing indicator immediately
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
    }
  }, [input, username, userId, sendTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const typerNames = [...typers.entries()]
    .filter(([uid]) => uid !== userId)
    .map(([, name]) => name);

  const typingLabel =
    typerNames.length === 1
      ? `${typerNames[0]} is typing…`
      : typerNames.length === 2
      ? `${typerNames[0]} and ${typerNames[1]} are typing…`
      : typerNames.length > 2
      ? `${typerNames.length} people are typing…`
      : "";

  return (
    <div className="chat-room">
      {/* Header */}
      <header className="room-header">
        <div className="room-header-left">
          <span
            className="room-header-dot"
            style={{ background: room.color }}
          />
          <span className="room-header-name">{room.name}</span>
          <span
            className={`conn-badge ${connected ? "conn-on" : "conn-off"}`}
            title={connected ? "Connected" : "Reconnecting…"}
          >
            {connected ? "live" : "…"}
          </span>
        </div>
        <div className="room-header-right">
          <span className="online-count">
            <span className="online-dot" /> {onlineCount} online
          </span>
          <button className="leave-btn" onClick={onLeave} title="Leave room">
            ✕
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 && connected && (
          <div className="empty-state">
            No messages yet. Say hello 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showAvatar =
            msg.type === "system" ||
            (msg as ChatMessage).userId !== (prev as ChatMessage | undefined)?.userId ||
            msg.at - (prev?.at ?? 0) > 60_000;

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isSelf={
                msg.type === "message" && (msg as ChatMessage).userId === userId
              }
              showAvatar={showAvatar}
            />
          );
        })}

        {/* Typing indicator */}
        {typingLabel && (
          <div className="typing-indicator">
            <span className="typing-dots">
              <span /><span /><span />
            </span>
            <span className="typing-label">{typingLabel}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        <textarea
          className="msg-input"
          placeholder={`Message ${room.name}  (Enter to send, Shift+Enter for newline)`}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={2000}
          disabled={!connected}
        />
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
