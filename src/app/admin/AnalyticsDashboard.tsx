"use client";

import { useEffect, useState } from "react";
import { subscribeToAllUsers, subscribeToAllSquads, subscribeToAllKYCSubmissions, type UserProfile, type Squad, type KYCSubmission } from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

export default function AnalyticsDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [kyc, setKyc] = useState<KYCSubmission[]>([]);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsubs = [
      subscribeToAllUsers(setUsers),
      subscribeToAllSquads(setSquads),
      subscribeToAllKYCSubmissions(setKyc),
    ];
    return () => unsubs.forEach((u) => u());
  }, [firebaseReady]);

  // Derived stats
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const totalUsers = users.length;
  const bannedUsers = users.filter((u) => u.banned).length;
  const kycApproved = users.filter((u) => u.kycStatus === "approved").length;
  const kycPending = kyc.filter((k) => k.status === "pending").length;
  const kycRejected = users.filter((u) => u.kycStatus === "rejected").length;

  const totalSquads = squads.length;
  const liveSquads = squads.filter((s) => s.active).length;
  const totalMembers = squads.reduce((a, s) => a + (s.memberUids?.length ?? 0), 0);
  const avgMembers = totalSquads > 0 ? (totalMembers / totalSquads).toFixed(1) : "0";

  // Online users (seen within 5 minutes)
  const onlineUsers = users.filter((u) => {
    const diff = now - (u.lastSeen?.toMillis?.() ?? 0);
    return diff < 5 * 60 * 1000;
  }).length;

  // Users active in last 24h
  const activeDay = users.filter((u) => {
    const diff = now - (u.lastSeen?.toMillis?.() ?? 0);
    return diff < 24 * 60 * 60 * 1000;
  }).length;

  // Squads created today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const squadsToday = squads.filter((s) => {
    const created = s.createdAt?.toMillis?.() ?? 0;
    return created >= todayStart.getTime();
  }).length;

  // Theme distribution
  const themeCount: Record<string, number> = {};
  squads.forEach((s) => {
    themeCount[s.theme] = (themeCount[s.theme] ?? 0) + 1;
  });
  const topThemes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const stats = [
    { label: "Total Users", value: totalUsers, bg: "#c0e8ff", icon: "group" },
    { label: "Online Now", value: onlineUsers, bg: "#c8f7c5", icon: "sensors" },
    { label: "Active 24h", value: activeDay, bg: "#ffe24c", icon: "timeline" },
    { label: "Banned", value: bannedUsers, bg: "#ffd8e7", icon: "block" },
    { label: "KYC Approved", value: kycApproved, bg: "#c8f7c5", icon: "verified_user" },
    { label: "KYC Pending", value: kycPending, bg: "#ffe24c", icon: "pending" },
    { label: "KYC Rejected", value: kycRejected, bg: "#ffd8e7", icon: "cancel" },
    { label: "Total Squads", value: totalSquads, bg: "#c0e8ff", icon: "groups" },
    { label: "Live Squads", value: liveSquads, bg: "#c8f7c5", icon: "radio_button_checked" },
    { label: "Squads Today", value: squadsToday, bg: "#ffe24c", icon: "add_location_alt" },
    { label: "Total Members", value: totalMembers, bg: "#ffd8e7", icon: "person_pin" },
    { label: "Avg Members/Squad", value: avgMembers, bg: "#e4e1e6", icon: "bar_chart" },
  ];

  return (
    <div>
      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
        {stats.map(({ label, value, bg, icon }) => (
          <div key={label} style={{ background: bg, border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#544249" }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#544249", letterSpacing: "0.04em" }}>{label}</span>
            </div>
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 32, fontWeight: 900, color: "#1b1b1e", lineHeight: 1 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Theme leaderboard */}
      {topThemes.length > 0 && (
        <div>
          <h3 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 12, color: "#1b1b1e" }}>
            TOP SQUAD THEMES
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topThemes.map(([theme, count], i) => {
              const maxCount = topThemes[0][1];
              const pct = (count / maxCount) * 100;
              return (
                <div key={theme} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: "#544249", width: 20, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", width: 140, flexShrink: 0 }}>{theme}</span>
                  <div style={{ flex: 1, height: 18, background: "#e4e1e6", border: "2px solid #1b1b1e", position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#9f376f", transition: "width 0.4s" }} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: "#1b1b1e", width: 30, textAlign: "right", flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent users */}
      {users.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 12, color: "#1b1b1e" }}>
            RECENT SIGNUPS
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {[...users]
              .sort((a, b) => (b.firstSeen?.toMillis?.() ?? 0) - (a.firstSeen?.toMillis?.() ?? 0))
              .slice(0, 8)
              .map((u) => (
                <div key={u.email} style={{ border: "2px solid #1b1b1e", padding: "10px 12px", background: "#fbf8fc", display: "flex", alignItems: "center", gap: 10 }}>
                  {u.photoURL && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photoURL} alt={u.displayName} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1b1b1e", flexShrink: 0, objectFit: "cover" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName}</p>
                    <p style={{ fontSize: 10, color: "#544249", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                  </div>
                  <div>
                    {u.kycStatus === "approved" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>verified_user</span>}
                    {u.kycStatus === "pending" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#c7ad07" }}>pending</span>}
                    {u.banned && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#ba1a1a" }}>block</span>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
