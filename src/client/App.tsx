import React, { useCallback, useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { SettingsPage } from "./SettingsPage";
import { MessageList } from "./MessageList";
import { useChat } from "./useChat";
import * as api from "./api";
import type { Server, Channel, ServerMember, DMConversation, AuthUser } from "../shared/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ user, size=32, onClick }: { user: Partial<AuthUser>; size?: number; onClick?: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  const style: React.CSSProperties = { width: size, height: size, borderRadius: "50%", background: user.bannerColor ?? "#5865f2",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize: size*0.4, fontWeight:700, color:"#fff",
    overflow:"hidden", flexShrink:0, cursor: onClick ? "pointer" : undefined };
  return (
    <div style={style} onClick={onClick}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : (user.displayName ?? user.username ?? "?")[0]?.toUpperCase()}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {subtitle && <div className="modal-subtitle">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Voice bar ─────────────────────────────────────────────────────────────────

function VoiceBar({ channelName, members, onLeave }: { channelName: string; members: {userId:string;username:string}[]; onLeave: () => void }) {
  return (
    <div>
      <div className="voice-bar">
        <span className="voice-status">🔊 Connected — {channelName}</span>
        <button className="icon-btn voice-leave" onClick={onLeave} title="Disconnect">📵</button>
      </div>
      {members.length > 0 && (
        <div className="voice-members">
          {members.map(m => (
            <div key={m.userId} className="voice-member">
              <div className="voice-avatar">{m.username[0]?.toUpperCase()}</div>
              {m.username}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chat view ─────────────────────────────────────────────────────────────────

function ChatView({ roomId, channelName, channelTopic, members, user, isVoice }:
  { roomId: string; channelName: string; channelTopic?: string | null; members: ServerMember[]; user: AuthUser; isVoice?: boolean }) {

  const [input, setInput] = useState("");
  const [inVoice, setInVoice] = useState(false);
  const [profileTarget, setProfileTarget] = useState<{ userId: string; anchor: DOMRect } | null>(null);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, connected, onlineCount, typerNames, voiceState, sendMessage, sendTypingStart, sendReaction, joinVoice, leaveVoice } = useChat({ roomId, userId: user.userId });

  const voiceMembers = isVoice ? (voiceState.get(roomId) ?? []) : [];

  const handleSend = useCallback(() => {
    sendMessage(input, { userId: user.userId, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, isNitro: user.isNitro });
    setInput("");
    textareaRef.current?.focus();
  }, [input, sendMessage, user]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAvatarClick = async (userId: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setProfileTarget({ userId, anchor: rect });
    try { const u = await api.getUser(userId); setProfileUser(u); } catch { setProfileUser(null); }
  };

  const typingLabel = typerNames.length === 1 ? `${typerNames[0]} is typing…`
    : typerNames.length === 2 ? `${typerNames[0]} and ${typerNames[1]} are typing…`
    : typerNames.length > 2 ? `${typerNames.length} people are typing…` : "";

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      {/* Header */}
      <div className="channel-header">
        <span className="channel-header-icon">{isVoice ? "🔊" : "#"}</span>
        <span className="channel-header-name">{channelName}</span>
        {channelTopic && <span className="channel-header-topic">{channelTopic}</span>}
        <div className="header-spacer" />
        <div className="member-count"><span className="online-dot" />{onlineCount} online</div>
      </div>

      {/* Voice bar if in voice */}
      {isVoice && inVoice && (
        <VoiceBar channelName={channelName} members={voiceMembers} onLeave={() => { leaveVoice(roomId); setInVoice(false); }} />
      )}

      {/* Voice join prompt */}
      {isVoice && !inVoice && (
        <div className="empty-state" style={{ flex: "none", padding: "24px 16px" }}>
          <span style={{ fontSize: 48 }}>🔊</span>
          <div className="empty-title">Voice Channel</div>
          <p className="empty-desc">Connect to chat with others using your microphone.</p>
          <button className="empty-btn" onClick={() => { joinVoice(roomId, user.username); setInVoice(true); }}>Join Voice</button>
          {voiceMembers.length > 0 && (
            <div className="voice-members" style={{ marginTop: 12, justifyContent:"center" }}>
              {voiceMembers.map(m => <div key={m.userId} className="voice-member"><div className="voice-avatar">{m.username[0]}</div>{m.username}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} currentUserId={user.userId} onReact={sendReaction} onAvatarClick={handleAvatarClick} />

      {/* Typing */}
      <div className="typing-bar">
        {typingLabel && <><div className="typing-dots"><span/><span/><span/></div><span className="typing-text">{typingLabel}</span></>}
      </div>

      {/* Input */}
      {!isVoice && (
        <div className="input-area">
          <div className="input-box">
            <button className="input-attach" title="Attach file">➕</button>
            <textarea
              ref={textareaRef}
              className="msg-textarea"
              placeholder={`Message ${channelName}`}
              value={input}
              onChange={e => { setInput(e.target.value); sendTypingStart(user.username); }}
              onKeyDown={handleKey}
              rows={1}
              maxLength={2000}
              disabled={!connected}
            />
            <button className="emoji-btn" title="Emoji">😀</button>
          </div>
        </div>
      )}

      {/* Profile popup */}
      {profileTarget && (
        <div className="modal-overlay" onClick={() => setProfileTarget(null)}>
          <div className="profile-popup" style={{ position:"fixed", left: Math.min(profileTarget.anchor.right+8, window.innerWidth-320), top: Math.min(profileTarget.anchor.top, window.innerHeight-400) }} onClick={e=>e.stopPropagation()}>
            <div className="profile-banner" style={{ background: profileUser?.bannerColor ?? "#5865f2" }} />
            <div className="profile-popup-body">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div className="profile-popup-avatar">
                  {profileUser?.avatarUrl ? <img src={profileUser.avatarUrl} alt="" /> : profileUser?.displayName?.[0] ?? "?"}
                </div>
                {profileUser?.isNitro && <span className="tag tag-nitro" style={{ marginTop: 8 }}>✨ Nitro</span>}
              </div>
              <div className="profile-popup-name">{profileUser?.displayName ?? "Loading…"}</div>
              <div className="profile-popup-tag">@{profileUser?.username}</div>
              {profileUser?.badges?.length ? (
                <div className="profile-popup-badges">{profileUser.badges.map((b,i) => <span key={i} className="badge">{b}</span>)}</div>
              ) : null}
              {profileUser?.bio && <div className="profile-popup-bio">{profileUser.bio}</div>}
              {profileTarget.userId !== user.userId && (
                <div className="profile-popup-actions">
                  <button className="profile-popup-btn" onClick={() => setProfileTarget(null)}>Send Message</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

type View = { type: "channel"; serverId: string; channel: Channel } | { type: "dm"; dm: DMConversation; otherUserId: string } | null;

function Shell() {
  const { user, logout } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [view, setView] = useState<View>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [modal, setModal] = useState<"createServer" | "joinServer" | "createChannel" | null>(null);
  const [newServerName, setNewServerName] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("text");

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

  const createChannel = async () => {
    if (!newChannelName.trim() || !activeServerId || !user) return;
    const c = await api.createChannel(activeServerId, { name: newChannelName.trim(), type: newChannelType, category: newChannelType==="voice"?"Voice Channels":"Text Channels", userId: user.userId });
    setChannels(prev => [...prev, c]);
    setNewChannelName(""); setModal(null);
  };

  // Group channels by category
  const categories = [...new Set(channels.map(c => c.category))];

  if (!user) return null;

  return (
    <div className="app">
      {/* Server rail */}
      <div className="server-rail">
        {/* DMs button */}
        <div className={`server-icon ${!activeServerId ? "active" : ""}`} onClick={() => { setActiveServerId(null); setView(null); }} title="Direct Messages">💬</div>
        <div className="server-rail-divider" />
        {servers.map(s => (
          <div key={s.serverId} className={`server-icon ${s.serverId===activeServerId?"active":""}`}
            style={s.serverId===activeServerId ? { "--server-theme": s.theme ?? "var(--accent)" } as React.CSSProperties : undefined}
            onClick={() => { setActiveServerId(s.serverId); setView(null); }}
            title={s.name}>
            {s.iconUrl ? <img src={s.iconUrl} alt={s.name} /> : s.name[0].toUpperCase()}
          </div>
        ))}
        <div className="server-rail-divider" />
        <div className="server-icon server-add-btn" title="Add a Server" onClick={() => setModal("createServer")}>＋</div>
        <div className="server-icon server-add-btn" style={{ fontSize:18, color:"var(--text-muted)" }} title="Join a Server" onClick={() => setModal("joinServer")}>🔗</div>
      </div>

      {/* Channel / DM sidebar */}
      <div className="channel-sidebar">
        {activeServer ? (
          <>
            <div className="server-header">
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeServer.name}</span>
              <span className="server-header-invite" title="Invite code" onClick={() => { navigator.clipboard?.writeText(activeServer.inviteCode); }}>
                #{activeServer.inviteCode}
              </span>
            </div>
            <div className="channel-list">
              {categories.map(cat => {
                const catChannels = channels.filter(c => c.category === cat);
                return (
                  <div key={cat}>
                    <div className="channel-category">
                      <span>{cat.toUpperCase()}</span>
                      <span className="cat-add" onClick={() => setModal("createChannel")}>＋</span>
                    </div>
                    {catChannels.map(ch => {
                      const isActive = view?.type==="channel" && view.channel.channelId===ch.channelId;
                      return (
                        <div key={ch.channelId} className={`channel-item ${isActive?"active":""}`}
                          onClick={() => setView({ type:"channel", serverId: activeServer.serverId, channel: ch })}>
                          <span className="channel-icon">{ch.type==="voice" ? "🔊" : ch.type==="announcement" ? "📢" : "#"}</span>
                          <span className="channel-name">{ch.name}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {channels.length === 0 && <div style={{ padding:"16px", fontSize:13, color:"var(--text-muted)" }}>No channels yet.</div>}
            </div>
          </>
        ) : (
          <>
            <div className="server-header">Direct Messages</div>
            <div className="channel-list">
              <div className="dm-section">
                <div className="dm-header">Messages</div>
                {dms.map(dm => {
                  const otherId = dm.participants.find(p => p !== user.userId) ?? dm.participants[0];
                  const isActive = view?.type==="dm" && view.dm.dmId===dm.dmId;
                  return (
                    <div key={dm.dmId} className={`dm-item ${isActive?"active":""}`}
                      onClick={() => setView({ type:"dm", dm, otherUserId: otherId })}>
                      <div className="dm-avatar">{otherId[0]?.toUpperCase()}</div>
                      <div className="dm-name">{otherId}</div>
                    </div>
                  );
                })}
                {dms.length === 0 && <div style={{ padding:"8px 16px", fontSize:13, color:"var(--text-muted)" }}>No DMs yet.</div>}
              </div>
            </div>
          </>
        )}

        {/* User panel */}
        <div className="user-panel">
          <div className="user-panel-avatar" onClick={() => setShowSettings(true)}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" /> : user.displayName[0]?.toUpperCase()}
          </div>
          <div className="user-panel-info">
            <div className="user-panel-name">{user.displayName} {user.isNitro && <span className="nitro-badge">✨</span>}</div>
            <div className="user-panel-tag">@{user.username}</div>
          </div>
          <div className="user-panel-actions">
            <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>⚙️</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main">
        {view?.type === "channel" && (
          <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
            <ChatView
              key={view.channel.channelId}
              roomId={view.channel.channelId}
              channelName={view.channel.name}
              channelTopic={view.channel.topic}
              members={members}
              user={user}
              isVoice={view.channel.type === "voice"}
            />
            {/* Member list */}
            <div className="member-sidebar">
              {["owner","admin","moderator","member"].map(role => {
                const roleMembers = members.filter(m => m.role === role);
                if (!roleMembers.length) return null;
                return (
                  <div key={role}>
                    <div className="member-section-label">{role.toUpperCase()} — {roleMembers.length}</div>
                    {roleMembers.map(m => (
                      <div key={m.userId} className="member-row">
                        <div className="member-av">{(m.nickname ?? m.userId)[0]?.toUpperCase()}</div>
                        <span className="member-name">{m.nickname ?? m.userId}</span>
                        {m.role==="owner" && <span className="member-role-owner">👑</span>}
                        {m.role==="admin"  && <span className="member-role-admin">🛡️</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view?.type === "dm" && (
          <ChatView
            key={view.dm.dmId}
            roomId={view.dm.dmId}
            channelName={view.otherUserId}
            members={[]}
            user={user}
          />
        )}

        {!view && (
          <div className="empty-state">
            <div className="empty-icon">{activeServer ? "💬" : "👋"}</div>
            <div className="empty-title">{activeServer ? `Welcome to ${activeServer.name}` : "Welcome!"}</div>
            <div className="empty-desc">
              {activeServer ? "Select a channel on the left to start chatting." : "Select a server or DM to get started."}
            </div>
            {!activeServer && (
              <button className="empty-btn" onClick={() => setModal("createServer")}>Create a Server</button>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {/* Create server modal */}
      {modal === "createServer" && (
        <Modal title="Create a Server" subtitle="Give your server a name. You can always change it later." onClose={() => setModal(null)}>
          <input className="field-input" placeholder="My Awesome Server" value={newServerName} onChange={e=>setNewServerName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createServer()} autoFocus maxLength={100} />
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={createServer} disabled={!newServerName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {/* Join server modal */}
      {modal === "joinServer" && (
        <Modal title="Join a Server" subtitle="Enter an invite code to join an existing server." onClose={() => setModal(null)}>
          <input className="field-input" placeholder="Enter invite code" value={inviteInput} onChange={e=>setInviteInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&joinServer()} autoFocus />
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={joinServer} disabled={!inviteInput.trim()}>Join</button>
          </div>
        </Modal>
      )}

      {/* Create channel modal */}
      {modal === "createChannel" && (
        <Modal title="Create Channel" onClose={() => setModal(null)}>
          <div className="field-group">
            <label className="field-label">Channel Type</label>
            <div style={{ display:"flex", gap:8 }}>
              {["text","voice","announcement"].map(t => (
                <button key={t} className={`btn ${newChannelType===t?"btn-primary":"btn-ghost"}`} onClick={() => setNewChannelType(t)}>{t==="text"?"# Text":t==="voice"?"🔊 Voice":"📢 Announce"}</button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Channel Name</label>
            <input className="field-input" placeholder="new-channel" value={newChannelName} onChange={e=>setNewChannelName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createChannel()} autoFocus maxLength={100} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={createChannel} disabled={!newChannelName.trim()}>Create Channel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function Root() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="splash">
      <div className="splash-logo">💬</div>
      <div className="splash-text">Loading…</div>
    </div>
  );
  return user ? <Shell /> : <LoginPage />;
}

export function App() {
  return <AuthProvider><Root /></AuthProvider>;
}
