import { Server, routePartykitRequest } from "partyserver";
import { DurableObject } from "cloudflare:workers";
import type {
  ChatMessage, SystemMessage, ClientEvent,
  TypingEvent, OnlineEvent, HistoryEvent,
  ReactionEvent, SignalEvent,
  VoiceJoinEvent, VoiceLeaveEvent, VoiceStateEvent,
} from "../shared/types";

export interface Env {
  Chat:    DurableObjectNamespace;
  Auth:    DurableObjectNamespace;
  Servers: DurableObjectNamespace;
  ASSETS:  R2Bucket;
  SESSION_SECRET: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// Crypto helpers
// ════════════════════════════════════════════════════════════════════════════════

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("");
}
async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return [...new Uint8Array(s)].map(x => x.toString(16).padStart(2,"0")).join("");
}
function b64u(s: string) { return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""); }
async function signTok(payload: object, secret: string) {
  const body = b64u(JSON.stringify(payload));
  return body + "." + await hmacHex(secret, body);
}
async function verifyTok(token: string, secret: string): Promise<Record<string,unknown>|null> {
  const i = token.lastIndexOf(".");
  if (i<0) return null;
  const body = token.slice(0,i), sig = token.slice(i+1);
  if (await hmacHex(secret,body) !== sig) return null;
  try { return JSON.parse(atob(body.replace(/-/g,"+").replace(/_/g,"/"))); } catch { return null; }
}
function jr(d: unknown, s=200) {
  return new Response(JSON.stringify(d), { status:s, headers:{"Content-Type":"application/json"} });
}
function nanoid(n=12) {
  const chars="abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b=>chars[b%chars.length]).join("");
}

// ════════════════════════════════════════════════════════════════════════════════
// Auth Durable Object
// ════════════════════════════════════════════════════════════════════════════════

export class Auth extends DurableObject<Env> {
  private get sec() { return this.env.SESSION_SECRET ?? "dev-secret"; }

  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id      TEXT PRIMARY KEY,
        username     TEXT UNIQUE NOT NULL COLLATE NOCASE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt         TEXT NOT NULL,
        avatar_url   TEXT,
        banner_color TEXT NOT NULL DEFAULT '#5865f2',
        bio          TEXT NOT NULL DEFAULT '',
        is_nitro     INTEGER NOT NULL DEFAULT 0,
        badges       TEXT NOT NULL DEFAULT '[]',
        created_at   INTEGER NOT NULL
      );
    `);
  }

  async fetch(req: Request): Promise<Response> {
    const p = new URL(req.url).pathname;
    if (req.method==="POST" && p==="/auth/register") return this.register(req);
    if (req.method==="POST" && p==="/auth/login")    return this.login(req);
    if (req.method==="GET"  && p==="/auth/verify")   return this.verify(req);
    if (req.method==="POST" && p==="/auth/profile")  return this.updateProfile(req);
    if (req.method==="GET"  && p.startsWith("/auth/user/")) return this.getUser(p.split("/")[3]);
    return new Response("Not found",{status:404});
  }

  private async register(req: Request) {
    const { username, password } = await req.json<{username:string;password:string}>();
    if (!username||!password) return jr({error:"Required"},400);
    if (username.length<2||username.length>32) return jr({error:"Username 2-32 chars"},400);
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return jr({error:"Invalid chars"},400);
    if (password.length<6) return jr({error:"Password min 6 chars"},400);
    const ex = this.ctx.storage.sql.exec(`SELECT user_id FROM users WHERE username=?`,username).toArray();
    if (ex.length) return jr({error:"Username taken"},409);
    const userId=crypto.randomUUID(), salt=crypto.randomUUID();
    const passwordHash=await sha256(salt+password);
    this.ctx.storage.sql.exec(
      `INSERT INTO users(user_id,username,display_name,password_hash,salt,created_at)VALUES(?,?,?,?,?,?)`,
      userId, username, username, passwordHash, salt, Date.now()
    );
    const token=await signTok({userId,username,exp:Date.now()+30*864e5},this.sec);
    return jr({token,userId,username,displayName:username,avatarUrl:null,bannerColor:"#5865f2",bio:"",isNitro:false,badges:[],createdAt:Date.now()});
  }

  private async login(req: Request) {
    const { username, password } = await req.json<{username:string;password:string}>();
    if (!username||!password) return jr({error:"Required"},400);
    type Row = {user_id:string;username:string;display_name:string;password_hash:string;salt:string;avatar_url:string|null;banner_color:string;bio:string;is_nitro:number;badges:string;created_at:number};
    const rows = this.ctx.storage.sql.exec(`SELECT * FROM users WHERE username=?`,username).toArray() as Row[];
    if (!rows.length) return jr({error:"Invalid credentials"},401);
    const u=rows[0];
    if (await sha256(u.salt+password)!==u.password_hash) return jr({error:"Invalid credentials"},401);
    const token=await signTok({userId:u.user_id,username:u.username,exp:Date.now()+30*864e5},this.sec);
    return jr({token,userId:u.user_id,username:u.username,displayName:u.display_name,avatarUrl:u.avatar_url,bannerColor:u.banner_color,bio:u.bio,isNitro:!!u.is_nitro,badges:JSON.parse(u.badges),createdAt:u.created_at});
  }

  private async verify(req: Request) {
    const token=req.headers.get("Authorization")?.replace("Bearer ","");
    if (!token) return jr({error:"No token"},401);
    const p=await verifyTok(token,this.sec);
    if (!p||(p.exp as number)<Date.now()) return jr({error:"Expired"},401);
    type Row = {user_id:string;username:string;display_name:string;avatar_url:string|null;banner_color:string;bio:string;is_nitro:number;badges:string;created_at:number};
    const rows=this.ctx.storage.sql.exec(`SELECT * FROM users WHERE user_id=?`,p.userId).toArray() as Row[];
    if (!rows.length) return jr({error:"Not found"},404);
    const u=rows[0];
    return jr({userId:u.user_id,username:u.username,displayName:u.display_name,avatarUrl:u.avatar_url,bannerColor:u.banner_color,bio:u.bio,isNitro:!!u.is_nitro,badges:JSON.parse(u.badges),createdAt:u.created_at,token});
  }

  private async updateProfile(req: Request) {
    const token=req.headers.get("Authorization")?.replace("Bearer ","");
    if (!token) return jr({error:"Unauthorized"},401);
    const p=await verifyTok(token,this.sec);
    if (!p) return jr({error:"Unauthorized"},401);
    const body=await req.json<{displayName?:string;bio?:string;bannerColor?:string;avatarUrl?:string}>();
    const sets:string[]=[], vals:unknown[]=[];
    if (body.displayName) { sets.push("display_name=?"); vals.push(body.displayName.slice(0,32)); }
    if (body.bio!==undefined) { sets.push("bio=?"); vals.push(body.bio.slice(0,190)); }
    if (body.bannerColor) { sets.push("banner_color=?"); vals.push(body.bannerColor); }
    if (body.avatarUrl!==undefined) { sets.push("avatar_url=?"); vals.push(body.avatarUrl); }
    if (sets.length) {
      vals.push(p.userId);
      this.ctx.storage.sql.exec(`UPDATE users SET ${sets.join(",")} WHERE user_id=?`,...vals);
    }
    return jr({ok:true});
  }

  private getUser(userId: string) {
    type Row={user_id:string;username:string;display_name:string;avatar_url:string|null;banner_color:string;bio:string;is_nitro:number;badges:string;created_at:number};
    const rows=this.ctx.storage.sql.exec(`SELECT user_id,username,display_name,avatar_url,banner_color,bio,is_nitro,badges,created_at FROM users WHERE user_id=?`,userId).toArray() as Row[];
    if (!rows.length) return jr({error:"Not found"},404);
    const u=rows[0];
    return jr({userId:u.user_id,username:u.username,displayName:u.display_name,avatarUrl:u.avatar_url,bannerColor:u.banner_color,bio:u.bio,isNitro:!!u.is_nitro,badges:JSON.parse(u.badges),createdAt:u.created_at});
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Servers Durable Object  (server/channel/member management)
// ════════════════════════════════════════════════════════════════════════════════

export class Servers extends DurableObject<Env> {
  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        server_id   TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon_url    TEXT,
        banner_url  TEXT,
        owner_id    TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        boost_count INTEGER NOT NULL DEFAULT 0,
        theme       TEXT,
        created_at  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        server_id TEXT NOT NULL,
        user_id   TEXT NOT NULL,
        role      TEXT NOT NULL DEFAULT 'member',
        nickname  TEXT,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY(server_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS channels (
        channel_id TEXT PRIMARY KEY,
        server_id  TEXT NOT NULL,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT 'text',
        category   TEXT NOT NULL DEFAULT 'General',
        position   INTEGER NOT NULL DEFAULT 0,
        topic      TEXT
      );
      CREATE TABLE IF NOT EXISTS dms (
        dm_id          TEXT PRIMARY KEY,
        participant_a  TEXT NOT NULL,
        participant_b  TEXT NOT NULL,
        created_at     INTEGER NOT NULL
      );
    `);
  }

  async fetch(req: Request): Promise<Response> {
    const url=new URL(req.url), p=url.pathname, m=req.method;
    if (m==="POST" && p==="/servers/create")              return this.createServer(req);
    if (m==="POST" && p==="/servers/join")                return this.joinServer(req);
    if (m==="GET"  && p==="/servers/list")                return this.listServers(req);
    if (m==="GET"  && p.match(/^\/servers\/[^/]+\/channels$/)) return this.listChannels(p.split("/")[2]);
    if (m==="GET"  && p.match(/^\/servers\/[^/]+\/members$/))  return this.listMembers(p.split("/")[2]);
    if (m==="POST" && p.match(/^\/servers\/[^/]+\/channels$/)) return this.createChannel(req,p.split("/")[2]);
    if (m==="POST" && p.match(/^\/servers\/[^/]+\/leave$/))    return this.leaveServer(req,p.split("/")[2]);
    if (m==="PATCH"&& p.match(/^\/servers\/[^/]+$/))           return this.updateServer(req,p.split("/")[2]);
    if (m==="POST" && p==="/dms/open")                    return this.openDM(req);
    if (m==="GET"  && p.startsWith("/dms/list/"))         return this.listDMs(p.split("/")[3]);
    return new Response("Not found",{status:404});
  }

  private async createServer(req: Request) {
    const { name, userId } = await req.json<{name:string;userId:string}>();
    if (!name||!userId) return jr({error:"Required"},400);
    const serverId=crypto.randomUUID(), inviteCode=nanoid(8);
    this.ctx.storage.sql.exec(
      `INSERT INTO servers(server_id,name,owner_id,invite_code,created_at)VALUES(?,?,?,?,?)`,
      serverId,name.slice(0,100),userId,inviteCode,Date.now()
    );
    this.ctx.storage.sql.exec(
      `INSERT INTO members(server_id,user_id,role,joined_at)VALUES(?,?,'owner',?)`,
      serverId,userId,Date.now()
    );
    // Default channels
    const cats=[
      {name:"general",type:"text",cat:"Text Channels",pos:0},
      {name:"announcements",type:"announcement",cat:"Text Channels",pos:1},
      {name:"General",type:"voice",cat:"Voice Channels",pos:2},
    ];
    for (const c of cats) {
      this.ctx.storage.sql.exec(
        `INSERT INTO channels(channel_id,server_id,name,type,category,position)VALUES(?,?,?,?,?,?)`,
        crypto.randomUUID(),serverId,c.name,c.type,c.cat,c.pos
      );
    }
    return jr({serverId,name,iconUrl:null,bannerUrl:null,ownerId:userId,inviteCode,boostCount:0,theme:null,createdAt:Date.now()});
  }

  private async joinServer(req: Request) {
    const { inviteCode, userId } = await req.json<{inviteCode:string;userId:string}>();
    type SRow={server_id:string;name:string;icon_url:string|null;owner_id:string;invite_code:string;boost_count:number;theme:string|null;created_at:number};
    const rows=this.ctx.storage.sql.exec(`SELECT * FROM servers WHERE invite_code=?`,inviteCode).toArray() as SRow[];
    if (!rows.length) return jr({error:"Invalid invite code"},404);
    const s=rows[0];
    const already=this.ctx.storage.sql.exec(`SELECT user_id FROM members WHERE server_id=? AND user_id=?`,s.server_id,userId).toArray();
    if (already.length) return jr({error:"Already a member"},409);
    this.ctx.storage.sql.exec(
      `INSERT INTO members(server_id,user_id,role,joined_at)VALUES(?,?,'member',?)`,
      s.server_id,userId,Date.now()
    );
    return jr({serverId:s.server_id,name:s.name,iconUrl:s.icon_url,ownerId:s.owner_id,inviteCode:s.invite_code,boostCount:s.boost_count,theme:s.theme,createdAt:s.created_at});
  }

  private listServers(req: Request) {
    const userId=new URL(req.url).searchParams.get("userId");
    if (!userId) return jr({error:"userId required"},400);
    type SRow={server_id:string;name:string;icon_url:string|null;owner_id:string;invite_code:string;boost_count:number;theme:string|null;created_at:number};
    const rows=this.ctx.storage.sql.exec(
      `SELECT s.* FROM servers s JOIN members m ON s.server_id=m.server_id WHERE m.user_id=? ORDER BY s.created_at`,
      userId
    ).toArray() as SRow[];
    return jr(rows.map(s=>({serverId:s.server_id,name:s.name,iconUrl:s.icon_url,ownerId:s.owner_id,inviteCode:s.invite_code,boostCount:s.boost_count,theme:s.theme,createdAt:s.created_at})));
  }

  private listChannels(serverId: string) {
    type CRow={channel_id:string;server_id:string;name:string;type:string;category:string;position:number;topic:string|null};
    const rows=this.ctx.storage.sql.exec(`SELECT * FROM channels WHERE server_id=? ORDER BY position`,serverId).toArray() as CRow[];
    return jr(rows.map(c=>({channelId:c.channel_id,serverId:c.server_id,name:c.name,type:c.type,category:c.category,position:c.position,topic:c.topic})));
  }

  private listMembers(serverId: string) {
    type MRow={user_id:string;role:string;nickname:string|null;joined_at:number};
    const rows=this.ctx.storage.sql.exec(`SELECT user_id,role,nickname,joined_at FROM members WHERE server_id=? ORDER BY joined_at`,serverId).toArray() as MRow[];
    return jr(rows.map(m=>({userId:m.user_id,serverId,role:m.role,nickname:m.nickname,joinedAt:m.joined_at})));
  }

  private async createChannel(req: Request, serverId: string) {
    const { name, type, category, userId } = await req.json<{name:string;type:string;category:string;userId:string}>();
    const member=this.ctx.storage.sql.exec(`SELECT role FROM members WHERE server_id=? AND user_id=?`,serverId,userId).toArray() as {role:string}[];
    if (!member.length||!["owner","admin"].includes(member[0].role)) return jr({error:"No permission"},403);
    const channelId=crypto.randomUUID();
    const maxPos=this.ctx.storage.sql.exec(`SELECT MAX(position) as p FROM channels WHERE server_id=?`,serverId).toArray()[0] as {p:number|null};
    this.ctx.storage.sql.exec(
      `INSERT INTO channels(channel_id,server_id,name,type,category,position)VALUES(?,?,?,?,?,?)`,
      channelId,serverId,name.slice(0,100),type||"text",category||"General",(maxPos.p??-1)+1
    );
    return jr({channelId,serverId,name,type:type||"text",category:category||"General",position:(maxPos.p??-1)+1,topic:null});
  }

  private async leaveServer(req: Request, serverId: string) {
    const { userId }=await req.json<{userId:string}>();
    const member=this.ctx.storage.sql.exec(`SELECT role FROM members WHERE server_id=? AND user_id=?`,serverId,userId).toArray() as {role:string}[];
    if (!member.length) return jr({error:"Not a member"},404);
    if (member[0].role==="owner") return jr({error:"Owner cannot leave — transfer ownership first"},400);
    this.ctx.storage.sql.exec(`DELETE FROM members WHERE server_id=? AND user_id=?`,serverId,userId);
    return jr({ok:true});
  }

  private async updateServer(req: Request, serverId: string) {
    const body=await req.json<{name?:string;iconUrl?:string;bannerUrl?:string;theme?:string;userId:string}>();
    const member=this.ctx.storage.sql.exec(`SELECT role FROM members WHERE server_id=? AND user_id=?`,serverId,body.userId).toArray() as {role:string}[];
    if (!member.length||!["owner","admin"].includes(member[0].role)) return jr({error:"No permission"},403);
    const sets:string[]=[], vals:unknown[]=[];
    if (body.name)       { sets.push("name=?");       vals.push(body.name.slice(0,100)); }
    if (body.iconUrl)    { sets.push("icon_url=?");   vals.push(body.iconUrl); }
    if (body.bannerUrl)  { sets.push("banner_url=?"); vals.push(body.bannerUrl); }
    if (body.theme)      { sets.push("theme=?");      vals.push(body.theme); }
    if (sets.length) { vals.push(serverId); this.ctx.storage.sql.exec(`UPDATE servers SET ${sets.join(",")} WHERE server_id=?`,...vals); }
    return jr({ok:true});
  }

  private async openDM(req: Request) {
    const { userA, userB }=await req.json<{userA:string;userB:string}>();
    const [a,b]=[userA,userB].sort();
    const dmId=a+"_"+b;
    const ex=this.ctx.storage.sql.exec(`SELECT dm_id FROM dms WHERE dm_id=?`,dmId).toArray();
    if (!ex.length) {
      this.ctx.storage.sql.exec(`INSERT INTO dms(dm_id,participant_a,participant_b,created_at)VALUES(?,?,?,?)`,dmId,a,b,Date.now());
    }
    return jr({dmId,participants:[a,b]});
  }

  private listDMs(userId: string) {
    type DRow={dm_id:string;participant_a:string;participant_b:string};
    const rows=this.ctx.storage.sql.exec(
      `SELECT * FROM dms WHERE participant_a=? OR participant_b=? ORDER BY created_at DESC`,userId,userId
    ).toArray() as DRow[];
    return jr(rows.map(d=>({dmId:d.dm_id,participants:[d.participant_a,d.participant_b]})));
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Chat Durable Object  (one per channel/DM — handles WS + history + voice)
// ════════════════════════════════════════════════════════════════════════════════

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  // voice: channelId -> Set<{connId, userId, username}>
  private voiceRooms = new Map<string, Map<string,{userId:string;username:string}>>();

  onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id           TEXT PRIMARY KEY,
        type         TEXT NOT NULL DEFAULT 'message',
        channel_id   TEXT NOT NULL DEFAULT '',
        user_id      TEXT,
        username     TEXT,
        display_name TEXT,
        avatar_url   TEXT,
        is_nitro     INTEGER NOT NULL DEFAULT 0,
        text         TEXT NOT NULL,
        attachments  TEXT NOT NULL DEFAULT '[]',
        reactions    TEXT NOT NULL DEFAULT '{}',
        edited_at    INTEGER,
        at           INTEGER NOT NULL
      );
    `);
  }

  onConnect(conn: import("partyserver").Connection, ctx: import("partyserver").ConnectionContext) {
    // Send last 100 messages
    type Row={id:string;type:string;channel_id:string;user_id:string;username:string;display_name:string;avatar_url:string|null;is_nitro:number;text:string;attachments:string;reactions:string;edited_at:number|null;at:number};
    const rows=this.ctx.storage.sql.exec(`SELECT * FROM messages ORDER BY at DESC LIMIT 100`).toArray().reverse() as Row[];
    const messages=(rows).map(r=>
      r.type==="system"
        ? ({type:"system",id:r.id,text:r.text,at:r.at} as SystemMessage)
        : ({
            type:"message",id:r.id,channelId:r.channel_id,
            userId:r.user_id,username:r.username,displayName:r.display_name,
            avatarUrl:r.avatar_url,isNitro:!!r.is_nitro,text:r.text,
            attachments:JSON.parse(r.attachments),reactions:JSON.parse(r.reactions),
            editedAt:r.edited_at,at:r.at,
          } as ChatMessage)
    );
    conn.send(JSON.stringify({type:"history",messages} as HistoryEvent));
    this.broadcastOnline();
  }

  onClose(conn: import("partyserver").Connection) {
    // Remove from any voice rooms
    for (const [channelId, members] of this.voiceRooms) {
      if (members.has(conn.id)) {
        const info=members.get(conn.id)!;
        members.delete(conn.id);
        if (members.size===0) this.voiceRooms.delete(channelId);
        const ev: VoiceLeaveEvent={type:"voice_leave",userId:info.userId,channelId};
        this.broadcast(JSON.stringify(ev));
        this.broadcastVoiceState(channelId);
      }
    }
    this.broadcastOnline();
  }

  onMessage(conn: import("partyserver").Connection, raw: string) {
    let msg: ClientEvent;
    try { msg=JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "message":   return this.handleMessage(msg);
      case "typing":    return this.broadcast(JSON.stringify(msg as TypingEvent), [conn.id]);
      case "reaction":  return this.handleReaction(msg);
      case "signal":    return this.handleSignal(conn, msg);
      case "voice_join":return this.handleVoiceJoin(conn, msg);
      case "voice_leave":return this.handleVoiceLeave(conn, msg);
    }
  }

  private handleMessage(msg: ClientEvent & {type:"message"}) {
    const text=msg.text.trim().slice(0,2000);
    if (!text) return;
    const id=crypto.randomUUID(), at=Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO messages(id,type,channel_id,user_id,username,display_name,avatar_url,is_nitro,text,attachments,reactions,at)
       VALUES(?,'message',?,?,?,?,?,?,?,'[]','{}',?)`,
      id,"",msg.userId,msg.username,msg.displayName,msg.avatarUrl??null,msg.isNitro?1:0,text,at
    );
    // Keep last 500
    this.ctx.storage.sql.exec(`DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY at DESC LIMIT 500)`);
    const out: ChatMessage={type:"message",id,channelId:"",userId:msg.userId,username:msg.username,
      displayName:msg.displayName,avatarUrl:msg.avatarUrl??null,isNitro:msg.isNitro,
      text,attachments:[],reactions:{},editedAt:null,at};
    this.broadcast(JSON.stringify(out));
  }

  private handleReaction(msg: ClientEvent & {type:"reaction"}) {
    type Row={reactions:string};
    const rows=this.ctx.storage.sql.exec(`SELECT reactions FROM messages WHERE id=?`,msg.messageId).toArray() as Row[];
    if (!rows.length) return;
    const r: Record<string,string[]>=JSON.parse(rows[0].reactions);
    if (!r[msg.emoji]) r[msg.emoji]=[];
    if (msg.action==="add" && !r[msg.emoji].includes(msg.userId)) r[msg.emoji].push(msg.userId);
    if (msg.action==="remove") r[msg.emoji]=r[msg.emoji].filter(u=>u!==msg.userId);
    if (!r[msg.emoji].length) delete r[msg.emoji];
    this.ctx.storage.sql.exec(`UPDATE messages SET reactions=? WHERE id=?`,JSON.stringify(r),msg.messageId);
    const ev: ReactionEvent={type:"reaction",messageId:msg.messageId,emoji:msg.emoji,userId:msg.userId,action:msg.action};
    this.broadcast(JSON.stringify(ev));
  }

  private handleSignal(conn: import("partyserver").Connection, msg: ClientEvent & {type:"signal"}) {
    // Forward WebRTC signal to target peer
    for (const c of this.getConnections()) {
      // We tag connections by userId via a convention; here we forward to all and let client filter
      if (c.id !== conn.id) c.send(JSON.stringify(msg));
    }
  }

  private handleVoiceJoin(conn: import("partyserver").Connection, msg: ClientEvent & {type:"voice_join"}) {
    if (!this.voiceRooms.has(msg.channelId)) this.voiceRooms.set(msg.channelId, new Map());
    this.voiceRooms.get(msg.channelId)!.set(conn.id,{userId:msg.userId,username:msg.username});
    const ev: VoiceJoinEvent={type:"voice_join",userId:msg.userId,username:msg.username,channelId:msg.channelId};
    this.broadcast(JSON.stringify(ev));
    this.broadcastVoiceState(msg.channelId);
  }

  private handleVoiceLeave(conn: import("partyserver").Connection, msg: ClientEvent & {type:"voice_leave"}) {
    this.voiceRooms.get(msg.channelId)?.delete(conn.id);
    const ev: VoiceLeaveEvent={type:"voice_leave",userId:msg.userId,channelId:msg.channelId};
    this.broadcast(JSON.stringify(ev));
    this.broadcastVoiceState(msg.channelId);
  }

  private broadcastVoiceState(channelId: string) {
    const members=this.voiceRooms.get(channelId);
    const users=members ? [...members.values()] : [];
    const ev: VoiceStateEvent={type:"voice_state",channelId,users};
    this.broadcast(JSON.stringify(ev));
  }

  private broadcastOnline() {
    const conns=[...this.getConnections()];
    const ev: OnlineEvent={type:"online",count:conns.length,users:[]};
    this.broadcast(JSON.stringify(ev));
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Worker entry point
// ════════════════════════════════════════════════════════════════════════════════

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization",
};

function authDO(env:Env)    { return env.Auth.get(env.Auth.idFromName("global")); }
function serversDO(env:Env) { return env.Servers.get(env.Servers.idFromName("global")); }

async function proxy(do_: DurableObjectStub, req: Request, overridePath?: string): Promise<Response> {
  const url=new URL(req.url);
  if (overridePath) url.pathname=overridePath;
  const res=await do_.fetch(new Request(url.toString(),req));
  const body=await res.text();
  return new Response(body,{status:res.status,headers:{"Content-Type":"application/json",...CORS}});
}

export default {
  async fetch(req: Request, env: Env) {
    const url=new URL(req.url), p=url.pathname, m=req.method;

    if (m==="OPTIONS") return new Response(null,{headers:CORS});

    // Auth
    if (p.startsWith("/auth/")) return proxy(authDO(env),req);

    // File upload (avatars / server icons)
    if (m==="PUT" && p==="/upload") {
      const token=req.headers.get("Authorization")?.replace("Bearer ","");
      if (!token) return new Response("Unauthorized",{status:401});
      const vr=await authDO(env).fetch(new Request(new URL("/auth/verify",url).toString(),{headers:{Authorization:"Bearer "+token}}));
      if (!vr.ok) return new Response("Unauthorized",{status:401});
      const {userId}=await vr.json<{userId:string}>();
      const ct=req.headers.get("Content-Type")??"image/jpeg";
      const ext=ct.includes("png")?"png":ct.includes("webp")?"webp":"jpg";
      const kind=url.searchParams.get("kind")??"avatar"; // avatar | icon | banner
      const key=`${kind}s/${userId}_${Date.now()}.${ext}`;
      await env.ASSETS.put(key,req.body,{httpMetadata:{contentType:ct}});
      return new Response(JSON.stringify({url:`/files/${key}`}),{headers:{"Content-Type":"application/json",...CORS}});
    }

    // File serve
    if (m==="GET" && p.startsWith("/files/")) {
      const key=p.replace("/files/","");
      const obj=await env.ASSETS.get(key);
      if (!obj) return new Response("Not found",{status:404});
      return new Response(obj.body,{headers:{"Content-Type":obj.httpMetadata?.contentType??"image/jpeg","Cache-Control":"public,max-age=86400"}});
    }

    // Server management
    if (p.startsWith("/servers/") || p.startsWith("/dms/")) return proxy(serversDO(env),req);

    // Chat WebSockets (PartyKit rooms)
    return (await routePartykitRequest(req,env as unknown as Record<string, unknown>)) ?? new Response("Not found",{status:404});
  },
} satisfies ExportedHandler<Env>;
