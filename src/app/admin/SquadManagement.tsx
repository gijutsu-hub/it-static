"use client";

import { useEffect, useState } from "react";
import { subscribeToAllSquads, deactivateSquad, deleteSquad, type Squad } from "@/lib/firestore";
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

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-SG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SquadManagement() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToAllSquads((s) => {
      setSquads(s);
      setLoading(false);
    });
    return unsub;
  }, [firebaseReady]);

  const filtered = squads.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.hostName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "live" ? s.active : !s.active);
    return matchSearch && matchFilter;
  });

  async function handleDeactivate(squadId: string) {
    setPending(squadId);
    try {
      await deactivateSquad(squadId);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(null);
    }
  }

  async function handleDelete(squadId: string) {
    setPending(squadId);
    setConfirmDelete(null);
    try {
      await deleteSquad(squadId);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search squads or hosts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: "10px 14px", border: "2px solid #1b1b1e",
            fontSize: 13, fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
            backgroundColor: "#fbf8fc", outline: "none",
          }}
        />
        {(["all", "live", "ended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "10px 16px", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11,
              textTransform: "uppercase", cursor: "pointer",
              fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
              backgroundColor: filter === f ? "#1b1b1e" : "#fbf8fc",
              color: filter === f ? "#fbf8fc" : "#1b1b1e",
              boxShadow: filter === f ? "none" : "2px 2px 0 #1b1b1e",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#544249", fontWeight: 600 }}>Loading squads...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#544249", fontWeight: 600 }}>No squads found.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((squad) => {
          const bg = THEME_COLORS[squad.theme] ?? "#ffe24c";
          const memberCount = squad.memberUids?.length ?? 0;
          const pct = Math.min(100, (memberCount / squad.capacity) * 100);

          return (
            <div
              key={squad.id}
              style={{
                border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e",
                overflow: "hidden", background: "#fbf8fc",
                opacity: pending === squad.id ? 0.6 : 1,
              }}
            >
              <div style={{ height: 5, background: bg }} />
              <div style={{ padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>{squad.name}</span>
                    {squad.active ? (
                      <span style={{ background: "#c8f7c5", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>LIVE</span>
                    ) : (
                      <span style={{ background: "#e4e1e6", border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: "#544249" }}>ENDED</span>
                    )}
                    <span style={{ background: bg, border: "1.5px solid #1b1b1e", padding: "1px 6px", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{squad.theme}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>
                    Hosted by <strong>{squad.hostName}</strong> · {formatDate(squad.createdAt as Timestamp)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1b1b1e" }}>{memberCount}/{squad.capacity} members</span>
                    <div style={{ flex: 1, maxWidth: 100, height: 5, background: "#e4e1e6", border: "1px solid #1b1b1e" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#9f376f" }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: "#7aafbf", fontWeight: 600, marginTop: 2 }}>ID: {squad.id}</p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  {squad.active && (
                    <button
                      onClick={() => handleDeactivate(squad.id)}
                      disabled={pending === squad.id}
                      style={{
                        padding: "8px 14px", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11,
                        textTransform: "uppercase", cursor: "pointer", background: "#ffe24c",
                        fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                        boxShadow: "2px 2px 0 #1b1b1e",
                      }}
                    >
                      {pending === squad.id ? "..." : "END SQUAD"}
                    </button>
                  )}
                  {confirmDelete === squad.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleDelete(squad.id)}
                        disabled={pending === squad.id}
                        style={{ padding: "8px 12px", border: "2px solid #ba1a1a", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", background: "#ba1a1a", color: "white", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ padding: "8px 12px", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11, textTransform: "uppercase", cursor: "pointer", background: "#fbf8fc", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(squad.id)}
                      disabled={pending === squad.id}
                      style={{
                        padding: "8px 14px", border: "2px solid #ba1a1a", fontWeight: 700, fontSize: 11,
                        textTransform: "uppercase", cursor: "pointer", background: "#fbf8fc", color: "#ba1a1a",
                        fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                        boxShadow: "2px 2px 0 #ba1a1a",
                      }}
                    >
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
