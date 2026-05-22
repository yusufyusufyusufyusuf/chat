import { Server, routePartykitRequest } from "partyserver";
import { Auth } from "../shared/auth";
import type {
  ChatMessage,
  SystemMessage,
  TypingEvent,
  OnlineCountEvent,
  HistoryMessage,
  IncomingClientMessage,
  OutgoingMessage,
} from "../shared/types";

export interface Env {
  Chat: DurableObjectNamespace;
  AuthDO: DurableObjectNamespace;
  AVATARS: R2Bucket;
  SESSION_SECRET: string;
}

export { Auth };

// ── Chat Durable Object ───────────────────────────────────────────────────────

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  private MAX_HISTORY = 100;

  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id        TEXT PRIMARY KEY,
        type      TEXT NOT NULL DEFAULT 'message',
        user_id   TEXT,
        username  TEXT,
        avatar_url TEXT,
        text      TEXT NOT NULL,
        at        INTEGER NOT NULL
      );
    `);
  }

  onConnect(conn: import("partyserver").Connection) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT * FROM messages ORDER BY at DESC LIMIT ?`, this.MAX_HISTORY)
      .toArray()
      .reverse();

    const messages = rows.map((r) =>
      r.type === "system"
        ? ({
            type: "system",
            id: r.id as string,
            text: r.text as string,
            at: r.at as number,
          } satisfies SystemMessage)
        : ({
            type: "message",
            id: r.id as string,
            userId: r.user_id as string,
            username: r.username as string,
            avatarUrl: (r.avatar_url as string) ?? null,
            text: r.text as string,
            at: r.at as number,
          } satisfies ChatMessage)
    );

    conn.send(
      JSON.stringify({ type: "history", messages } satisfies HistoryMessage)
    );
    this.broadcastOnlineCount();
  }

  onClose() {
    this.broadcastOnlineCount();
  }

  onMessage(conn: import("partyserver").Connection, raw: string) {
    let msg: IncomingClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "typing") {
      const event: TypingEvent = {
        type: "typing",
        userId: msg.userId,
        username: msg.username,
        isTyping: msg.isTyping,
      };
      this.broadcast(JSON.stringify(event), [conn.id]);
      return;
    }

    if (msg.type === "message") {
      const text = msg.text.trim().slice(0, 2000);
      if (!text) return;

      const id = crypto.randomUUID();
      const at = Date.now();

      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, type, user_id, username, avatar_url, text, at)
         VALUES (?, 'message', ?, ?, ?, ?, ?)`,
        id,
        msg.userId,
        msg.username,
        msg.avatarUrl ?? null,
        text,
        at
      );

      this.ctx.storage.sql.exec(
        `DELETE FROM messages WHERE id NOT IN (
           SELECT id FROM messages ORDER BY at DESC LIMIT ?
         )`,
        this.MAX_HISTORY
      );

      const out: ChatMessage = {
        type: "message",
        id,
        userId: msg.userId,
        username: msg.username,
        avatarUrl: msg.avatarUrl ?? null,
        text,
        at,
      };

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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function authDO(env: Env) {
  return env.AuthDO.get(env.AuthDO.idFromName("global"));
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── Auth routes (/auth/*) ────────────────────────────────────────────────
    if (url.pathname.startsWith("/auth/")) {
      const res = await authDO(env).fetch(req);
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), ...corsHeaders() },
      });
    }

    // ── Avatar upload: PUT /avatar ───────────────────────────────────────────
    if (req.method === "PUT" && url.pathname === "/avatar") {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return new Response("Unauthorized", { status: 401 });

      // Verify via auth DO
      const verifyRes = await authDO(env).fetch(
        new Request(`${url.origin}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      if (!verifyRes.ok) return new Response("Unauthorized", { status: 401 });
      const { userId } = await verifyRes.json<{ userId: string }>();

      const contentType = req.headers.get("Content-Type") ?? "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
        ? "webp"
        : "jpg";
      const key = `avatars/${userId}.${ext}`;

      await env.AVATARS.put(key, req.body, {
        httpMetadata: { contentType },
      });

      const avatarUrl = `/avatar/${userId}.${ext}`;

      // Update in auth DO
      await authDO(env).fetch(
        new Request(`${url.origin}/auth/avatar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ avatarUrl }),
        })
      );

      return new Response(JSON.stringify({ avatarUrl }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // ── Avatar serve: GET /avatar/:filename ──────────────────────────────────
    if (req.method === "GET" && url.pathname.startsWith("/avatar/")) {
      const filename = url.pathname.replace("/avatar/", "");
      const obj = await env.AVATARS.get(`avatars/${filename}`);
      if (!obj) return new Response("Not found", { status: 404 });

      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // ── PartyKit WebSocket (chat rooms) ──────────────────────────────────────
    return (
      (await routePartykitRequest(req, env as unknown as Record<string, unknown>)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
