import React, { useEffect, useRef } from "react";
import type { ChatMessage, SystemMessage } from "../shared/types";

type Msg = ChatMessage | SystemMessage;

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDate(at: number) {
  const d = new Date(at), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today at " + formatTime(at);
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday at " + formatTime(at);
  return d.toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" }) + " " + formatTime(at);
}
function isSameGroup(a: Msg, b: Msg) {
  if (a.type==="system"||b.type==="system") return false;
  return (a as ChatMessage).userId===(b as ChatMessage).userId && b.at-a.at<300_000;
}

const COMMON_EMOJI = ["👍","❤️","😂","🎉","😮","😢","🔥","✅"];

interface Props {
  messages: Msg[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string, action: "add"|"remove") => void;
  onAvatarClick: (userId: string, el: HTMLElement) => void;
}

export function MessageList({ messages, currentUserId, onReact, onAvatarClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = React.useState<string | null>(null); // messageId with open picker

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="messages-area" onClick={() => setPicker(null)}>
      {messages.map((msg, i) => {
        const prev = messages[i-1];
        const isGrouped = prev ? isSameGroup(prev, msg) : false;

        if (msg.type === "system") {
          return <div key={msg.id} className="system-msg"><span>{msg.text}</span><span style={{fontSize:11,color:"var(--text-muted)",marginLeft:8}}>{formatTime(msg.at)}</span></div>;
        }

        const m = msg as ChatMessage;
        const isSelf = m.userId === currentUserId;
        const userReactions = Object.entries(m.reactions).map(([emoji, users]) => ({ emoji, users, reacted: users.includes(currentUserId) }));

        return (
          <div key={m.id} className="msg-group" style={{ marginTop: isGrouped ? 0 : 16 }}>
            <div className="msg-avatar-col">
              {!isGrouped ? (
                <div
                  className="msg-avatar"
                  onClick={e => onAvatarClick(m.userId, e.currentTarget as HTMLElement)}
                >
                  {m.avatarUrl ? <img src={m.avatarUrl} alt={m.username} /> : m.displayName[0]?.toUpperCase()}
                </div>
              ) : (
                <div className="msg-avatar-spacer" />
              )}
            </div>

            <div className="msg-content-col">
              {!isGrouped && (
                <div className="msg-header">
                  <span className={`msg-author ${m.isNitro ? "is-nitro" : ""}`} onClick={e => onAvatarClick(m.userId, e.currentTarget as HTMLElement)}>
                    {m.displayName}
                    {m.isNitro && <span style={{ fontSize: 14, marginLeft: 4 }}>✨</span>}
                  </span>
                  <span className="msg-timestamp">{formatDate(m.at)}</span>
                </div>
              )}

              <div style={{ position: "relative" }}>
                <div className="msg-text">
                  {m.text}
                  {m.editedAt && <span className="msg-edited">(edited)</span>}
                </div>

                {/* Hover actions */}
                <div className="msg-actions" onClick={e => e.stopPropagation()}>
                  <button className="msg-action-btn" title="Add reaction" onClick={e => { e.stopPropagation(); setPicker(p => p===m.id ? null : m.id); }}>😀</button>
                </div>

                {/* Emoji picker */}
                {picker === m.id && (
                  <div style={{ position:"absolute", right:0, top:32, background:"var(--bg-mid)", border:"1px solid var(--border)", borderRadius:8, padding:8, display:"flex", gap:6, zIndex:20 }} onClick={e=>e.stopPropagation()}>
                    {COMMON_EMOJI.map(e => (
                      <button key={e} style={{ fontSize:20, padding:"2px 4px", borderRadius:4 }}
                        onClick={() => { const reacted=m.reactions[e]?.includes(currentUserId); onReact(m.id, e, reacted?"remove":"add"); setPicker(null); }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reactions */}
              {userReactions.length > 0 && (
                <div className="msg-reactions">
                  {userReactions.map(({ emoji, users, reacted }) => (
                    <button key={emoji} className={`reaction-pill ${reacted ? "reacted" : ""}`}
                      onClick={() => onReact(m.id, emoji, reacted ? "remove" : "add")}>
                      {emoji} <span className="reaction-count">{users.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
