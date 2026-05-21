"use client";

import { useEffect, useState, useRef } from "react";
import { subscribeToSquad, type Squad } from "@/lib/firestore";
import { authReady } from "@/lib/firebase";
import QRCode from "qrcode";

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BASE_URL || "https://itstatic.app";

const PALETTE = [
  { bg: "#ff85c1", accent: "#9f376f", text: "#1b1b1e" },
  { bg: "#ffe24c", accent: "#c7ad07", text: "#1b1b1e" },
  { bg: "#7ed4fd", accent: "#006686", text: "#1b1b1e" },
  { bg: "#c0e8ff", accent: "#005b78", text: "#1b1b1e" },
  { bg: "#ffd8e7", accent: "#791651", text: "#1b1b1e" },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  squadId: string;
}

export default function EventClient({ squadId }: Props) {
  const [squad, setSquad] = useState<Squad | null | undefined>(undefined);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const eventUrl = `${BASE_URL}/event/${squadId}`;
  const palette = PALETTE[hashId(squadId) % PALETTE.length];

  useEffect(() => {
    authReady.then(() => {
      const unsub = subscribeToSquad(squadId, setSquad);
      return unsub;
    });
  }, [squadId]);

  useEffect(() => {
    QRCode.toDataURL(eventUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#1b1b1e", light: "#fbf8fc" },
    }).then(setQrDataUrl).catch(() => {});
  }, [eventUrl]);

  function copyLink() {
    navigator.clipboard.writeText(eventUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString("en-SG", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (squad === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf8fc",
          fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 48, color: "#9f376f", display: "block", marginBottom: 16, animation: "spin 1s linear infinite" }}
          >
            radar
          </span>
          <p
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 20,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Tuning in...
          </p>
        </div>
      </div>
    );
  }

  if (squad === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf8fc",
          fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 40 }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 64, color: "#d9c0c9", display: "block", marginBottom: 16 }}
          >
            wifi_off
          </span>
          <h1
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 28,
              fontWeight: 800,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            EVENT NOT FOUND
          </h1>
          <p style={{ fontSize: 14, color: "#544249", fontWeight: 600 }}>
            This event no longer exists or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const memberCount = squad.memberUids?.length ?? 0;
  const pct = Math.min(100, (memberCount / squad.capacity) * 100);
  const category = squad.category || squad.theme || "EVENT";
  const isFull = memberCount >= squad.capacity;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fbf8fc",
        fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "4px solid #1b1b1e",
          backgroundColor: "#fbf8fc",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 0 #1b1b1e",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="IT'S STATIC" style={{ height: 40 }} />
        <a
          href="/auth"
          style={{
            background: "#9f376f",
            color: "white",
            border: "2px solid #1b1b1e",
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 12,
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: "3px 3px 0 #1b1b1e",
            letterSpacing: "0.04em",
          }}
        >
          JOIN THE STATIC
        </a>
      </header>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Event hero */}
        <div
          style={{
            background: palette.bg,
            border: "4px solid #1b1b1e",
            boxShadow: "10px 10px 0 #1b1b1e",
            marginBottom: 32,
            overflow: "hidden",
          }}
        >
          {/* Category banner */}
          <div
            style={{
              background: "#1b1b1e",
              padding: "8px 24px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: palette.bg, fontVariationSettings: "'FILL' 1" }}
            >
              celebration
            </span>
            <span
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 12,
                color: palette.bg,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {category}
            </span>
          </div>

          <div style={{ padding: "32px 32px 28px" }}>
            <h1
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 40,
                fontWeight: 900,
                textTransform: "uppercase",
                color: palette.text,
                lineHeight: 1,
                marginBottom: 16,
                letterSpacing: "-0.02em",
              }}
            >
              {squad.name}
            </h1>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.text, opacity: 0.7 }}>person</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>
                  Hosted by <strong>{squad.hostName}</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.text, opacity: 0.7 }}>schedule</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: palette.text }}>
                  {formatDate(squad.createdAt as any)}
                </span>
              </div>
            </div>

            {/* Capacity */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>
                  Capacity
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                    fontSize: 18,
                    fontWeight: 800,
                    color: palette.text,
                  }}
                >
                  {memberCount} / {squad.capacity}
                </span>
              </div>
              <div style={{ height: 10, background: "rgba(27,27,30,0.2)", border: "2px solid #1b1b1e", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "#1b1b1e",
                    borderRadius: 999,
                    transition: "width 0.4s",
                  }}
                />
              </div>
            </div>

            {/* Status badge */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  background: squad.active && !isFull ? "#c8f7c5" : "#ffd8e7",
                  border: "2px solid #1b1b1e",
                  padding: "4px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  boxShadow: "2px 2px 0 #1b1b1e",
                }}
              >
                {!squad.active ? "ENDED" : isFull ? "SQUAD FULL" : "OPEN — JOIN NOW"}
              </span>
            </div>
          </div>
        </div>

        {/* Share + ticket row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <button
            onClick={copyLink}
            style={{
              background: copied ? "#c8f7c5" : "#ffe24c",
              border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e",
              padding: "18px 16px",
              fontWeight: 800,
              fontSize: 14,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              letterSpacing: "0.04em",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 0 #1b1b1e";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {copied ? "check_circle" : "link"}
            </span>
            {copied ? "COPIED!" : "SHARE LINK"}
          </button>

          <button
            onClick={() => setShowTicket(true)}
            style={{
              background: "#ff85c1",
              border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e",
              padding: "18px 16px",
              fontWeight: 800,
              fontSize: 14,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              letterSpacing: "0.04em",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 0 #1b1b1e";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
              confirmation_number
            </span>
            GET TICKET
          </button>
        </div>

        {/* CTA */}
        <div
          style={{
            background: "#1b1b1e",
            border: "4px solid #1b1b1e",
            boxShadow: "8px 8px 0 #9f376f",
            padding: "28px 32px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              textTransform: "uppercase",
              color: "#fbf8fc",
              marginBottom: 8,
            }}
          >
            Want to join the event?
          </p>
          <p style={{ fontSize: 14, color: "#c4bcc3", fontWeight: 600, marginBottom: 20 }}>
            Sign in to IT&apos;S STATIC and find this squad on the map.
          </p>
          <a
            href="/auth"
            style={{
              display: "inline-block",
              background: "#ff85c1",
              color: "#1b1b1e",
              border: "3px solid #fbf8fc",
              padding: "14px 32px",
              fontWeight: 800,
              fontSize: 14,
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow: "4px 4px 0 #fbf8fc",
              letterSpacing: "0.06em",
            }}
          >
            JOIN THE STATIC →
          </a>
        </div>
      </main>

      {/* ── TICKET MODAL ── */}
      {showTicket && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowTicket(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <FunkyTicket
              ref={ticketRef}
              squad={squad}
              category={category}
              palette={palette}
              qrDataUrl={qrDataUrl}
              eventUrl={eventUrl}
              onClose={() => setShowTicket(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Funky Ticket Component ──────────────────────────────────────────────────

import React from "react";

interface TicketProps {
  squad: Squad;
  category: string;
  palette: { bg: string; accent: string; text: string };
  qrDataUrl: string;
  eventUrl: string;
  onClose: () => void;
}

const FunkyTicket = React.forwardRef<HTMLDivElement, TicketProps>(
  ({ squad, category, palette, qrDataUrl, eventUrl, onClose }, ref) => {
    const [copied, setCopied] = useState(false);
    const ticketId = `TKT-${squad.id.slice(0, 6).toUpperCase()}`;
    const memberCount = squad.memberUids?.length ?? 0;

    function copyUrl() {
      navigator.clipboard.writeText(eventUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }

    function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
      if (!ts?.toDate) return "LIVE NOW";
      return ts.toDate().toLocaleDateString("en-SG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).toUpperCase();
    }

    return (
      <div
        style={{
          width: 340,
          fontFamily: "var(--font-quicksand),'Quicksand',sans-serif",
          filter: "drop-shadow(12px 12px 0px #1b1b1e)",
        }}
      >
        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fbf8fc",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            CLOSE
          </button>
        </div>

        <div ref={ref}>
          {/* Ticket top section */}
          <div
            style={{
              background: palette.bg,
              border: "4px solid #1b1b1e",
              borderBottom: "none",
              padding: "24px 24px 20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Diagonal stripe decoration */}
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                background: "rgba(27,27,30,0.08)",
                transform: "rotate(45deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 60,
                height: 60,
                background: "rgba(27,27,30,0.06)",
                transform: "rotate(45deg)",
              }}
            />

            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p
                  style={{
                    fontWeight: 800,
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: palette.text,
                    opacity: 0.6,
                    marginBottom: 4,
                  }}
                >
                  IT&apos;S STATIC × LIVE EVENT
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: palette.accent,
                    letterSpacing: "0.06em",
                  }}
                >
                  {category}
                </p>
              </div>
              <div
                style={{
                  background: "#1b1b1e",
                  color: palette.bg,
                  padding: "4px 10px",
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {squad.active ? "LIVE" : "ENDED"}
              </div>
            </div>

            {/* Event name */}
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 30,
                fontWeight: 900,
                textTransform: "uppercase",
                color: palette.text,
                lineHeight: 1,
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              {squad.name}
            </h2>

            {/* Meta row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.5, letterSpacing: "0.06em", marginBottom: 2 }}>
                  HOSTED BY
                </p>
                <p style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{squad.hostName}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.5, letterSpacing: "0.06em", marginBottom: 2 }}>
                  DATE
                </p>
                <p style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
                  {formatDate(squad.createdAt as any)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.5, letterSpacing: "0.06em", marginBottom: 2 }}>
                  CREW
                </p>
                <p style={{ fontSize: 12, fontWeight: 800 }}>{memberCount}/{squad.capacity}</p>
              </div>
            </div>
          </div>

          {/* Perforation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderLeft: "4px solid #1b1b1e",
              borderRight: "4px solid #1b1b1e",
              background: "#fbf8fc",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.75)",
                marginLeft: -12,
                flexShrink: 0,
                border: "2px solid #1b1b1e",
              }}
            />
            <div
              style={{
                flex: 1,
                borderTop: "3px dashed #1b1b1e",
                margin: "0 4px",
              }}
            />
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.75)",
                marginRight: -12,
                flexShrink: 0,
                border: "2px solid #1b1b1e",
              }}
            />
          </div>

          {/* Ticket stub / QR section */}
          <div
            style={{
              background: "#1b1b1e",
              border: "4px solid #1b1b1e",
              borderTop: "none",
              padding: "20px 24px 24px",
              display: "flex",
              gap: 20,
              alignItems: "center",
            }}
          >
            {/* QR Code */}
            <div
              style={{
                background: "#fbf8fc",
                border: "3px solid #fbf8fc",
                boxShadow: "4px 4px 0 #9f376f",
                flexShrink: 0,
                lineHeight: 0,
              }}
            >
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Event QR" style={{ width: 90, height: 90, display: "block" }} />
              ) : (
                <div
                  style={{
                    width: 90,
                    height: 90,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#1b1b1e" }}>qr_code_2</span>
                </div>
              )}
            </div>

            {/* Stub info */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#877179", marginBottom: 6 }}>
                TICKET ID
              </p>
              <p
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#fbf8fc",
                  letterSpacing: "0.06em",
                  marginBottom: 12,
                }}
              >
                {ticketId}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#877179", marginBottom: 4 }}>
                SCAN TO VIEW EVENT
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "#2d2d30",
                  border: "1px solid #3d3d40",
                  padding: "4px 8px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#877179" }}>link</span>
                <span style={{ fontSize: 9, color: "#877179", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                  {eventUrl.replace("https://", "")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy/share buttons below ticket */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={copyUrl}
            style={{
              flex: 1,
              background: copied ? "#c8f7c5" : "#ffe24c",
              border: "3px solid #fbf8fc",
              padding: "12px",
              fontWeight: 800,
              fontSize: 12,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              letterSpacing: "0.04em",
              color: "#1b1b1e",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {copied ? "check" : "link"}
            </span>
            {copied ? "COPIED!" : "COPY LINK"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={() =>
                navigator.share({
                  title: `${squad.name} — IT'S STATIC`,
                  text: `You're invited to ${squad.name}!`,
                  url: eventUrl,
                }).catch(() => {})
              }
              style={{
                flex: 1,
                background: "#ff85c1",
                border: "3px solid #fbf8fc",
                padding: "12px",
                fontWeight: 800,
                fontSize: 12,
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                letterSpacing: "0.04em",
                color: "#1b1b1e",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>share</span>
              SHARE
            </button>
          )}
        </div>
      </div>
    );
  }
);

FunkyTicket.displayName = "FunkyTicket";
