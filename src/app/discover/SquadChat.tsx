"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeToSquadMessages,
  sendSquadMessage,
  setSquadPresence,
  subscribeToSquadPresence,
  subscribeToMyPrivateChats,
  type Squad,
  type ChatMessage,
  type PresenceEntry,
  type PrivateChat,
} from "@/lib/firestore";
import PrivateGroupChat, { PrivateGroupCreator } from "./PrivateGroupChat";

interface Props {
  squad: Squad;
  uid: string;
  displayName: string;
  photoURL: string;
  onVideoCall?: (squadId: string) => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function formatTime(ts: ChatMessage["sentAt"]): string {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({
  msg,
  isOwn,
}: {
  msg: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOwn ? "flex-end" : "flex-start",
        gap: 3,
      }}
    >
      {!isOwn && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 1,
          }}
        >
          {msg.senderPhotoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.senderPhotoURL}
              alt=""
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1.5px solid #1b1b1e",
              }}
            />
          ) : (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "#ffd8e7",
                border: "1.5px solid #1b1b1e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {msg.senderName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#544249",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {msg.senderName}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
        <div
          style={{
            backgroundColor: isOwn ? "#9f376f" : "#ffffff",
            color: isOwn ? "white" : "#1b1b1e",
            border: `2.5px solid #1b1b1e`,
            padding: "8px 12px",
            maxWidth: 300,
            overflowWrap: "anywhere",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.45,
            borderRadius: isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
            boxShadow: isOwn ? "3px 3px 0 #3d0025" : "3px 3px 0 #b0b0b0",
          }}
        >
          {msg.text}
        </div>
        <span
          style={{
            fontSize: 9,
            color: "#b0acb5",
            fontWeight: 700,
            flexShrink: 0,
            marginBottom: 2,
          }}
        >
          {formatTime(msg.sentAt)}
        </span>
      </div>
    </div>
  );
}

function MemberRow({ entry }: { entry: PresenceEntry }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderRadius: 6,
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        {entry.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.photoURL}
            alt=""
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2px solid #1b1b1e",
            }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "#ffd8e7",
              border: "2px solid #1b1b1e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#9f376f",
            }}
          >
            {entry.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: entry.online ? "#4caf50" : "#999",
            border: "1.5px solid #fbf8fc",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: entry.online ? "#1b1b1e" : "#999",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {entry.displayName}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 1000;

export default function SquadChat({ squad, uid, displayName, photoURL, onVideoCall }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [activePrivateChatId, setActivePrivateChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showCreatePrivate, setShowCreatePrivate] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const lastSentRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Presence: go online on mount, go offline on unmount/unload
  useEffect(() => {
    setSquadPresence(squad.id, uid, displayName, photoURL, true).catch(() => {});
    const goOffline = () =>
      setSquadPresence(squad.id, uid, displayName, photoURL, false).catch(() => {});
    window.addEventListener("beforeunload", goOffline);
    return () => {
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [squad.id, uid, displayName, photoURL]);

  useEffect(() => subscribeToSquadMessages(squad.id, setMessages), [squad.id]);
  useEffect(() => subscribeToSquadPresence(squad.id, setPresence), [squad.id]);
  useEffect(() => subscribeToMyPrivateChats(uid, setPrivateChats), [uid]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) return;
    lastSentRef.current = now;
    setSending(true);
    setInput("");
    try {
      await sendSquadMessage(squad.id, { uid, name: displayName, photoURL }, text);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, squad.id, uid, displayName, photoURL]);

  const onlinePresence = presence.filter((p) => p.online);
  const offlinePresence = presence.filter((p) => !p.online);
  const otherOnlineMembers = presence.filter((p) => p.uid !== uid && p.online);

  // Private chats the user hasn't opened yet (notification badges)
  const pendingPrivateChats = privateChats.filter(
    (c) => c.id !== activePrivateChatId
  );

  const activePrivateChat =
    privateChats.find((c) => c.id === activePrivateChatId) ?? null;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        position: "relative",
        backgroundColor: "#fbf8fc",
      }}
    >
      {/* ── Members sidebar (desktop) ─────────────────────────────────── */}
      <aside
        className="hidden sm:flex"
        style={{
          width: 196,
          borderRight: "3px solid #1b1b1e",
          flexDirection: "column",
          backgroundColor: "#e8f7ff",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        {/* Online */}
        <div style={{ padding: "14px 10px 0" }}>
          <p
            style={{
              fontWeight: 900,
              fontSize: 9,
              textTransform: "uppercase",
              color: "#4caf50",
              letterSpacing: "0.08em",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#4caf50",
                display: "inline-block",
              }}
            />
            LIVE — {onlinePresence.length}
          </p>
          {onlinePresence.map((e) => (
            <MemberRow key={e.uid} entry={e} />
          ))}
        </div>

        {/* Offline */}
        {offlinePresence.length > 0 && (
          <div style={{ padding: "12px 10px 0" }}>
            <p
              style={{
                fontWeight: 900,
                fontSize: 9,
                textTransform: "uppercase",
                color: "#9f9b9e",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              AWAY — {offlinePresence.length}
            </p>
            {offlinePresence.map((e) => (
              <MemberRow key={e.uid} entry={e} />
            ))}
          </div>
        )}

        {/* Pending private chat notifications */}
        {pendingPrivateChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActivePrivateChatId(chat.id)}
            style={{
              margin: "8px 10px 0",
              padding: "8px 10px",
              backgroundColor: "#ffe24c",
              border: "2px solid #1b1b1e",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              textAlign: "left",
              fontFamily: "inherit",
              boxShadow: "3px 3px 0 #1b1b1e",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#1b1b1e",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14 }}
            >
              lock
            </span>
            PRIVATE INVITE
          </button>
        ))}

        {/* Create private group */}
        {otherOnlineMembers.length > 0 && (
          <button
            onClick={() => setShowCreatePrivate(true)}
            style={{
              margin: "auto 10px 14px",
              padding: "8px 10px",
              backgroundColor: "#ffd8e7",
              border: "2px solid #1b1b1e",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "3px 3px 0 #1b1b1e",
              color: "#3d0025",
              marginTop: "auto",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16 }}
            >
              group_add
            </span>
            PRIVATE GROUP
          </button>
        )}
      </aside>

      {/* ── Main chat area ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Chat header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "3px solid #1b1b1e",
            backgroundColor: "#7ed4fd",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Mobile: members toggle button */}
          <button
            className="flex sm:hidden"
            onClick={() => setShowMobileMembers((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 4,
              color: "#005b78",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              group
            </span>
            <span style={{ fontSize: 11, fontWeight: 800 }}>
              {onlinePresence.length}
            </span>
          </button>

          <span
            style={{
              fontFamily:
                "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 900,
              fontSize: 16,
              textTransform: "uppercase",
              color: "#1b1b1e",
              flex: 1,
            }}
          >
            # {squad.name}
          </span>

          {/* Video call button */}
          {onVideoCall && (
            <button
              onClick={() => onVideoCall(squad.id)}
              title="Start video call"
              style={{
                background: "none", border: "2px solid #1b1b1e", padding: "4px 8px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                borderRadius: 4, backgroundColor: "#7ed4fd", flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#005b78", fontVariationSettings: "'FILL' 1" }}>videocam</span>
            </button>
          )}

          {/* Private invite badge (mobile & desktop) */}
          {pendingPrivateChats.length > 0 && (
            <button
              onClick={() =>
                setActivePrivateChatId(pendingPrivateChats[0].id)
              }
              style={{
                padding: "4px 10px",
                backgroundColor: "#ffe24c",
                border: "2px solid #1b1b1e",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 900,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "2px 2px 0 #1b1b1e",
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "#1b1b1e",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 12 }}
              >
                lock
              </span>
              {pendingPrivateChats.length} PRIVATE
            </button>
          )}

          {/* Mobile: create private group */}
          <button
            className="flex sm:hidden"
            onClick={() => setShowCreatePrivate(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display:
                otherOnlineMembers.length > 0 ? undefined : "none",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 22, color: "#9f376f" }}
            >
              group_add
            </span>
          </button>
        </div>

        {/* Mobile: members strip */}
        {showMobileMembers && (
          <div
            className="flex sm:hidden"
            style={{
              borderBottom: "3px solid #1b1b1e",
              backgroundColor: "#e8f7ff",
              padding: "10px 12px",
              overflowX: "auto",
              gap: 14,
              flexShrink: 0,
            }}
          >
            {presence.map((e) => (
              <div
                key={e.uid}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <div style={{ position: "relative" }}>
                  {e.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.photoURL}
                      alt=""
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        border: "2px solid #1b1b1e",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        backgroundColor: "#ffd8e7",
                        border: "2px solid #1b1b1e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#9f376f",
                      }}
                    >
                      {e.displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: e.online ? "#4caf50" : "#999",
                      border: "1.5px solid #fbf8fc",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: e.online ? "#1b1b1e" : "#999",
                    maxWidth: 44,
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.displayName.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                margin: "auto",
                gap: 8,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 44, color: "#c4bcc3" }}
              >
                chat_bubble
              </span>
              <p
                style={{
                  color: "#544249",
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                No messages yet — say hello!
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.senderUid === uid}
            />
          ))}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "3px solid #1b1b1e",
            backgroundColor: "#fbf8fc",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message squad... (500 char max)"
            style={{
              flex: 1,
              border: "3px solid #1b1b1e",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              outline: "none",
              backgroundColor: "#f6f2f7",
              borderRadius: 8,
              minWidth: 0,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              padding: "10px 14px",
              backgroundColor: "#9f376f",
              color: "white",
              border: "3px solid #1b1b1e",
              cursor: !input.trim() || sending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              borderRadius: 8,
              boxShadow: "4px 4px 0 #1b1b1e",
              opacity: !input.trim() || sending ? 0.5 : 1,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              transition: "opacity 0.1s",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              send
            </span>
          </button>
        </div>
      </div>

      {/* ── Private group creator modal ───────────────────────────────── */}
      {showCreatePrivate && (
        <PrivateGroupCreator
          squad={squad}
          uid={uid}
          displayName={displayName}
          photoURL={photoURL}
          onlineMembers={otherOnlineMembers}
          onClose={() => setShowCreatePrivate(false)}
          onCreated={(chatId) => {
            setShowCreatePrivate(false);
            setActivePrivateChatId(chatId);
          }}
        />
      )}

      {/* ── Active private chat overlay ───────────────────────────────── */}
      {activePrivateChat && (
        <PrivateGroupChat
          chat={activePrivateChat}
          uid={uid}
          displayName={displayName}
          photoURL={photoURL}
          onClose={() => setActivePrivateChatId(null)}
        />
      )}
    </div>
  );
}
