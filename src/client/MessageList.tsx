import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage, SystemMessage } from "../shared/types";

type Msg = ChatMessage | SystemMessage;

function formatTimestamp(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullDate(at: number) {
  const d = new Date(at), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today at " + formatTimestamp(at);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday at " + formatTimestamp(at);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " " + formatTimestamp(at);
}

function isSameGroup(a: Msg, b: Msg) {
  if (a.type === "system" || b.type === "system") return false;
  const ca = a as ChatMessage, cb = b as ChatMessage;
  return ca.userId === cb.userId && cb.at - ca.at < 420_000; // 7 minutes
}

function isSameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🔥", "✅", "👀", "💯"];

interface AvatarProps {
  displayName: string;
  avatarUrl: string | null;
  bannerColor?: string;
  size?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

function Avatar({ displayName, avatarUrl, bannerColor = "#5865f2", size = 40, onClick }: AvatarProps) {
  return (
    <div
      className="msg-avatar"
      style={{ width: size, height: size, background: bannerColor, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : displayName?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

interface Props {
  messages: Msg[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string, action: "add" | "remove") => void;
  onAvatarClick: (userId: string, el: HTMLElement) => void;
}

export function MessageList({ messages, currentUserId, onReact, onAvatarClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleContainerClick = () => setOpenPicker(null);

  return (
    <div className="messages-area" onClick={handleContainerClick}>
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const grouped = !!prev && isSameGroup(prev, msg);
        const showDateDiv = !prev || !isSameDay((prev as ChatMessage).at ?? 0, (msg as ChatMessage).at ?? 0);

        if (msg.type === "system") {
          return (
            <div key={msg.id} className="system-msg">
              <div className="system-msg-line" />
              <span style={{ whiteSpace: "nowrap" }}>{msg.text}</span>
              <div className="system-msg-line" />
            </div>
          );
        }

        const m = msg as ChatMessage;
        const reactions = Object.entries(m.reactions).map(([emoji, users]) => ({
          emoji, users, reacted: users.includes(currentUserId),
        }));

        return (
          <React.Fragment key={m.id}>
            {showDateDiv && (
              <div className="system-msg" style={{ marginTop: 16, marginBottom: 4 }}>
                <div className="system-msg-line" />
                <span style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 600 }}>
                  {formatFullDate(m.at)}
                </span>
                <div className="system-msg-line" />
              </div>
            )}

            <div className={`msg-group ${grouped ? "msg-group--continuation" : ""}`} style={{ paddingTop: grouped ? 2 : 18 }}>
              {/* Message hover actions */}
              <div className="msg-actions" onClick={e => e.stopPropagation()}>
                <button
                  className="msg-action-btn"
                  title="Add reaction"
                  onClick={e => { e.stopPropagation(); setOpenPicker(p => p === m.id ? null : m.id); }}
                >
                  😀
                </button>

                {/* Emoji picker */}
                {openPicker === m.id && (
                  <div className="emoji-picker" onClick={e => e.stopPropagation()}>
                    {QUICK_EMOJI.map(em => (
                      <button
                        key={em}
                        className="emoji-picker-btn"
                        onClick={() => {
                          const alreadyReacted = m.reactions[em]?.includes(currentUserId);
                          onReact(m.id, em, alreadyReacted ? "remove" : "add");
                          setOpenPicker(null);
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Avatar column */}
              <div className="msg-avatar-col">
                {grouped
                  ? <div className="msg-timestamp-inline">{formatTimestamp(m.at)}</div>
                  : <Avatar
                      displayName={m.displayName}
                      avatarUrl={m.avatarUrl}
                      onClick={e => onAvatarClick(m.userId, e.currentTarget as HTMLElement)}
                    />
                }
              </div>

              {/* Content */}
              <div className="msg-content-col">
                {!grouped && (
                  <div className="msg-header">
                    <span
                      className={`msg-author ${m.isNitro ? "msg-author--nitro" : ""}`}
                      onClick={e => onAvatarClick(m.userId, e.currentTarget as HTMLElement)}
                    >
                      {m.displayName}
                      {m.isNitro && <span style={{ fontSize: 13, marginLeft: 4 }}>✨</span>}
                    </span>
                    <span className="msg-timestamp">{formatFullDate(m.at)}</span>
                  </div>
                )}

                <div className="msg-body">
                  {m.text}
                  {m.editedAt && <span className="msg-edited">(edited)</span>}
                </div>

                {reactions.length > 0 && (
                  <div className="msg-reactions">
                    {reactions.map(({ emoji, users, reacted }) => (
                      <button
                        key={emoji}
                        className={`reaction-pill ${reacted ? "reaction-pill--reacted" : ""}`}
                        onClick={() => onReact(m.id, emoji, reacted ? "remove" : "add")}
                        title={users.join(", ")}
                      >
                        {emoji}
                        <span className="reaction-count">{users.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} style={{ height: 8 }} />
    </div>
  );
}
