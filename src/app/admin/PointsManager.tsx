"use client";

import { useState, useEffect, useCallback } from "react";
import { db, PointsLogEntry, addPointsWithLog, subscribeToPointsLog } from "@/lib/firestore";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { authReady } from "@/lib/firebase";

interface UserRow {
  email: string;
  displayName: string;
  photoURL?: string;
  points: number;
  codename?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  if (!err && src) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "2px solid #1b1b1e", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 13, flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PointsBadge({ pts }: { pts: number }) {
  const color = pts >= 500 ? "#9f376f" : pts >= 100 ? "#e67e22" : "#2980b9";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      backgroundColor: color, color: "#fff",
      border: "2px solid #1b1b1e",
      fontSize: 12, fontWeight: 800,
      fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
    }}>
      {pts.toLocaleString()} pts
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function PointsManager({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [log, setLog]           = useState<PointsLogEntry[]>([]);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [amount, setAmount]     = useState("");
  const [reason, setReason]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab]           = useState<"leaderboard" | "log">("leaderboard");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    authReady.then(() => {
      const q = query(collection(db, "users"), orderBy("points", "desc"), limit(100));
      unsub = onSnapshot(q, (snap) => {
        setUsers(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                email: d.id,
                displayName: data.displayName ?? d.id,
                photoURL: data.photoURL,
                points: data.points ?? 0,
                codename: data.codename,
              } as UserRow;
            })
            .filter((u) => u.points > 0 || true) // include zero-point users
        );
      });
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    authReady.then(() => {
      unsub = subscribeToPointsLog(setLog);
    });
    return () => unsub?.();
  }, []);

  const handleAdjust = useCallback(async () => {
    if (!selected || !amount || !reason.trim()) return;
    const pts = parseInt(amount);
    if (isNaN(pts) || pts === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await addPointsWithLog(
        selected.email,
        selected.displayName,
        pts,
        reason.trim(),
        adminEmail,
      );
      setMsg({ text: `${pts > 0 ? "+" : ""}${pts} points applied to ${selected.displayName}`, ok: true });
      setAmount("");
      setReason("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMsg({ text: message, ok: false });
    } finally {
      setSubmitting(false);
    }
  }, [selected, amount, reason, adminEmail]);

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.codename ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

      {/* ── Left column ───────────────────────────────────────────────── */}
      <div>
        {/* Sub-tabs */}
        <div style={{
          display: "flex", borderBottom: "3px solid #1b1b1e", marginBottom: 20,
        }}>
          {(["leaderboard", "log"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 20px",
                backgroundColor: tab === t ? "#1b1b1e" : "transparent",
                color: tab === t ? "#ff85c1" : "#544249",
                border: "none", borderRight: "2px solid #e4e1e6",
                cursor: "pointer",
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 11, fontWeight: 800, textTransform: "uppercase",
              }}
            >
              {t === "leaderboard" ? "🏆 Leaderboard" : "📋 History"}
            </button>
          ))}
        </div>

        {tab === "leaderboard" && (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 14px", marginBottom: 16,
                border: "2px solid #1b1b1e",
                fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                fontSize: 13, fontWeight: 600, outline: "none",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((u, idx) => {
                const isSelected = selected?.email === u.email;
                return (
                  <div
                    key={u.email}
                    onClick={() => setSelected(isSelected ? null : u)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      backgroundColor: isSelected ? "#f3e8f7" : "#fff",
                      border: `2px solid ${isSelected ? "#9f376f" : "#e4e1e6"}`,
                      boxShadow: isSelected ? "3px 3px 0 #9f376f" : "none",
                      cursor: "pointer",
                      transition: "border-color 0.1s",
                    }}
                  >
                    <span style={{
                      minWidth: 28, textAlign: "center",
                      fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                      fontSize: 12, fontWeight: 800,
                      color: idx < 3 ? ["#c0a000", "#999", "#c07a00"][idx] : "#aaa",
                    }}>
                      {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `#${idx + 1}`}
                    </span>
                    <Avatar src={u.photoURL} name={u.displayName} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1b1b1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.displayName}
                      </div>
                      <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.codename ? `@${u.codename}` : u.email}
                      </div>
                    </div>
                    <PointsBadge pts={u.points} />
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontWeight: 700 }}>
                  No users found
                </div>
              )}
            </div>
          </>
        )}

        {tab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontWeight: 700 }}>
                No adjustments yet
              </div>
            ) : log.map((entry) => {
              const isPos = entry.amount > 0;
              return (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  backgroundColor: "#fff",
                  border: "2px solid #e4e1e6",
                }}>
                  <span style={{
                    minWidth: 52, textAlign: "center", padding: "3px 8px",
                    backgroundColor: isPos ? "#d4edda" : "#f8d7da",
                    border: `2px solid ${isPos ? "#28a745" : "#dc3545"}`,
                    fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                    fontSize: 12, fontWeight: 800,
                    color: isPos ? "#155724" : "#721c24",
                  }}>
                    {isPos ? "+" : ""}{entry.amount}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1b1b1e" }}>
                      {entry.userName}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {entry.reason}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", textAlign: "right", flexShrink: 0 }}>
                    <div>{entry.adminEmail?.split("@")[0]}</div>
                    <div>{entry.createdAt?.toDate().toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right column — Adjust panel ───────────────────────────────── */}
      <div style={{
        position: "sticky", top: 116,
        backgroundColor: "#fff",
        border: "3px solid #1b1b1e",
        boxShadow: "4px 4px 0 #1b1b1e",
        padding: 24,
      }}>
        <h3 style={{
          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          fontSize: 13, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.04em", margin: "0 0 18px",
        }}>
          Adjust Points
        </h3>

        {/* Selected user */}
        {selected ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: 12,
            backgroundColor: "#f3e8f7", border: "2px solid #9f376f",
            marginBottom: 16,
          }}>
            <Avatar src={selected.photoURL} name={selected.displayName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1b1b1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.displayName}
              </div>
              <div style={{ fontSize: 11, color: "#9f376f", fontWeight: 700 }}>
                Currently {selected.points.toLocaleString()} pts
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{
            padding: 16, border: "2px dashed #e4e1e6",
            color: "#aaa", fontSize: 12, fontWeight: 600,
            textAlign: "center", marginBottom: 16,
          }}>
            Select a user from the leaderboard
          </div>
        )}

        {/* Amount */}
        <div style={{ marginBottom: 12 }}>
          <label style={{
            display: "block", fontSize: 10, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.04em",
            color: "#544249", marginBottom: 4,
          }}>
            Points (use − for deduction)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="+50 or -25"
            disabled={!selected}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 12px",
              border: "2px solid #1b1b1e",
              fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
              fontSize: 13, fontWeight: 600, outline: "none",
              backgroundColor: selected ? "#fff" : "#f8f6fb",
            }}
          />
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 10, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.04em",
            color: "#544249", marginBottom: 4,
          }}>
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Event participation bonus"
            disabled={!selected}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 12px", resize: "vertical",
              border: "2px solid #1b1b1e",
              fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
              fontSize: 13, fontWeight: 600, outline: "none",
              backgroundColor: selected ? "#fff" : "#f8f6fb",
            }}
          />
        </div>

        <button
          onClick={handleAdjust}
          disabled={submitting || !selected || !amount || !reason.trim()}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: (submitting || !selected || !amount || !reason.trim()) ? "#ccc" : "#9f376f",
            color: "#fff",
            border: "3px solid #1b1b1e",
            boxShadow: (submitting || !selected || !amount || !reason.trim()) ? "none" : "3px 3px 0 #1b1b1e",
            cursor: (submitting || !selected || !amount || !reason.trim()) ? "not-allowed" : "pointer",
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 13, fontWeight: 800, textTransform: "uppercase",
          }}
        >
          {submitting ? "Applying…" : "Apply Adjustment"}
        </button>

        {msg && (
          <div style={{
            marginTop: 12, padding: "10px 14px",
            backgroundColor: msg.ok ? "#d4edda" : "#f8d7da",
            border: `2px solid ${msg.ok ? "#28a745" : "#dc3545"}`,
            fontSize: 12, fontWeight: 700,
            color: msg.ok ? "#155724" : "#721c24",
          }}>
            {msg.text}
          </div>
        )}

        {/* Quick presets */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#aaa", letterSpacing: "0.04em", marginBottom: 8 }}>
            Quick presets
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { label: "+10", val: "10", r: "Check-in bonus" },
              { label: "+25", val: "25", r: "Photo challenge" },
              { label: "+50", val: "50", r: "Event participation" },
              { label: "+100", val: "100", r: "Referral reward" },
              { label: "−10", val: "-10", r: "Penalty" },
              { label: "−50", val: "-50", r: "Abuse deduction" },
            ].map((p) => (
              <button
                key={p.label}
                disabled={!selected}
                onClick={() => { setAmount(p.val); setReason(p.r); }}
                style={{
                  padding: "4px 10px",
                  backgroundColor: !selected ? "#f0f0f0" : p.val.startsWith("-") ? "#f8d7da" : "#d4edda",
                  border: `2px solid ${!selected ? "#ddd" : p.val.startsWith("-") ? "#dc3545" : "#28a745"}`,
                  cursor: !selected ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                  fontSize: 11, fontWeight: 800,
                  color: !selected ? "#bbb" : p.val.startsWith("-") ? "#721c24" : "#155724",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
