"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAllUsers,
  adminSuspendUser,
  adminRestoreUser,
  adminGrantFreeAccess,
  adminSetSubscriptionStatus,
  adminRestoreTrial,
  type UserProfile,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

const s: React.CSSProperties = {
  fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
};

type SubStatus = NonNullable<UserProfile["subscriptionStatus"]>;
type Filter = "all" | SubStatus | "none" | "suspended";

function fmtTs(ts: { seconds: number } | undefined | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function SubPill({ status, suspended }: { status?: SubStatus; suspended?: boolean }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: "#4caf50", color: "#fff" },
    trial:     { bg: "#7ed4fd", color: "#005b78" },
    pending:   { bg: "#ffe24c", color: "#1b1b1e" },
    past_due:  { bg: "#ff6b35", color: "#fff" },
    cancelled: { bg: "#877179", color: "#fff" },
    suspended: { bg: "#ba1a1a", color: "#fff" },
    none:      { bg: "#e4e1e6", color: "#544249" },
  };
  const key = suspended ? "suspended" : (status ?? "none");
  const { bg, color } = cfg[key] ?? cfg.none;
  return (
    <span style={{
      backgroundColor: bg, color,
      fontSize: 9, fontWeight: 800, textTransform: "uppercase",
      padding: "3px 8px", border: "2px solid #1b1b1e",
      boxShadow: "1px 1px 0 #1b1b1e", whiteSpace: "nowrap", display: "inline-block",
    }}>
      {suspended ? "SUSPENDED" : (key === "none" ? "NO SUB" : key.replace("_", " "))}
    </span>
  );
}

function Btn({
  onClick, label, bg = "#fbf8fc", color = "#1b1b1e", disabled,
}: {
  onClick: () => void; label: string; bg?: string; color?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s, backgroundColor: bg, color, border: "2px solid #1b1b1e",
        boxShadow: disabled ? "none" : "2px 2px 0 #1b1b1e",
        padding: "4px 10px", fontSize: 9, fontWeight: 800,
        textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: "1 1 110px", minWidth: 100,
        backgroundColor: active ? color : "#fbf8fc",
        border: "3px solid #1b1b1e",
        boxShadow: active ? "none" : "4px 4px 0 #1b1b1e",
        padding: "12px 16px", cursor: onClick ? "pointer" : "default",
        transform: active ? "translate(4px,4px)" : "none",
        transition: "all 0.1s",
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: active ? "#fff" : "#544249", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{
        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
        fontSize: 30, fontWeight: 900, lineHeight: 1,
        color: active ? "#fff" : color,
      }}>
        {value}
      </p>
    </div>
  );
}

export default function SubscriptionManager() {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("all");
  const [search, setSearch]     = useState("");
  const [pending, setPending]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    authReady.then(() => {
      unsub = subscribeToAllUsers((u) => { setUsers(u); setLoading(false); });
    });
    return () => unsub?.();
  }, []);

  // Derived counts
  const counts = {
    all:       users.length,
    active:    users.filter(u => u.subscriptionStatus === "active").length,
    trial:     users.filter(u => u.subscriptionStatus === "trial").length,
    pending:   users.filter(u => u.subscriptionStatus === "pending").length,
    past_due:  users.filter(u => u.subscriptionStatus === "past_due").length,
    cancelled: users.filter(u => u.subscriptionStatus === "cancelled").length,
    suspended: users.filter(u => u.adminSuspended).length,
    none:      users.filter(u => !u.subscriptionStatus).length,
  };

  const revenue_estimate = counts.active * 299; // placeholder INR/month

  // Filter + search
  let filtered = users.filter(u =>
    (u.email?.toLowerCase().includes(search.toLowerCase()) ||
     u.displayName?.toLowerCase().includes(search.toLowerCase()))
  );
  if (filter === "suspended") filtered = filtered.filter(u => u.adminSuspended);
  else if (filter === "none") filtered = filtered.filter(u => !u.subscriptionStatus);
  else if (filter !== "all") filtered = filtered.filter(u => u.subscriptionStatus === filter);

  // Sort: suspended > past_due > active > trial > others
  const priority = (u: UserProfile) =>
    u.adminSuspended ? 6 : u.subscriptionStatus === "past_due" ? 5 :
    u.subscriptionStatus === "active" ? 4 : u.subscriptionStatus === "trial" ? 3 : 0;
  filtered = [...filtered].sort((a, b) => priority(b) - priority(a) || (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0));

  async function act(email: string, fn: () => Promise<void>) {
    setPending(email);
    try { await fn(); } catch (e) { console.error(e); } finally { setPending(null); }
  }

  const filterBtns: { key: Filter; label: string; color: string }[] = [
    { key: "all",       label: `ALL (${counts.all})`,             color: "#1b1b1e" },
    { key: "active",    label: `ACTIVE (${counts.active})`,       color: "#4caf50" },
    { key: "trial",     label: `TRIAL (${counts.trial})`,         color: "#006686" },
    { key: "past_due",  label: `PAST DUE (${counts.past_due})`,   color: "#ff6b35" },
    { key: "suspended", label: `SUSPENDED (${counts.suspended})`, color: "#ba1a1a" },
    { key: "cancelled", label: `CANCELLED (${counts.cancelled})`, color: "#877179" },
    { key: "none",      label: `NO SUB (${counts.none})`,         color: "#544249" },
  ];

  return (
    <div style={{ ...s, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard label="Total Users"   value={counts.all}       color="#9f376f" />
        <StatCard label="Active Subs"   value={counts.active}    color="#4caf50"
          onClick={() => setFilter("active")} active={filter === "active"} />
        <StatCard label="Trial"         value={counts.trial}     color="#006686"
          onClick={() => setFilter("trial")} active={filter === "trial"} />
        <StatCard label="Past Due ⚠️"  value={counts.past_due}  color="#ff6b35"
          onClick={() => setFilter("past_due")} active={filter === "past_due"} />
        <StatCard label="Suspended"     value={counts.suspended} color="#ba1a1a"
          onClick={() => setFilter("suspended")} active={filter === "suspended"} />
        <StatCard label="No Sub"        value={counts.none}      color="#877179"
          onClick={() => setFilter("none")} active={filter === "none"} />
        <div style={{
          flex: "1 1 110px", minWidth: 110, backgroundColor: "#fffde7",
          border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", padding: "12px 16px",
        }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#544249", marginBottom: 4 }}>
            Est. MRR
          </p>
          <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 22, fontWeight: 900, lineHeight: 1, color: "#1b1b1e" }}>
            ₹{revenue_estimate.toLocaleString("en-IN")}
          </p>
          <p style={{ fontSize: 8, color: "#877179", marginTop: 2 }}>@₹299/active user</p>
        </div>
      </div>

      {/* Alert: past due */}
      {counts.past_due > 0 && (
        <div style={{ backgroundColor: "#ffd8e7", border: "3px solid #ff6b35", boxShadow: "4px 4px 0 #ff6b35", padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#ff6b35", fontVariationSettings: "'FILL' 1" }}>warning</span>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#ba1a1a", textTransform: "uppercase" }}>
            {counts.past_due} user{counts.past_due !== 1 ? "s" : ""} with failed payment — suspend or grant free access
          </p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          style={{ flex: 1, minWidth: 200, border: "3px solid #1b1b1e", padding: "9px 14px", fontSize: 12, fontFamily: "inherit", fontWeight: 600, backgroundColor: "#fbf8fc", outline: "none" }}
        />
        {filterBtns.map(fb => (
          <button key={fb.key} onClick={() => setFilter(fb.key)} style={{
            padding: "7px 12px", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 9,
            textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            backgroundColor: filter === fb.key ? fb.color : "#fbf8fc",
            color: filter === fb.key ? "#fff" : "#1b1b1e",
            boxShadow: filter === fb.key ? "none" : "2px 2px 0 #1b1b1e",
            transform: filter === fb.key ? "translate(2px,2px)" : "none",
          }}>
            {fb.label}
          </button>
        ))}
      </div>

      {/* ── User rows ─────────────────────────────────────────────────── */}
      <div style={{ border: "4px solid #1b1b1e", boxShadow: "6px 6px 0 #1b1b1e", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 120px 120px 120px 110px auto", gap: 8, backgroundColor: "#1b1b1e", padding: "10px 16px", borderBottom: "3px solid #1b1b1e" }}>
          {["", "USER", "STATUS", "TRIAL ENDS", "LAST PAYMENT", "RAZORPAY ID", "ACTIONS"].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#aaa" }}>{h}</span>
          ))}
        </div>

        {loading && <div style={{ padding: 32, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>No users match</div>}

        {filtered.map((u, i) => {
          const bg = u.adminSuspended ? "#fff0ee" : u.subscriptionStatus === "past_due" ? "#fff8ee" : i % 2 === 0 ? "#fbf8fc" : "#f6f2f7";
          const isExpanded = expanded === u.email;
          return (
            <div key={u.email} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #e4e1e6" : "none" }}>
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 120px 120px 120px 110px auto", gap: 8, alignItems: "center", padding: "10px 16px", backgroundColor: bg }}>
                {/* Avatar */}
                <div>
                  {u.photoURL
                    ? <img src={u.photoURL} alt="" style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover" }} />
                    : <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1b1b1e", backgroundColor: "#ffd8e7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#9f376f" }}>
                        {u.displayName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                  }
                </div>

                {/* Name / email */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName || "—"}</p>
                  <p style={{ fontSize: 10, color: "#544249", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                </div>

                {/* Sub status */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <SubPill status={u.subscriptionStatus} suspended={u.adminSuspended} />
                  <span style={{ fontSize: 8, color: "#877179" }}>Since {fmtTs(u.subscriptionActivatedAt as never)}</span>
                </div>

                {/* Trial ends */}
                <span style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>{fmtTs(u.trialEndsAt as never)}</span>

                {/* Last charged */}
                <span style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>{fmtTs(u.lastChargedAt as never)}</span>

                {/* Razorpay ID */}
                <span style={{ fontSize: 9, color: "#877179", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={u.subscriptionId}>
                  {u.subscriptionId ? u.subscriptionId.slice(0, 14) + "…" : "—"}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <Btn label="▼ MORE" bg="#e4e1e6" onClick={() => setExpanded(isExpanded ? null : u.email)} />
                </div>
              </div>

              {/* Expanded actions */}
              {isExpanded && (
                <div style={{ backgroundColor: "#fffde7", borderTop: "2px dashed #1b1b1e", padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#544249", marginRight: 4 }}>ACTIONS:</span>

                  <Btn
                    label={pending === u.email ? "…" : "✓ GRANT FREE ACCESS"}
                    bg="#c8f7c5"
                    disabled={pending === u.email || (u.subscriptionStatus === "active" && !u.adminSuspended)}
                    onClick={() => act(u.email, () => adminGrantFreeAccess(u.email))}
                  />
                  <Btn
                    label={pending === u.email ? "…" : "⏱ RESTORE TRIAL (7d)"}
                    bg="#c0e8ff"
                    disabled={pending === u.email}
                    onClick={() => act(u.email, () => adminRestoreTrial(u.email))}
                  />
                  <Btn
                    label={pending === u.email ? "…" : u.adminSuspended ? "↩ RESTORE" : "⛔ SUSPEND"}
                    bg={u.adminSuspended ? "#c8f7c5" : "#ffd8e7"}
                    disabled={pending === u.email}
                    onClick={() => act(u.email, () => u.adminSuspended ? adminRestoreUser(u.email) : adminSuspendUser(u.email))}
                  />
                  <Btn
                    label={pending === u.email ? "…" : "✗ CANCEL SUB"}
                    bg="#ffdad6"
                    disabled={pending === u.email || u.subscriptionStatus === "cancelled"}
                    onClick={() => act(u.email, () => adminSetSubscriptionStatus(u.email, "cancelled"))}
                  />
                  <Btn
                    label={pending === u.email ? "…" : "→ SET ACTIVE"}
                    bg="#e8fce8"
                    disabled={pending === u.email}
                    onClick={() => act(u.email, () => adminSetSubscriptionStatus(u.email, "active"))}
                  />
                  {u.subscriptionId && (
                    <a
                      href={`https://dashboard.razorpay.com/subscriptions/${u.subscriptionId}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#006686", border: "2px solid #1b1b1e", padding: "4px 10px", boxShadow: "2px 2px 0 #1b1b1e", backgroundColor: "#c0e8ff", textDecoration: "none" }}
                    >
                      RAZORPAY ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: "#877179", fontWeight: 600 }}>
        GRANT FREE ACCESS = activates subscription with no payment · SUSPEND = blocks all platform access · CANCEL = removes subscription access
      </p>
    </div>
  );
}
