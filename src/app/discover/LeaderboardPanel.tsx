"use client";

import { useEffect, useState } from "react";
import { subscribeToLeaderboard, BADGE_DEFS, type UserProfile } from "@/lib/firestore";

interface Props {
  myUid: string;
}

export default function LeaderboardPanel({ myUid }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => subscribeToLeaderboard(setUsers), []);

  const myRank = users.findIndex((u) => u.email === myUid);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "4px solid #1b1b1e", backgroundColor: "#ffe24c" }}>
        <h2 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: "#1b1b1e" }}>
          🏆 LEADERBOARD
        </h2>
        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>
          Top players ranked by points
          {myRank >= 0 && ` · You're #${myRank + 1}`}
        </p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {users.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e" }}>No rankings yet</p>
          </div>
        )}

        {users.map((user, index) => {
          const isMe = user.email === myUid;
          const rank = index + 1;
          const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
          const points = user.points ?? 0;

          return (
            <div
              key={user.email}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                marginBottom: 8, border: "2px solid #1b1b1e",
                backgroundColor: isMe ? "#ffe24c" : "#fbf8fc",
                boxShadow: isMe ? "4px 4px 0 #1b1b1e" : "2px 2px 0 #1b1b1e",
              }}
            >
              {/* Rank */}
              <div style={{ minWidth: 36, textAlign: "center" }}>
                {rankEmoji ? (
                  <span style={{ fontSize: 24 }}>{rankEmoji}</span>
                ) : (
                  <span style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 18, color: "#544249" }}>
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e", overflow: "hidden", flexShrink: 0, backgroundColor: "#ffd8e7" }}>
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#9f376f", fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)" }}>
                    {(user.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.displayName}
                    {isMe && <span style={{ fontWeight: 600, fontSize: 10, color: "#9f376f", marginLeft: 6 }}>(YOU)</span>}
                  </p>
                  {user.kycStatus === "approved" && (
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#4caf50", flexShrink: 0 }}>verified</span>
                  )}
                </div>
                {/* Badges */}
                {user.badges && user.badges.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                    {user.badges.slice(0, 4).map((badge) => {
                      const def = BADGE_DEFS[badge];
                      if (!def) return null;
                      return (
                        <span
                          key={badge}
                          style={{ backgroundColor: def.color, border: "1px solid #1b1b1e", padding: "1px 5px", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}
                        >
                          {def.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Points */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 20, color: "#1b1b1e" }}>
                  {points.toLocaleString()}
                </p>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Points guide */}
      <div style={{ borderTop: "3px solid #1b1b1e", padding: "12px 16px", backgroundColor: "#ffd8e7" }}>
        <p style={{ fontWeight: 800, fontSize: 10, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 8 }}>EARN POINTS</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "Post challenge", pts: "+5" },
            { label: "Correct guess", pts: "+10" },
            { label: "Complete hunt", pts: "+20" },
            { label: "Join squad", pts: "+2" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ backgroundColor: "#ffe24c", border: "1px solid #1b1b1e", padding: "2px 6px", fontSize: 9, fontWeight: 800, color: "#1b1b1e" }}>{item.pts}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#544249", textTransform: "uppercase" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
