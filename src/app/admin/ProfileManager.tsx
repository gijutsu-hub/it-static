"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAllUsers,
  adminEditProfile,
  manualApproveKYC,
  revokeKYC,
  type UserProfile,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

const s: React.CSSProperties = { fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" };

function fmtTs(ts: { seconds: number } | undefined | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Field({ label, value }: { label: string; value: string | number | boolean | undefined | null }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#877179", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#1b1b1e", wordBreak: "break-all" }}>
        {value === undefined || value === null || value === "" ? "—" : String(value)}
      </p>
    </div>
  );
}

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{ backgroundColor: bg, color, fontSize: 9, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", border: "2px solid #1b1b1e", boxShadow: "1px 1px 0 #1b1b1e", display: "inline-block", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function KycBadge({ status }: { status?: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    approved: { bg: "#4caf50", color: "#fff" },
    pending:  { bg: "#ffe24c", color: "#1b1b1e" },
    rejected: { bg: "#ba1a1a", color: "#fff" },
    expired:  { bg: "#877179", color: "#fff" },
  };
  const { bg, color } = cfg[status ?? ""] ?? { bg: "#e4e1e6", color: "#544249" };
  return <Pill bg={bg} color={color} label={status?.toUpperCase() ?? "NONE"} />;
}

function SubBadge({ status, suspended }: { status?: string; suspended?: boolean }) {
  if (suspended) return <Pill bg="#ba1a1a" color="#fff" label="SUSPENDED" />;
  const cfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: "#4caf50", color: "#fff" },
    trial:     { bg: "#7ed4fd", color: "#005b78" },
    pending:   { bg: "#ffe24c", color: "#1b1b1e" },
    past_due:  { bg: "#ff6b35", color: "#fff" },
    cancelled: { bg: "#877179", color: "#fff" },
  };
  const { bg, color } = cfg[status ?? ""] ?? { bg: "#e4e1e6", color: "#544249" };
  return <Pill bg={bg} color={color} label={status?.replace("_", " ").toUpperCase() ?? "NO SUB"} />;
}

interface EditState {
  displayName: string;
  bio: string;
  codename: string;
  interests: string;
  badges: string;
  points: string;
}

export default function ProfileManager() {
  const [users, setUsers]         = useState<UserProfile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [editMode, setEditMode]   = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ displayName: "", bio: "", codename: "", interests: "", badges: "", points: "" });
  const [saving, setSaving]       = useState(false);
  const [kycPending, setKycPending] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    authReady.then(() => {
      unsub = subscribeToAllUsers(u => { setUsers(u); setLoading(false); });
    });
    return () => unsub?.();
  }, []);

  const filtered = users.filter(u =>
    (u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()) ||
     u.codename?.toLowerCase().includes(search.toLowerCase()))
  );

  function openEdit(u: UserProfile) {
    setEditMode(u.email);
    setEditState({
      displayName: u.displayName ?? "",
      bio:         u.bio ?? "",
      codename:    u.codename ?? "",
      interests:   (u.interests ?? []).join(", "),
      badges:      (u.badges ?? []).join(", "),
      points:      String(u.points ?? 0),
    });
  }

  async function saveEdit(email: string) {
    setSaving(true);
    try {
      await adminEditProfile(email, {
        displayName: editState.displayName.trim() || undefined,
        bio:         editState.bio.trim() || undefined,
        codename:    editState.codename.trim().toUpperCase() || undefined,
        interests:   editState.interests.split(",").map(x => x.trim()).filter(Boolean),
        badges:      editState.badges.split(",").map(x => x.trim()).filter(Boolean),
        points:      parseInt(editState.points) || 0,
      });
      setEditMode(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleKyc(u: UserProfile) {
    setKycPending(u.email);
    try {
      u.kycStatus === "approved" ? await revokeKYC(u.email) : await manualApproveKYC(u.email);
    } catch (e) { console.error(e); }
    finally { setKycPending(null); }
  }

  const inputSt: React.CSSProperties = {
    width: "100%", border: "2px solid #1b1b1e", padding: "6px 10px",
    fontSize: 12, fontFamily: "inherit", backgroundColor: "#fbf8fc",
    outline: "none", boxSizing: "border-box", marginBottom: 6,
  };

  return (
    <div style={{ ...s, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or codename…"
          style={{ flex: 1, border: "3px solid #1b1b1e", padding: "10px 14px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, backgroundColor: "#fbf8fc", outline: "none" }}
        />
        <div style={{ fontWeight: 700, fontSize: 11, color: "#544249", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : `${filtered.length} users`}
        </div>
      </div>

      {/* User list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(u => {
          const isExpanded = expanded === u.email;
          const isEditing  = editMode === u.email;

          return (
            <div key={u.email} style={{ border: "3px solid #1b1b1e", boxShadow: isExpanded ? "6px 6px 0 #1b1b1e" : "3px 3px 0 #1b1b1e", backgroundColor: "#fbf8fc" }}>

              {/* ── Collapsed row ── */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", backgroundColor: isExpanded ? "#f0edf1" : "#fbf8fc" }}
                onClick={() => { setExpanded(isExpanded ? null : u.email); setEditMode(null); }}
              >
                {/* Avatar */}
                <div style={{ flexShrink: 0 }}>
                  {u.photoURL
                    ? <img src={u.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #1b1b1e", objectFit: "cover" }} />
                    : <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #1b1b1e", backgroundColor: "#ffd8e7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#9f376f" }}>
                        {u.displayName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                  }
                </div>

                {/* Identity */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#1b1b1e" }}>{u.displayName || "No Name"}</span>
                    {u.codename && (
                      <span style={{ backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", padding: "1px 8px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {u.codename}
                      </span>
                    )}
                    <KycBadge status={u.kycStatus} />
                    <SubBadge status={u.subscriptionStatus} suspended={u.adminSuspended} />
                    {u.entryCodeRedeemed && <Pill bg="#c8f7c5" color="#1b1b1e" label="CODE ✓" />}
                  </div>
                  <p style={{ fontSize: 10, color: "#544249", marginTop: 2 }}>{u.email}</p>
                </div>

                {/* Points + expand arrow */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 20, fontWeight: 900, color: "#9f376f", lineHeight: 1 }}>{u.points ?? 0}</p>
                  <p style={{ fontSize: 8, color: "#877179", textTransform: "uppercase", fontWeight: 700 }}>pts</p>
                </div>
                <span style={{ fontSize: 14, color: "#544249", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div style={{ borderTop: "2px dashed #1b1b1e", padding: "16px", backgroundColor: "#fafafa" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>

                    {/* Read-only fields */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#9f376f", marginBottom: 8, borderBottom: "2px solid #9f376f", paddingBottom: 4 }}>ACCOUNT</p>
                      <Field label="Email"            value={u.email} />
                      <Field label="First Seen"       value={fmtTs(u.firstSeen as never)} />
                      <Field label="Last Seen"        value={fmtTs(u.lastSeen as never)} />
                      <Field label="Entry Code"       value={u.entryCodeRedeemed ? "Redeemed ✓" : "Not redeemed"} />
                      <Field label="Banned"           value={u.banned ? "Yes" : "No"} />
                      <Field label="Location"         value={u.location ? `${u.location.lat?.toFixed(4)}, ${u.location.lng?.toFixed(4)}` : "—"} />
                    </div>

                    {/* Subscription */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#006686", marginBottom: 8, borderBottom: "2px solid #006686", paddingBottom: 4 }}>SUBSCRIPTION</p>
                      <Field label="Status"           value={u.adminSuspended ? "SUSPENDED" : (u.subscriptionStatus ?? "None")} />
                      <Field label="Sub ID"           value={u.subscriptionId} />
                      <Field label="Trial Ends"       value={fmtTs(u.trialEndsAt as never)} />
                      <Field label="Activated At"     value={fmtTs(u.subscriptionActivatedAt as never)} />
                      <Field label="Last Charged"     value={fmtTs(u.lastChargedAt as never)} />
                    </div>

                    {/* KYC */}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#4caf50", marginBottom: 8, borderBottom: "2px solid #4caf50", paddingBottom: 4 }}>KYC</p>
                      <Field label="KYC Status"       value={u.kycStatus} />
                      <Field label="Verified At"      value={fmtTs(u.kycVerifiedAt as never)} />
                      <Field label="Expires At"       value={fmtTs(u.kycExpiresAt as never)} />
                      <div style={{ marginTop: 8 }}>
                        <button
                          onClick={() => handleKyc(u)}
                          disabled={kycPending === u.email}
                          style={{ ...s, backgroundColor: u.kycStatus === "approved" ? "#ffdad6" : "#c8f7c5", border: "2px solid #1b1b1e", padding: "5px 12px", fontSize: 9, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e", opacity: kycPending === u.email ? 0.5 : 1 }}
                        >
                          {kycPending === u.email ? "…" : u.kycStatus === "approved" ? "REVOKE KYC" : "APPROVE KYC"}
                        </button>
                      </div>
                    </div>

                    {/* Editable profile */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, borderBottom: "2px solid #ffe24c", paddingBottom: 4 }}>
                        <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#6d5e00" }}>PROFILE</p>
                        {!isEditing && (
                          <button onClick={() => openEdit(u)} style={{ ...s, backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", padding: "2px 8px", fontSize: 9, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", boxShadow: "1px 1px 0 #1b1b1e" }}>
                            ✏ EDIT
                          </button>
                        )}
                      </div>

                      {!isEditing ? (
                        <>
                          <Field label="Display Name" value={u.displayName} />
                          <Field label="Codename"     value={u.codename} />
                          <Field label="Bio"          value={u.bio} />
                          <Field label="Interests"    value={(u.interests ?? []).join(", ")} />
                          <Field label="Badges"       value={(u.badges ?? []).join(", ")} />
                          <Field label="Points"       value={u.points} />
                        </>
                      ) : (
                        <div>
                          {(
                            [
                              ["Display Name", "displayName"],
                              ["Codename (UPPERCASE)", "codename"],
                              ["Bio", "bio"],
                              ["Interests (comma-sep)", "interests"],
                              ["Badges (comma-sep)", "badges"],
                              ["Points", "points"],
                            ] as [string, keyof EditState][]
                          ).map(([label, key]) => (
                            <div key={key}>
                              <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#877179", marginBottom: 2 }}>{label}</p>
                              <input
                                style={inputSt}
                                value={editState[key]}
                                type={key === "points" ? "number" : "text"}
                                onChange={e => setEditState(p => ({ ...p, [key]: e.target.value }))}
                              />
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                            <button
                              onClick={() => saveEdit(u.email)}
                              disabled={saving}
                              style={{ ...s, backgroundColor: "#4caf50", color: "#fff", border: "2px solid #1b1b1e", padding: "6px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e", opacity: saving ? 0.5 : 1 }}
                            >
                              {saving ? "SAVING…" : "SAVE"}
                            </button>
                            <button
                              onClick={() => setEditMode(null)}
                              style={{ ...s, backgroundColor: "#e4e1e6", border: "2px solid #1b1b1e", padding: "6px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e" }}
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#544249", textTransform: "uppercase", padding: 32 }}>No users found</p>
      )}
    </div>
  );
}
