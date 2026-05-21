"use client";

import { useEffect, useState } from "react";
import { subscribeToAllStoreItems, createStoreItem, updateStoreItem, type StoreItem } from "@/lib/firestore";

export default function StoreManager() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", cost: "50", type: "badge" as StoreItem["type"],
    value: "", emoji: "", active: true,
  });

  useEffect(() => subscribeToAllStoreItems(setItems), []);

  async function handleCreate() {
    if (!form.name.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      await createStoreItem({
        name: form.name.trim().toUpperCase(),
        description: form.description.trim(),
        cost: parseInt(form.cost) || 50,
        type: form.type,
        value: form.value.trim(),
        emoji: form.emoji.trim() || undefined,
        active: form.active,
      });
      setForm({ name: "", description: "", cost: "50", type: "badge", value: "", emoji: "", active: true });
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: StoreItem) {
    await updateStoreItem(item.id, { active: !item.active });
  }

  const inputStyle = {
    width: "100%", padding: "8px 12px", border: "2px solid #1b1b1e", fontSize: 12,
    fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", backgroundColor: "#fbf8fc",
    outline: "none", boxSizing: "border-box" as const, marginBottom: 8,
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: "#544249" }}>{items.length} store item{items.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ padding: "8px 16px", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e" }}
        >
          + NEW ITEM
        </button>
      </div>

      {showCreate && (
        <div style={{ border: "3px solid #1b1b1e", padding: 20, backgroundColor: "#fffde7", boxShadow: "4px 4px 0 #1b1b1e", marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", marginBottom: 12 }}>CREATE STORE ITEM</p>
          <input style={inputStyle} placeholder="Name (e.g. GOLDEN BADGE)" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} />
          <input style={inputStyle} placeholder="Description" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Cost (points)" type="number" value={form.cost} onChange={e => setForm(v => ({ ...v, cost: e.target.value }))} />
            <select style={{ ...inputStyle, flex: 1 }} value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value as StoreItem["type"] }))}>
              <option value="badge">Badge</option>
              <option value="frame">Frame</option>
              <option value="emoji">Emoji</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 2 }} placeholder="Value (badge key or color)" value={form.value} onChange={e => setForm(v => ({ ...v, value: e.target.value }))} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Emoji (optional)" value={form.emoji} onChange={e => setForm(v => ({ ...v, emoji: e.target.value }))} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input type="checkbox" id="active-check" checked={form.active} onChange={e => setForm(v => ({ ...v, active: e.target.checked }))} />
            <label htmlFor="active-check" style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Active (visible in store)</label>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !form.name.trim() || !form.value.trim()}
            style={{ padding: "10px 20px", backgroundColor: "#9f376f", color: "#fff", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e" }}
          >
            {saving ? "SAVING…" : "CREATE"}
          </button>
        </div>
      )}

      {items.length === 0 && !showCreate && (
        <p style={{ color: "#544249", fontSize: 12, fontWeight: 600 }}>No store items yet. Create one above.</p>
      )}

      {items.map((item) => (
        <div key={item.id} style={{ border: "2px solid #1b1b1e", padding: 14, backgroundColor: item.active ? "#fbf8fc" : "#f0f0f0", boxShadow: "2px 2px 0 #1b1b1e", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28, width: 40, textAlign: "center" }}>{item.emoji || "🎁"}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>{item.name}</p>
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>{item.description}</p>
            <p style={{ fontSize: 10, color: "#9f376f", fontWeight: 700, marginTop: 2 }}>{item.type} · value: {item.value} · ⭐ {item.cost} pts</p>
          </div>
          <button
            onClick={() => toggleActive(item)}
            style={{
              padding: "6px 12px", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase", cursor: "pointer",
              backgroundColor: item.active ? "#c8f7c5" : "#ffd8e7",
              color: "#1b1b1e",
            }}
          >
            {item.active ? "ACTIVE" : "HIDDEN"}
          </button>
        </div>
      ))}
    </div>
  );
}
