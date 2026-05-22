import { Server, routePartykitRequest } from "partyserver";

export interface Env {
  Chat: DurableObjectNamespace;
}

// ── Shared message types (keep in sync with client/types.ts) ──────────────────

export type ChatMessage = {
  type: "message";
  id: string;
  userId: string;
  username: string;
  text: string;
  at: number; // epoch ms
};

export type SystemMessage = {
  type: "system";
  id: string;
  text: string;
  at: number;
};

export type TypingEvent = {
  type: "typing";
  userId: string;
  username: string;
  isTyping: boolean;
};

export type OnlineCountEvent = {
  type: "online";
  count: number;
};

export type HistoryMessage = {
  type: "history";
  messages: (ChatMessage | SystemMessage)[];
};

export type IncomingMessage =
  | { type: "message"; text: string; username: string; userId: string }
  | { type: "typing"; username: string; userId: string; isTyping: boolean };

export type OutgoingMessage =
  | ChatMessage
  | SystemMessage
  | TypingEvent
  | OnlineCountEvent
  | HistoryMessage;

// ── Durable Object ────────────────────────────────────────────────────────────

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  private MAX_HISTORY = 100;

  // Called once when the DO is first created (SQLite migration)
  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id        TEXT PRIMARY KEY,
        type      TEXT NOT NULL DEFAULT 'message',
        user_id   TEXT,
        username  TEXT,
        text      TEXT NOT NULL,
        at        INTEGER NOT NULL
      );
    `);
  }

  // New WebSocket connection
  onConnect(conn: Party.Connection) {
    // Send history
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT * FROM messages ORDER BY at DESC LIMIT ?`,
        this.MAX_HISTORY
      )
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
            text: r.text as string,
            at: r.at as number,
          } satisfies ChatMessage)
    );

    conn.send(JSON.stringify({ type: "history", messages } satisfies HistoryMessage));

    // Broadcast updated online count
    this.broadcastOnlineCount();
  }

  onClose() {
    this.broadcastOnlineCount();
  }

  onMessage(conn: Party.Connection, raw: string) {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "typing") {
      // Relay typing events to everyone except sender
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

      // Persist
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, type, user_id, username, text, at)
         VALUES (?, 'message', ?, ?, ?, ?)`,
        id,
        msg.userId,
        msg.username,
        text,
        at
      );

      // Trim old rows
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
        text,
        at,
      };

      // Broadcast to all (including sender so they get the canonical message)
      this.broadcast(JSON.stringify(out));
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private broadcastOnlineCount() {
    const count = [...this.getConnections()].length;
    const event: OnlineCountEvent = { type: "online", count };
    this.broadcast(JSON.stringify(event));
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return (
      (await routePartykitRequest(req, env)) ||
      env.Chat.get(env.Chat.idFromName("default")).fetch(req)
    );
  },
} satisfies ExportedHandler<Env>;
