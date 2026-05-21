"use client";

import { useEffect, useState } from "react";
import { subscribeToAllSquads, subscribeToMyTickets, type Squad, type Ticket } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { authReady } from "@/lib/firebase";

const THEME_COLORS: Record<string, string> = {
  "K-POP VIBES": "#ff85c1",
  "TECH TALK": "#7ed4fd",
  "ROOFTOP BEATS": "#7ed4fd",
  "URBAN ART": "#ffe24c",
  "SKATE CREW": "#ffe24c",
  "RAVE SIGNAL": "#ff85c1",
  "CHILL ZONE": "#c0e8ff",
};

interface Props {
  uid: string;
}

type FilterTab = "all" | "live" | "past" | "mine" | "tickets";

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SquadRow({ squad, uid }: { squad: Squad; uid: string }) {
  const isHost = squad.hostUid === uid;
  const isMember = !isHost && squad.memberUids?.includes(uid);
  const bg = THEME_COLORS[squad.theme] ?? "#ffe24c";
  const memberCount = squad.memberUids?.length ?? 0;
  const pct = Math.min(100, (memberCount / squad.capacity) * 100);
  const fillColor = pct >= 90 ? "#ba1a1a" : pct >= 60 ? "#9f376f" : "#4caf50";

  return (
    <div
      style={{
        background: "#fbf8fc",
        border: "3px solid #1b1b1e",
        boxShadow: "5px 5px 0 #1b1b1e",
        overflow: "hidden",
      }}
    >
      {/* Theme accent bar */}
      <div style={{ height: 6, background: bg }} />
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* Status + theme */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: bg, border: "2px solid #1b1b1e",
            }}
          />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {squad.active && (
              <span style={{ background: "#c8f7c5", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>
                LIVE
              </span>
            )}
            {!squad.active && (
              <span style={{ background: "#e4e1e6", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: "#544249" }}>
                ENDED
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              {squad.name}
            </h3>
            {isHost && (
              <span style={{ background: "#ff85c1", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>
                YOU HOSTED
              </span>
            )}
            {isMember && (
              <span style={{ background: "#7ed4fd", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>
                ATTENDED
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>by {squad.hostName}</span>
            <span style={{ background: bg, border: "1.5px solid #1b1b1e", padding: "1px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
              {squad.theme}
            </span>
            <span style={{ fontSize: 10, color: "#7aafbf", fontWeight: 600 }}>{formatDate(squad.createdAt as Timestamp)}</span>
          </div>
        </div>

        {/* Members + bar */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
          <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: "#1b1b1e" }}>
            {memberCount}
            <span style={{ fontSize: 12, fontWeight: 700, color: "#544249" }}>/{squad.capacity}</span>
          </p>
          <div style={{ width: 70, height: 5, background: "#e4e1e6", border: "1.5px solid #1b1b1e", marginTop: 4 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: fillColor }} />
          </div>
          <span style={{ fontSize: 9, color: "#544249", fontWeight: 600 }}>{Math.round(pct)}% full</span>
        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div style={{ border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", overflow: "hidden", background: "#fbf8fc" }}>
      <div style={{ background: "#ffe24c", padding: "8px 16px", borderBottom: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>{ticket.squadName}</span>
        {ticket.checkedIn && (
          <span style={{ background: "#c8f7c5", border: "1.5px solid #1b1b1e", padding: "2px 8px", fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>CHECKED IN</span>
        )}
      </div>
      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: "0.1em", color: "#9f376f", marginBottom: 4 }}>
          {ticket.ticketCode}
        </p>
        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>Issued {formatDateTime(ticket.issuedAt as Timestamp)}</p>
      </div>
    </div>
  );
}

export default function IntelPanel({ uid }: Props) {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToAllSquads(setSquads);
  }, [firebaseReady]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToMyTickets(uid, setTickets);
  }, [uid, firebaseReady]);

  const liveSquads = squads.filter((s) => s.active);
  const pastSquads = squads.filter((s) => !s.active);
  const mySquads = squads.filter((s) => s.hostUid === uid || s.memberUids?.includes(uid));
  const totalMembers = squads.reduce((a, s) => a + (s.memberUids?.length ?? 0), 0);
  const myHostedCount = squads.filter((s) => s.hostUid === uid).length;

  const filtered: Squad[] = (() => {
    switch (activeTab) {
      case "live": return liveSquads;
      case "past": return pastSquads;
      case "mine": return mySquads;
      default: return squads;
    }
  })();

  const tabs: { key: FilterTab; label: string; count: number; bg: string }[] = [
    { key: "all", label: "ALL", count: squads.length, bg: "#fbf8fc" },
    { key: "live", label: "LIVE", count: liveSquads.length, bg: "#c8f7c5" },
    { key: "past", label: "PAST", count: pastSquads.length, bg: "#e4e1e6" },
    { key: "mine", label: "MINE", count: mySquads.length, bg: "#ffd8e7" },
    { key: "tickets", label: "TICKETS", count: tickets.length, bg: "#ffe24c" },
  ];

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
      {/* Sticky header + tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#fbf8fc", borderBottom: "3px solid #1b1b1e", paddingBottom: 0 }}>
        <div style={{ padding: "20px 20px 16px" }}>
          <span
            style={{
              display: "inline-block", background: "#7ed4fd",
              border: "2px solid #1b1b1e", padding: "3px 10px",
              fontWeight: 700, fontSize: 10, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: 6, transform: "rotate(-1deg)",
            }}
          >
            MISSION LOG
          </span>
          <h1
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 28, fontWeight: 700, textTransform: "uppercase",
              color: "#1b1b1e", lineHeight: 1.1,
            }}
          >
            INTEL
          </h1>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", overflowX: "auto", paddingLeft: 16, gap: 0, borderTop: "2px solid #1b1b1e" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px", border: "none", borderRight: "2px solid #1b1b1e",
                fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer",
                fontFamily: "inherit", letterSpacing: "0.04em", whiteSpace: "nowrap",
                backgroundColor: activeTab === tab.key ? "#1b1b1e" : tab.bg,
                color: activeTab === tab.key ? "#fbf8fc" : "#1b1b1e",
                borderBottom: activeTab === tab.key ? "none" : "none",
                flexShrink: 0,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: 6, background: activeTab === tab.key ? "#ffe24c" : "#1b1b1e",
                  color: activeTab === tab.key ? "#1b1b1e" : "#fbf8fc",
                  borderRadius: 999, padding: "1px 6px", fontSize: 9, fontWeight: 900,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px 80px" }}>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { value: squads.length, label: "Squads", bg: "#ffe24c" },
            { value: liveSquads.length, label: "Live Now", bg: "#c8f7c5" },
            { value: totalMembers, label: "Members", bg: "#c0e8ff" },
            { value: myHostedCount, label: "You Hosted", bg: "#ffd8e7" },
          ].map(({ value, label, bg }) => (
            <div
              key={label}
              style={{
                background: bg, border: "3px solid #1b1b1e",
                boxShadow: "4px 4px 0 #1b1b1e", padding: "10px 16px",
                minWidth: 70, flex: "1 1 70px",
              }}
            >
              <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 28, fontWeight: 900, color: "#1b1b1e", lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#544249", marginTop: 3 }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Tickets tab */}
        {activeTab === "tickets" && (
          <section>
            <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 14, color: "#1b1b1e" }}>
              MY TICKETS ({tickets.length})
            </h2>
            {tickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#544249", fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d9c0c9", display: "block", marginBottom: 10 }}>confirmation_number</span>
                <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>NO TICKETS YET</p>
                <p style={{ fontSize: 13 }}>Join a squad to get your first ticket.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
              </div>
            )}
          </section>
        )}

        {/* Squads tabs */}
        {activeTab !== "tickets" && (
          <>
            {/* Section label */}
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", color: "#1b1b1e" }}>
                {activeTab === "all" && `ALL MEETUPS (${filtered.length})`}
                {activeTab === "live" && `LIVE NOW (${filtered.length})`}
                {activeTab === "past" && `COMPLETED MEETUPS (${filtered.length})`}
                {activeTab === "mine" && `YOUR MISSIONS (${filtered.length})`}
              </h2>
              {activeTab === "past" && filtered.length > 0 && (
                <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, marginTop: 2 }}>
                  Full history of all squads that have ended.
                </p>
              )}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#544249", fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#d9c0c9", display: "block", marginBottom: 10 }}>
                  {activeTab === "live" ? "wifi_off" : activeTab === "mine" ? "person_off" : "radio_button_unchecked"}
                </span>
                <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                  {activeTab === "live" ? "NOTHING LIVE" : activeTab === "mine" ? "NO MISSIONS YET" : "EMPTY"}
                </p>
                <p style={{ fontSize: 13 }}>
                  {activeTab === "live" ? "No active squads right now." : activeTab === "mine" ? "Join or host a squad to start." : "No meetups deployed yet."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map((s) => (
                  <SquadRow key={s.id} squad={s} uid={uid} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
