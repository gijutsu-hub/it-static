"use client";

import { useEffect, useState } from "react";
import {
  subscribeToActiveHunts,
  subscribeToMyHuntProgress,
  subscribeToHuntHints,
  collectHint,
  type TreasureHunt,
  type HuntHint,
  type HuntProgress,
} from "@/lib/firestore";

interface Props {
  uid: string;
  userLocation: { lat: number; lng: number } | null;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TreasureHuntPanel({ uid, userLocation }: Props) {
  const [hunts, setHunts] = useState<TreasureHunt[]>([]);
  const [progress, setProgress] = useState<HuntProgress[]>([]);
  const [selectedHunt, setSelectedHunt] = useState<TreasureHunt | null>(null);
  const [hints, setHints] = useState<HuntHint[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [justCollected, setJustCollected] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeToActiveHunts(setHunts);
    const u2 = subscribeToMyHuntProgress(uid, setProgress);
    return () => { u1(); u2(); };
  }, [uid]);

  useEffect(() => {
    if (!selectedHunt) return;
    return subscribeToHuntHints(selectedHunt.id, setHints);
  }, [selectedHunt]);

  function getProgress(huntId: string) {
    return progress.find((p) => p.huntId === huntId);
  }

  async function handleCollect(hint: HuntHint) {
    if (!selectedHunt) return;
    setCollecting(hint.id);
    try {
      await collectHint(uid, selectedHunt.id, hint.id, selectedHunt.totalHints, selectedHunt.rewardBadge);
      setJustCollected(hint.id);
      setTimeout(() => setJustCollected(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setCollecting(null);
    }
  }

  if (selectedHunt) {
    const prog = getProgress(selectedHunt.id);
    const collected = prog?.collectedHintIds ?? [];
    const completed = prog?.completed ?? false;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#fbf8fc" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "3px solid #1b1b1e", backgroundColor: "#ffe24c", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setSelectedHunt(null); setHints([]); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#1b1b1e" }}>arrow_back</span>
            </button>
            <span style={{ fontSize: 24 }}>{selectedHunt.coverEmoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 16, textTransform: "uppercase" }}>{selectedHunt.title}</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#544249" }}>{collected.length}/{selectedHunt.totalHints} hints found</p>
            </div>
            {completed && (
              <span style={{ backgroundColor: "#c8f7c5", border: "2px solid #1b1b1e", padding: "3px 8px", fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>COMPLETED ✓</span>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 10, height: 8, backgroundColor: "#e4e1e6", border: "2px solid #1b1b1e", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${selectedHunt.totalHints > 0 ? (collected.length / selectedHunt.totalHints) * 100 : 0}%`, backgroundColor: "#9f376f", transition: "width 0.4s" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {hints.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#544249", fontWeight: 600 }}>Loading hints…</div>
          )}

          {hints.map((hint, i) => {
            const isCollected = collected.includes(hint.id);
            const prevCollected = i === 0 || collected.includes(hints[i - 1]?.id ?? "");
            const isNextTarget = !isCollected && prevCollected;
            const dist = userLocation ? distanceMeters(userLocation.lat, userLocation.lng, hint.location.lat, hint.location.lng) : null;
            const inRange = dist !== null && dist <= hint.radiusMeters;
            const isJustCollected = justCollected === hint.id;

            return (
              <div
                key={hint.id}
                style={{
                  border: `3px solid ${isCollected ? "#4caf50" : isNextTarget ? "#ffe24c" : "#e4e1e6"}`,
                  backgroundColor: isCollected ? "#c8f7c5" : isNextTarget ? "#fffde7" : "#f5f2f6",
                  boxShadow: isNextTarget ? "4px 4px 0 #1b1b1e" : "2px 2px 0 #e4e1e6",
                  padding: "14px 16px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isJustCollected && (
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "#ffe24c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, animation: "fadeOut 3s forwards" }}>
                    <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>🎉 HINT COLLECTED!</p>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: isCollected ? "#4caf50" : isNextTarget ? "#ffe24c" : "#e4e1e6", border: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1", color: isCollected ? "#fff" : "#1b1b1e" }}>
                      {isCollected ? "check" : isNextTarget ? "explore" : "lock"}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#544249", marginBottom: 4 }}>HINT #{hint.order}</p>
                    {(isCollected || isNextTarget) ? (
                      <>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#1b1b1e", lineHeight: 1.4, marginBottom: 6 }}>"{hint.riddle}"</p>
                        {isNextTarget && hint.clueText && (
                          <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, backgroundColor: "#fff", border: "1px solid #e4e1e6", padding: "6px 10px", marginTop: 4 }}>
                            💡 {hint.clueText}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontWeight: 600, fontSize: 12, color: "#999", fontStyle: "italic" }}>Collect previous hints to unlock</p>
                    )}
                    {isNextTarget && dist !== null && (
                      <p style={{ fontSize: 10, fontWeight: 700, marginTop: 6, color: inRange ? "#4caf50" : "#9f376f" }}>
                        {inRange ? "📍 You're here! Collect now!" : `📍 ${Math.round(dist)}m away`}
                      </p>
                    )}
                  </div>
                </div>
                {isNextTarget && inRange && !isCollected && (
                  <button
                    onClick={() => handleCollect(hint)}
                    disabled={collecting === hint.id}
                    style={{
                      width: "100%", marginTop: 12, padding: "12px",
                      backgroundColor: "#9f376f", color: "#fff", border: "3px solid #1b1b1e",
                      fontWeight: 800, fontSize: 13, textTransform: "uppercase", cursor: "pointer",
                      boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                      {collecting === hint.id ? "hourglass_empty" : "treasure"}
                    </span>
                    {collecting === hint.id ? "COLLECTING…" : "🎁 COLLECT HINT"}
                  </button>
                )}
              </div>
            );
          })}

          {completed && selectedHunt.rewardBadge && (
            <div style={{ padding: "20px", backgroundColor: "#ffe24c", border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>🏆 HUNT COMPLETE!</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#544249", marginTop: 4 }}>Badge awarded: {selectedHunt.rewardBadge.toUpperCase()}</p>
            </div>
          )}
        </div>
        <style>{`@keyframes fadeOut { 0%{opacity:1} 80%{opacity:1} 100%{opacity:0;pointer-events:none} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "3px solid #1b1b1e", backgroundColor: "#ffe24c", flexShrink: 0 }}>
        <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 18, textTransform: "uppercase" }}>
          🗺️ TREASURE HUNTS
        </p>
        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Find hints on the map · collect rewards</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {hunts.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#544249" }}>
            <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>🗝️</span>
            <p style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>No active hunts</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Check back soon — hunts drop without warning</p>
          </div>
        )}

        {hunts.map((hunt) => {
          const prog = getProgress(hunt.id);
          const collected = prog?.collectedHintIds?.length ?? 0;
          const completed = prog?.completed ?? false;

          return (
            <button
              key={hunt.id}
              onClick={() => setSelectedHunt(hunt)}
              style={{
                border: `3px solid ${completed ? "#4caf50" : "#1b1b1e"}`,
                backgroundColor: completed ? "#c8f7c5" : "#fbf8fc",
                boxShadow: "4px 4px 0 #1b1b1e",
                padding: "16px 18px",
                textAlign: "left", cursor: "pointer",
                fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                display: "flex", alignItems: "center", gap: 14,
              }}
            >
              <span style={{ fontSize: 36, flexShrink: 0 }}>{hunt.coverEmoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 15, textTransform: "uppercase" }}>{hunt.title}</p>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hunt.description}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 6, backgroundColor: "#e4e1e6", border: "1.5px solid #1b1b1e", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${hunt.totalHints > 0 ? (collected / hunt.totalHints) * 100 : 0}%`, backgroundColor: completed ? "#4caf50" : "#9f376f" }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#1b1b1e", flexShrink: 0 }}>{collected}/{hunt.totalHints}</span>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#544249", flexShrink: 0 }}>chevron_right</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
