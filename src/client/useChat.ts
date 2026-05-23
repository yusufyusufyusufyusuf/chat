import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { ChatMessage, SystemMessage, ServerEvent, ClientEvent } from "../shared/types";

export type DisplayMessage = ChatMessage | SystemMessage;

interface Options {
  roomId: string;           // channelId or dmId
  userId: string;
  enabled?: boolean;
}

const TYPING_DEBOUNCE = 1500;

export function useChat({ roomId, userId, enabled = true }: Options) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typers, setTypers] = useState<Map<string, string>>(new Map());
  const [voiceState, setVoiceState] = useState<Map<string, { userId: string; username: string }[]>>(new Map());

  const socketRef = useRef<PartySocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const socket = new PartySocket({ host: window.location.host, room: roomId, party: "chat" });
    socketRef.current = socket;
    setMessages([]); setConnected(false); setTypers(new Map());

    socket.addEventListener("open",  () => setConnected(true));
    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (evt) => {
      const msg: ServerEvent = JSON.parse(evt.data);

      if (msg.type === "history") { setMessages(msg.messages); return; }
      if (msg.type === "online")  { setOnlineCount(msg.count); return; }

      if (msg.type === "typing") {
        setTypers(prev => {
          const n = new Map(prev);
          msg.isTyping ? n.set(msg.userId, msg.username) : n.delete(msg.userId);
          return n;
        });
        return;
      }

      if (msg.type === "reaction") {
        setMessages(prev => prev.map(m =>
          m.type === "message" && m.id === msg.messageId
            ? { ...m, reactions: (() => {
                const r = { ...(m as ChatMessage).reactions };
                if (!r[msg.emoji]) r[msg.emoji] = [];
                if (msg.action === "add" && !r[msg.emoji].includes(msg.userId)) r[msg.emoji] = [...r[msg.emoji], msg.userId];
                if (msg.action === "remove") r[msg.emoji] = r[msg.emoji].filter(u => u !== msg.userId);
                if (!r[msg.emoji]?.length) delete r[msg.emoji];
                return r;
              })() }
            : m
        ));
        return;
      }

      if (msg.type === "voice_state") {
        setVoiceState(prev => new Map(prev).set(msg.channelId, msg.users));
        return;
      }

      if (msg.type === "message" || msg.type === "system") {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.type === "message") {
          setTypers(prev => { const n = new Map(prev); n.delete((msg as ChatMessage).userId); return n; });
        }
      }
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [roomId, enabled]);

  const send = useCallback((event: ClientEvent) => {
    socketRef.current?.send(JSON.stringify(event));
  }, []);

  const sendMessage = useCallback((text: string, meta: { userId: string; username: string; displayName: string; avatarUrl: string | null; isNitro: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    send({ type: "message", text: trimmed, ...meta });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) { isTypingRef.current = false; send({ type: "typing", userId, username: meta.username, isTyping: false }); }
  }, [send, userId]);

  const sendTypingStart = useCallback((username: string) => {
    if (!isTypingRef.current) { isTypingRef.current = true; send({ type: "typing", userId, username, isTyping: true }); }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { isTypingRef.current = false; send({ type: "typing", userId, username, isTyping: false }); }, TYPING_DEBOUNCE);
  }, [send, userId]);

  const sendReaction = useCallback((messageId: string, emoji: string, action: "add" | "remove") => {
    send({ type: "reaction", messageId, emoji, userId, action });
  }, [send, userId]);

  const joinVoice = useCallback((channelId: string, username: string) => {
    send({ type: "voice_join", userId, username, channelId });
  }, [send, userId]);

  const leaveVoice = useCallback((channelId: string) => {
    send({ type: "voice_leave", userId, channelId });
  }, [send, userId]);

  const sendSignal = useCallback((to: string, data: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
    send({ type: "signal", from: userId, to, data });
  }, [send, userId]);

  const typerNames = [...typers.entries()].filter(([uid]) => uid !== userId).map(([, name]) => name);

  return {
    messages, connected, onlineCount, typers, typerNames, voiceState,
    sendMessage, sendTypingStart, sendReaction, joinVoice, leaveVoice, sendSignal,
  };
}
