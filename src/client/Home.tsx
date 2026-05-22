import React, { useState } from "react";
import type { Room } from "./App";

interface HomeProps {
  onJoin: (roomId: string, roomName?: string) => void;
  rooms: Room[];
}

const SUGGESTED_ROOMS = ["general", "random", "dev", "design", "music"];

export function Home({ onJoin, rooms }: HomeProps) {
  const [input, setInput] = useState("");

  const handleJoin = () => {
    const val = input.trim();
    if (val) {
      onJoin(val);
      setInput("");
    }
  };

  return (
    <div className="home">
      <div className="home-card">
        <h1 className="home-title">
          Welcome to <em>chat</em>
        </h1>
        <p className="home-subtitle">
          Real-time rooms powered by Cloudflare Durable Objects.
          <br />
          Enter a room name to join or create it.
        </p>

        <div className="join-form">
          <span className="join-hash">#</span>
          <input
            className="join-input"
            placeholder="room-name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
            spellCheck={false}
          />
          <button className="join-btn" onClick={handleJoin}>
            Join →
          </button>
        </div>

        <div className="suggested-label">Popular rooms</div>
        <div className="suggested-rooms">
          {SUGGESTED_ROOMS.filter((r) => !rooms.find((rm) => rm.id === r)).map(
            (r) => (
              <button
                key={r}
                className="suggested-chip"
                onClick={() => onJoin(r)}
              >
                #{r}
              </button>
            )
          )}
        </div>

        {rooms.length > 0 && (
          <>
            <div className="suggested-label">Your rooms</div>
            <div className="suggested-rooms">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  className="suggested-chip active-chip"
                  onClick={() => onJoin(r.id)}
                >
                  <span
                    className="chip-dot"
                    style={{ background: r.color }}
                  />
                  {r.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
