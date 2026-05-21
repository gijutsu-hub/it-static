"use client";

import { useState, useEffect, useRef } from "react";
import {
  createPrivateChat,
  subscribeToPrivateChatMessages,
  sendPrivateChatMessage,
  dissolvePrivateChat,
  type PresenceEntry,
  type PrivateChat,
  type ChatMessage,
} from "@/lib/firestore";
import type { Squad } from "@/lib/firestore";

// ── Creator modal ──────────────────────────────────────────────────────────────

interface CreatorProps {
  squad: Squad;
  uid: string;
  displayName: string;
  photoURL: string;
  onlineMembers: PresenceEntry[];
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

export function PrivateGroupCreator({
  squad,
  uid,
  displayName,
  photoURL,
  onlineMembers,
  onClose,
  onCreated,
}: CreatorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const toggle = (memberUid: string) =>
    setSelected((prev) =>
      prev.includes(memberUid)
        ? prev.filter((x) => x !== memberUid)
        : [...prev, memberUid]
    );

  const handleCreate = async () => {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    try {
      const memberUids = [uid, ...selected];
      const memberNames: Record<string, string> = { [uid]: displayName };
      selected.forEach((sel) => {
        const m = onlineMembers.find((o) => o.uid === sel);
        if (m) memberNames[sel] = m.displayName;
      });
      const chatId = await createPrivateChat(
        squad.id,
        uid,
        memberUids,
        memberNames
      );
      onCreated(chatId);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fbf8fc",
          border: "4px solid #1b1b1e",
          boxShadow: "8px 8px 0 #1b1b1e",
          padding: 28,
          maxWidth: 360,
          width: "100%",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 22, color: "#9f376f" }}
          >
            lock
          </span>
          <h2
            style={{
              fontFamily:
                "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 20,
              fontWeight: 900,
              textTransform: "uppercase",
              color: "#1b1b1e",
            }}
          >
            PRIVATE GROUP
          </h2>
        </div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#544249",
            marginBottom: 16,
          }}
        >
          One-time private chat — auto-dissolves in 2 hours or when you
          close it.
        </p>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}
        >
          {onlineMembers.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: "#999",
                textAlign: "center",
                padding: "16px 0",
                fontWeight: 600,
              }}
            >
              No other online squad members right now
            </p>
          )}
          {onlineMembers.map((member) => {
            const isSelected = selected.includes(member.uid);
            return (
              <button
                key={member.uid}
                onClick={() => toggle(member.uid)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "2.5px solid #1b1b1e",
                  borderRadius: 8,
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#9f376f" : "#f6f2f7",
                  color: isSelected ? "white" : "#1b1b1e",
                  fontFamily: "inherit",
                  boxShadow: isSelected
                    ? "3px 3px 0 #3d0025"
                    : "3px 3px 0 #1b1b1e",
                  transition: "all 0.1s",
                }}
              >
                {member.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photoURL}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "2px solid #1b1b1e",
                      flexShrink: 0,
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
                      fontSize: 13,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {member.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span
                  style={{ fontWeight: 700, fontSize: 13, flex: 1, textAlign: "left" }}
                >
                  {member.displayName}
                </span>
                {isSelected && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18 }}
                  >
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              border: "3px solid #1b1b1e",
              padding: "12px",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              cursor: "pointer",
              backgroundColor: "#fbf8fc",
              boxShadow: "4px 4px 0 #1b1b1e",
              fontFamily: "inherit",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            style={{
              flex: 2,
              border: "3px solid #1b1b1e",
              padding: "12px",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              cursor:
                selected.length === 0 || creating ? "not-allowed" : "pointer",
              backgroundColor: "#9f376f",
              color: "white",
              boxShadow: "4px 4px 0 #1b1b1e",
              fontFamily: "inherit",
              opacity: selected.length === 0 || creating ? 0.55 : 1,
            }}
          >
            {creating
              ? "CREATING..."
              : `CREATE (${selected.length} selected)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Private chat overlay ───────────────────────────────────────────────────────

function formatCountdown(expiresAt: PrivateChat["expiresAt"]): string {
  if (!expiresAt?.toDate) return "";
  const diff = expiresAt.toDate().getTime() - Date.now();
  if (diff <= 0) return "EXPIRED";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

interface PrivateChatProps {
  chat: PrivateChat;
  uid: string;
  displayName: string;
  photoURL: string;
  onClose: () => void;
}

export default function PrivateGroupChat({
  chat,
  uid,
  displayName,
  photoURL,
  onClose,
}: PrivateChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(formatCountdown(chat.expiresAt));
  const [dissolved, setDissolved] = useState(
    !chat.active || chat.expiresAt?.toDate().getTime() < Date.now()
  );
  const lastSentRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => subscribeToPrivateChatMessages(chat.id, setMessages),
    [chat.id]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const id = setInterval(() => {
      const c = formatCountdown(chat.expiresAt);
      setCountdown(c);
      if (c === "EXPIRED") {
        setDissolved(true);
        clearInterval(id);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [chat.expiresAt]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || dissolved) return;
    const now = Date.now();
    if (now - lastSentRef.current < 1000) return;
    lastSentRef.current = now;
    setSending(true);
    setInput("");
    try {
      await sendPrivateChatMessage(
        chat.id,
        { uid, name: displayName, photoURL },
        text
      );
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleDissolve = async () => {
    try {
      await dissolvePrivateChat(chat.id);
    } catch {
      // best effort
    }
    setDissolved(true);
    onClose();
  };

  const isCreator = chat.createdBy === uid;
  const memberList = Object.entries(chat.memberNames)
    .filter(([k]) => k !== uid)
    .map(([, v]) => v)
    .join(", ");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fbf8fc",
          border: "4px solid #1b1b1e",
          boxShadow: "8px 8px 0 #1b1b1e",
          width: "100%",
          maxWidth: 380,
          height: "68vh",
          maxHeight: 540,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "3px solid #1b1b1e",
            backgroundColor: "#ffd8e7",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: "#9f376f", flexShrink: 0 }}
          >
            lock
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontWeight: 900,
                fontSize: 11,
                textTransform: "uppercase",
                color: "#3d0025",
                letterSpacing: "0.04em",
              }}
            >
              PRIVATE GROUP
            </p>
            <p
              style={{
                fontSize: 11,
                color: "#544249",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {memberList || "Solo"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: dissolved ? "#ba1a1a" : "#4caf50",
                backgroundColor: dissolved ? "#ffd8e7" : "#c8f7c5",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1.5px solid #1b1b1e",
                textTransform: "uppercase",
              }}
            >
              {dissolved ? "DISSOLVED" : countdown}
            </span>
            {isCreator && !dissolved && (
              <button
                onClick={handleDissolve}
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#ba1a1a",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                  textDecoration: "underline",
                }}
              >
                DISSOLVE
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: "#3d0025" }}
            >
              close
            </span>
          </button>
        </div>

        {dissolved && (
          <div
            style={{
              backgroundColor: "#ffd8e7",
              padding: "8px 14px",
              borderBottom: "2px solid #1b1b1e",
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#ba1a1a",
                textAlign: "center",
              }}
            >
              This private chat has been dissolved.
            </p>
          </div>
        )}

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ textAlign: "center", paddingBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              🔒 Private · Auto-dissolves {countdown}
            </span>
          </div>
          {messages.length === 0 && !dissolved && (
            <p
              style={{
                textAlign: "center",
                color: "#999",
                fontSize: 12,
                fontWeight: 600,
                margin: "auto 0",
              }}
            >
              No messages yet — say something!
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems:
                  msg.senderUid === uid ? "flex-end" : "flex-start",
                gap: 2,
              }}
            >
              {msg.senderUid !== uid && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#9f376f",
                    textTransform: "uppercase",
                  }}
                >
                  {msg.senderName}
                </span>
              )}
              <div
                style={{
                  backgroundColor:
                    msg.senderUid === uid ? "#9f376f" : "#ffffff",
                  color: msg.senderUid === uid ? "white" : "#1b1b1e",
                  border: "2px solid #1b1b1e",
                  padding: "7px 12px",
                  maxWidth: 240,
                  overflowWrap: "anywhere",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  borderRadius:
                    msg.senderUid === uid
                      ? "10px 10px 2px 10px"
                      : "10px 10px 10px 2px",
                  boxShadow: "2px 2px 0 #1b1b1e",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        {!dissolved && (
          <div
            style={{
              padding: "10px 12px",
              borderTop: "3px solid #1b1b1e",
              display: "flex",
              gap: 8,
              backgroundColor: "#fbf8fc",
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
              placeholder="Private message..."
              style={{
                flex: 1,
                border: "2.5px solid #1b1b1e",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                outline: "none",
                backgroundColor: "#f6f2f7",
                borderRadius: 6,
                minWidth: 0,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                padding: "8px 12px",
                backgroundColor: "#9f376f",
                color: "white",
                border: "2.5px solid #1b1b1e",
                cursor:
                  !input.trim() || sending ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                borderRadius: 6,
                boxShadow: "3px 3px 0 #1b1b1e",
                opacity: !input.trim() || sending ? 0.5 : 1,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                send
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
