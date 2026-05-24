"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import {
  subscribeToAllCodeDrops,
  createCodeDrop,
  toggleCodeDrop,
  deleteCodeDrop,
  type CodeDrop,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAPS_MAP_ID = process.env.NEXT_PUBLIC_MAPS_MAP_ID ?? "DEMO_MAP_ID";

const s: React.CSSProperties = {
  fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "2px solid #1b1b1e",
  fontSize: 12,
  fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
  backgroundColor: "#fbf8fc",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 8,
  textTransform: "uppercase" as const,
};

function formatTs(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Mini map picker ────────────────────────────────────────────────────────────
function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: string;
  lng: string;
  onPick: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!MAPS_API_KEY || !mapRef.current) return;
    setOptions({ key: MAPS_API_KEY, v: "weekly" });
    Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
    ]).then((libs) => {
      const { Map } = libs[0] as any;
      const { AdvancedMarkerElement } = libs[1] as any;
      if (!mapRef.current || mapObjRef.current) return;
      const center = lat && lng
        ? { lat: parseFloat(lat), lng: parseFloat(lng) }
        : { lat: 19.076, lng: 72.877 };
      const map = new Map(mapRef.current, {
        center,
        zoom: 13,
        mapId: MAPS_MAP_ID,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
      mapObjRef.current = map;

      if (lat && lng) {
        markerRef.current = new AdvancedMarkerElement({ map, position: center });
      }

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        onPick(pos.lat, pos.lng);
        if (markerRef.current) markerRef.current.position = pos;
        else {
          markerRef.current = new AdvancedMarkerElement({ map, position: pos });
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when lat/lng props change externally
  useEffect(() => {
    if (!mapObjRef.current || !lat || !lng) return;
    const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
    if (isNaN(pos.lat) || isNaN(pos.lng)) return;
    mapObjRef.current.panTo(pos);
    importLibrary("marker").then(({ AdvancedMarkerElement }: any) => {
      if (markerRef.current) { markerRef.current.position = pos; }
      else {
        markerRef.current = new AdvancedMarkerElement({ map: mapObjRef.current, position: pos });
      }
    });
  }, [lat, lng]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%", height: 200, border: "2px solid #1b1b1e",
        borderRadius: 4, marginBottom: 8, cursor: "crosshair",
      }}
    />
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CodeDropManager() {
  const [drops, setDrops] = useState<CodeDrop[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [form, setForm] = useState({
    code: "",
    label: "",
    lat: "",
    lng: "",
    maxUses: "1",
    expiresAt: "",
  });

  useEffect(() => {
    authReady.then(() => {
      setReady(true);
      return subscribeToAllCodeDrops(setDrops);
    });
  }, []);

  function setF(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleCreate() {
    const code = form.code.trim().toUpperCase();
    const label = form.label.trim();
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!code || !label || isNaN(lat) || isNaN(lng)) return;
    setCreating(true);
    try {
      await createCodeDrop({
        code,
        label,
        lat,
        lng,
        active: true,
        maxUses: parseInt(form.maxUses) || 1,
        ...(form.expiresAt ? { expiresAt: Timestamp.fromDate(new Date(form.expiresAt)) } : {}),
      });
      setForm({ code: "", label: "", lat: "", lng: "", maxUses: "1", expiresAt: "" });
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(drop: CodeDrop) {
    await toggleCodeDrop(drop.id, !drop.active);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteCodeDrop(id).finally(() => setDeleting(null));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!ready) return <p style={{ ...s, fontSize: 12, color: "#544249" }}>Loading…</p>;

  return (
    <div style={s}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: "#544249" }}>
          {drops.length} drop{drops.length !== 1 ? "s" : ""} ·{" "}
          {drops.filter((d) => d.active).length} active
        </p>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{ padding: "8px 16px", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "2px 2px 0 #1b1b1e" }}
        >
          {showCreate ? "× CLOSE" : "+ NEW DROP"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ border: "3px solid #1b1b1e", padding: 20, backgroundColor: "#fffde7", boxShadow: "4px 4px 0 #1b1b1e", marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", marginBottom: 12 }}>CREATE CODE DROP</p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, letterSpacing: "0.15em", fontWeight: 800 }}
              placeholder="CODE (e.g. STATIC42)"
              value={form.code}
              maxLength={12}
              onChange={(e) => setF("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <input
              style={{ ...inputStyle, flex: 2 }}
              placeholder="Label (e.g. Bandra Fort Drop)"
              value={form.label}
              onChange={(e) => setF("label", e.target.value)}
            />
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#544249", marginBottom: 6 }}>
            Click on the map to set drop location
          </p>
          <MapPicker
            lat={form.lat}
            lng={form.lng}
            onPick={(lat, lng) => setForm((p) => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Latitude"
              value={form.lat}
              onChange={(e) => setF("lat", e.target.value)}
            />
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Longitude"
              value={form.lng}
              onChange={(e) => setF("lng", e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              type="number"
              placeholder="Max uses (1 = single use, 0 = unlimited)"
              value={form.maxUses}
              min={0}
              onChange={(e) => setF("maxUses", e.target.value)}
            />
            <input
              style={{ ...inputStyle, flex: 1 }}
              type="datetime-local"
              placeholder="Expires at (optional)"
              value={form.expiresAt}
              onChange={(e) => setF("expiresAt", e.target.value)}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !form.code || !form.label || !form.lat || !form.lng}
            style={{ padding: "10px 20px", backgroundColor: "#9f376f", color: "#fff", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e", opacity: creating ? 0.6 : 1 }}
          >
            {creating ? "CREATING…" : "DROP CODE"}
          </button>
        </div>
      )}

      {/* Drop list */}
      {drops.length === 0 && !showCreate && (
        <p style={{ color: "#544249", fontSize: 12, fontWeight: 600 }}>No code drops yet. Create one above.</p>
      )}

      {drops.map((drop) => (
        <div
          key={drop.id}
          style={{
            border: "2px solid #1b1b1e",
            backgroundColor: drop.active ? "#fbf8fc" : "#f0edf1",
            boxShadow: "3px 3px 0 #1b1b1e",
            marginBottom: 10,
            opacity: drop.active ? 1 : 0.7,
          }}
        >
          {/* Main row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
            {/* Status pill */}
            <span style={{
              backgroundColor: drop.active ? "#4caf50" : "#877179",
              color: "white", fontSize: 9, fontWeight: 800, textTransform: "uppercase",
              padding: "3px 8px", border: "2px solid #1b1b1e", whiteSpace: "nowrap",
            }}>
              {drop.active ? "ACTIVE" : "INACTIVE"}
            </span>

            {/* Code */}
            <span
              style={{
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 16, fontWeight: 800, letterSpacing: "0.15em",
                backgroundColor: "#ffe24c", padding: "2px 10px",
                border: "2px solid #1b1b1e", cursor: "pointer",
              }}
              title="Click to copy"
              onClick={() => copyCode(drop.code)}
            >
              {drop.code}
              {copied === drop.code ? " ✓" : ""}
            </span>

            {/* Label */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{drop.label}</p>
              <p style={{ fontSize: 10, color: "#544249", margin: 0 }}>
                {drop.lat.toFixed(4)}, {drop.lng.toFixed(4)} ·{" "}
                {drop.usedCount}/{drop.maxUses === 0 ? "∞" : drop.maxUses} uses ·{" "}
                Created {formatTs(drop.createdAt)}
                {drop.expiresAt ? ` · Expires ${formatTs(drop.expiresAt)}` : ""}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setExpanded(expanded === drop.id ? null : drop.id)}
                style={{ padding: "5px 10px", backgroundColor: "#7ed4fd", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer" }}
              >
                {expanded === drop.id ? "▲ HIDE" : "▼ REDEEMERS"}
              </button>
              <button
                onClick={() => handleToggle(drop)}
                style={{ padding: "5px 10px", backgroundColor: drop.active ? "#ff6b35" : "#4caf50", color: "white", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer" }}
              >
                {drop.active ? "DEACTIVATE" : "ACTIVATE"}
              </button>
              <button
                onClick={() => handleDelete(drop.id)}
                disabled={deleting === drop.id}
                style={{ padding: "5px 10px", backgroundColor: "#ba1a1a", color: "white", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 10, textTransform: "uppercase", cursor: "pointer", opacity: deleting === drop.id ? 0.5 : 1 }}
              >
                DELETE
              </button>
            </div>
          </div>

          {/* Expanded: redeemers list */}
          {expanded === drop.id && (
            <div style={{ borderTop: "2px dashed #1b1b1e", padding: "10px 16px", backgroundColor: "#f8f4f9" }}>
              <p style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "#544249", marginBottom: 6 }}>
                REDEEMED BY ({drop.redeemedBy.length})
              </p>
              {drop.redeemedBy.length === 0 ? (
                <p style={{ fontSize: 11, color: "#877179" }}>No one yet.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {drop.redeemedBy.map((email) => (
                    <span
                      key={email}
                      style={{ fontSize: 10, backgroundColor: "#e4e1e6", padding: "2px 8px", border: "1px solid #1b1b1e" }}
                    >
                      {email}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
