"use client";

import { useEffect, useState } from "react";
import {
  subscribeToStoreItems,
  purchaseStoreItem,
  type StoreItem,
  type UserProfile,
} from "@/lib/firestore";

interface Props {
  uid: string;
  userProfile: UserProfile | null | undefined;
  onPointsUpdate: () => void;
}

export default function StorePanel({ uid, userProfile, onPointsUpdate }: Props) {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => subscribeToStoreItems(setItems), []);

  const points = userProfile?.points ?? 0;
  const ownedItems = userProfile?.ownedItems ?? [];

  async function handleBuy(item: StoreItem) {
    if (buying) return;
    setBuying(item.id);
    setMessage(null);
    try {
      const result = await purchaseStoreItem(uid, item);
      if (result.success) {
        setMessage({ text: `Unlocked: ${item.name}!`, ok: true });
        onPointsUpdate();
      } else {
        setMessage({ text: result.reason ?? "Purchase failed", ok: false });
      }
    } finally {
      setBuying(null);
    }
  }

  const typeIcon = (type: StoreItem["type"]) =>
    type === "badge" ? "military_tech" : type === "frame" ? "crop_free" : "emoji_emotions";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "4px solid #1b1b1e", backgroundColor: "#ffd8e7" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: "#1b1b1e" }}>
              🛍️ STORE
            </h2>
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>
              Unlock badges and items with points
            </p>
          </div>
          <div style={{ background: "#ffe24c", border: "2px solid #1b1b1e", padding: "6px 12px", boxShadow: "2px 2px 0 #1b1b1e", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 22, color: "#1b1b1e", lineHeight: 1 }}>{points}</p>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>YOUR POINTS</p>
          </div>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div style={{ padding: "10px 16px", backgroundColor: message.ok ? "#c8f7c5" : "#ffd8e7", borderBottom: "2px solid #1b1b1e" }}>
          <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: message.ok ? "#1b1b1e" : "#ba1a1a" }}>
            {message.ok ? "✓ " : "⚠ "}{message.text}
          </p>
        </div>
      )}

      {/* Items grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
            <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 6 }}>Store coming soon</p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>Keep earning points — new items drop regularly!</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {items.map((item) => {
            const owned = ownedItems.includes(item.id);
            const canAfford = points >= item.cost;
            const isBuying = buying === item.id;

            return (
              <div
                key={item.id}
                style={{
                  border: `2px solid ${owned ? "#4caf50" : "#1b1b1e"}`,
                  backgroundColor: owned ? "#c8f7c5" : "#fbf8fc",
                  boxShadow: owned ? "none" : "3px 3px 0 #1b1b1e",
                  padding: 14, display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                {/* Icon/Emoji */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, height: 40, backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {item.emoji || (
                      <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
                        {typeIcon(item.type)}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    <p style={{ fontSize: 9, color: "#544249", fontWeight: 600, textTransform: "uppercase" }}>{item.type}</p>
                  </div>
                </div>

                <p style={{ fontSize: 10, color: "#544249", fontWeight: 600, lineHeight: 1.4 }}>{item.description}</p>

                {/* Cost + button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 14 }}>⭐</span>
                    <span style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 16, color: canAfford ? "#1b1b1e" : "#ba1a1a" }}>
                      {item.cost}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>pts</span>
                  </div>

                  {owned ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#4caf50" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>OWNED</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={!canAfford || isBuying}
                      aria-label={`Buy ${item.name} for ${item.cost} points`}
                      style={{
                        padding: "6px 12px", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 10,
                        textTransform: "uppercase", cursor: canAfford && !isBuying ? "pointer" : "not-allowed",
                        backgroundColor: canAfford ? "#9f376f" : "#e4e1e6",
                        color: canAfford ? "white" : "#544249",
                        boxShadow: canAfford ? "2px 2px 0 #1b1b1e" : "none",
                        fontFamily: "inherit",
                      }}
                    >
                      {isBuying ? "..." : "BUY"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div style={{ borderTop: "3px solid #1b1b1e", padding: "10px 16px", backgroundColor: "#fbf8fc", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#9f376f" }}>info</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#544249" }}>Earn points by posting challenges, guessing correctly, and completing hunts.</span>
      </div>
    </div>
  );
}
