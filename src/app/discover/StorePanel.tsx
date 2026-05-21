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
  const [cart, setCart] = useState<StoreItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | StoreItem["type"]>("all");

  useEffect(() => subscribeToStoreItems(setItems), []);

  const points = userProfile?.points ?? 0;
  const ownedItems = userProfile?.ownedItems ?? [];

  const cartTotal = cart.reduce((sum, item) => sum + item.cost, 0);
  const filteredItems = filter === "all" ? items : items.filter(i => i.type === filter);

  function toggleCart(item: StoreItem) {
    if (ownedItems.includes(item.id)) return;
    setCart(prev => {
      const inCart = prev.some(i => i.id === item.id);
      return inCart ? prev.filter(i => i.id !== item.id) : [...prev, item];
    });
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    if (cartTotal > points) {
      setMessage({ text: "Not enough points for all items", ok: false });
      return;
    }
    setChecking(true);
    setMessage(null);
    let successCount = 0;
    const errors: string[] = [];
    for (const item of cart) {
      const result = await purchaseStoreItem(uid, item);
      if (result.success) successCount++;
      else errors.push(result.reason ?? item.name);
    }
    setChecking(false);
    if (successCount > 0) {
      setMessage({ text: `Unlocked ${successCount} item${successCount > 1 ? "s" : ""}! 🎉`, ok: true });
      setCart([]);
      setCartOpen(false);
      onPointsUpdate();
    } else {
      setMessage({ text: errors[0] ?? "Purchase failed", ok: false });
    }
  }

  const typeIcon = (type: StoreItem["type"]) =>
    type === "badge" ? "military_tech" : type === "frame" ? "crop_free" : "emoji_emotions";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fbf8fc", position: "relative" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "4px solid #1b1b1e", backgroundColor: "#ffd8e7", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: "#1b1b1e" }}>
              🛍️ STORE
            </h2>
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Unlock badges and rewards with your points</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {/* Cart button */}
            <button
              onClick={() => setCartOpen(v => !v)}
              style={{
                position: "relative", padding: "8px 14px",
                backgroundColor: cart.length > 0 ? "#9f376f" : "#fbf8fc",
                border: "2px solid #1b1b1e", cursor: "pointer",
                fontWeight: 800, fontSize: 12, fontFamily: "inherit",
                color: cart.length > 0 ? "white" : "#1b1b1e",
                boxShadow: "2px 2px 0 #1b1b1e",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shopping_cart</span>
              {cart.length > 0 && <span>{cart.length}</span>}
            </button>
            {/* Points balance */}
            <div style={{ background: "#ffe24c", border: "2px solid #1b1b1e", padding: "6px 10px", boxShadow: "2px 2px 0 #1b1b1e", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 20, color: "#1b1b1e", lineHeight: 1 }}>{points}</p>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>POINTS</p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "badge", "frame", "emoji"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10,
                textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
                backgroundColor: filter === f ? "#1b1b1e" : "#fbf8fc",
                color: filter === f ? "#ffe24c" : "#544249",
              }}
            >
              {f === "all" ? "ALL" : f.toUpperCase() + "S"}
            </button>
          ))}
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div style={{ padding: "10px 16px", backgroundColor: message.ok ? "#c8f7c5" : "#ffd8e7", borderBottom: "2px solid #1b1b1e", flexShrink: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: message.ok ? "#1b1b1e" : "#ba1a1a" }}>
            {message.ok ? "✓ " : "⚠ "}{message.text}
          </p>
        </div>
      )}

      {/* Items grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
            <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 6 }}>Store coming soon</p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>Keep earning points — items drop regularly!</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {filteredItems.map((item) => {
            const owned = ownedItems.includes(item.id);
            const inCart = cart.some(i => i.id === item.id);
            const canAfford = points >= item.cost;

            return (
              <div
                key={item.id}
                style={{
                  border: `2px solid ${owned ? "#4caf50" : inCart ? "#9f376f" : "#1b1b1e"}`,
                  backgroundColor: owned ? "#c8f7c5" : inCart ? "#ffd8e7" : "#fbf8fc",
                  boxShadow: owned ? "none" : `3px 3px 0 ${inCart ? "#9f376f" : "#1b1b1e"}`,
                  padding: 14, display: "flex", flexDirection: "column", gap: 8,
                  transition: "all 0.1s",
                }}
              >
                {/* Icon / Emoji */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 44, height: 44, backgroundColor: owned ? "#c8f7c5" : "#ffe24c",
                    border: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                  }}>
                    {item.emoji || (
                      <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
                        {typeIcon(item.type)}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: 11, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1b1b1e" }}>{item.name}</p>
                    <span style={{
                      fontSize: 8, fontWeight: 700, textTransform: "uppercase", padding: "1px 5px",
                      backgroundColor: item.type === "badge" ? "#ffd8e7" : item.type === "frame" ? "#7ed4fd" : "#ffe24c",
                      border: "1px solid #1b1b1e",
                    }}>{item.type}</span>
                  </div>
                </div>

                <p style={{ fontSize: 10, color: "#544249", fontWeight: 600, lineHeight: 1.4 }}>{item.description}</p>

                {/* Cost + CTA */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 14 }}>⭐</span>
                    <span style={{
                      fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                      fontWeight: 900, fontSize: 18,
                      color: canAfford || owned ? "#1b1b1e" : "#ba1a1a"
                    }}>
                      {item.cost}
                    </span>
                  </div>

                  {owned ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#4caf50" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>OWNED</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleCart(item)}
                      disabled={!canAfford && !inCart}
                      aria-label={inCart ? `Remove ${item.name} from cart` : `Add ${item.name} to cart`}
                      style={{
                        padding: "6px 12px", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 9,
                        textTransform: "uppercase", cursor: canAfford || inCart ? "pointer" : "not-allowed",
                        backgroundColor: inCart ? "#9f376f" : canAfford ? "#ffe24c" : "#e4e1e6",
                        color: inCart ? "white" : canAfford ? "#1b1b1e" : "#544249",
                        boxShadow: canAfford || inCart ? "2px 2px 0 #1b1b1e" : "none",
                        fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                        {inCart ? "remove_shopping_cart" : "add_shopping_cart"}
                      </span>
                      {inCart ? "REMOVE" : "ADD"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart drawer */}
      {cartOpen && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 40,
          backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e", borderBottom: "none",
          boxShadow: "0 -6px 0 #1b1b1e", padding: 20, maxHeight: "60vh", overflowY: "auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 16, textTransform: "uppercase" }}>
              🛒 CART ({cart.length})
            </p>
            <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#544249" }}>close</span>
            </button>
          </div>

          {cart.length === 0 ? (
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, textAlign: "center", padding: "16px 0" }}>Cart is empty</p>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #e4e1e6" }}>
                  <div style={{ width: 32, height: 32, backgroundColor: "#ffe24c", border: "1.5px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {item.emoji || "🎁"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>{item.name}</p>
                    <p style={{ fontSize: 10, color: "#544249" }}>⭐ {item.cost} pts</p>
                  </div>
                  <button onClick={() => toggleCart(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ba1a1a" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                </div>
              ))}

              {/* Total + checkout */}
              <div style={{ marginTop: 14, padding: "10px 14px", backgroundColor: cartTotal > points ? "#ffd8e7" : "#c8f7c5", border: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>TOTAL: ⭐ {cartTotal}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: cartTotal > points ? "#ba1a1a" : "#4caf50" }}>
                  {cartTotal > points ? `Need ${cartTotal - points} more pts` : `Balance: ${points - cartTotal}`}
                </p>
              </div>
              <button
                onClick={handleCheckout}
                disabled={checking || cartTotal > points}
                style={{
                  width: "100%", padding: "14px", border: "3px solid #1b1b1e",
                  backgroundColor: checking || cartTotal > points ? "#e4e1e6" : "#9f376f",
                  color: checking || cartTotal > points ? "#544249" : "white",
                  fontWeight: 900, fontSize: 14, textTransform: "uppercase",
                  cursor: checking || cartTotal > points ? "not-allowed" : "pointer",
                  boxShadow: cartTotal <= points ? "4px 4px 0 #1b1b1e" : "none",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>shopping_bag</span>
                {checking ? "PROCESSING…" : `CHECKOUT (⭐ ${cartTotal})`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Sticky cart bar when items in cart and drawer closed */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: "sticky", bottom: 0, left: 0, right: 0,
            width: "100%", padding: "14px", backgroundColor: "#9f376f", color: "white",
            border: "none", borderTop: "3px solid #1b1b1e", fontWeight: 900, fontSize: 13,
            textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>shopping_cart</span>
          VIEW CART — {cart.length} ITEM{cart.length > 1 ? "S" : ""} · ⭐ {cartTotal}
        </button>
      )}
    </div>
  );
}
