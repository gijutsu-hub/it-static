"use client";

import { useState } from "react";
import { doCheckIn } from "@/lib/firestore";
import { getTier } from "@/lib/tiers";

export default function CheckInWidget({
  uid,
  displayName,
  photoURL,
  points,
  streakCount,
  lastCheckIn,
  onCheckedIn,
}: {
  uid: string;
  displayName: string;
  photoURL: string;
  points: number;
  streakCount?: number;
  lastCheckIn?: { toDate: () => Date };
  onCheckedIn?: (newStreak: number, pts: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ newStreak: number; alreadyDone: boolean; pointsEarned: number } | null>(null);
  const [open, setOpen] = useState(false);

  const tier = getTier(points);

  const alreadyDoneToday = (() => {
    if (!lastCheckIn) return false;
    const today = new Date().toISOString().slice(0, 10);
    return lastCheckIn.toDate().toISOString().slice(0, 10) === today;
  })();

  async function handleCheckIn() {
    setLoading(true);
    try {
      const res = await doCheckIn(uid, displayName, photoURL, tier.name);
      setResult(res);
      setOpen(true);
      if (!res.alreadyDone && onCheckedIn) {
        onCheckedIn(res.newStreak, res.pointsEarned);
      }
    } catch (e) {
      console.error("Check-in failed", e);
    } finally {
      setLoading(false);
    }
  }

  const currentStreak = result?.newStreak ?? streakCount ?? 0;

  return (
    <>
      {/* Floating check-in button */}
      <button
        onClick={alreadyDoneToday && !open ? () => setOpen(true) : handleCheckIn}
        disabled={loading}
        title={alreadyDoneToday ? "Already checked in today" : "Daily check-in"}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "10px 14px",
          backgroundColor: alreadyDoneToday ? "#d4edda" : "#9f376f",
          border: `3px solid ${alreadyDoneToday ? "#28a745" : "#1b1b1e"}`,
          boxShadow: `3px 3px 0 ${alreadyDoneToday ? "#28a745" : "#1b1b1e"}`,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "transform 0.1s",
        }}
      >
        <span className="material-symbols-outlined" style={{
          fontSize: 22,
          color: alreadyDoneToday ? "#155724" : "#fff",
          fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 24",
        }}>
          {alreadyDoneToday ? "check_circle" : "where_to_vote"}
        </span>
        {currentStreak > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: "uppercase",
            color: alreadyDoneToday ? "#155724" : "#ffe24c",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          }}>
            🔥{currentStreak}d
          </span>
        )}
      </button>

      {/* Result modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fbf8fc",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              padding: 32, maxWidth: 340, width: "90%",
              textAlign: "center",
            }}
          >
            {result?.alreadyDone || alreadyDoneToday ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#28a745", fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <h3 style={{
                  fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                  fontSize: 18, fontWeight: 800, textTransform: "uppercase",
                  margin: "12px 0 6px",
                }}>
                  Already checked in!
                </h3>
                <p style={{ color: "#666", fontSize: 13, margin: "0 0 8px" }}>
                  You&apos;ve already checked in today. Come back tomorrow to keep your streak going!
                </p>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 16px",
                  backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
                  fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                  fontWeight: 800, fontSize: 13, textTransform: "uppercase",
                }}>
                  🔥 {currentStreak}-day streak
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 52 }}>
                  {(result?.newStreak ?? 0) >= 7 ? "🔥" : "✅"}
                </div>
                <h3 style={{
                  fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                  fontSize: 20, fontWeight: 800, textTransform: "uppercase",
                  margin: "12px 0 6px",
                }}>
                  Checked in!
                </h3>
                {result && (
                  <>
                    <p style={{ color: "#544249", fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>
                      +{result.pointsEarned} points earned
                      {result.newStreak > 1 && ` (streak bonus!)`}
                    </p>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "8px 20px",
                      backgroundColor: "#9f376f", color: "#fff",
                      border: "3px solid #1b1b1e", boxShadow: "3px 3px 0 #1b1b1e",
                      fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                      fontWeight: 800, fontSize: 16, textTransform: "uppercase",
                    }}>
                      🔥 Day {result.newStreak}
                    </div>
                    {result.newStreak >= 7 && (
                      <p style={{ marginTop: 12, fontSize: 12, color: "#9f376f", fontWeight: 700 }}>
                        Week streak unlocked! Keep hunting.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 20, padding: "8px 24px",
                backgroundColor: "#1b1b1e", color: "#fff",
                border: "2px solid #1b1b1e", cursor: "pointer",
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontWeight: 800, fontSize: 12, textTransform: "uppercase",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
