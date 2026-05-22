import React, { useCallback, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Home } from "./Home";
import { ChatRoom } from "./ChatRoom";
import { ProfileEditor } from "./ProfileEditor";
import { ROOM_COLORS } from "./utils";

export type Room = {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
};

// Inner shell — only rendered when authenticated
function Shell() {
  const { user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>(() => {
    try { return JSON.parse(localStorage.getItem("chat:rooms") ?? "[]"); }
    catch { return []; }
  });

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return window.location.hash.replace("#", "").trim() || null;
  });

  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    localStorage.setItem("chat:rooms", JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    window.location.hash = activeRoomId ?? "";
  }, [activeRoomId]);

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "").trim();
      setActiveRoomId(hash || null);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    const id = roomId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id) return;
    setRooms((prev) => {
      if (prev.find((r) => r.id === id)) return prev;
      const colorIndex = prev.length % ROOM_COLORS.length;
      return [...prev, { id, name: `#${id}`, color: ROOM_COLORS[colorIndex], joinedAt: Date.now() }];
    });
    setActiveRoomId(id);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setActiveRoomId((cur) => (cur === roomId ? null : cur));
  }, []);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const avatarSrc = user?.avatarUrl ?? null;
  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">💬</span>
          <span className="sidebar-title">chat</span>
        </div>

        <div className="sidebar-section-label">Rooms</div>
        <nav className="room-list">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={`room-item ${room.id === activeRoomId ? "active" : ""}`}
              onClick={() => setActiveRoomId(room.id)}
            >
              <span className="room-dot" style={{ background: room.color }} />
              <span className="room-item-name">{room.name}</span>
            </button>
          ))}
          {rooms.length === 0 && (
            <p className="no-rooms">No rooms yet. Join one below.</p>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            className="user-row user-row-btn"
            onClick={() => setShowProfile(true)}
            title="Edit profile"
          >
            <div className="user-avatar-wrap">
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" className="user-avatar-img" />
              ) : (
                <div className="user-avatar">{initial}</div>
              )}
              <span className="user-avatar-edit">✏️</span>
            </div>
            <span className="user-display-name">{user?.username}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        {activeRoom ? (
          <ChatRoom
            room={activeRoom}
            username={user!.username}
            userId={user!.userId}
            avatarUrl={user!.avatarUrl}
            onLeave={() => leaveRoom(activeRoom.id)}
          />
        ) : (
          <Home onJoin={joinRoom} rooms={rooms} />
        )}
      </main>

      {showProfile && <ProfileEditor onClose={() => setShowProfile(false)} />}
    </div>
  );
}

// Root — shows login or app
function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <span className="splash-logo">💬</span>
      </div>
    );
  }

  return user ? <Shell /> : <LoginPage />;
}

export function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
