"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAllUsers,
  banUser,
  unbanUser,
  manualApproveKYC,
  revokeKYC,
  adminSuspendUser,
  adminRestoreUser,
  type UserProfile,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function SubBadge({ status, suspended }: { status: UserProfile["subscriptionStatus"]; suspended?: boolean }) {
  if (suspended) return <Pill bg="#ba1a1a" color="white" label="SUSPENDED" />;
  switch (status) {
    case "active":   return <Pill bg="#4caf50" color="white"   label="ACTIVE" />;
    case "trial":    return <Pill bg="#7ed4fd" color="#005b78" label="TRIAL" />;
    case "pending":  return <Pill bg="#ffe24c" color="#1b1b1e" label="PENDING" />;
    case "past_due": return <Pill bg="#ff6b35" color="white"   label="PAST DUE" />;
    case "cancelled":return <Pill bg="#877179" color="white"   label="CANCELLED" />;
    default:         return <Pill bg="#e4e1e6" color="#544249" label="NONE" />;
  }
}

function KycBadge({ status }: { status: UserProfile["kycStatus"] }) {
  switch (status) {
    case "approved": return <Pill bg="#4caf50" color="white"   label="VERIFIED" />;
    case "pending":  return <Pill bg="#ffe24c" color="#1b1b1e" label="PENDING" />;
    case "rejected": return <Pill bg="#ba1a1a" color="white"   label="REJECTED" />;
    case "expired":  return <Pill bg="#877179" color="white"   label="EXPIRED" />;
    default:         return <Pill bg="#e4e1e6" color="#544249" label="NONE" />;
  }
}

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      backgroundColor: bg, color,
      fontSize: 9, fontWeight: 800, textTransform: "uppercase",
      padding: "3px 7px", border: "2px solid #1b1b1e",
      boxShadow: "2px 2px 0 #1b1b1e", whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function ActionBtn({
  onClick, disabled, label, bg,
}: {
  onClick: () => void; disabled: boolean; label: string; bg: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: bg, color: "#1b1b1e",
        fontSize: 9, fontWeight: 800, textTransform: "uppercase",
        padding: "4px 10px", border: "2px solid #1b1b1e",
        boxShadow: "2px 2px 0 #1b1b1e", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit", whiteSpace: "nowrap",
        transition: "transform 0.08s, box-shadow 0.08s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translate(1px,1px)";
          e.currentTarget.style.boxShadow = "1px 1px 0 #1b1b1e";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "2px 2px 0 #1b1b1e";
      }}
    >
      {label}
    </button>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [kycPending, setKycPending] = useState<string | null>(null);
  const [subPending, setSubPending] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "past_due" | "suspended" | "no_sub">("all");
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToAllUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
    return unsub;
  }, [firebaseReady]);

  async function toggleBan(user: UserProfile) {
    setPending(user.email);
    try {
      user.banned ? await unbanUser(user.email) : await banUser(user.email);
    } catch (e) { console.error(e); }
    finally { setPending(null); }
  }

  async function handleKYCAction(user: UserProfile) {
    setKycPending(user.email);
    try {
      user.kycStatus === "approved"
        ? await revokeKYC(user.email)
        : await manualApproveKYC(user.email);
    } catch (e) { console.error(e); }
    finally { setKycPending(null); }
  }

  async function handleSubAction(user: UserProfile) {
    setSubPending(user.email);
    try {
      user.adminSuspended
        ? await adminRestoreUser(user.email)
        : await adminSuspendUser(user.email);
    } catch (e) { console.error(e); }
    finally { setSubPending(null); }
  }

  // Stats
  const activeCount    = users.filter((u) => !u.banned).length;
  const bannedCount    = users.filter((u) => u.banned).length;
  const subActiveCount = users.filter((u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trial").length;
  const pastDueCount   = users.filter((u) => u.subscriptionStatus === "past_due").length;
  const suspendedCount = users.filter((u) => u.adminSuspended).length;
  const noSubCount     = users.filter((u) => !u.subscriptionStatus || u.subscriptionStatus === "cancelled").length;

  // Filtering
  let filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase())
  );
  if (subFilter === "past_due")  filtered = filtered.filter((u) => u.subscriptionStatus === "past_due");
  if (subFilter === "suspended") filtered = filtered.filter((u) => u.adminSuspended);
  if (subFilter === "no_sub")    filtered = filtered.filter((u) => !u.subscriptionStatus || u.subscriptionStatus === "cancelled");

  // Sort: suspended > past_due > banned > lastSeen desc
  filtered = [...filtered].sort((a, b) => {
    const aScore = (a.adminSuspended ? 3 : 0) + (a.subscriptionStatus === "past_due" ? 2 : 0) + (a.banned ? 1 : 0);
    const bScore = (b.adminSuspended ? 3 : 0) + (b.subscriptionStatus === "past_due" ? 2 : 0) + (b.banned ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0);
  });

  const COLS = "48px 1fr 160px 130px 80px 70px 80px 80px 90px 80px 90px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Users",  value: users.length,   color: "#9f376f" },
          { label: "Active",       value: activeCount,    color: "#006686" },
          { label: "Banned",       value: bannedCount,    color: "#ba1a1a" },
          { label: "Subscribed",   value: subActiveCount, color: "#4caf50" },
          { label: "Past Due",     value: pastDueCount,   color: "#ff6b35" },
          { label: "Suspended",    value: suspendedCount, color: "#ba1a1a" },
          { label: "No Sub",       value: noSubCount,     color: "#877179" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: "1 1 100px", minWidth: 90,
              backgroundColor: "#fbf8fc", border: "3px solid #1b1b1e",
              boxShadow: "4px 4px 0 #1b1b1e", padding: "12px 16px",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#544249", marginBottom: 4 }}>
              {stat.label}
            </p>
            <p style={{
              fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
              fontSize: 32, fontWeight: 900, color: stat.color, lineHeight: 1,
            }}>
              {loading ? "…" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            flex: 1, minWidth: 200, border: "3px solid #1b1b1e", padding: "10px 14px",
            fontSize: 13, fontFamily: "inherit", fontWeight: 600,
            backgroundColor: "#fbf8fc", outline: "none",
          }}
        />
        {(["all", "past_due", "suspended", "no_sub"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setSubFilter(f)}
            style={{
              padding: "8px 14px", border: "2px solid #1b1b1e",
              fontWeight: 800, fontSize: 10, textTransform: "uppercase", cursor: "pointer",
              fontFamily: "inherit",
              backgroundColor: subFilter === f ? "#1b1b1e" : "#fbf8fc",
              color: subFilter === f ? "#fbf8fc" : "#1b1b1e",
              boxShadow: subFilter === f ? "none" : "2px 2px 0 #1b1b1e",
            }}
          >
            {f === "all" ? "ALL" : f === "past_due" ? `PAST DUE (${pastDueCount})` : f === "suspended" ? `SUSPENDED (${suspendedCount})` : `NO SUB (${noSubCount})`}
          </button>
        ))}
      </div>

      {/* Alert banner for past-due users */}
      {pastDueCount > 0 && (
        <div style={{
          backgroundColor: "#ffd8e7", border: "3px solid #ff6b35",
          boxShadow: "4px 4px 0 #ff6b35", padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#ff6b35", fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#ba1a1a", textTransform: "uppercase" }}>
            {pastDueCount} user{pastDueCount !== 1 ? "s" : ""} with failed payment — review and suspend if unresolved
          </p>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
        boxShadow: "6px 6px 0 #1b1b1e", overflow: "hidden",
        overflowX: "auto",
      }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS,
          backgroundColor: "#1b1b1e", padding: "10px 16px", gap: 8,
          borderBottom: "3px solid #1b1b1e",
        }}>
          {["", "NAME / EMAIL", "LAST SEEN", "FIRST SEEN", "ACCOUNT", "BAN", "KYC", "KYC ACT", "SUBSCRIPTION", "SUB ACT", "RAZORPAY ID"].map((h) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#aaa", whiteSpace: "nowrap" }}>{h}</span>
          ))}
        </div>

        {loading && (
          <div style={{ padding: 32, textAlign: "center", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>
            Loading users…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#544249" }}>
            No users found
          </div>
        )}

        {filtered.map((user, i) => {
          const rowBg = user.adminSuspended ? "#fff0ee" : user.subscriptionStatus === "past_due" ? "#fff8ee" : user.banned ? "#ffd8e7" : i % 2 === 0 ? "#fbf8fc" : "#f6f2f7";
          return (
            <div
              key={user.email}
              style={{
                display: "grid", gridTemplateColumns: COLS,
                alignItems: "center", gap: 8,
                padding: "10px 16px",
                borderBottom: i < filtered.length - 1 ? "1px solid #e4e1e6" : "none",
                backgroundColor: rowBg,
              }}
            >
              {/* Avatar */}
              <div>
                {user.photoURL
                  ? <img src={user.photoURL} alt="" style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover" }} />
                  : <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1b1b1e", backgroundColor: "#ffd8e7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>
                      {user.displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                }
              </div>

              {/* Name + email */}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 12, color: "#1b1b1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.displayName || "—"}
                </p>
                <p style={{ fontSize: 10, color: "#544249", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </p>
              </div>

              {/* Last seen */}
              <span style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>{formatDate(user.lastSeen as never)}</span>

              {/* First seen */}
              <span style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>{formatDate(user.firstSeen as never)}</span>

              {/* Account status */}
              <span>
                <Pill
                  bg={user.adminSuspended ? "#ba1a1a" : user.banned ? "#c95500" : "#006686"}
                  color="white"
                  label={user.adminSuspended ? "SUSPENDED" : user.banned ? "BANNED" : "ACTIVE"}
                />
              </span>

              {/* Ban action */}
              <span>
                <ActionBtn
                  onClick={() => toggleBan(user)}
                  disabled={pending === user.email}
                  label={pending === user.email ? "…" : user.banned ? "UNBAN" : "BAN"}
                  bg={user.banned ? "#ffe24c" : "#ffdad6"}
                />
              </span>

              {/* KYC status */}
              <span><KycBadge status={user.kycStatus} /></span>

              {/* KYC action */}
              <span>
                <ActionBtn
                  onClick={() => handleKYCAction(user)}
                  disabled={kycPending === user.email}
                  label={kycPending === user.email ? "…" : user.kycStatus === "approved" ? "REVOKE" : "VERIFY"}
                  bg={user.kycStatus === "approved" ? "#ffdad6" : "#e8fce8"}
                />
              </span>

              {/* Subscription status */}
              <span>
                <SubBadge status={user.subscriptionStatus} suspended={user.adminSuspended} />
              </span>

              {/* Suspend/Restore action */}
              <span>
                <ActionBtn
                  onClick={() => handleSubAction(user)}
                  disabled={subPending === user.email}
                  label={
                    subPending === user.email ? "…"
                      : user.adminSuspended ? "RESTORE"
                      : "SUSPEND"
                  }
                  bg={user.adminSuspended ? "#c8f7c5" : "#ffd8e7"}
                />
              </span>

              {/* Razorpay subscription ID */}
              <span style={{ fontSize: 9, color: "#877179", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                {user.subscriptionId ?? "—"}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "#877179", fontWeight: 600 }}>
        SUSPEND = blocks platform access immediately regardless of payment state · RESTORE = grants active access override
      </p>
    </div>
  );
}
