import { nanoid } from "nanoid";

const ADJECTIVES = [
  "swift", "brave", "clever", "bright", "calm",
  "witty", "bold", "crisp", "sleek", "sharp",
];
const NOUNS = [
  "fox", "owl", "hawk", "wolf", "bear",
  "lynx", "kite", "wren", "crow", "hare",
];

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}-${noun}-${num}`;
}

export function getUserId(): string {
  let id = localStorage.getItem("chat:userId");
  if (!id) {
    id = nanoid();
    localStorage.setItem("chat:userId", id);
  }
  return id;
}

export const ROOM_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
  "#f97316", "#06b6d4",
];
