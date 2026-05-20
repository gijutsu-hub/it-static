"use client";

import { useEffect, useState } from "react";
import {
  subscribeToUsers,
  subscribeToFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  updateUserProfile,
  type UserProfile,
  type FriendRequest,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

const INTERESTS = [
  "K-POP VIBES",
  "TECH TALK",
  "ROOFTOP BEATS",
  "URBAN ART",
  "SKATE CREW",
  "RAVE SIGNAL",
  "CHILL ZONE",
  "GLITCH ART",
  "SYNTH-WAVE",
  "HARD-LINE",
  "LO-FI",
];

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

const CARD_COLORS = [
  "#fbf8fc",
  "#c0e8ff",
  "#ffe24c",
  "#ffd8e7",
  "#fbf8fc",
  "#c0e8ff",
];

interface Props {
  uid: string;
}

type RequestStatus = "none" | "sent" | "received" | "friends";

export default function RecruitDirectory({ uid }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterInterest, setFilterInterest] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    codename: "",
    bio: "",
    interests: [] as string[],
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [dossierUser, setDossierUser] = useState<UserProfile | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToUsers(uid, setUsers);
    return unsub;
  }, [uid, firebaseReady]);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToFriendRequests(uid, setRequests);
    return unsub;
  }, [uid, firebaseReady]);

  function getRequestState(targetUid: string): {
    status: RequestStatus;
    requestId?: string;
  } {
    const req = requests.find(
      (r) =>
        r.participants.includes(targetUid) && r.participants.includes(uid)
    );
    if (!req) return { status: "none" };
    if (req.status === "accepted") return { status: "friends", requestId: req.id };
    if (req.status === "rejected") return { status: "none" };
    if (req.fromUid === uid) return { status: "sent", requestId: req.id };
    return { status: "received", requestId: req.id };
  }

  async function handleSend(toUid: string) {
    setSending(toUid);
    try {
      await sendFriendRequest(uid, toUid);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(null);
    }
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

  function getUserStatus(user: UserProfile): {
    label: string;
    color: string;
    animClass: string;
  } {
    const now = Date.now();
    const lastSeen = user.lastSeen?.toMillis() ?? 0;
    const diff = now - lastSeen;
    if (diff < 5 * 60 * 1000)
      return { label: "SYNCED", color: "#c7ad07", animClass: "animate-pulse" };
    if (diff < 2 * 60 * 60 * 1000)
      return { label: "SIGNAL", color: "#006686", animClass: "" };
    return { label: "LATENT", color: "#ba1a1a", animClass: "" };
  }

  const pendingReceived = requests.filter(
    (r) => r.toUid === uid && r.status === "pending"
  );

  const filtered = users.filter((u) => {
    const name = (u.codename ?? u.displayName).toLowerCase();
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchInterest =
      !filterInterest || (u.interests ?? []).includes(filterInterest);
    return matchSearch && matchInterest;
  });

  const visible = filtered.slice(0, visibleCount);

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const payload: Parameters<typeof updateUserProfile>[1] = {};
      if (editForm.codename.trim()) payload.codename = editForm.codename.trim().toUpperCase().replace(/\s+/g, "_");
      if (editForm.bio.trim()) payload.bio = editForm.bio.trim();
      if (editForm.interests.length > 0) payload.interests = editForm.interests;
      if (Object.keys(payload).length > 0) await updateUserProfile(uid, payload);
      setShowEditProfile(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProfile(false);
    }
  }

  function toggleEditInterest(interest: string) {
    setEditForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }));
  }

  const codename = (user: UserProfile) =>
    user.codename ?? user.displayName.toUpperCase().replace(/\s+/g, "_");

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "32px 40px 80px",
        fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        backgroundColor: "#fbf8fc",
      }}
    >
      {/* ── HEADER ── */}
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <span
            style={{
              display: "inline-block",
              background: "#ffe24c",
              border: "2px solid #1b1b1e",
              padding: "4px 12px",
              fontWeight: 700,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
              transform: "rotate(-1deg)",
            }}
          >
            ACTIVE DATABASE
          </span>
          <h1
            style={{
              fontFamily:
                "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 32,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#1b1b1e",
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            RECRUIT DIRECTORY
          </h1>
          <p style={{ fontSize: 16, color: "#544249", fontWeight: 600 }}>
            Find your frequency. Filter through the noise to find the perfect
            squad-mate for the next signal burst.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div
            style={{
              background: "#ff85c1",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              padding: "12px 20px",
              transform: "rotate(1deg)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily:
                  "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#1b1b1e",
              }}
            >
              {users.length} SYNCED
            </span>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            style={{
              background: "#ffe24c",
              border: "3px solid #1b1b1e",
              boxShadow: "4px 4px 0 #1b1b1e",
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            MY PROFILE
          </button>
        </div>
      </section>

      {/* ── INCOMING REQUESTS ── */}
      {pendingReceived.length > 0 && (
        <section
          style={{
            background: "#ffd8e7",
            border: "4px solid #1b1b1e",
            boxShadow: "6px 6px 0 #1b1b1e",
            padding: "20px 24px",
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontFamily:
                "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#9f376f",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
            >
              notifications_active
            </span>
            INCOMING SIGNALS ({pendingReceived.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingReceived.map((req) => {
              const sender = users.find((u) => u.email === req.fromUid) ??
                ({ email: req.fromUid, displayName: req.fromUid } as UserProfile);
              return (
                <div
                  key={req.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "#fbf8fc",
                    border: "2px solid #1b1b1e",
                    padding: "10px 14px",
                    boxShadow: "3px 3px 0 #1b1b1e",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {sender.photoURL && (
                      <img
                        src={sender.photoURL}
                        alt={codename(sender)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          border: "2px solid #1b1b1e",
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        textTransform: "uppercase",
                      }}
                    >
                      {codename(sender)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#544249",
                        fontWeight: 600,
                      }}
                    >
                      wants to connect
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={accepting === req.id}
                      style={{
                        background: "#9f376f",
                        color: "white",
                        border: "2px solid #1b1b1e",
                        padding: "6px 14px",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        boxShadow: "3px 3px 0 #1b1b1e",
                        fontFamily: "inherit",
                      }}
                    >
                      {accepting === req.id ? "..." : "ACCEPT"}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      style={{
                        background: "#fbf8fc",
                        border: "2px solid #1b1b1e",
                        padding: "6px 14px",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
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

      {/* ── SEARCH + FILTERS ── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH CODENAME / FREQUENCY..."
            style={{
              width: "100%",
              background: "#fbf8fc",
              border: "4px solid #1b1b1e",
              padding: "16px 56px 16px 20px",
              fontFamily:
                "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              outline: "none",
              boxShadow: "6px 6px 0 #1b1b1e",
              boxSizing: "border-box",
              transition: "box-shadow 0.15s",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = "8px 8px 0 #ffe24c")
            }
            onBlur={(e) =>
              (e.currentTarget.style.boxShadow = "6px 6px 0 #1b1b1e")
            }
          />
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              right: 20,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 30,
              color: "#9f376f",
              pointerEvents: "none",
            }}
          >
            search
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#544249",
              letterSpacing: "0.04em",
              marginRight: 4,
            }}
          >
            Frequency:
          </span>
          {INTERESTS.slice(0, 6).map((interest) => {
            const active = filterInterest === interest;
            return (
              <button
                key={interest}
                onClick={() =>
                  setFilterInterest(active ? null : interest)
                }
                style={{
                  background: active
                    ? (INTEREST_COLORS[interest] ?? "#ffe24c")
                    : "#fbf8fc",
                  border: "2px solid #1b1b1e",
                  padding: "4px 14px",
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  boxShadow: active ? "3px 3px 0 #1b1b1e" : "2px 2px 0 #1b1b1e",
                  fontFamily: "inherit",
                  transition: "all 0.1s",
                }}
              >
                {interest}
              </button>
            );
          })}
          {filterInterest && (
            <button
              onClick={() => setFilterInterest(null)}
              style={{
                background: "none",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                color: "#9f376f",
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: "inherit",
                textDecoration: "underline",
              }}
            >
              CLEAR
            </button>
          )}
        </div>
      </section>

      {/* ── RECRUIT GRID ── */}
      {visible.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "#544249",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 48, color: "#d9c0c9", display: "block", marginBottom: 12 }}
          >
            wifi_off
          </span>
          No recruits found on this frequency. Adjust your filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {visible.map((user, idx) => {
            const status = getUserStatus(user);
            const { status: reqStatus, requestId } = getRequestState(user.email);
            const cardBg = CARD_COLORS[idx % CARD_COLORS.length];
            const primaryInterest = user.interests?.[0] ?? "UNTUNED";
            const interestColor = INTEREST_COLORS[primaryInterest] ?? "#e4e1e6";

            return (
              <div
                key={user.email}
                style={{
                  background: cardBg,
                  border: "4px solid #1b1b1e",
                  padding: "24px",
                  boxShadow: "6px 6px 0 #1b1b1e",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.12s, box-shadow 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translate(2px, 2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "4px 4px 0 #1b1b1e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "6px 6px 0 #1b1b1e";
                }}
              >
                {/* Connected badge */}
                {reqStatus === "friends" && (
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      background: "#9f376f",
                      color: "white",
                      padding: "4px 10px",
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      border: "2px solid #1b1b1e",
                    }}
                  >
                    CONNECTED
                  </div>
                )}

                {/* Profile row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      border: "4px solid #1b1b1e",
                      boxShadow: "4px 4px 0 #1b1b1e",
                      flexShrink: 0,
                      overflow: "hidden",
                      background: interestColor,
                    }}
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={codename(user)}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 36, color: "#1b1b1e" }}
                        >
                          person
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontFamily:
                          "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#1b1b1e",
                        textTransform: "uppercase",
                        lineHeight: 1.2,
                        wordBreak: "break-word",
                        marginBottom: 4,
                      }}
                    >
                      {codename(user)}
                    </h3>
                    {user.interests && user.interests.length > 1 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                          marginTop: 6,
                        }}
                      >
                        {user.interests.slice(0, 3).map((interest) => (
                          <span
                            key={interest}
                            style={{
                              background:
                                INTEREST_COLORS[interest] ?? "#e4e1e6",
                              border: "1.5px solid #1b1b1e",
                              padding: "2px 8px",
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "#1b1b1e",
                            }}
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "2px solid #1b1b1e",
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        opacity: 0.6,
                        letterSpacing: "0.04em",
                      }}
                    >
                      Frequency
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: interestColor,
                        border: "1.5px solid #1b1b1e",
                        padding: "2px 10px",
                      }}
                    >
                      {primaryInterest}
                    </span>
                  </div>
                  {user.bio && (
                    <div
                      style={{
                        borderBottom: "2px solid #1b1b1e",
                        paddingBottom: 8,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          color: "#544249",
                          fontWeight: 600,
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {user.bio}
                      </p>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        opacity: 0.6,
                        letterSpacing: "0.04em",
                      }}
                    >
                      Status
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        className={status.animClass}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: status.color,
                          border: "2px solid #1b1b1e",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setDossierUser(user)}
                    style={{
                      flex: 1,
                      background: "#1b1b1e",
                      color: "white",
                      border: "2px solid #1b1b1e",
                      padding: "10px 0",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      boxShadow: "3px 3px 0 #544249",
                      fontFamily: "inherit",
                      transition: "transform 0.1s, box-shadow 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0 #544249";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = "";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "3px 3px 0 #544249";
                    }}
                  >
                    VIEW DOSSIER
                  </button>
                  <button
                    onClick={() => {
                      if (reqStatus === "none") handleSend(user.email);
                      if (reqStatus === "received" && requestId) handleAccept(requestId);
                    }}
                    disabled={
                      reqStatus === "sent" ||
                      reqStatus === "friends" ||
                      sending === user.email ||
                      accepting === requestId
                    }
                    style={{
                      width: 44,
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        reqStatus === "friends"
                          ? "#ffe24c"
                          : reqStatus === "sent"
                          ? "#e4e1e6"
                          : reqStatus === "received"
                          ? "#9f376f"
                          : "#ff85c1",
                      border: "2px solid #1b1b1e",
                      boxShadow: "3px 3px 0 #1b1b1e",
                      cursor:
                        reqStatus === "sent" || reqStatus === "friends"
                          ? "default"
                          : "pointer",
                      fontFamily: "inherit",
                      transition: "transform 0.1s, box-shadow 0.1s",
                      opacity:
                        reqStatus === "sent" || reqStatus === "friends" ? 0.7 : 1,
                    }}
                    title={
                      reqStatus === "none"
                        ? "Send friend request"
                        : reqStatus === "sent"
                        ? "Request sent"
                        : reqStatus === "received"
                        ? "Accept request"
                        : "Already connected"
                    }
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 20,
                        color:
                          reqStatus === "received" ? "white" : "#1b1b1e",
                        fontVariationSettings:
                          reqStatus === "friends" ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      {reqStatus === "friends"
                        ? "check_circle"
                        : reqStatus === "sent"
                        ? "schedule"
                        : reqStatus === "received"
                        ? "person_add"
                        : "person_add"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LOAD MORE ── */}
      {visibleCount < filtered.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <button
            onClick={() => setVisibleCount((n) => n + 6)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#ffe24c",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              padding: "16px 40px",
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(-2px,-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "10px 10px 0 #1b1b1e";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "8px 8px 0 #1b1b1e";
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(-2px,-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "10px 10px 0 #1b1b1e";
            }}
          >
            UNCOVER MORE SIGNALS
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              refresh
            </span>
          </button>
        </div>
      )}

      {/* ── DOSSIER MODAL ── */}
      {dossierUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setDossierUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fbf8fc",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              padding: 36,
              maxWidth: 440,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  border: "4px solid #1b1b1e",
                  boxShadow: "6px 6px 0 #1b1b1e",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#ff85c1",
                }}
              >
                {dossierUser.photoURL ? (
                  <img
                    src={dossierUser.photoURL}
                    alt={codename(dossierUser)}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 48, color: "#1b1b1e" }}
                    >
                      person
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h2
                  style={{
                    fontFamily:
                      "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                    fontSize: 26,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#9f376f",
                    lineHeight: 1.1,
                    marginBottom: 6,
                  }}
                >
                  {codename(dossierUser)}
                </h2>
                <p
                  style={{
                    fontSize: 12,
                    color: "#544249",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {dossierUser.displayName}
                </p>
              </div>
            </div>

            {dossierUser.bio && (
              <div
                style={{
                  background: "#ffd8e7",
                  border: "2px solid #1b1b1e",
                  padding: "12px 16px",
                  marginBottom: 20,
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: "#3d0025", lineHeight: 1.6 }}>
                  {dossierUser.bio}
                </p>
              </div>
            )}

            {dossierUser.interests && dossierUser.interests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#544249",
                    letterSpacing: "0.04em",
                    marginBottom: 10,
                  }}
                >
                  Frequencies
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {dossierUser.interests.map((interest) => (
                    <span
                      key={interest}
                      style={{
                        background: INTEREST_COLORS[interest] ?? "#e4e1e6",
                        border: "2px solid #1b1b1e",
                        padding: "4px 14px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        boxShadow: "2px 2px 0 #1b1b1e",
                      }}
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setDossierUser(null)}
                style={{
                  flex: 1,
                  background: "#fbf8fc",
                  border: "3px solid #1b1b1e",
                  padding: "12px",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "4px 4px 0 #1b1b1e",
                  fontFamily: "inherit",
                }}
              >
                CLOSE
              </button>
              {(() => {
                const { status: reqStatus, requestId } = getRequestState(dossierUser.email);
                if (reqStatus === "friends") return (
                  <div
                    style={{
                      flex: 2,
                      background: "#ffe24c",
                      border: "3px solid #1b1b1e",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    CONNECTED
                  </div>
                );
                if (reqStatus === "sent") return (
                  <div
                    style={{
                      flex: 2,
                      background: "#e4e1e6",
                      border: "3px solid #1b1b1e",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      color: "#544249",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                    REQUEST SENT
                  </div>
                );
                if (reqStatus === "received" && requestId) return (
                  <button
                    onClick={() => { handleAccept(requestId); setDossierUser(null); }}
                    style={{
                      flex: 2,
                      background: "#9f376f",
                      color: "white",
                      border: "3px solid #1b1b1e",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: "4px 4px 0 #1b1b1e",
                      fontFamily: "inherit",
                    }}
                  >
                    ACCEPT REQUEST
                  </button>
                );
                return (
                  <button
                    onClick={() => { handleSend(dossierUser.email); setDossierUser(null); }}
                    disabled={sending === dossierUser.email}
                    style={{
                      flex: 2,
                      background: "#9f376f",
                      color: "white",
                      border: "3px solid #1b1b1e",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: "4px 4px 0 #1b1b1e",
                      fontFamily: "inherit",
                    }}
                  >
                    SEND SIGNAL
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {showEditProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowEditProfile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fbf8fc",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              padding: 40,
              maxWidth: 500,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                fontFamily:
                  "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 28,
                fontWeight: 800,
                textTransform: "uppercase",
                color: "#9f376f",
                marginBottom: 24,
              }}
            >
              TUNE YOUR SIGNAL
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#544249",
                    marginBottom: 6,
                  }}
                >
                  Codename
                </label>
                <input
                  value={editForm.codename}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, codename: e.target.value }))
                  }
                  placeholder="e.g. VOID_WALKER_Z"
                  style={{
                    width: "100%",
                    border: "3px solid #1b1b1e",
                    padding: "12px 16px",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    outline: "none",
                    background: "#f6f2f7",
                    boxSizing: "border-box",
                    textTransform: "uppercase",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#544249",
                    marginBottom: 6,
                  }}
                >
                  Bio / Signal Description
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="What's your frequency? What are you about?"
                  rows={3}
                  style={{
                    width: "100%",
                    border: "3px solid #1b1b1e",
                    padding: "12px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    outline: "none",
                    background: "#f6f2f7",
                    boxSizing: "border-box",
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#544249",
                    marginBottom: 10,
                  }}
                >
                  Frequencies / Interests
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {INTERESTS.map((interest) => {
                    const selected = editForm.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleEditInterest(interest)}
                        style={{
                          background: selected
                            ? (INTEREST_COLORS[interest] ?? "#ffe24c")
                            : "#fbf8fc",
                          border: "2px solid #1b1b1e",
                          padding: "6px 14px",
                          fontWeight: 700,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          cursor: "pointer",
                          boxShadow: selected ? "3px 3px 0 #1b1b1e" : "2px 2px 0 #877179",
                          fontFamily: "inherit",
                        }}
                      >
                        {selected && "✓ "}{interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setShowEditProfile(false)}
                style={{
                  flex: 1,
                  background: "#fbf8fc",
                  border: "3px solid #1b1b1e",
                  padding: "14px",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "4px 4px 0 #1b1b1e",
                  fontFamily: "inherit",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                style={{
                  flex: 2,
                  background: "#9f376f",
                  color: "white",
                  border: "3px solid #1b1b1e",
                  padding: "14px",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "4px 4px 0 #1b1b1e",
                  fontFamily: "inherit",
                  opacity: savingProfile ? 0.6 : 1,
                }}
              >
                {savingProfile ? "TRANSMITTING..." : "BROADCAST SIGNAL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
