"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { doc, onSnapshot } from "firebase/firestore";
import {
  subscribeToSquads,
  createSquad,
  joinSquad,
  upsertUser,
  subscribeToUserKYCStatus,
  db,
  type Squad,
  type KYCSubmission,
  type UserProfile,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";
import RecruitDirectory from "./RecruitDirectory";
import KYCFlow from "./KYCFlow";
import { signOut } from "next-auth/react";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

// distance between two lat/lng points in km (haversine approximation)
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const THEMES = [
  "K-POP VIBES",
  "TECH TALK",
  "ROOFTOP BEATS",
  "URBAN ART",
  "SKATE CREW",
  "RAVE SIGNAL",
  "CHILL ZONE",
];

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
  session: Session;
}

export default function DiscoverClient({ session }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerMapRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const userMarkerRef =
    useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [allSquads, setAllSquads] = useState<Squad[]>([]);
  const [nearbySquads, setNearbySquads] = useState<Squad[]>([]);
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostForm, setHostForm] = useState({
    name: "",
    theme: THEMES[0],
    capacity: "10",
  });
  const [hosting, setHosting] = useState(false);
  const [activeNav, setActiveNav] = useState<"squads" | "signals" | "intel" | "recruits" | "kyc">(
    "squads"
  );
  const [kycSubmission, setKycSubmission] = useState<KYCSubmission | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null | undefined>(undefined);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const user = session.user!;
  // Use email as stable UID since we use Next-Auth (not Firebase Auth)
  const uid = user.email ?? "anon";

  const mySquad = allSquads.find(
    (s) => s.memberUids?.includes(uid) || s.hostUid === uid
  ) ?? null;

  // ── Wait for Firebase anonymous auth before any Firestore calls ───────────
  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  // ── Register user in Firestore immediately on mount ───────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    upsertUser(uid, {
      displayName: user.name ?? "Anonymous",
      photoURL: user.image ?? "",
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  // ── Subscribe to current user's KYC status for sidebar indicator ──────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToUserKYCStatus(uid, (sub) => {
      setKycSubmission(sub);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Subscribe to user profile for KYC approval gate ────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    const userDocRef = doc(db, "users", uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      setUserProfile(snap.exists() ? (snap.data() as UserProfile) : null);
    }, () => {});
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Force KYC tab when profile loads and KYC is not approved ───────────────
  const kycApproved = userProfile?.kycStatus === "approved";
  useEffect(() => {
    if (userProfile !== undefined && !kycApproved) {
      setActiveNav("kyc");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.kycStatus]);

  // ── Request geolocation proactively on mount (before Maps loads) ──────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      setUserLocation({ lat: 1.3521, lng: 103.8198 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (googleMapRef.current) {
          googleMapRef.current.setCenter(loc);
          googleMapRef.current.setZoom(15);
          placeUserMarker(googleMapRef.current, loc);
        }
        if (firebaseReady) {
          upsertUser(uid, {
            displayName: user.name ?? "Anonymous",
            photoURL: user.image ?? "",
            location: loc,
          }).catch(() => {});
        }
      },
      () => {
        setLocationDenied(true);
        setUserLocation({ lat: 1.3521, lng: 103.8198 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load Google Maps ───────────────────────────────────────────────────────
  useEffect(() => {
    setOptions({ key: MAPS_API_KEY, v: "weekly", libraries: ["marker"] });
    importLibrary("maps").then(() => setMapsReady(true));
  }, []);

  // ── Initialize map once ready ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || googleMapRef.current) return;

    let cancelled = false;
    importLibrary("maps").then(({ Map }) => {
      if (cancelled || !mapDivRef.current) return;
      initMap(Map);
    });
    return () => { cancelled = true; };
  }, [mapsReady]);

  function initMap(Map: typeof google.maps.Map) {
    if (!mapDivRef.current) return;
    // Use already-resolved location if available, fall back to Singapore
    const center = userLocation ?? { lat: 1.3521, lng: 103.8198 };
    const map = new Map(mapDivRef.current, {
      center,
      zoom: userLocation ? 15 : 14,
      mapId: "RESIST_NET_MAP",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });
    googleMapRef.current = map;
    if (userLocation) placeUserMarker(map, userLocation);
  }

  // ── Subscribe to all squads from Firestore ─────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToSquads((squads) => {
      setAllSquads(squads);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  // ── Filter nearby squads and update map markers ────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const nearby = allSquads.filter(
      (s) =>
        distanceKm(
          userLocation.lat,
          userLocation.lng,
          s.location.lat,
          s.location.lng
        ) <= 5
    );
    setNearbySquads(nearby);
    if (googleMapRef.current) {
      updateMapMarkers(nearby, googleMapRef.current);
    }
  }, [allSquads, userLocation]);

  function placeUserMarker(
    map: google.maps.Map,
    loc: { lat: number; lng: number }
  ) {
    const el = document.createElement("div");
    el.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:0;";
    el.innerHTML = `
      <div style="background:#ff85c1;border:3px solid #1b1b1e;box-shadow:4px 4px 0 #1b1b1e;padding:6px 12px;border-radius:12px;display:flex;align-items:center;gap:8px;white-space:nowrap;">
        <img src="${user.image ?? ""}" style="width:24px;height:24px;border-radius:50%;border:2px solid #1b1b1e;flex-shrink:0;" />
        <span style="font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:11px;color:#1b1b1e;text-transform:uppercase;">YOU</span>
      </div>
      <div style="width:3px;height:14px;background:#1b1b1e;"></div>
      <div style="width:8px;height:4px;background:#1b1b1e;opacity:0.4;border-radius:999px;"></div>`;

    userMarkerRef.current = new (
      google.maps.marker as any
    ).AdvancedMarkerElement({
      map,
      position: loc,
      content: el,
      title: "You",
      zIndex: 100,
    });
  }

  function updateMapMarkers(squads: Squad[], map: google.maps.Map) {
    const currentIds = new Set(squads.map((s) => s.id));

    // Remove stale markers
    markerMapRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        (marker as any).map = null;
        markerMapRef.current.delete(id);
      }
    });

    // Add new markers
    squads.forEach((squad) => {
      if (markerMapRef.current.has(squad.id)) return;

      const bg = THEME_COLORS[squad.theme] ?? "#ffe24c";
      const memberCount = squad.memberUids?.length ?? 0;

      const el = document.createElement("div");
      el.style.cssText =
        "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      el.innerHTML = `
        <div style="background:${bg};border:3px solid #1b1b1e;box-shadow:5px 5px 0 #1b1b1e;padding:8px 14px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px;transition:transform 0.15s;">
          <span style="font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:11px;color:#1b1b1e;text-transform:uppercase;letter-spacing:0.04em;">${squad.name}</span>
          <span style="background:white;border:1.5px solid #1b1b1e;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:700;font-family:var(--font-quicksand),'Quicksand',sans-serif;color:#1b1b1e;">${memberCount} / ${squad.capacity} active</span>
        </div>
        <div style="width:3px;height:18px;background:#1b1b1e;"></div>
        <div style="width:10px;height:5px;background:#1b1b1e;opacity:0.3;border-radius:999px;"></div>`;

      const marker = new (google.maps.marker as any).AdvancedMarkerElement({
        map,
        position: squad.location,
        content: el,
        title: squad.name,
      });

      el.addEventListener("click", () => setSelectedSquad(squad));
      markerMapRef.current.set(squad.id, marker);
    });
  }

  async function handleJoin(squad: Squad) {
    if (squad.memberUids?.includes(uid)) return;
    if ((squad.memberUids?.length ?? 0) >= squad.capacity) return;
    setJoining(squad.id);
    try {
      await joinSquad(squad.id, uid);
    } catch (e) {
      console.error(e);
    } finally {
      setJoining(null);
      setSelectedSquad(null);
    }
  }

  async function handleHostParty() {
    if (!userLocation || !hostForm.name.trim()) return;
    setHosting(true);
    try {
      await createSquad({
        name: hostForm.name.trim().toUpperCase(),
        theme: hostForm.theme,
        hostUid: uid,
        hostName: user.name ?? "Anonymous",
        hostPhotoURL: user.image ?? "",
        location: userLocation,
        address: "Your Location",
        capacity: Math.max(2, parseInt(hostForm.capacity) || 10),
        memberUids: [uid],
        active: true,
      });
      setShowHostModal(false);
      setHostForm({ name: "", theme: THEMES[0], capacity: "10" });
    } catch (e) {
      console.error(e);
    } finally {
      setHosting(false);
    }
  }

  const totalActiveNodes = allSquads.reduce(
    (acc, s) => acc + (s.memberUids?.length ?? 0),
    0
  );

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ fontFamily: "var(--font-quicksand),'Quicksand',sans-serif", backgroundColor: "#fbf8fc" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        className="discover-header"
        style={{
          position: "fixed", top: 0, left: 0, width: "100%", zIndex: 50,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#fbf8fc",
          borderBottom: "4px solid #1b1b1e",
          boxShadow: "4px 4px 0 rgba(27,27,30,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid #1b1b1e", background: "#ff85c1",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#1b1b1e" }}>bolt</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em",
              textTransform: "lowercase", color: "#9f376f", fontStyle: "italic", lineHeight: 1,
            }}
          >
            itstatic.space
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            className="material-symbols-outlined"
            style={{ color: "#9f376f", padding: 8, fontSize: 24, background: "none", border: "none", cursor: "pointer" }}
          >notifications</button>
          <button
            className="material-symbols-outlined"
            style={{ color: "#9f376f", padding: 8, fontSize: 24, background: "none", border: "none", cursor: "pointer" }}
          >wifi_tethering</button>
          <button
            className="material-symbols-outlined"
            style={{ color: "#9f376f", padding: 8, fontSize: 24, background: "none", border: "none", cursor: "pointer" }}
          >settings</button>

          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, marginLeft: 12,
              backgroundColor: "#ffd8e7", border: "2px solid #1b1b1e",
              padding: "8px 16px", borderRadius: 8,
            }}
          >
            <span
              style={{
                fontWeight: 700, fontSize: 13, letterSpacing: "0.02em",
                textTransform: "uppercase", color: "#3d0025",
              }}
            >
              {(user.name ?? "COMMANDER").toUpperCase().replace(/ /g, "_")}
            </span>
            {user.image && (
              <img
                src={user.image}
                alt="Profile"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1b1b1e" }}
              />
            )}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/auth" })}
            style={{
              background: "none", border: "2px solid #877179", borderRadius: 6,
              cursor: "pointer", color: "#544249", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", padding: "4px 10px",
            }}
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside
        className="discover-sidebar"
        style={{
          position: "fixed", left: 0, top: 0, height: "100%", width: 320,
          backgroundColor: "#7ed4fd", flexDirection: "column",
          zIndex: 40, borderRight: "4px solid #1b1b1e",
          boxShadow: "8px 0 0 rgba(0,102,134,1)",
          paddingTop: 88, paddingBottom: 32, overflowY: "auto",
        }}
      >
        {/* Operations box */}
        <div style={{ padding: "0 24px", marginBottom: 24 }}>
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              padding: 16, boxShadow: "4px 4px 0 #1b1b1e", borderRadius: 12,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 900, color: "#1b1b1e", textTransform: "uppercase",
              }}
            >
              OPERATIONS
            </h2>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 700, marginTop: 2 }}>
              Active Nodes: {totalActiveNodes}
            </p>
          </div>

          {/* KYC required banner */}
          {userProfile !== undefined && !kycApproved && (
            <div
              style={{
                marginTop: 12,
                backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
                boxShadow: "3px 3px 0 #1b1b1e", padding: "10px 14px", borderRadius: 8,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1b1b1e", flexShrink: 0, marginTop: 1 }}>
                lock
              </span>
              <div>
                <p style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 2 }}>
                  IDENTITY REQUIRED
                </p>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#544249", lineHeight: 1.4 }}>
                  Complete VERIFY ID to unlock all features.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 16px" }}>
          {[
            { icon: "groups", label: "Squads", key: "squads" },
            { icon: "fingerprint", label: "VERIFY ID", key: "kyc" },
            { icon: "person_search", label: "Recruits", key: "recruits" },
            { icon: "celebration", label: "Host Party", key: "host" },
            { icon: "sensors", label: "Signals", key: "signals" },
            { icon: "article", label: "Intel", key: "intel" },
          ].map((item) => {
            const isActive = activeNav === item.key;
            const isKyc = item.key === "kyc";
            const isLocked = !kycApproved && item.key !== "kyc";

            // Determine KYC indicator
            let kycIndicator: React.ReactNode = null;
            if (isKyc && kycSubmission !== undefined) {
              if (kycApproved) {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4caf50", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#4caf50", textTransform: "uppercase" }}>VERIFIED</span>
                  </span>
                );
              } else if (kycSubmission?.status === "pending") {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#c7ad07", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#544249", textTransform: "uppercase" }}>(PENDING)</span>
                  </span>
                );
              } else if (kycSubmission?.status === "rejected") {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ba1a1a", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#ba1a1a", textTransform: "uppercase" }}>REJECTED</span>
                  </span>
                );
              }
            }

            return (
              <button
                key={item.key}
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  if (item.key === "host") setShowHostModal(true);
                  else setActiveNav(item.key as typeof activeNav);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 8,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  textAlign: "left", width: "100%", fontWeight: 700,
                  fontSize: 14, textTransform: "uppercase", letterSpacing: "0.02em",
                  fontFamily: "inherit", transition: "all 0.12s",
                  backgroundColor: isActive ? "#ffe24c" : "transparent",
                  color: isLocked ? "#7aafbf" : isActive ? "#211b00" : "#005b78",
                  border: isActive ? "2px solid #1b1b1e" : "2px solid transparent",
                  boxShadow: isActive ? "4px 4px 0 #1b1b1e" : "none",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {isLocked ? "lock" : item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {kycIndicator}
              </button>
            );
          })}
        </nav>

        {/* Nearby squads list */}
        <div style={{ marginTop: 24, padding: "0 16px" }}>
          <div style={{ borderTop: "4px solid #1b1b1e", paddingTop: 20 }}>
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              Squads Nearby
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nearbySquads.length === 0 && (
                <p style={{ color: "#544249", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                  No squads nearby yet.{"\n"}Host the first one!
                </p>
              )}
              {nearbySquads.map((squad) => {
                const isMember = squad.memberUids?.includes(uid);
                const isFull = (squad.memberUids?.length ?? 0) >= squad.capacity;
                return (
                  <div
                    key={squad.id}
                    style={{
                      backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
                      padding: "10px 12px", boxShadow: "4px 4px 0 #1b1b1e",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          border: "2px solid #1b1b1e",
                          backgroundColor: THEME_COLORS[squad.theme] ?? "#ffe24c",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, display: "block" }}>
                          {squad.name}
                        </span>
                        <span style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>
                          {squad.memberUids?.length ?? 0}/{squad.capacity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoin(squad)}
                      disabled={isMember || isFull || joining === squad.id}
                      style={{
                        backgroundColor: isMember ? "#e4e1e6" : "#9f376f",
                        color: isMember ? "#544249" : "white",
                        border: "2px solid #1b1b1e",
                        padding: "4px 12px", fontWeight: 700, fontSize: 11,
                        textTransform: "uppercase", cursor: isMember || isFull ? "default" : "pointer",
                        boxShadow: isMember ? "none" : "3px 3px 0 #1b1b1e",
                        fontFamily: "inherit", borderRadius: 2,
                        opacity: isFull && !isMember ? 0.5 : 1,
                      }}
                    >
                      {joining === squad.id ? "..." : isMember ? "IN" : isFull ? "FULL" : "JOIN"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setShowHostModal(true)}
            style={{
              width: "100%", marginTop: 24,
              backgroundColor: "#c7ad07", border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e", padding: "14px 24px",
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 18, fontWeight: 800, textTransform: "uppercase",
              cursor: "pointer", letterSpacing: "-0.01em",
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
            DEPLOY SIGNAL
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <main
        className="discover-main"
        style={{
          flex: 1, position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Recruit Directory — shown when recruits tab is active */}
        {activeNav === "recruits" && (
          <div className="discover-overlay-panel">
            <RecruitDirectory uid={uid} />
          </div>
        )}

        {/* KYC Flow — shown when kyc tab is active */}
        {activeNav === "kyc" && (
          <div className="discover-overlay-panel">
            <KYCFlow
              uid={uid}
              displayName={user.name ?? ""}
              profilePhotoURL={user.image ?? ""}
            />
          </div>
        )}

        {/* Google Map — kept mounted for Google Maps lifecycle, hidden when recruits or kyc tab is active */}
        <div
          ref={mapDivRef}
          style={{
            width: "100%",
            height: "100%",
            visibility: activeNav === "recruits" || activeNav === "kyc" ? "hidden" : "visible",
            pointerEvents: activeNav === "recruits" || activeNav === "kyc" ? "none" : "auto",
          }}
        />

        {/* Loading overlay */}
        {!mapsReady && activeNav !== "recruits" && activeNav !== "kyc" && (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#f6f2f7", zIndex: 10,
            }}
          >
            <div
              style={{
                border: "4px solid #1b1b1e", backgroundColor: "#fbf8fc",
                padding: 32, boxShadow: "8px 8px 0 #1b1b1e", textAlign: "center",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 48, color: "#9f376f", display: "block", marginBottom: 16 }}
              >
                radar
              </span>
              <p
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontSize: 20, fontWeight: 700, textTransform: "uppercase",
                }}
              >
                Booting signal map...
              </p>
            </div>
          </div>
        )}

        {/* Location denied notice */}
        {locationDenied && activeNav !== "recruits" && activeNav !== "kyc" && (
          <div
            style={{
              position: "absolute", top: 16, left: "50%",
              transform: "translateX(-50%)", zIndex: 20,
              backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
              boxShadow: "4px 4px 0 #1b1b1e", padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1b1b1e" }}>
              location_off
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1b1b1e" }}>
              Location denied — showing default area
            </span>
          </div>
        )}

        {/* ── RIGHT OVERLAY PANELS ──────────────────────────────────────── */}
        {activeNav !== "recruits" && activeNav !== "kyc" && (
        <div
          style={{
            position: "absolute", right: 24, top: 24,
            width: 272, display: "flex", flexDirection: "column", gap: 20,
            zIndex: 10, pointerEvents: "none",
          }}
        >
          {/* YOUR PARTY */}
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e", padding: 20, borderRadius: 16,
              pointerEvents: "auto",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              YOUR PARTY
            </h3>
            {mySquad ? (
              <>
                <p
                  style={{
                    fontWeight: 700, fontSize: 13, marginBottom: 10,
                    color: "#9f376f", textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {mySquad.name}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user.image && (
                    <img
                      src={user.image}
                      alt="You"
                      style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e" }}
                    />
                  )}
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {user.name} (You)
                    </p>
                    <span
                      style={{
                        fontSize: 10, color: "#9f376f", fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {mySquad.hostUid === uid ? "Host" : "Member"}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#544249", marginTop: 8, fontWeight: 600 }}>
                  {mySquad.memberUids?.length ?? 0}/{mySquad.capacity} members
                </p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {user.image && (
                    <img
                      src={user.image}
                      alt="You"
                      style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e" }}
                    />
                  )}
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {user.name} (You)
                    </p>
                    <span style={{ fontSize: 10, color: "#9f376f", fontWeight: 800, textTransform: "uppercase" }}>
                      Host
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      border: "2px dashed #1b1b1e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: "#1b1b1e", fontSize: 20 }}>
                      add
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 13, fontStyle: "italic" }}>
                    Waiting for crew...
                  </p>
                </div>
              </>
            )}
          </div>

          {/* INCOMING */}
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e", padding: 20, borderRadius: 16,
              pointerEvents: "auto",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              INCOMING
            </h3>
            <p style={{ fontSize: 13, color: "#544249", fontWeight: 600 }}>
              No incoming requests
            </p>
          </div>
        </div>
        )}
      </main>

      {/* ── FAB (desktop only — mobile uses bottom nav HOST button) ────────── */}
      {kycApproved && <div className="hidden md:block"><button
        onClick={() => setShowHostModal(true)}
        style={{
          position: "fixed", bottom: 40, right: 40,
          backgroundColor: "#ff85c1", border: "4px solid #1b1b1e",
          padding: "28px 32px", borderRadius: "50%",
          boxShadow: "6px 6px 0 #1b1b1e", cursor: "pointer",
          zIndex: 50, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 6,
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translate(3px,3px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "3px 3px 0 #1b1b1e";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 0 #1b1b1e";
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 44, color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}
        >
          celebration
        </span>
        <span
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 12, fontWeight: 800, textTransform: "uppercase",
            color: "#1b1b1e", whiteSpace: "nowrap", letterSpacing: "-0.01em",
          }}
        >
          Host Your Own Party
        </span>
      </button></div>}

      {/* ── SQUAD DETAIL MODAL (click marker / sidebar) ───────────────────── */}
      {selectedSquad && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setSelectedSquad(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e", padding: 36,
              maxWidth: 400, width: "100%", borderRadius: 16,
            }}
          >
            <div
              style={{
                backgroundColor: THEME_COLORS[selectedSquad.theme] ?? "#ffe24c",
                border: "3px solid #1b1b1e", padding: "8px 16px",
                display: "inline-block", marginBottom: 16, borderRadius: 6,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#1b1b1e" }}>
                {selectedSquad.theme}
              </span>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 30, fontWeight: 800, textTransform: "uppercase",
                color: "#9f376f", marginBottom: 8,
              }}
            >
              {selectedSquad.name}
            </h2>
            <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, marginBottom: 4 }}>
              Hosted by <strong>{selectedSquad.hostName}</strong>
            </p>
            <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, marginBottom: 20 }}>
              {selectedSquad.memberUids?.length ?? 0} / {selectedSquad.capacity} members
            </p>

            {/* Capacity bar */}
            <div style={{ backgroundColor: "#e4e1e6", borderRadius: 999, height: 8, marginBottom: 24, border: "2px solid #1b1b1e" }}>
              <div
                style={{
                  backgroundColor: "#9f376f", height: "100%", borderRadius: 999,
                  width: `${Math.min(100, ((selectedSquad.memberUids?.length ?? 0) / selectedSquad.capacity) * 100)}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setSelectedSquad(null)}
                style={{
                  flex: 1, border: "3px solid #1b1b1e", padding: "12px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#fbf8fc",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                }}
              >
                CLOSE
              </button>
              <button
                onClick={() => handleJoin(selectedSquad)}
                disabled={
                  selectedSquad.memberUids?.includes(uid) ||
                  (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity ||
                  joining === selectedSquad.id
                }
                style={{
                  flex: 2, border: "3px solid #1b1b1e", padding: "12px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#9f376f", color: "white",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                  opacity:
                    selectedSquad.memberUids?.includes(uid) ||
                    (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity
                      ? 0.5 : 1,
                }}
              >
                {joining === selectedSquad.id
                  ? "JOINING..."
                  : selectedSquad.memberUids?.includes(uid)
                  ? "ALREADY IN"
                  : (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity
                  ? "SQUAD FULL"
                  : "JOIN SQUAD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOST PARTY MODAL ─────────────────────────────────────────────── */}
      {showHostModal && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowHostModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e", padding: 40,
              maxWidth: 480, width: "100%", borderRadius: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 30, fontWeight: 800, textTransform: "uppercase",
                marginBottom: 24, color: "#9f376f",
              }}
            >
              HOST A SQUAD
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block", fontWeight: 700, fontSize: 11,
                    textTransform: "uppercase", marginBottom: 6,
                    color: "#544249", letterSpacing: "0.04em",
                  }}
                >
                  Squad Name
                </label>
                <input
                  value={hostForm.name}
                  onChange={(e) =>
                    setHostForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. NEON RIDERS"
                  style={{
                    width: "100%", border: "3px solid #1b1b1e",
                    padding: "12px 16px", fontSize: 15, fontWeight: 700,
                    fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box", backgroundColor: "#f6f2f7",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block", fontWeight: 700, fontSize: 11,
                    textTransform: "uppercase", marginBottom: 6,
                    color: "#544249", letterSpacing: "0.04em",
                  }}
                >
                  Theme / Vibe
                </label>
                <select
                  value={hostForm.theme}
                  onChange={(e) =>
                    setHostForm((f) => ({ ...f, theme: e.target.value }))
                  }
                  style={{
                    width: "100%", border: "3px solid #1b1b1e",
                    padding: "12px 16px", fontSize: 14, fontWeight: 700,
                    fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box", backgroundColor: "#f6f2f7",
                    appearance: "none",
                  }}
                >
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block", fontWeight: 700, fontSize: 11,
                    textTransform: "uppercase", marginBottom: 6,
                    color: "#544249", letterSpacing: "0.04em",
                  }}
                >
                  Max Capacity
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={hostForm.capacity}
                  onChange={(e) =>
                    setHostForm((f) => ({ ...f, capacity: e.target.value }))
                  }
                  style={{
                    width: "100%", border: "3px solid #1b1b1e",
                    padding: "12px 16px", fontSize: 15, fontWeight: 700,
                    fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box", backgroundColor: "#f6f2f7",
                  }}
                />
              </div>

              {!userLocation && (
                <p style={{ color: "#ba1a1a", fontSize: 13, fontWeight: 600 }}>
                  ⚠ Enable location access to pin your squad on the map.
                </p>
              )}

              <div
                style={{
                  backgroundColor: "#ffd8e7", border: "2px solid #1b1b1e",
                  padding: "10px 14px", borderRadius: 6, fontSize: 12,
                  fontWeight: 600, color: "#3d0025",
                }}
              >
                📍 Your squad will be pinned at your current location
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setShowHostModal(false)}
                style={{
                  flex: 1, border: "3px solid #1b1b1e", padding: "14px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#fbf8fc",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleHostParty}
                disabled={!hostForm.name.trim() || !userLocation || hosting}
                style={{
                  flex: 2, border: "3px solid #1b1b1e", padding: "14px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#9f376f", color: "white",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                  opacity: !hostForm.name.trim() || !userLocation || hosting ? 0.55 : 1,
                }}
              >
                {hosting ? "DEPLOYING..." : "DEPLOY SQUAD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      <div
        className="md:hidden"
        style={{
          position: "fixed", bottom: 0, left: 0, width: "100%",
          backgroundColor: "#fbf8fc", borderTop: "4px solid #1b1b1e",
          display: "flex", justifyContent: "space-around", padding: "10px 0",
          zIndex: 50,
        }}
      >
        {([
          { icon: "map", label: "MAP", key: "squads" },
          { icon: "person_search", label: "RECRUITS", key: "recruits" },
          { icon: "fingerprint", label: "VERIFY", key: "kyc" },
          { icon: "celebration", label: "HOST", key: "host" },
        ] as const).map((item) => {
          const isActive = activeNav === item.key || (item.key === "host" && showHostModal);
          const isLocked = !kycApproved && item.key !== "kyc";
          return (
            <button
              key={item.key}
              onClick={() => {
                if (isLocked) return;
                if (item.key === "host") setShowHostModal(true);
                else setActiveNav(item.key);
              }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                color: isLocked ? "#c4bcc3" : isActive ? "#9f376f" : "#544249",
                background: "none", border: "none",
                cursor: isLocked ? "not-allowed" : "pointer",
                padding: "4px 12px", minWidth: 60,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {isLocked ? "lock" : item.icon}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
