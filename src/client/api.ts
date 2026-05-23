import type { AuthUser, Server, Channel, ServerMember, DMConversation } from "../shared/types";

const token = () => localStorage.getItem("app:token") ?? "";
const authHeaders = (extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  "Authorization": "Bearer " + token(),
  ...extra,
});

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers as Record<string, string> | undefined) },
  });
  const data = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (username: string, password: string) =>
  apiFetch<AuthUser>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });

export const login = (username: string, password: string) =>
  apiFetch<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });

export const verify = () =>
  apiFetch<AuthUser>("/auth/verify");

export const updateProfile = (data: { displayName?: string; bio?: string; bannerColor?: string; avatarUrl?: string }) =>
  apiFetch<{ ok: boolean }>("/auth/profile", { method: "POST", body: JSON.stringify(data) });

export const getUser = (userId: string) =>
  apiFetch<AuthUser>(`/auth/user/${userId}`);

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadFile(file: File, kind: "avatar" | "icon" | "banner"): Promise<string> {
  const maxPx = kind === "avatar" ? 256 : 512;
  const resized = await resizeImage(file, maxPx);
  const res = await fetch(`/upload?kind=${kind}`, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + token(), "Content-Type": resized.type },
    body: resized,
  });
  if (!res.ok) throw new Error("Upload failed");
  const { url } = await res.json() as { url: string };
  return url;
}

function resizeImage(file: File, maxPx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas error")), "image/jpeg", 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Servers ───────────────────────────────────────────────────────────────────
export const createServer = (name: string, userId: string) =>
  apiFetch<Server>("/servers/create", { method: "POST", body: JSON.stringify({ name, userId }) });

export const joinServer = (inviteCode: string, userId: string) =>
  apiFetch<Server>("/servers/join", { method: "POST", body: JSON.stringify({ inviteCode, userId }) });

export const listServers = (userId: string) =>
  apiFetch<Server[]>(`/servers/list?userId=${userId}`);

export const listChannels = (serverId: string) =>
  apiFetch<Channel[]>(`/servers/${serverId}/channels`);

export const listMembers = (serverId: string) =>
  apiFetch<ServerMember[]>(`/servers/${serverId}/members`);

export const createChannel = (serverId: string, data: { name: string; type: string; category: string; userId: string }) =>
  apiFetch<Channel>(`/servers/${serverId}/channels`, { method: "POST", body: JSON.stringify(data) });

export const leaveServer = (serverId: string, userId: string) =>
  apiFetch<{ ok: boolean }>(`/servers/${serverId}/leave`, { method: "POST", body: JSON.stringify({ userId }) });

export const deleteServer = (serverId: string, userId: string) =>
  apiFetch<{ ok: boolean }>(`/servers/${serverId}`, { method: "DELETE", body: JSON.stringify({ userId }) });

export const updateServer = (serverId: string, data: object) =>
  apiFetch<{ ok: boolean }>(`/servers/${serverId}`, { method: "PATCH", body: JSON.stringify(data) });

// ── DMs ───────────────────────────────────────────────────────────────────────
export const openDM = (userA: string, userB: string) =>
  apiFetch<DMConversation>("/dms/open", { method: "POST", body: JSON.stringify({ userA, userB }) });

export const listDMs = (userId: string) =>
  apiFetch<DMConversation[]>(`/dms/list/${userId}`);
