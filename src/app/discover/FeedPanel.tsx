"use client";

import { useState, useEffect, useRef } from "react";
import {
  subscribeToFeed,
  toggleFeedLike,
  postActivity,
  type ActivityFeedItem,
  type ActivityType,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";
import { getTier } from "@/lib/tiers";

const TYPE_META: Record<ActivityType, { icon: string; label: string; color: string }> = {
  hunt_found:       { icon: "emoji_events",       label: "Hunt Found",      color: "#ffe24c" },
  check_in:         { icon: "where_to_vote",       label: "Check-In",        color: "#d4edda" },
  badge_earned:     { icon: "military_tech",        label: "Badge",           color: "#cce5ff" },
  photo_challenge:  { icon: "photo_camera",         label: "Photo Challenge", color: "#f3e8f7" },
  squad_formed:     { icon: "diversity_3",           label: "Squad",           color: "#fff3cd" },
  drop_created:     { icon: "add_location",          label: "Drop",            color: "#fce4ec" },
  points_milestone: { icon: "star",                  label: "Milestone",       color: "#ffe24c" },
  referral:         { icon: "person_add",            label: "Recruit",         color: "#e8f5e9" },
};

function timeAgo(ts: { toDate: () => Date }): string {
  const secs = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function Avatar({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  if (!err && src) {
    return (
      <img
        src={src} alt={name} onError={() => setErr(true)}
        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #1b1b1e", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 14,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TierPill({ tier }: { tier: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", fontSize: 9,
      fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: "#1b1b1e", color: "#ff85c1", border: "1.5px solid #ff85c1",
    }}>
      {tier}
    </span>
  );
}

function FeedCard({
  item, myEmail, onLike,
}: {
  item: ActivityFeedItem; myEmail: string; onLike: (id: string) => void;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.check_in;
  const liked = item.likes?.includes(myEmail);

  return (
    <div style={{
      backgroundColor: "#fff",
      border: "2px solid #e4e1e6",
      borderLeft: `4px solid #9f376f`,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar src={item.photoURL} name={item.displayName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: "#1b1b1e" }}>
              {item.displayName}
            </span>
            {item.tier && <TierPill tier={item.tier} />}
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>
            {timeAgo(item.createdAt)}
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", fontSize: 9, fontWeight: 800,
          textTransform: "uppercase", letterSpacing: "0.04em",
          backgroundColor: meta.color, border: "1.5px solid #1b1b1e",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>
            {meta.icon}
          </span>
          {meta.label}
        </span>
      </div>

      {/* Content */}
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1b1b1e", lineHeight: 1.4 }}>
          {item.title}
        </p>
        {item.body && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#544249", lineHeight: 1.4 }}>
            {item.body}
          </p>
        )}
      </div>

      {item.imageURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageURL} alt=""
          style={{ width: "100%", maxHeight: 200, objectFit: "cover", border: "2px solid #e4e1e6" }}
        />
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1.5px dashed #e4e1e6" }}>
        <button
          onClick={() => onLike(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer",
            color: liked ? "#9f376f" : "#aaa",
            fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
            fontSize: 12, fontWeight: 700, padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17, fontVariationSettings: `'FILL' ${liked ? 1 : 0}` }}>
            favorite
          </span>
          {(item.likes?.length ?? 0) > 0 && <span>{item.likes.length}</span>}
        </button>
        {item.locationName && (
          <span style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 3 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
            {item.locationName}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Post composer ─────────────────────────────────────────────────────────────

function PostComposer({
  uid, displayName, photoURL, tier, onPosted,
}: {
  uid: string; displayName: string; photoURL: string; tier: string;
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await postActivity({
        uid,
        displayName,
        photoURL,
        type: "check_in",
        title: text.trim(),
        tier,
      });
      setText("");
      setOpen(false);
      onPosted();
    } finally {
      setPosting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", padding: "12px 16px",
          backgroundColor: "#fbf8fc", border: "2px dashed #c4b8c0",
          cursor: "pointer", textAlign: "left",
          color: "#aaa", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#9f376f" }}>edit</span>
        Share something with the crew…
      </button>
    );
  }

  return (
    <div style={{ backgroundColor: "#fff", border: "2px solid #9f376f", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening on the hunt?"
        autoFocus
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical",
          padding: "8px 12px", border: "2px solid #e4e1e6",
          fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
          fontSize: 13, fontWeight: 600, outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setOpen(false); setText(""); }}
          style={{
            padding: "7px 16px", background: "none",
            border: "2px solid #e4e1e6", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={posting || !text.trim()}
          style={{
            padding: "7px 16px",
            backgroundColor: posting || !text.trim() ? "#ccc" : "#9f376f",
            color: "#fff", border: "2px solid #1b1b1e",
            cursor: posting || !text.trim() ? "not-allowed" : "pointer",
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 12, fontWeight: 800, textTransform: "uppercase",
          }}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function FeedPanel({
  uid,
  displayName,
  photoURL,
  points,
}: {
  uid: string;
  displayName: string;
  photoURL: string;
  points: number;
}) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [ready, setReady] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const tier = getTier(points).name;

  useEffect(() => {
    authReady.then(() => {
      unsubRef.current = subscribeToFeed(setItems);
      setReady(true);
    });
    return () => unsubRef.current?.();
  }, []);

  function handleLike(id: string) {
    toggleFeedLike(id, uid).catch(() => {});
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "3px solid #1b1b1e",
        backgroundColor: "#fbf8fc",
        flexShrink: 0,
      }}>
        <h2 style={{
          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          fontSize: 16, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.04em", margin: 0, color: "#1b1b1e",
        }}>
          Activity Feed
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>
          Live hunter activity
        </p>
      </div>

      {/* Composer */}
      <div style={{ padding: "12px 16px", borderBottom: "2px solid #e4e1e6", flexShrink: 0 }}>
        <PostComposer
          uid={uid} displayName={displayName} photoURL={photoURL} tier={tier}
          onPosted={() => {}}
        />
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {!ready && (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 13, fontWeight: 700 }}>
            Loading feed…
          </div>
        )}
        {ready && items.length === 0 && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#ddd", display: "block", marginBottom: 12 }}>
              article
            </span>
            <div style={{ fontWeight: 800, color: "#bbb", fontSize: 13, textTransform: "uppercase" }}>
              No activity yet
            </div>
            <div style={{ color: "#ccc", fontSize: 12, marginTop: 4 }}>
              Check in or complete a hunt to post!
            </div>
          </div>
        )}
        {items.map((item) => (
          <FeedCard key={item.id} item={item} myEmail={uid} onLike={handleLike} />
        ))}
      </div>
    </div>
  );
}
