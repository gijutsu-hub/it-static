"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeToUsers,
  subscribeToFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  type UserProfile,
  type FriendRequest,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

const INTEREST_COLORS: Record<string, string> = {
  "K-POP VIBES": "#ff85c1",
  "TECH TALK": "#7ed4fd",
  "ROOFTOP BEATS": "#7ed4fd",
  "URBAN ART": "#ffe24c",
  "SKATE CREW": "#ffe24c",
  "RAVE SIGNAL": "#ff85c1",
  "CHILL ZONE": "#c0e8ff",
  "GLITCH ART": "#ffd8e7",
  "SYNTH-WAVE": "#c0e8ff",
  "HARD-LINE": "#e4e1e6",
  "LO-FI": "#ffe24c",
};

interface Props {
  uid: string;
}

type RequestStatus = "none" | "sent" | "received" | "friends";
type View = "match" | "connections";

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  h ^= h >>> 16;
  return Math.abs(h) / 0xffffffff;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadPassedToday(uid: string): Set<string> {
  try {
    const key = `passed:${getTodayKey()}:${uid}`;
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function savePassedToday(uid: string, passed: Set<string>): void {
  try {
    const key = `passed:${getTodayKey()}:${uid}`;
    localStorage.setItem(key, JSON.stringify([...passed]));
  } catch { /* */ }
}

export default function RecruitDirectory({ uid }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());
  const [passedUsers, setPassedUsers] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<View>("match");
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    const loaded = loadPassedToday(uid);
    setPassedUsers(loaded);
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [uid]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToUsers(uid, setUsers);
  }, [uid, firebaseReady]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToFriendRequests(uid, setRequests);
  }, [uid, firebaseReady]);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Deterministic daily ordering seeded by date+uid, then offset by matchIndex
  const orderedUsers = useMemo(() => {
    if (users.length === 0) return [];
    const today = getTodayKey();
    return [...users].sort((a, b) => {
      const ra = seededRandom(`${today}:${uid}:${a.email}`);
      const rb = seededRandom(`${today}:${uid}:${b.email}`);
      return ra - rb;
    });
  }, [users, uid]);

  const todayQueue = useMemo(
    () => orderedUsers.filter((u) => !passedUsers.has(u.email)),
    [orderedUsers, passedUsers]
  );

  const todayMatch = todayQueue[matchIndex] ?? todayQueue[0] ?? null;

  function getRequestState(targetUid: string): { status: RequestStatus; requestId?: string } {
    const req = requests.find(
      (r) => r.participants.includes(targetUid) && r.participants.includes(uid)
    );
    if (!req) return { status: "none" };
    if (req.status === "accepted") return { status: "friends", requestId: req.id };
    if (req.status === "rejected") return { status: "none" };
    if (req.fromUid === uid) return { status: "sent", requestId: req.id };
    return { status: "received", requestId: req.id };
  }

  const connections = requests
    .filter((r) => r.status === "accepted")
    .map((r) => {
      const otherUid = r.fromUid === uid ? r.toUid : r.fromUid;
      return users.find((u) => u.email === otherUid) ?? null;
    })
    .filter(Boolean) as UserProfile[];

  const pendingReceived = requests.filter((r) => r.toUid === uid && r.status === "pending");

  async function handleConnect() {
    if (!todayMatch) return;
    setSending(true);
    try {
      await sendFriendRequest(uid, todayMatch.email);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  function handlePass() {
    if (!todayMatch) return;
    const updated = new Set(passedUsers).add(todayMatch.email);
    setPassedUsers(updated);
    savePassedToday(uid, updated);
    setMatchIndex(0);
  }

  async function handleAccept(requestId: string) {
    setAccepting(requestId);
    try {
      await acceptFriendRequest(requestId);
    } catch (e) {
      console.error(e);
    } finally {
      setAccepting(null);
    }
  }

  async function handleReject(requestId: string) {
    try {
      await rejectFriendRequest(requestId);
    } catch (e) {
      console.error(e);
    }
  }

  // eslint-disable-next-line react-hooks/purity
  function getUserStatus(u: UserProfile) {
    const nowMs = Date.now(); // impure but intentional for live status
    const diff = nowMs - (u.lastSeen?.toMillis() ?? 0);
    if (diff < 5 * 60 * 1000) return { label: "LIVE NOW", color: "#4caf50", pulse: true };
    if (diff < 2 * 60 * 60 * 1000) return { label: "RECENT", color: "#006686", pulse: false };
    return { label: "OFFLINE", color: "#ba1a1a", pulse: false };
  }

  const codename = (u: UserProfile) =>
    u.codename ?? u.displayName.toUpperCase().replace(/\s+/g, "_");

  const matchesLeft = todayQueue.filter((u) => {
    const { status } = getRequestState(u.email);
    return status === "none";
  }).length;

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        backgroundColor: "#fbf8fc",
      }}
    >
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#fbf8fc", borderBottom: "3px solid #1b1b1e" }}>
        <div style={{ padding: "16px 16px 0" }}>
          <span
            style={{
              display: "inline-block", background: "#ff85c1",
              border: "2px solid #1b1b1e", padding: "3px 10px",
              fontWeight: 700, fontSize: 10, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: 4, transform: "rotate(-1deg)",
            }}
          >
            DAILY SIGNAL
          </span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
            <h1
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 26, fontWeight: 700, textTransform: "uppercase",
                color: "#1b1b1e", lineHeight: 1,
              }}
            >
              RECRUITS
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1b1b1e", padding: "4px 10px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#ffe24c" }}>schedule</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fbf8fc", textTransform: "uppercase" }}>{timeLeft}</span>
            </div>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", borderTop: "2px solid #1b1b1e" }}>
          {([
            { key: "match" as View, label: "TODAY'S MATCH", icon: "favorite" },
            { key: "connections" as View, label: `CONNECTIONS${connections.length > 0 ? ` (${connections.length})` : ""}`, icon: "group" },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                flex: 1, padding: "10px", border: "none", borderRight: "2px solid #1b1b1e",
                fontWeight: 800, fontSize: 10, textTransform: "uppercase", cursor: "pointer",
                fontFamily: "inherit", letterSpacing: "0.04em",
                backgroundColor: view === key ? "#1b1b1e" : "#fbf8fc",
                color: view === key ? "#fbf8fc" : "#1b1b1e",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: view === key ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
              {label}
              {key === "match" && pendingReceived.length > 0 && (
                <span style={{ background: "#ba1a1a", color: "white", borderRadius: 999, padding: "0px 5px", fontSize: 9, fontWeight: 900 }}>
                  {pendingReceived.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 80px" }}>
        {/* ── MATCH VIEW ─────────────────────────────────────────────────── */}
        {view === "match" && (
          <>
            {/* Incoming signals */}
            {pendingReceived.length > 0 && (
              <section
                style={{
                  background: "#ffd8e7", border: "3px solid #1b1b1e",
                  boxShadow: "5px 5px 0 #1b1b1e", padding: "16px 18px", marginBottom: 20,
                }}
              >
                <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: "#9f376f", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
                  INCOMING SIGNALS ({pendingReceived.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendingReceived.map((req) => {
                    const sender = users.find((u) => u.email === req.fromUid) ?? ({ email: req.fromUid, displayName: req.fromUid } as UserProfile);
                    return (
                      <div
                        key={req.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 12, background: "#fbf8fc", border: "2px solid #1b1b1e",
                          padding: "10px 12px", boxShadow: "2px 2px 0 #1b1b1e",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {sender.photoURL && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sender.photoURL} alt={codename(sender)} style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover" }} />
                          )}
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", display: "block" }}>{codename(sender)}</span>
                            <span style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>wants to connect</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={accepting === req.id}
                            style={{ background: "#9f376f", color: "white", border: "2px solid #1b1b1e", padding: "6px 12px", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e", fontFamily: "inherit" }}
                          >
                            {accepting === req.id ? "..." : "ACCEPT"}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            style={{ background: "#fbf8fc", border: "2px solid #1b1b1e", padding: "6px 12px", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            IGNORE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Daily match card */}
            {!todayMatch ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#544249", fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 56, color: "#d9c0c9", display: "block", marginBottom: 14 }}>wifi_off</span>
                <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                  {users.length === 0 ? "NO SIGNAL" : "ALL PASSED"}
                </p>
                <p style={{ fontSize: 13 }}>
                  {users.length === 0 ? "No other users on the network yet." : "You've passed everyone today. New matches at midnight."}
                </p>
              </div>
            ) : (() => {
              const { status: reqStatus, requestId } = getRequestState(todayMatch.email);
              const status = getUserStatus(todayMatch);
              const primaryInterest = todayMatch.interests?.[0] ?? "UNTUNED";
              const interestBg = INTEREST_COLORS[primaryInterest] ?? "#e4e1e6";

              return (
                <div style={{ maxWidth: 500, margin: "0 auto" }}>
                  {/* Match counter pill */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>
                      {matchesLeft} potential matches today
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9f376f", textTransform: "uppercase" }}>
                      {connections.length} connected
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      background: "#fbf8fc", border: "4px solid #1b1b1e",
                      boxShadow: "10px 10px 0 #1b1b1e", overflow: "hidden",
                    }}
                  >
                    {/* Colored header band */}
                    <div style={{ background: interestBg, padding: "20px 24px 16px", borderBottom: "3px solid #1b1b1e", position: "relative" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                        <div
                          style={{
                            width: 90, height: 90, border: "4px solid #1b1b1e",
                            boxShadow: "4px 4px 0 #1b1b1e", flexShrink: 0,
                            overflow: "hidden", background: "#fbf8fc",
                            borderRadius: 4,
                          }}
                        >
                          {todayMatch.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={todayMatch.photoURL} alt={codename(todayMatch)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 44, color: "#1b1b1e" }}>person</span>
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 4 }}>
                          <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e", lineHeight: 1.1, marginBottom: 6 }}>
                            {codename(todayMatch)}
                          </h2>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <div
                              className={status.pulse ? "animate-pulse" : ""}
                              style={{ width: 10, height: 10, borderRadius: "50%", background: status.color, border: "2px solid #1b1b1e", flexShrink: 0 }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: status.color }}>{status.label}</span>
                          </div>
                          {todayMatch.interests && todayMatch.interests.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {todayMatch.interests.slice(0, 3).map((i) => (
                                <span key={i} style={{ background: INTEREST_COLORS[i] ?? "#e4e1e6", border: "1.5px solid #1b1b1e", padding: "2px 8px", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>
                                  {i}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "18px 20px" }}>
                      {/* Bio */}
                      {todayMatch.bio ? (
                        <div style={{ background: "#ffd8e7", border: "2px solid #1b1b1e", padding: "10px 14px", marginBottom: 16, borderRadius: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#3d0025", lineHeight: 1.6 }}>&ldquo;{todayMatch.bio}&rdquo;</p>
                        </div>
                      ) : (
                        <div style={{ background: "#f0eeef", border: "2px dashed #c4bcc3", padding: "10px 14px", marginBottom: 16, borderRadius: 2 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#7a6b73", lineHeight: 1.5, fontStyle: "italic" }}>No bio yet — reach out and find out!</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      {reqStatus === "none" && (
                        <div style={{ display: "flex", gap: 10 }}>
                          {/* PASS */}
                          <button
                            onClick={handlePass}
                            style={{
                              flex: 1, background: "#fbf8fc", color: "#544249",
                              border: "3px solid #1b1b1e", padding: "14px 0",
                              fontWeight: 800, fontSize: 13, textTransform: "uppercase",
                              cursor: "pointer", fontFamily: "inherit",
                              boxShadow: "4px 4px 0 #1b1b1e",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                            PASS
                          </button>
                          {/* CONNECT */}
                          <button
                            onClick={handleConnect}
                            disabled={sending}
                            style={{
                              flex: 2, background: "#9f376f", color: "white",
                              border: "3px solid #1b1b1e", padding: "14px 0",
                              fontWeight: 800, fontSize: 13, textTransform: "uppercase",
                              cursor: "pointer", boxShadow: "5px 5px 0 #3d0025",
                              fontFamily: "inherit",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>favorite</span>
                            {sending ? "CONNECTING..." : "CONNECT"}
                          </button>
                        </div>
                      )}

                      {reqStatus === "sent" && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1, background: "#e4e1e6", border: "3px solid #1b1b1e", padding: "14px 0", fontWeight: 800, fontSize: 13, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#544249" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
                            SIGNAL SENT
                          </div>
                          <button
                            onClick={handlePass}
                            style={{ flex: 1, background: "#fbf8fc", color: "#544249", border: "3px solid #1b1b1e", padding: "14px 0", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          >
                            NEXT
                          </button>
                        </div>
                      )}

                      {reqStatus === "received" && requestId && (
                        <button
                          onClick={() => handleAccept(requestId)}
                          disabled={accepting === requestId}
                          style={{
                            width: "100%", background: "#ffe24c", border: "3px solid #1b1b1e",
                            padding: "14px 0", fontWeight: 800, fontSize: 14, textTransform: "uppercase",
                            cursor: "pointer", boxShadow: "5px 5px 0 #1b1b1e", fontFamily: "inherit",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#1b1b1e",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>person_add</span>
                          {accepting === requestId ? "..." : "THEY LIKE YOU — ACCEPT!"}
                        </button>
                      )}

                      {reqStatus === "friends" && (
                        <div>
                          <div style={{ width: "100%", background: "#c8f7c5", border: "3px solid #1b1b1e", padding: "14px 0", fontWeight: 800, fontSize: 14, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#1b1b1e", marginBottom: 8 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            YOU&apos;RE CONNECTED!
                          </div>
                          <button
                            onClick={handlePass}
                            style={{ width: "100%", background: "#fbf8fc", color: "#544249", border: "3px solid #1b1b1e", padding: "10px 0", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            SEE NEXT MATCH
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Deck preview — show avatars of next few */}
                  {todayQueue.length > 1 && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>UP NEXT:</span>
                      {todayQueue.slice(1, 5).map((u) => (
                        <div key={u.email} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #1b1b1e", overflow: "hidden", background: "#ffd8e7", flexShrink: 0 }}>
                          {u.photoURL
                            ? <img src={u.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#9f376f" }}>{(u.displayName || "?")[0].toUpperCase()}</div>
                          }
                        </div>
                      ))}
                      {todayQueue.length > 5 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7aafbf" }}>+{todayQueue.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ── CONNECTIONS VIEW ──────────────────────────────────────────── */}
        {view === "connections" && (
          <>
            {connections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#544249", fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 56, color: "#d9c0c9", display: "block", marginBottom: 14 }}>group</span>
                <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>NO CONNECTIONS YET</p>
                <p style={{ fontSize: 13 }}>Make your first connection on the Match tab.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, marginBottom: 4 }}>
                  You&apos;re connected with {connections.length} {connections.length === 1 ? "person" : "people"}.
                </p>
                {connections.map((conn) => {
                  const st = getUserStatus(conn);
                  return (
                    <div
                      key={conn.email}
                      style={{
                        background: "#fbf8fc", border: "3px solid #1b1b1e",
                        boxShadow: "4px 4px 0 #1b1b1e", overflow: "hidden",
                        display: "flex", alignItems: "center",
                      }}
                    >
                      {/* Color accent */}
                      <div style={{ width: 6, alignSelf: "stretch", background: INTEREST_COLORS[conn.interests?.[0] ?? ""] ?? "#ffd8e7", flexShrink: 0 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", flex: 1 }}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #1b1b1e", flexShrink: 0, overflow: "hidden", background: "#ffd8e7" }}>
                          {conn.photoURL
                            ? <img src={conn.photoURL} alt={codename(conn)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#9f376f" }}>person</span>
                              </div>
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 2 }}>
                            {codename(conn)}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div className={st.pulse ? "animate-pulse" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: st.color, border: "1.5px solid #1b1b1e" }} />
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>{st.label}</span>
                          </div>
                          {conn.interests && conn.interests.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              {conn.interests.slice(0, 2).map(i => (
                                <span key={i} style={{ background: INTEREST_COLORS[i] ?? "#e4e1e6", border: "1px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{i}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
