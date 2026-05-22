import { DurableObject } from "cloudflare:workers";
import type { Env } from "../server/index";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(s: string) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Simple signed token: base64(payload).signature
async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64url(JSON.stringify(payload));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

async function verifyToken(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, body);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRecord {
  userId: string;
  username: string;
  passwordHash: string; // sha256(salt + password)
  salt: string;
  avatarUrl: string | null;
  createdAt: number;
}

// ── Auth Durable Object ───────────────────────────────────────────────────────

export class Auth extends DurableObject<Env> {
  private get secret() {
    return this.env.SESSION_SECRET ?? "change-me-in-production";
  }

  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id      TEXT PRIMARY KEY,
        username     TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt         TEXT NOT NULL,
        avatar_url   TEXT,
        created_at   INTEGER NOT NULL
      );
    `);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/auth/register") {
      return this.handleRegister(req);
    }
    if (req.method === "POST" && url.pathname === "/auth/login") {
      return this.handleLogin(req);
    }
    if (req.method === "GET" && url.pathname === "/auth/verify") {
      return this.handleVerify(req);
    }
    if (req.method === "POST" && url.pathname === "/auth/avatar") {
      return this.handleSetAvatar(req);
    }

    return new Response("Not found", { status: 404 });
  }

  // ── Register ────────────────────────────────────────────────────────────────

  private async handleRegister(req: Request): Promise<Response> {
    const { username, password } = await req.json<{
      username: string;
      password: string;
    }>();

    if (!username || !password) {
      return json({ error: "Username and password required" }, 400);
    }
    if (username.length < 2 || username.length > 24) {
      return json({ error: "Username must be 2–24 characters" }, 400);
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
      return json(
        { error: "Username can only contain letters, numbers, - and _" },
        400
      );
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Check existing
    const existing = this.ctx.storage.sql
      .exec(`SELECT user_id FROM users WHERE username = ?`, username)
      .toArray();
    if (existing.length > 0) {
      return json({ error: "Username already taken" }, 409);
    }

    const userId = crypto.randomUUID();
    const salt = crypto.randomUUID();
    const passwordHash = await sha256(salt + password);

    this.ctx.storage.sql.exec(
      `INSERT INTO users (user_id, username, password_hash, salt, avatar_url, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      userId,
      username,
      passwordHash,
      salt,
      Date.now()
    );

    const token = await signToken(
      { userId, username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      this.secret
    );

    return json({ token, userId, username, avatarUrl: null });
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  private async handleLogin(req: Request): Promise<Response> {
    const { username, password } = await req.json<{
      username: string;
      password: string;
    }>();

    if (!username || !password) {
      return json({ error: "Username and password required" }, 400);
    }

    const rows = this.ctx.storage.sql
      .exec(
        `SELECT user_id, username, password_hash, salt, avatar_url FROM users WHERE username = ?`,
        username
      )
      .toArray();

    if (rows.length === 0) {
      return json({ error: "Invalid username or password" }, 401);
    }

    const user = rows[0] as unknown as UserRecord & {
      user_id: string;
      password_hash: string;
      avatar_url: string | null;
    };

    const hash = await sha256((user.salt as string) + password);
    if (hash !== user.password_hash) {
      return json({ error: "Invalid username or password" }, 401);
    }

    const token = await signToken(
      {
        userId: user.user_id,
        username: user.username,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    return json({
      token,
      userId: user.user_id,
      username: user.username,
      avatarUrl: user.avatar_url,
    });
  }

  // ── Verify token ─────────────────────────────────────────────────────────────

  private async handleVerify(req: Request): Promise<Response> {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "No token" }, 401);

    const payload = await verifyToken(token, this.secret);
    if (!payload || (payload.exp as number) < Date.now()) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // Fetch fresh avatarUrl
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT avatar_url FROM users WHERE user_id = ?`,
        payload.userId
      )
      .toArray();

    return json({
      userId: payload.userId,
      username: payload.username,
      avatarUrl: rows[0]?.avatar_url ?? null,
    });
  }

  // ── Set avatar URL ────────────────────────────────────────────────────────────

  private async handleSetAvatar(req: Request): Promise<Response> {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const payload = await verifyToken(token, this.secret);
    if (!payload) return json({ error: "Unauthorized" }, 401);

    const { avatarUrl } = await req.json<{ avatarUrl: string }>();

    this.ctx.storage.sql.exec(
      `UPDATE users SET avatar_url = ? WHERE user_id = ?`,
      avatarUrl,
      payload.userId
    );

    return json({ ok: true });
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
