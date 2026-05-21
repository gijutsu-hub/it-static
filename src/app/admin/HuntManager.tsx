"use client";

import { useEffect, useState } from "react";
import {
  subscribeToActiveHunts,
  createHunt,
  createHuntHint,
  type TreasureHunt,
} from "@/lib/firestore";

export default function HuntManager() {
  const [hunts, setHunts] = useState<TreasureHunt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddHint, setShowAddHint] = useState<string | null>(null);

  const [huntForm, setHuntForm] = useState({ title: "", description: "", coverEmoji: "🗺️", rewardBadge: "explorer" });
  const [hintForm, setHintForm] = useState({ order: "1", lat: "", lng: "", riddle: "", clueText: "", radiusMeters: "30" });
  const [creating, setCreating] = useState(false);

  useEffect(() => subscribeToActiveHunts(setHunts), []);

  async function handleCreateHunt() {
    if (!huntForm.title.trim()) return;
    setCreating(true);
    try {
      await createHunt({
        title: huntForm.title.trim().toUpperCase(),
        description: huntForm.description.trim(),
        coverEmoji: huntForm.coverEmoji || "🗺️",
        active: true,
        createdBy: "admin",
        totalHints: 0,
        rewardBadge: huntForm.rewardBadge || undefined,
      });
      setHuntForm({ title: "", description: "", coverEmoji: "🗺️", rewardBadge: "explorer" });
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddHint(huntId: string) {
    const lat = parseFloat(hintForm.lat);
    const lng = parseFloat(hintForm.lng);
    if (isNaN(lat) || isNaN(lng) || !hintForm.riddle.trim()) return;
    setCreating(true);
    try {
      await createHuntHint({
        huntId,
        order: parseInt(hintForm.order) || 1,
        location: { lat, lng },
        riddle: hintForm.riddle.trim(),
        clueText: hintForm.clueText.trim(),
        radiusMeters: parseInt(hintForm.radiusMeters) || 30,
      });
      setHintForm({ order: "1", lat: "", lng: "", riddle: "", clueText: "", radiusMeters: "30" });
      setShowAddHint(null);
    } finally {
      setCreating(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 12px", border: "2px solid #1b1b1e", fontSize: 12,
    fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", backgroundColor: "#fbf8fc",
    outline: "none", boxSizing: "border-box" as const, marginBottom: 8,
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: "#544249" }}>{hunts.length} active hunt{hunts.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ padding: "8px 16px", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e" }}
        >
          + NEW HUNT
        </button>
      </div>

      {showCreate && (
        <div style={{ border: "3px solid #1b1b1e", padding: 20, backgroundColor: "#fffde7", boxShadow: "4px 4px 0 #1b1b1e", marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", marginBottom: 12 }}>CREATE HUNT</p>
          <input style={inputStyle} placeholder="Title (e.g. URBAN CIPHER)" value={huntForm.title} onChange={(e) => setHuntForm(v => ({ ...v, title: e.target.value }))} />
          <input style={inputStyle} placeholder="Description" value={huntForm.description} onChange={(e) => setHuntForm(v => ({ ...v, description: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Cover emoji (🗺️)" value={huntForm.coverEmoji} onChange={(e) => setHuntForm(v => ({ ...v, coverEmoji: e.target.value }))} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Reward badge (explorer)" value={huntForm.rewardBadge} onChange={(e) => setHuntForm(v => ({ ...v, rewardBadge: e.target.value }))} />
          </div>
          <button onClick={handleCreateHunt} disabled={creating} style={{ padding: "10px 20px", backgroundColor: "#9f376f", color: "#fff", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e" }}>
            {creating ? "CREATING…" : "CREATE"}
          </button>
        </div>
      )}

      {hunts.length === 0 && !showCreate && (
        <p style={{ color: "#544249", fontSize: 12, fontWeight: 600 }}>No active hunts. Create one above.</p>
      )}

      {hunts.map((hunt) => (
        <div key={hunt.id} style={{ border: "2px solid #1b1b1e", padding: 16, backgroundColor: "#fbf8fc", boxShadow: "3px 3px 0 #1b1b1e", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{hunt.coverEmoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase" }}>{hunt.title}</p>
              <p style={{ fontSize: 11, color: "#544249" }}>{hunt.description} · {hunt.totalHints} hints · Reward: {hunt.rewardBadge ?? "none"}</p>
            </div>
            <button onClick={() => setShowAddHint(showAddHint === hunt.id ? null : hunt.id)} style={{ padding: "6px 12px", backgroundColor: "#7ed4fd", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer" }}>
              + HINT
            </button>
          </div>

          {showAddHint === hunt.id && (
            <div style={{ border: "2px dashed #1b1b1e", padding: 12, backgroundColor: "#f0f8ff", marginTop: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", marginBottom: 8, color: "#544249" }}>ADD HINT TO HUNT</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Hint order (1)" value={hintForm.order} onChange={(e) => setHintForm(v => ({ ...v, order: e.target.value }))} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Radius (metres)" value={hintForm.radiusMeters} onChange={(e) => setHintForm(v => ({ ...v, radiusMeters: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Latitude (e.g. 1.3521)" value={hintForm.lat} onChange={(e) => setHintForm(v => ({ ...v, lat: e.target.value }))} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Longitude (e.g. 103.8198)" value={hintForm.lng} onChange={(e) => setHintForm(v => ({ ...v, lng: e.target.value }))} />
              </div>
              <input style={inputStyle} placeholder="Riddle / question shown to player" value={hintForm.riddle} onChange={(e) => setHintForm(v => ({ ...v, riddle: e.target.value }))} />
              <input style={inputStyle} placeholder="Clue text (directional hint)" value={hintForm.clueText} onChange={(e) => setHintForm(v => ({ ...v, clueText: e.target.value }))} />
              <button onClick={() => handleAddHint(hunt.id)} disabled={creating} style={{ padding: "8px 16px", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e" }}>
                {creating ? "SAVING…" : "DROP HINT"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
