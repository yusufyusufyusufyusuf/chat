import React, { useCallback, useEffect, useState } from "react";
import { Home } from "./Home";
import { ChatRoom } from "./ChatRoom";
import { generateUsername, getUserId, ROOM_COLORS } from "./utils";

export type Room = {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
};

export function App() {
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("chat:rooms") ?? "[]");
    } catch {
      return [];
    }
  });

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    // Check URL for room id
    const hash = window.location.hash.replace("#", "").trim();
    return hash || null;
  });

  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem("chat:username") ?? generateUsername();
  });

  const userId = getUserId();

  // Persist username
  useEffect(() => {
    localStorage.setItem("chat:username", username);
  }, [username]);

  // Persist rooms
  useEffect(() => {
    localStorage.setItem("chat:rooms", JSON.stringify(rooms));
  }, [rooms]);

  // Sync URL hash with active room
  useEffect(() => {
    window.location.hash = activeRoomId ?? "";
  }, [activeRoomId]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "").trim();
      setActiveRoomId(hash || null);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const joinRoom = useCallback(
    (roomId: string, roomName?: string) => {
      const id = roomId.trim().toLowerCase().replace(/\s+/g, "-");
      if (!id) return;

      setRooms((prev) => {
        if (prev.find((r) => r.id === id)) return prev;
        const colorIndex = prev.length % ROOM_COLORS.length;
        return [
          ...prev,
          {
            id,
            name: roomName ?? `#${id}`,
            color: ROOM_COLORS[colorIndex],
            joinedAt: Date.now(),
          },
        ];
      });

      setActiveRoomId(id);
    },
    []
  );

  const leaveRoom = useCallback((roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setActiveRoomId((cur) => (cur === roomId ? null : cur));
  }, []);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

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
              <span
                className="room-dot"
                style={{ background: room.color }}
              />
              <span className="room-item-name">{room.name}</span>
            </button>
          ))}
          {rooms.length === 0 && (
            <p className="no-rooms">No rooms yet. Join one below.</p>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="user-avatar" style={{ background: "#6366f1" }}>
              {username[0]?.toUpperCase()}
            </div>
            <input
              className="username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim() || username)}
              maxLength={24}
              title="Your display name"
              spellCheck={false}
            />
          </div>
        </div>
      </aside>

      <main className="main">
        {activeRoom ? (
          <ChatRoom
            room={activeRoom}
            username={username}
            userId={userId}
            onLeave={() => leaveRoom(activeRoom.id)}
          />
        ) : (
          <Home onJoin={joinRoom} rooms={rooms} />
        )}
      </main>
    </div>
  );
}
