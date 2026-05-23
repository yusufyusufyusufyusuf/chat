import React, { useCallback, useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { SettingsPage } from "./SettingsPage";
import { MessageList } from "./MessageList";
import { useChat } from "./useChat";
import * as api from "./api";
import type { AuthUser, Channel, DMConversation, Server, ServerMember } from "../shared/types";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function UserAvatar({
  user, size = 32, status = false,
  onClick,
}: {
  user: Partial<AuthUser>;
  size?: number;
  status?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: size, height: size, borderRadius: "50%",
          background: user.bannerColor ?? "#5865f2",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.42, fontWeight: 700, color: "#fff",
          overflow: "hidden", cursor: onClick ? "pointer" : "default", flexShrink: 0,
        }}
        onClick={onClick}
      >
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (user.displayName ?? user.username ?? "?")[0]?.toUpperCase()}
      </div>
      {status && (
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: Math.max(10, size * 0.32), height: Math.max(10, size * 0.32),
          borderRadius: "50%", background: "var(--status-on)",
          border: "2px solid var(--bg-2)",
        }} />
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {subtitle && <div className="modal-subtitle">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Rail
// ─────────────────────────────────────────────────────────────────────────────

function ServerRail({
  servers, activeServerId, onSelectServer, onSelectHome, onAddServer, onJoinServer,
}: {
  servers: Server[];
  activeServerId: string | null;
  onSelectServer: (id: string) => void;
  onSelectHome: () => void;
  onAddServer: () => void;
  onJoinServer: () => void;
}) {
  return (
    <div className="server-rail">
      {/* Home / DMs button */}
      <div className={`rail-btn-wrap ${!activeServerId ? "rail-btn-wrap--active" : ""}`}>
        <div className="rail-pill" />
        <div
          className={`rail-btn rail-btn--home ${!activeServerId ? "rail-btn--active" : ""}`}
          onClick={onSelectHome}
          title="Direct Messages"
        >
          <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor" style={{ color: activeServerId ? "var(--blurple)" : "#fff" }}>
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
        </div>
        <div className="rail-tooltip">Direct Messages</div>
      </div>

      <div className="rail-sep" />

      {/* Server icons */}
      {servers.map(s => {
        const isActive = s.serverId === activeServerId;
        const initials = s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || s.name[0].toUpperCase();
        return (
          <div key={s.serverId} className={`rail-btn-wrap ${isActive ? "rail-btn-wrap--active" : ""}`}>
            <div className="rail-pill" />
            <div
              className={`rail-btn ${isActive ? "rail-btn--active" : ""}`}
              style={isActive ? { borderRadius: "30%", background: s.theme ?? "var(--blurple)" } : {}}
              onClick={() => onSelectServer(s.serverId)}
              title={s.name}
            >
              {s.iconUrl
                ? <img src={s.iconUrl} alt={s.name} className="rail-btn-img" style={{ borderRadius: "inherit" }} />
                : <span className="rail-btn-icon" style={{ fontSize: 16, color: isActive ? "#fff" : "var(--text-3)" }}>{initials}</span>}
            </div>
            <div className="rail-tooltip">{s.name}</div>
          </div>
        );
      })}

      <div className="rail-sep" />

      {/* Add server */}
      <div className="rail-btn-wrap">
        <div className="rail-pill" />
        <div className="rail-btn rail-btn--add" onClick={onAddServer} title="Create a Server">
          <span className="rail-btn-icon" style={{ fontSize: 28 }}>+</span>
        </div>
        <div className="rail-tooltip">Create a Server</div>
      </div>

      {/* Join server */}
      <div className="rail-btn-wrap">
        <div className="rail-pill" />
        <div className="rail-btn rail-btn--add" style={{ fontSize: 20 }} onClick={onJoinServer} title="Join a Server">
          <span className="rail-btn-icon" style={{ fontSize: 20 }}>🔗</span>
        </div>
        <div className="rail-tooltip">Join a Server</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DM Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function DMSidebar({
  dms, activeDMId, user, userCache, onSelectDM, onSettings,
}: {
  dms: DMConversation[];
  activeDMId: string | null;
  user: AuthUser;
  userCache: Map<string, AuthUser>;
  onSelectDM: (dm: DMConversation, otherId: string) => void;
  onSettings: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = dms.filter(dm => {
    const otherId = dm.participants.find(p => p !== user.userId) ?? dm.participants[0];
    const other = userCache.get(otherId);
    const name = other?.displayName ?? other?.username ?? otherId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="sidebar">
      <div className="dm-header">
        <input
          className="sidebar-search-input"
          placeholder="Find or start a conversation"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "var(--bg-1)", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "none", fontSize: 13, width: "100%" }}
        />
      </div>

      <div className="sidebar-channels">
        <div className="dm-section-label">Direct Messages</div>
        {filtered.map(dm => {
          const otherId = dm.participants.find(p => p !== user.userId) ?? dm.participants[0];
          const other = userCache.get(otherId);
          const name = other?.displayName ?? other?.username ?? otherId.slice(0, 8) + "…";
          const isActive = dm.dmId === activeDMId;
          return (
            <div
              key={dm.dmId}
              className={`dm-item ${isActive ? "dm-item--active" : ""}`}
              onClick={() => onSelectDM(dm, otherId)}
            >
              <div className="dm-avatar">
                <div className="dm-avatar-img" style={{ background: other?.bannerColor ?? "#5865f2" }}>
                  {other?.avatarUrl
                    ? <img src={other.avatarUrl} alt={name} />
                    : name[0]?.toUpperCase()}
                </div>
                <div className="dm-status-dot" />
              </div>
              <div className="dm-info">
                <div className="dm-name">{name}</div>
                <div className="dm-subtext">@{other?.username ?? otherId}</div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: "16px", fontSize: 13, color: "var(--text-3)", textAlign: "center", lineHeight: 1.6 }}>
            No conversations yet.
            <br />Start one from a server member!
          </div>
        )}
      </div>

      <UserPanel user={user} onSettings={onSettings} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function ServerSidebar({
  server, channels, activeChannelId, user,
  onSelectChannel, onCreateChannel, onSettings, onLeaveServer, onInvite,
}: {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  user: AuthUser;
  onSelectChannel: (ch: Channel) => void;
  onCreateChannel: () => void;
  onSettings: () => void;
  onLeaveServer: () => void;
  onInvite: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const categories = [...new Set(channels.map(c => c.category))];
  const isOwner = server.ownerId === user.userId;

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  return (
    <div className="sidebar" style={{ position: "relative" }}>
      {/* Server name header */}
      <div className="sidebar-header" onClick={() => setShowDropdown(d => !d)}>
        <span className="sidebar-header-name">{server.name}</span>
        <span className="sidebar-header-chevron">{showDropdown ? "✕" : "⌄"}</span>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div ref={dropdownRef} className="server-dropdown">
          <div className="dropdown-item" onClick={() => { onInvite(); setShowDropdown(false); }}>
            Invite People
            <span style={{ fontSize: 16 }}>👋</span>
          </div>
          {isOwner && (
            <div className="dropdown-item" onClick={() => { setShowDropdown(false); }}>
              Server Settings
              <span style={{ fontSize: 16 }}>⚙️</span>
            </div>
          )}
          {isOwner && (
            <div className="dropdown-item" onClick={() => { onCreateChannel(); setShowDropdown(false); }}>
              Create Channel
              <span style={{ fontSize: 16 }}>+</span>
            </div>
          )}
          <div className="dropdown-sep" />
          <div
            className={`dropdown-item ${!isOwner ? "dropdown-item--danger" : ""}`}
            onClick={() => { if (!isOwner) { onLeaveServer(); } setShowDropdown(false); }}
            style={isOwner ? { color: "var(--text-3)", cursor: "not-allowed" } : {}}
            title={isOwner ? "Transfer ownership to leave" : ""}
          >
            {isOwner ? "Cannot Leave (Owner)" : "Leave Server"}
            {!isOwner && <span style={{ fontSize: 16 }}>🚪</span>}
          </div>
        </div>
      )}

      {/* Channel list */}
      <div className="sidebar-channels">
        {categories.map(cat => {
          const catChannels = channels.filter(c => c.category === cat);
          const isCollapsed = collapsed.has(cat);
          return (
            <div key={cat}>
              <div className="channel-category" onClick={() => toggleCategory(cat)}>
                <span className={`channel-category-arrow ${isCollapsed ? "channel-category-arrow--collapsed" : ""}`}>▼</span>
                <span className="channel-category-name">{cat}</span>
                {isOwner && (
                  <span
                    className="channel-category-add"
                    title="Create Channel"
                    onClick={e => { e.stopPropagation(); onCreateChannel(); }}
                  >
                    +
                  </span>
                )}
              </div>

              {!isCollapsed && catChannels.map(ch => {
                const isActive = ch.channelId === activeChannelId;
                const icon = ch.type === "voice" ? "🔊" : ch.type === "announcement" ? "📢" : "#";
                return (
                  <div
                    key={ch.channelId}
                    className={`channel-item ${isActive ? "channel-item--active" : ""}`}
                    onClick={() => onSelectChannel(ch)}
                    title={ch.topic ?? ch.name}
                  >
                    <span className="channel-item-icon">{icon}</span>
                    <span className="channel-item-name">{ch.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {channels.length === 0 && (
          <div style={{ padding: "16px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
            No channels yet.
            {isOwner && <><br /><button onClick={onCreateChannel} style={{ color: "var(--blurple)", fontSize: 13, marginTop: 8 }}>+ Create one</button></>}
          </div>
        )}
      </div>

      <UserPanel user={user} onSettings={onSettings} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Panel (bottom of sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function UserPanel({ user, onSettings }: { user: AuthUser; onSettings: () => void }) {
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  return (
    <div className="user-panel">
      <div className="user-panel-avatar" onClick={onSettings}>
        <div className="user-panel-avatar-img" style={{ background: user.bannerColor }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="avatar" />
            : user.displayName[0]?.toUpperCase()}
        </div>
        <div className="user-panel-status" />
      </div>

      <div className="user-panel-info" onClick={onSettings}>
        <div className="user-panel-name">
          {user.displayName}
          {user.isNitro && <span className="user-panel-nitro"> ✨</span>}
        </div>
        <div className="user-panel-tag">@{user.username}</div>
      </div>

      <div className="user-panel-icons">
        <button
          className={`user-panel-btn ${muted ? "user-panel-btn--muted" : ""}`}
          title={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted(m => !m)}
        >
          {muted ? "🔇" : "🎤"}
        </button>
        <button
          className={`user-panel-btn ${deafened ? "user-panel-btn--muted" : ""}`}
          title={deafened ? "Undeafen" : "Deafen"}
          onClick={() => setDeafened(d => !d)}
        >
          {deafened ? "🔕" : "🎧"}
        </button>
        <button
          className="user-panel-btn"
          title="Settings"
          onClick={onSettings}
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice Channel View
// ─────────────────────────────────────────────────────────────────────────────

function VoiceView({ channel, user, voiceState, onJoin, onLeave }: {
  channel: Channel;
  user: AuthUser;
  voiceState: Map<string, { userId: string; username: string }[]>;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const voiceMembers = voiceState.get(channel.channelId) ?? [];
  const inVoice = voiceMembers.some(m => m.userId === user.userId);

  return (
    <div className="voice-main">
      <div style={{ fontSize: 48 }}>🔊</div>
      <div className="voice-title">{channel.name}</div>
      {channel.topic && <div className="voice-subtitle">{channel.topic}</div>}

      {voiceMembers.length > 0 && (
        <div className="voice-members-grid">
          {voiceMembers.map(m => (
            <div key={m.userId} className="voice-member-card">
              <div className={`voice-member-av ${m.userId === user.userId ? "voice-member-av--speaking" : ""}`}>
                {m.username[0]?.toUpperCase()}
              </div>
              <div className="voice-member-name">{m.username}</div>
            </div>
          ))}
        </div>
      )}

      {voiceMembers.length === 0 && (
        <div style={{ fontSize: 14, color: "var(--text-3)" }}>No one is in this channel yet.</div>
      )}

      {!inVoice ? (
        <button className="voice-join-btn" onClick={onJoin}>
          Join Voice Channel
        </button>
      ) : (
        <button
          className="voice-join-btn"
          style={{ background: "var(--red)" }}
          onClick={onLeave}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat View (text channel or DM)
// ─────────────────────────────────────────────────────────────────────────────

function ChatView({ roomId, channelName, channelTopic, user, isVoice, showMemberList, onToggleMembers }: {
  roomId: string;
  channelName: string;
  channelTopic?: string | null;
  user: AuthUser;
  isVoice?: boolean;
  showMemberList?: boolean;
  onToggleMembers?: () => void;
}) {
  const [input, setInput] = useState("");
  const [profileTarget, setProfileTarget] = useState<{ userId: string; rect: DOMRect } | null>(null);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, connected, onlineCount, typerNames, voiceState, sendMessage, sendTypingStart, sendReaction, joinVoice, leaveVoice } = useChat({ roomId, userId: user.userId });

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input, {
      userId: user.userId, username: user.username,
      displayName: user.displayName, avatarUrl: user.avatarUrl, isNitro: user.isNitro,
    });
    setInput("");
    textareaRef.current?.focus();
  }, [input, sendMessage, user]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAvatarClick = async (userId: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setProfileTarget({ userId, rect });
    setProfileUser(null);
    try { const u = await api.getUser(userId); setProfileUser(u); } catch { /* ignore */ }
  };

  const typingLabel =
    typerNames.length === 1 ? `${typerNames[0]} is typing…`
    : typerNames.length === 2 ? `${typerNames[0]} and ${typerNames[1]} are typing…`
    : typerNames.length > 2 ? `${typerNames.length} people are typing…`
    : "";

  // Voice channel content
  if (isVoice) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div className="chat-header">
          <span className="chat-header-icon">🔊</span>
          <span className="chat-header-name">{channelName}</span>
          {channelTopic && <>
            <div className="chat-header-sep" />
            <span className="chat-header-topic">{channelTopic}</span>
          </>}
          <div className="chat-header-spacer" />
          <div className="chat-header-actions">
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--status-on)", marginRight: 6 }} />
              {onlineCount} online
            </div>
          </div>
        </div>

        <VoiceView
          channel={{ channelId: roomId, serverId: "", name: channelName, type: "voice", category: "", position: 0, topic: channelTopic ?? null }}
          user={user}
          voiceState={voiceState}
          onJoin={() => joinVoice(roomId, user.username)}
          onLeave={() => leaveVoice(roomId)}
        />
      </div>
    );
  }

  // Text channel / DM
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Header */}
      <div className="chat-header">
        <span className="chat-header-icon">#</span>
        <span className="chat-header-name">{channelName}</span>
        {channelTopic && <>
          <div className="chat-header-sep" />
          <span className="chat-header-topic">{channelTopic}</span>
        </>}
        <div className="chat-header-spacer" />
        <div className="chat-header-actions">
          <div style={{ fontSize: 13, color: "var(--text-3)", marginRight: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--status-on)" : "var(--status-off)", marginRight: 6 }} />
            {onlineCount} online
          </div>
          {onToggleMembers && (
            <button
              className={`header-btn ${showMemberList ? "header-btn--active" : ""}`}
              title="Toggle Member List"
              onClick={onToggleMembers}
            >
              👥
            </button>
          )}
          <button className="header-btn" title="Search (coming soon)">🔍</button>
          <button className="header-btn" title="Inbox (coming soon)">📥</button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUserId={user.userId}
        onReact={sendReaction}
        onAvatarClick={handleAvatarClick}
      />

      {/* Typing */}
      <div className="typing-bar">
        {typingLabel && (
          <>
            <div className="typing-dots"><span/><span/><span/></div>
            <span className="typing-text">{typingLabel}</span>
          </>
        )}
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="input-box">
          <button className="input-btn" title="Upload a file">+</button>
          <textarea
            ref={textareaRef}
            className="msg-textarea"
            placeholder={`Message #${channelName}`}
            value={input}
            onChange={e => { setInput(e.target.value); sendTypingStart(user.username); }}
            onKeyDown={handleKey}
            rows={1}
            maxLength={2000}
            disabled={!connected}
          />
          <button className="input-btn" title="Emoji">😀</button>
          <button className="input-btn" title="GIF">GIF</button>
        </div>
      </div>

      {/* Profile popup */}
      {profileTarget && (
        <div className="modal-overlay" onClick={() => setProfileTarget(null)}>
          <div
            className="profile-popup"
            style={{
              left: Math.min(profileTarget.rect.right + 12, window.innerWidth - 320),
              top: Math.max(0, Math.min(profileTarget.rect.top, window.innerHeight - 460)),
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="profile-banner" style={{ background: profileUser?.bannerColor ?? "#5865f2" }} />
            <div className="profile-popup-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="profile-popup-av" style={{ background: profileUser?.bannerColor ?? "#5865f2" }}>
                  {profileUser?.avatarUrl
                    ? <img src={profileUser.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : profileUser?.displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
                {profileUser?.isNitro && <span className="nitro-badge-sm">✨ Nitro</span>}
              </div>
              <div className="profile-popup-name">{profileUser?.displayName ?? "Loading…"}</div>
              <div className="profile-popup-tag">@{profileUser?.username ?? "…"}</div>

              {profileUser?.badges?.length ? (
                <div className="profile-popup-badges">
                  {profileUser.badges.map((b, i) => <span key={i} className="badge-chip">{b}</span>)}
                </div>
              ) : null}

              {profileUser?.bio && (
                <>
                  <div className="profile-popup-sep" />
                  <div className="profile-popup-section-title">About Me</div>
                  <div className="profile-popup-bio">{profileUser.bio}</div>
                </>
              )}

              <div className="profile-popup-sep" />
              <div className="profile-popup-section-title">Member Since</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                {profileUser ? new Date(profileUser.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "…"}
              </div>

              {profileTarget.userId !== user.userId && (
                <button
                  className="profile-popup-btn"
                  onClick={async () => {
                    try {
                      await api.openDM(user.userId, profileTarget.userId);
                      setProfileTarget(null);
                    } catch { /* ignore */ }
                  }}
                >
                  Send Message
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member List Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function MemberList({ members, user }: { members: ServerMember[]; user: AuthUser }) {
  const roleOrder: ServerMember["role"][] = ["owner", "admin", "moderator", "member"];
  const roleLabel: Record<string, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", member: "Members" };

  return (
    <div className="member-list">
      {roleOrder.map(role => {
        const group = members.filter(m => m.role === role);
        if (!group.length) return null;
        return (
          <div key={role} className="member-list-section">
            <div className="member-section-label">{roleLabel[role]} — {group.length}</div>
            {group.map(m => (
              <div key={m.userId} className="member-row">
                <div className="member-av-wrap">
                  <div className="member-av" style={{ background: user.bannerColor }}>
                    {(m.nickname ?? m.userId)[0]?.toUpperCase()}
                  </div>
                  <div className="member-status" style={{ background: "var(--status-off)" }} />
                </div>
                <div className="member-info">
                  <div className="member-name">{m.nickname ?? m.userId}</div>
                </div>
                {m.role === "owner" && <span className="member-badge" title="Owner">👑</span>}
                {m.role === "admin" && <span className="member-badge" title="Admin">🛡️</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Shell
// ─────────────────────────────────────────────────────────────────────────────

type AppView =
  | { type: "channel"; serverId: string; channel: Channel }
  | { type: "dm"; dm: DMConversation; otherUserId: string }
  | null;

function Shell() {
  const { user, logout } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [userCache, setUserCache] = useState<Map<string, AuthUser>>(new Map());
  const [view, setView] = useState<AppView>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [modal, setModal] = useState<"createServer" | "joinServer" | "createChannel" | "invite" | null>(null);
  const [newServerName, setNewServerName] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice" | "announcement">("text");
  const [copied, setCopied] = useState(false);

  const activeServer = servers.find(s => s.serverId === activeServerId) ?? null;

  // Load servers + DMs on mount
  useEffect(() => {
    if (!user) return;
    api.listServers(user.userId).then(setServers).catch(console.error);
    api.listDMs(user.userId).then(setDms).catch(console.error);
  }, [user]);

  // Load channels + members when server changes
  useEffect(() => {
    if (!activeServerId) { setChannels([]); setMembers([]); return; }
    api.listChannels(activeServerId).then(setChannels).catch(console.error);
    api.listMembers(activeServerId).then(setMembers).catch(console.error);
  }, [activeServerId]);

  // Fetch user info for DM partners
  useEffect(() => {
    if (!user || !dms.length) return;
    for (const dm of dms) {
      const otherId = dm.participants.find(p => p !== user.userId);
      if (otherId && !userCache.has(otherId)) {
        api.getUser(otherId)
          .then(u => setUserCache(prev => new Map(prev).set(otherId, u)))
          .catch(() => {});
      }
    }
  }, [dms, user]);

  const selectServer = (serverId: string) => {
    setActiveServerId(serverId);
    setView(null);
  };

  const selectHome = () => {
    setActiveServerId(null);
    setView(null);
  };

  const selectChannel = (ch: Channel) => {
    if (!activeServerId) return;
    setView({ type: "channel", serverId: activeServerId, channel: ch });
  };

  const selectDM = (dm: DMConversation, otherId: string) => {
    setView({ type: "dm", dm, otherUserId: otherId });
  };

  const createServer = async () => {
    if (!newServerName.trim() || !user) return;
    const s = await api.createServer(newServerName.trim(), user.userId);
    setServers(prev => [...prev, s]);
    setActiveServerId(s.serverId);
    setNewServerName(""); setModal(null);
  };

  const joinServer = async () => {
    if (!inviteInput.trim() || !user) return;
    try {
      const s = await api.joinServer(inviteInput.trim(), user.userId);
      setServers(prev => [...prev, s]);
      setActiveServerId(s.serverId);
      setInviteInput(""); setModal(null);
    } catch (e) { alert((e as Error).message); }
  };

  const leaveServer = async () => {
    if (!activeServerId || !user) return;
    try {
      await api.leaveServer(activeServerId, user.userId);
      setServers(prev => prev.filter(s => s.serverId !== activeServerId));
      setActiveServerId(null); setView(null);
    } catch (e) { alert((e as Error).message); }
  };

  const createChannel = async () => {
    if (!newChannelName.trim() || !activeServerId || !user) return;
    const cat = newChannelType === "voice" ? "Voice Channels" : "Text Channels";
    const c = await api.createChannel(activeServerId, {
      name: newChannelName.trim(), type: newChannelType, category: cat, userId: user.userId,
    });
    setChannels(prev => [...prev, c]);
    setNewChannelName(""); setModal(null);
    setView({ type: "channel", serverId: activeServerId, channel: c });
  };

  const copyInvite = () => {
    if (!activeServer) return;
    navigator.clipboard?.writeText(activeServer.inviteCode).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <div className="app">
      {/* Server Rail */}
      <ServerRail
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={selectServer}
        onSelectHome={selectHome}
        onAddServer={() => setModal("createServer")}
        onJoinServer={() => setModal("joinServer")}
      />

      {/* Sidebar — switches between DM and server view */}
      {activeServer ? (
        <ServerSidebar
          server={activeServer}
          channels={channels}
          activeChannelId={view?.type === "channel" ? view.channel.channelId : null}
          user={user}
          onSelectChannel={selectChannel}
          onCreateChannel={() => setModal("createChannel")}
          onSettings={() => setShowSettings(true)}
          onLeaveServer={leaveServer}
          onInvite={() => setModal("invite")}
        />
      ) : (
        <DMSidebar
          dms={dms}
          activeDMId={view?.type === "dm" ? view.dm.dmId : null}
          user={user}
          userCache={userCache}
          onSelectDM={selectDM}
          onSettings={() => setShowSettings(true)}
        />
      )}

      {/* Main content */}
      <div className="main">
        {view?.type === "channel" && (
          <div className="chat-wrap">
            <ChatView
              key={view.channel.channelId}
              roomId={view.channel.channelId}
              channelName={view.channel.name}
              channelTopic={view.channel.topic}
              user={user}
              isVoice={view.channel.type === "voice"}
              showMemberList={showMemberList}
              onToggleMembers={view.channel.type !== "voice" ? () => setShowMemberList(m => !m) : undefined}
            />
            {showMemberList && view.channel.type !== "voice" && (
              <MemberList members={members} user={user} />
            )}
          </div>
        )}

        {view?.type === "dm" && (
          <ChatView
            key={view.dm.dmId}
            roomId={view.dm.dmId}
            channelName={
              (() => {
                const other = userCache.get(view.otherUserId);
                return other?.displayName ?? other?.username ?? view.otherUserId;
              })()
            }
            user={user}
          />
        )}

        {!view && (
          <div className="empty-state">
            {activeServer ? (
              <>
                <div className="empty-icon">#</div>
                <div className="empty-title">Welcome to {activeServer.name}!</div>
                <div className="empty-desc">
                  This is the beginning of your server. Select a channel to start chatting.
                </div>
                {channels.length === 0 && user.userId === activeServer.ownerId && (
                  <button className="empty-btn" onClick={() => setModal("createChannel")}>
                    Create a Channel
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="empty-icon">👋</div>
                <div className="empty-title">Welcome back, {user.displayName}!</div>
                <div className="empty-desc">
                  Open a DM to start chatting, or join a server to get started.
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button className="empty-btn" onClick={() => setModal("createServer")}>Create a Server</button>
                  <button className="empty-btn" style={{ background: "var(--bg-4)", color: "var(--text-2)" }} onClick={() => setModal("joinServer")}>Join a Server</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Settings overlay */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {/* Create Server modal */}
      {modal === "createServer" && (
        <Modal
          title="Create Your Server"
          subtitle="Give your server a personality with a name and icon. You can always change it later."
          onClose={() => setModal(null)}
        >
          <div className="field-group">
            <label className="field-label">Server Name</label>
            <input
              className="field-input"
              placeholder={`${user.displayName}'s server`}
              value={newServerName}
              onChange={e => setNewServerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createServer()}
              autoFocus
              maxLength={100}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Back</button>
            <button className="btn btn-primary" onClick={createServer} disabled={!newServerName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {/* Join Server modal */}
      {modal === "joinServer" && (
        <Modal
          title="Join a Server"
          subtitle="Enter an invite code below to join an existing server."
          onClose={() => setModal(null)}
        >
          <div className="field-group">
            <label className="field-label">Invite Code</label>
            <input
              className="field-input"
              placeholder="hTKzmak8"
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinServer()}
              autoFocus
            />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: -8, marginBottom: 8 }}>
            Invite codes are shown in the server header.
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Back</button>
            <button className="btn btn-green" onClick={joinServer} disabled={!inviteInput.trim()}>Join Server</button>
          </div>
        </Modal>
      )}

      {/* Create Channel modal */}
      {modal === "createChannel" && (
        <Modal title="Create Channel" onClose={() => setModal(null)}>
          <div className="field-group">
            <label className="field-label">Channel Type</label>
            <div className="field-type-btns">
              {(["text", "voice", "announcement"] as const).map(t => (
                <button
                  key={t}
                  className={`btn ${newChannelType === t ? "btn-primary" : "btn-ghost"}`}
                  style={{ border: "1px solid var(--border)", flex: 1 }}
                  onClick={() => setNewChannelType(t)}
                >
                  {t === "text" ? "# Text" : t === "voice" ? "🔊 Voice" : "📢 Announce"}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Channel Name</label>
            <input
              className="field-input"
              placeholder={newChannelType === "voice" ? "General" : "new-channel"}
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createChannel()}
              autoFocus
              maxLength={100}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={createChannel} disabled={!newChannelName.trim()}>
              Create Channel
            </button>
          </div>
        </Modal>
      )}

      {/* Invite code modal */}
      {modal === "invite" && activeServer && (
        <Modal
          title={`Invite people to ${activeServer.name}`}
          subtitle="Share your invite code with friends so they can join your server."
          onClose={() => setModal(null)}
        >
          <div className="invite-code-wrap">
            <span className="invite-code-text">{activeServer.inviteCode}</span>
            <button
              className={`invite-code-copy ${copied ? "invite-code-copy--copied" : ""}`}
              onClick={copyInvite}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
            Your invite link expires never. Share responsibly!
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-logo">
          <svg width="48" height="48" viewBox="0 0 127.14 96.36" fill="white">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
        </div>
        <div className="splash-bar"><div className="splash-bar-fill" /></div>
      </div>
    );
  }

  return user ? <Shell /> : <LoginPage />;
}

export function App() {
  return <AuthProvider><Root /></AuthProvider>;
}
