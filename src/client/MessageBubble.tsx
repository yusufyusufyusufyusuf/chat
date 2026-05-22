import React from "react";
import type { ChatMessage, SystemMessage } from "../shared/types";

interface Props {
  msg: ChatMessage | SystemMessage;
  isSelf: boolean;
  showAvatar: boolean;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getColor(userId: string) {
  const colors = [
    "#6366f1", "#ec4899", "#f59e0b", "#10b981",
    "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

export function MessageBubble({ msg, isSelf, showAvatar }: Props) {
  if (msg.type === "system") {
    return (
      <div className="system-msg">
        <span>{msg.text}</span>
        <span className="msg-time">{formatTime(msg.at)}</span>
      </div>
    );
  }

  const color = getColor(msg.userId);
  const initial = msg.username[0]?.toUpperCase() ?? "?";

  return (
    <div className={`msg-row ${isSelf ? "self" : "other"}`}>
      {!isSelf && (
        <div
          className="avatar"
          style={{
            background: color,
            visibility: showAvatar ? "visible" : "hidden",
          }}
        >
          {initial}
        </div>
      )}

      <div className="bubble-group">
        {showAvatar && !isSelf && (
          <div className="bubble-username" style={{ color }}>
            {msg.username}
          </div>
        )}
        <div className={`bubble ${isSelf ? "bubble-self" : "bubble-other"}`}>
          {msg.text}
        </div>
        <div className={`msg-time ${isSelf ? "time-right" : "time-left"}`}>
          {formatTime(msg.at)}
        </div>
      </div>

      {isSelf && (
        <div
          className="avatar avatar-self"
          style={{
            background: "#6366f1",
            visibility: showAvatar ? "visible" : "hidden",
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
