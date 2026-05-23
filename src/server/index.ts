import { Server, routePartykitRequest } from "partyserver";
import { DurableObject } from "cloudflare:workers";
import type {
  ChatMessage,
  SystemMessage,
  TypingEvent,
  OnlineCountEvent,
  HistoryMessage,
  IncomingClientMessage,
} from "../shared/types";

export interface Env {
  Chat: DurableObjectNamespace;
  AuthDO: DurableObjectNamespace;
  AVATARS: R2Bucket;
  SESSION_SECRET: string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(s: string) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64url(JSON.stringify(payload));
  const sig = await hmac(secret, body);
  return body + "." + sig;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, body);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function jr(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Auth Durable Object ───────────────────────────────────────────────────────

export class Auth extends DurableObject<Env> {
  private get secret() {
    return this.env.SESSION_SECRET ?? "change-me-in-production";
  }

  override onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id       TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt          TEXT NOT NULL,
        avatar_url    TEXT,
        created_at    INTEGER NOT NULL
      );
    `);
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/auth/register") return this.register(req);
    if (req.method === "POST" && url.pathname === "/auth/login")    return this.login(req);
    if (req.method === "GET"  && url.pathname === "/auth/verify")   return this.verify(req);
    if (req.method === "POST" && url.pathname === "/auth/avatar")   return this.setAvatar(req);
    return new Response("Not found", { status: 404 });
  }

  private async register(req: Request): Promise<Response> {
    const { username, password } = await req.json<{ username: string; password: string }>();
    if (!username || !password) return jr({ error: "Username and password required" }, 400);
    if (username.length < 2 || username.length > 24) return jr({ error: "Username must be 2-24 characters" }, 400);
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return jr({ error: "Username: letters, numbers, - and _ only" }, 400);
    if (password.length < 6) return jr({ error: "Password must be at least 6 characters" }, 400);

    const existing = this.ctx.storage.sql.exec(`SELECT user_id FROM users WHERE username = ?`, username).toArray();
    if (existing.length > 0) return jr({ error: "Username already taken" }, 409);

    const userId = crypto.randomUUID();
    const salt = crypto.randomUUID();
    const passwordHash = await sha256(salt + password);

    this.ctx.storage.sql.exec(
      `INSERT INTO users (user_id, username, password_hash, salt, avatar_url, created_at) VALUES (?, ?, ?, ?, NULL, ?)`,
      userId, username, passwordHash, salt, Date.now()
    );

    const token = await signToken({ userId, username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, this.secret);
    return jr({ token, userId, username, avatarUrl: null });
  }

  private async login(req: Request): Promise<Response> {
    const { username, password } = await req.json<{ username: string; password: string }>();
    if (!username || !password) return jr({ error: "Username and password required" }, 400);

    const rows = this.ctx.storage.sql.exec(
      `SELECT user_id, username, password_hash, salt, avatar_url FROM users WHERE username = ?`, username
    ).toArray() as { user_id: string; username: string; password_hash: string; salt: string; avatar_url: string | null }[];

    if (rows.length === 0) return jr({ error: "Invalid username or password" }, 401);
    const user = rows[0];
    const hash = await sha256(user.salt + password);
    if (hash !== user.password_hash) return jr({ error: "Invalid username or password" }, 401);

    const token = await signToken(
      { userId: user.user_id, username: user.username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      this.secret
    );
    return jr({ token, userId: user.user_id, username: user.username, avatarUrl: user.avatar_url });
  }

  private async verify(req: Request): Promise<Response> {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return jr({ error: "No token" }, 401);
    const payload = await verifyToken(token, this.secret);
    if (!payload || (payload.exp as number) < Date.now()) return jr({ error: "Expired" }, 401);
    const rows = this.ctx.storage.sql.exec(`SELECT avatar_url FROM users WHERE user_id = ?`, payload.userId).toArray();
    return jr({ userId: payload.userId, username: payload.username, avatarUrl: (rows[0]?.avatar_url as string) ?? null });
  }

  private async setAvatar(req: Request): Promise<Response> {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return jr({ error: "Unauthorized" }, 401);
    const payload = await verifyToken(token, this.secret);
    if (!payload) return jr({ error: "Unauthorized" }, 401);
    const { avatarUrl } = await req.json<{ avatarUrl: string }>();
    this.ctx.storage.sql.exec(`UPDATE users SET avatar_url = ? WHERE user_id = ?`, avatarUrl, payload.userId);
    return jr({ ok: true });
  }
}

// ── Chat Durable Object ───────────────────────────────────────────────────────

export class Chat extends Server<Env> {
  static options = { hibernate: true };
  private MAX_HISTORY = 100;

  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL DEFAULT 'message',
        user_id    TEXT,
        username   TEXT,
        avatar_url TEXT,
        text       TEXT NOT NULL,
        at         INTEGER NOT NULL
      );
    `);
  }

  onConnect(conn: Party.Connection) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT * FROM messages ORDER BY at DESC LIMIT ?`, this.MAX_HISTORY)
      .toArray().reverse();

    const messages = rows.map((r) =>
      r.type === "system"
        ? ({ type: "system", id: r.id, text: r.text, at: r.at } as SystemMessage)
        : ({ type: "message", id: r.id, userId: r.user_id, username: r.username, avatarUrl: r.avatar_url ?? null, text: r.text, at: r.at } as ChatMessage)
    );

    conn.send(JSON.stringify({ type: "history", messages } as HistoryMessage));
    this.broadcastOnlineCount();
  }

  onClose() { this.broadcastOnlineCount(); }

  onMessage(conn: Party.Connection, raw: string) {
    let msg: IncomingClientMessage;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "typing") {
      const event: TypingEvent = { type: "typing", userId: msg.userId, username: msg.username, isTyping: msg.isTyping };
      this.broadcast(JSON.stringify(event), [conn.id]);
      return;
    }

    if (msg.type === "message") {
      const text = msg.text.trim().slice(0, 2000);
      if (!text) return;
      const id = crypto.randomUUID();
      const at = Date.now();
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, type, user_id, username, avatar_url, text, at) VALUES (?, 'message', ?, ?, ?, ?, ?)`,
        id, msg.userId, msg.username, msg.avatarUrl ?? null, text, at
      );
      this.ctx.storage.sql.exec(
        `DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY at DESC LIMIT ?)`,
        this.MAX_HISTORY
      );
      const out: ChatMessage = { type: "message", id, userId: msg.userId, username: msg.username, avatarUrl: msg.avatarUrl ?? null, text, at };
      this.broadcast(JSON.stringify(out));
    }
  }

  private broadcastOnlineCount() {
    const count = [...this.getConnections()].length;
    const event: OnlineCountEvent = { type: "online", count };
    this.broadcast(JSON.stringify(event));
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function authDO(env: Env) {
  return env.AuthDO.get(env.AuthDO.idFromName("global"));
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname.startsWith("/auth/")) {
      const res = await authDO(env).fetch(req);
      const body = await res.text();
      return new Response(body, { status: res.status, headers: { "Content-Type": "application/json", ...CORS } });
    }

    if (req.method === "PUT" && url.pathname === "/avatar") {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return new Response("Unauthorized", { status: 401 });

      const verifyRes = await authDO(env).fetch(
        new Request(new URL("/auth/verify", url).toString(), { headers: { Authorization: "Bearer " + token } })
      );
      if (!verifyRes.ok) return new Response("Unauthorized", { status: 401 });
      const { userId } = await verifyRes.json<{ userId: string }>();

      const ct = req.headers.get("Content-Type") ?? "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const key = "avatars/" + userId + "." + ext;
      await env.AVATARS.put(key, req.body, { httpMetadata: { contentType: ct } });

      const avatarUrl = "/avatar/" + userId + "." + ext;
      await authDO(env).fetch(
        new Request(new URL("/auth/avatar", url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ avatarUrl }),
        })
      );

      return new Response(JSON.stringify({ avatarUrl }), { headers: { "Content-Type": "application/json", ...CORS } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/avatar/")) {
      const filename = url.pathname.replace("/avatar/", "");
      const obj = await env.AVATARS.get("avatars/" + filename);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: { "Content-Type": obj.httpMetadata?.contentType ?? "image/jpeg", "Cache-Control": "public, max-age=86400" },
      });
    }

    return (await routePartykitRequest(req, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
