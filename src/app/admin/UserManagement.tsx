"use client";

import { useEffect, useState } from "react";
import { subscribeToAllUsers, banUser, unbanUser, type UserProfile } from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-SG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
      if (user.banned) {
        await unbanUser(user.email);
      } else {
        await banUser(user.email);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPending(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = users.filter((u) => !u.banned).length;
  const bannedCount = users.filter((u) => u.banned).length;

  return (
    <div className="flex flex-col gap-6">

      {/* Stats row */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: "Total Users", value: users.length, color: "#9f376f" },
          { label: "Active",       value: activeCount,  color: "#006686" },
          { label: "Banned",       value: bannedCount,  color: "#ba1a1a" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex-1 min-w-[120px] bg-surface border-4 border-on-surface p-4"
            style={{ boxShadow: "4px 4px 0 #1b1b1e" }}
          >
            <p className="font-label-sm text-xs uppercase text-on-surface-variant mb-1">{stat.label}</p>
            <p
              className="font-display-lg text-4xl font-black"
              style={{ color: stat.color, fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)" }}
            >
              {loading ? "…" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full border-3 border-on-surface p-3 font-body-md bg-surface-container focus:outline-none focus:border-primary"
        style={{ border: "3px solid #1b1b1e" }}
      />

      {/* Table */}
      <div
        className="bg-surface border-4 border-on-surface overflow-hidden"
        style={{ boxShadow: "6px 6px 0 #1b1b1e" }}
      >
        {/* Header */}
        <div
          className="grid font-label-lg text-xs uppercase text-on-surface-variant px-4 py-3"
          style={{
            gridTemplateColumns: "48px 1fr 1fr 140px 140px 90px 90px",
            backgroundColor: "#e4e1e6",
            borderBottom: "3px solid #1b1b1e",
          }}
        >
          <span />
          <span>Name</span>
          <span>Email</span>
          <span>First Seen</span>
          <span>Last Seen</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {loading && (
          <div className="p-8 text-center font-label-lg text-on-surface-variant uppercase text-sm">
            Loading users…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center font-label-lg text-on-surface-variant uppercase text-sm">
            No users found
          </div>
        )}

        {filtered
          .sort((a, b) => {
            // Banned first, then by lastSeen descending
            if (a.banned !== b.banned) return a.banned ? -1 : 1;
            return (b.lastSeen?.seconds ?? 0) - (a.lastSeen?.seconds ?? 0);
          })
          .map((user, i) => (
            <div
              key={user.email}
              className="grid items-center px-4 py-3 font-body-md text-sm"
              style={{
                gridTemplateColumns: "48px 1fr 1fr 140px 140px 90px 90px",
                borderBottom: i < filtered.length - 1 ? "2px solid #e4e1e6" : "none",
                backgroundColor: user.banned ? "#fff0ee" : "transparent",
              }}
            >
              {/* Avatar */}
              <div>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-9 h-9 rounded-full border-2 border-on-surface"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full border-2 border-on-surface flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: "#ffd8e7" }}
                  >
                    {user.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>

              {/* Name */}
              <span className="font-semibold truncate pr-2">{user.displayName || "—"}</span>

              {/* Email */}
              <span className="text-on-surface-variant truncate pr-2 text-xs">{user.email}</span>

              {/* First Seen */}
              <span className="text-on-surface-variant text-xs">{formatDate(user.firstSeen as any)}</span>

              {/* Last Seen */}
              <span className="text-on-surface-variant text-xs">{formatDate(user.lastSeen as any)}</span>

              {/* Status badge */}
              <span>
                <span
                  className="font-label-sm text-[10px] uppercase px-2 py-1 border-2 border-on-surface"
                  style={{
                    backgroundColor: user.banned ? "#ba1a1a" : "#006686",
                    color: "white",
                    boxShadow: "2px 2px 0 #1b1b1e",
                  }}
                >
                  {user.banned ? "BANNED" : "ACTIVE"}
                </span>
              </span>

              {/* Ban / Unban button */}
              <span>
                <button
                  onClick={() => toggleBan(user)}
                  disabled={pending === user.email}
                  className="font-label-sm text-[10px] uppercase px-3 py-1 border-2 border-on-surface cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: user.banned ? "#ffe24c" : "#ffdad6",
                    color: "#1b1b1e",
                    boxShadow: "2px 2px 0 #1b1b1e",
                    transition: "transform 0.1s, box-shadow 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(1px,1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0 #1b1b1e";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #1b1b1e";
                  }}
                >
                  {pending === user.email ? "…" : user.banned ? "UNBAN" : "BAN"}
                </button>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
