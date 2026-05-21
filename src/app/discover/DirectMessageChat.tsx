"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeToDMMessages,
  sendDMMessage,
  type ChatMessage,
} from "@/lib/firestore";

interface Props {
  chatId: string;
  myUid: string;
  myName: string;
  myPhoto: string;
  theirName: string;
  theirPhoto: string;
  onClose: () => void;
  onCall?: () => void;
}

export default function DirectMessageChat({ chatId, myUid, myName, myPhoto, theirName, theirPhoto, onClose, onCall }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return subscribeToDMMessages(chatId, setMessages);
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const now = Date.now();
    if (now - lastSentRef.current < 1000) return;
    lastSentRef.current = now;
    setSending(true);
    setInput("");
    try {
      await sendDMMessage(chatId, { uid: myUid, name: myName, photoURL: myPhoto }, text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "2px solid #1b1b1e", backgroundColor: "#ffd8e7", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: "#3d0025" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>
        {theirPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theirPhoto} alt={theirName} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1b1b1e", flexShrink: 0, objectFit: "cover" }} />
        )}
        <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", color: "#3d0025", flex: 1 }}>{theirName}</p>
        {onCall && (
          <button
            onClick={onCall}
            style={{ background: "#7ed4fd", border: "2px solid #1b1b1e", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, boxShadow: "2px 2px 0 #1b1b1e" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#005b78", fontVariationSettings: "'FILL' 1" }}>videocam</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#544249", fontSize: 12, fontWeight: 600, marginTop: 32 }}>
            Start the conversation
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderUid === myUid;
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
              {!isMe && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={msg.senderPhotoURL || theirPhoto} alt="" style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid #1b1b1e", flexShrink: 0, objectFit: "cover" }} />
              )}
              <div style={{
                maxWidth: "70%",
                padding: "8px 12px",
                backgroundColor: isMe ? "#9f376f" : "#e4e1e6",
                color: isMe ? "#fff" : "#1b1b1e",
                border: "2px solid #1b1b1e",
                boxShadow: isMe ? "-2px 2px 0 #1b1b1e" : "2px 2px 0 #1b1b1e",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: "2px solid #1b1b1e", display: "flex", gap: 8, flexShrink: 0, backgroundColor: "#fbf8fc" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message..."
          style={{
            flex: 1, padding: "10px 12px", border: "2px solid #1b1b1e",
            fontSize: 13, fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
            fontWeight: 600, backgroundColor: "#fbf8fc", outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            padding: "10px 16px", border: "2px solid #1b1b1e", backgroundColor: "#9f376f",
            color: "#fff", fontWeight: 800, fontSize: 11, textTransform: "uppercase",
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            opacity: !input.trim() || sending ? 0.5 : 1,
            fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
            boxShadow: "2px 2px 0 #1b1b1e",
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
