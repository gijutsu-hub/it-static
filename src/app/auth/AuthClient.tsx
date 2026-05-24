"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { getDoc, doc } from "firebase/firestore";
import { applyReferral } from "@/lib/firestore";
import { authReady } from "@/lib/firebase";
import { db, subscribeToActiveDropLocations } from "@/lib/firestore";
import Link from "next/link";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAPS_MAP_ID  = process.env.NEXT_PUBLIC_MAPS_MAP_ID ?? "DEMO_MAP_ID";

type Step = "loading" | "enlist" | "code" | "done" | "banned";

interface DropLocation { id: string; label: string; lat: number; lng: number }

interface NearestAnalysis {
  drop: DropLocation;
  distKm: number;
  walkMin: number;          // DirectionsService result, or estimate
  mapsUrl: string;
  routePath?: google.maps.LatLng[];
}

// ── Haversine ─────────────────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmtDist(km: number) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`; }

// ── Checklist item ─────────────────────────────────────────────────────────────
function CheckItem({ n, label, state }: { n: string; label: string; state: "done" | "active" | "pending" }) {
  return (
    <div className={`flex items-center gap-3 transition-opacity ${state === "pending" ? "opacity-40" : ""}`}>
      <div className={`w-10 h-10 shrink-0 flex items-center justify-center sticker-border font-display-lg text-sm ${
        state === "done" ? "bg-on-surface text-secondary-container" :
        state === "active" ? "bg-primary text-on-primary" :
        "bg-surface-container text-on-surface"}`}>
        {state === "done"
          ? <span className="material-symbols-outlined text-lg">check</span>
          : n}
      </div>
      <span className={`font-display-lg text-base uppercase tracking-tight ${state === "active" ? "text-on-surface" : "text-on-surface-variant"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Nearest drop card ─────────────────────────────────────────────────────────
function NearestDropCard({ info }: { info: NearestAnalysis }) {
  return (
    <div className="bg-tertiary-fixed sticker-border p-4 flex flex-col gap-2" style={{ boxShadow: "4px 4px 0 #1b1b1e" }}>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-on-tertiary-fixed text-base">key</span>
        <span className="font-display-lg text-xs uppercase text-on-tertiary-fixed tracking-widest">Nearest Field Code Drop</span>
      </div>
      <div className="font-display-lg text-lg uppercase text-on-tertiary-fixed leading-tight">{info.drop.label}</div>
      <div className="flex gap-3 flex-wrap">
        <span className="bg-on-surface text-secondary-container font-display-lg text-xs px-2 py-1 sticker-border">
          <span className="material-symbols-outlined text-xs mr-1" style={{ verticalAlign: "middle" }}>directions_walk</span>
          {fmtDist(info.distKm)} away
        </span>
        <span className="bg-on-surface text-secondary-container font-display-lg text-xs px-2 py-1 sticker-border">
          ~{info.walkMin} min walk
        </span>
      </div>
      <a
        href={info.mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tactile-button bg-on-surface text-secondary-container px-4 py-2 font-display-lg text-xs rounded-lg uppercase flex items-center gap-2 w-fit"
      >
        <span className="material-symbols-outlined text-sm">map</span>
        Navigate
      </a>
    </div>
  );
}

// ── Map Panel ─────────────────────────────────────────────────────────────────
function MapPanel({
  drops,
  userLoc,
  nearestAnalysis,
}: {
  drops: DropLocation[];
  userLoc: { lat: number; lng: number } | null;
  nearestAnalysis: NearestAnalysis | null;
}) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapObjRef   = useRef<google.maps.Map | null>(null);
  const infoRef     = useRef<google.maps.InfoWindow | null>(null);
  const dropMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const userMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const routeLinesRef  = useRef<google.maps.Polyline[]>([]);

  const [mapsReady, setMapsReady]       = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false); // ← state, not ref

  // 1. Load Maps SDK once
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    setOptions({ key: MAPS_API_KEY, v: "weekly" });
    Promise.all([importLibrary("maps"), importLibrary("marker")]).then(() => setMapsReady(true));
  }, []);

  // 2. Init map (depends on SDK + DOM)
  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapObjRef.current) return;
    let cancelled = false;
    importLibrary("maps").then(({ Map, InfoWindow }: any) => {
      if (cancelled || !mapRef.current) return;
      const center = userLoc ?? { lat: 20.5937, lng: 78.9629 };
      const map = new Map(mapRef.current, {
        center,
        zoom: userLoc ? 13 : 5,
        mapId: MAPS_MAP_ID,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
      mapObjRef.current = map;
      infoRef.current = new InfoWindow();
      setMapInitialized(true); // ← triggers downstream effects
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  // 3. Place / update user marker (depends on mapInitialized state)
  useEffect(() => {
    if (!mapInitialized || !userLoc) return;
    importLibrary("marker").then(({ AdvancedMarkerElement }: any) => {
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      const pin = document.createElement("div");
      pin.innerHTML = `
        <div style="position:relative;width:28px;height:28px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#ff85c1;border:4px solid #1b1b1e;z-index:1"></div>
          <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(255,133,193,0.35);animation:auth-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
        </div>`;
      userMarkerRef.current = new AdvancedMarkerElement({
        map: mapObjRef.current, position: userLoc,
        content: pin, title: "You are here",
        zIndex: 10,
      });
      mapObjRef.current!.panTo(userLoc);
      if (drops.length === 0) mapObjRef.current!.setZoom(13);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInitialized, userLoc]);

  // 4. Place drop markers (depends on mapInitialized state + drops)
  useEffect(() => {
    if (!mapInitialized || drops.length === 0) return;
    importLibrary("marker").then(({ AdvancedMarkerElement }: any) => {
      dropMarkersRef.current.forEach((m) => (m.map = null));
      dropMarkersRef.current = [];

      drops.forEach((drop, idx) => {
        const isNearest = nearestAnalysis?.drop.id === drop.id;
        const dist = userLoc ? distKm(userLoc.lat, userLoc.lng, drop.lat, drop.lng) : null;

        const el = document.createElement("div");
        el.style.cssText = "cursor:pointer;";
        el.innerHTML = `
          <div style="
            background:${isNearest ? "#ff85c1" : "#fbf8fc"};
            border:${isNearest ? "3px" : "2px"} solid #1b1b1e;
            box-shadow:${isNearest ? "4px 4px 0 #1b1b1e" : "3px 3px 0 #1b1b1e"};
            border-radius:8px;padding:5px 10px;
            font-family:var(--font-bricolage,'Bricolage Grotesque',sans-serif);
            font-size:11px;font-weight:800;text-transform:uppercase;color:#1b1b1e;
            white-space:nowrap;display:flex;align-items:center;gap:5px;
          ">
            <span style="font-family:'Material Symbols Outlined';font-size:14px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24">key</span>
            ${drop.label}
            ${dist !== null ? `<span style="background:#ffe24c;padding:1px 5px;border:2px solid #1b1b1e;font-size:9px">${fmtDist(dist)}</span>` : ""}
            ${isNearest ? `<span style="background:#1b1b1e;color:#ff85c1;padding:1px 5px;font-size:9px">NEAREST</span>` : ""}
          </div>
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #1b1b1e;margin-left:14px;"></div>`;

        const marker = new AdvancedMarkerElement({
          map: mapObjRef.current,
          position: { lat: drop.lat, lng: drop.lng },
          content: el,
          title: drop.label,
          zIndex: isNearest ? 5 : idx + 1,
        });

        marker.addListener("click", () => {
          const walkMin = nearestAnalysis?.drop.id === drop.id ? nearestAnalysis.walkMin : Math.round((dist ?? 1) / 5 * 60);
          infoRef.current!.setContent(`
            <div style="font-family:var(--font-bricolage,'Bricolage Grotesque',sans-serif);padding:8px;max-width:210px">
              <p style="font-weight:800;text-transform:uppercase;font-size:13px;margin:0 0 4px">${drop.label}</p>
              ${dist !== null ? `<p style="font-size:11px;color:#544249;margin:0 0 2px">${fmtDist(dist)} from you · ~${walkMin} min walk</p>` : ""}
              <p style="font-size:11px;margin:4px 0;color:#1b1b1e;font-weight:600">Go here to collect your entry code.</p>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${drop.lat},${drop.lng}&travelmode=walking" target="_blank" style="font-size:10px;color:#9f376f;font-weight:800;text-transform:uppercase">Open in Maps →</a>
            </div>`);
          infoRef.current!.open(mapObjRef.current, marker as any);
        });
        dropMarkersRef.current.push(marker);
      });

      // Fit bounds — LatLngBounds lives in the "core" library, use global directly
      const gmaps = (window as any).google?.maps;
      if (gmaps?.LatLngBounds) {
        const bounds = new gmaps.LatLngBounds();
        drops.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
        if (userLoc) bounds.extend(userLoc);
        mapObjRef.current!.fitBounds(bounds, 80);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInitialized, drops, nearestAnalysis]);

  // 5. Draw walking route polylines (when nearest analysis has route path)
  useEffect(() => {
    if (!mapInitialized) return;
    routeLinesRef.current.forEach((l) => l.setMap(null));
    routeLinesRef.current = [];
    if (!nearestAnalysis?.routePath?.length) return;

    importLibrary("maps").then(({ Polyline }: any) => {
      // Glow shadow
      const shadow = new Polyline({
        path: nearestAnalysis.routePath,
        strokeColor: "#ff85c1",
        strokeOpacity: 0.25,
        strokeWeight: 12,
        map: mapObjRef.current,
        zIndex: 1,
      });
      // Main route
      const main = new Polyline({
        path: nearestAnalysis.routePath,
        strokeColor: "#ff85c1",
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapObjRef.current,
        zIndex: 2,
      });
      // Dashes overlay
      const dashes = new Polyline({
        path: nearestAnalysis.routePath,
        strokeColor: "#ffffff",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "18px" }],
        map: mapObjRef.current,
        zIndex: 3,
      });
      routeLinesRef.current = [shadow, main, dashes];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInitialized, nearestAnalysis?.routePath]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes auth-ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />

      {/* Top badge */}
      <div className="absolute top-4 left-4 right-4 pointer-events-none z-10 flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 bg-on-surface text-secondary-container px-4 py-2 sticker-border font-display-lg text-xs uppercase">
          <span className="material-symbols-outlined text-sm">key</span>
          {drops.length === 0 ? "LOADING DROPS…" : `${drops.length} FIELD CODE DROP${drops.length !== 1 ? "S" : ""} ACTIVE`}
        </div>
        {userLoc && (
          <div className="inline-flex items-center gap-2 bg-primary text-on-primary px-3 py-2 sticker-border font-display-lg text-xs uppercase">
            <span className="material-symbols-outlined text-sm">my_location</span>
            LOCATION LOCKED
          </div>
        )}
      </div>

      {!MAPS_API_KEY && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low/80">
          <div className="bg-white sticker-border sticker-shadow p-6 text-center max-w-xs">
            <span className="material-symbols-outlined text-4xl text-primary block mb-2">map</span>
            <p className="font-display-lg text-sm uppercase">Map requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main AuthClient ────────────────────────────────────────────────────────────
export default function AuthClient() {
  const searchParams = useSearchParams();
  const isBanned = searchParams.get("banned") === "1";
  const refCode = searchParams.get("ref") ?? "";
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step,            setStep]            = useState<Step>("loading");
  const [googlePending,   setGooglePending]   = useState(false);
  const [codeValue,       setCodeValue]       = useState("");
  const [codeError,       setCodeError]       = useState<string | null>(null);
  const [codeSubmitting,  setCodeSubmitting]  = useState(false);

  // Shared geo + drop state (used by both panels)
  const [userLoc,         setUserLoc]         = useState<{ lat: number; lng: number } | null>(null);
  const [drops,           setDrops]           = useState<DropLocation[]>([]);
  const [nearestAnalysis, setNearestAnalysis] = useState<NearestAnalysis | null>(null);

  // ── Get user location ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Load drops from Firestore (client-side, after anonymous auth) ────────────
  useEffect(() => {
    let unsub: (() => void) | undefined;
    authReady.then(() => {
      unsub = subscribeToActiveDropLocations(setDrops);
    });
    return () => unsub?.();
  }, []);

  // ── Compute nearest drop + fetch walking route ───────────────────────────────
  useEffect(() => {
    if (!userLoc || drops.length === 0) { setNearestAnalysis(null); return; }

    // Sort by haversine distance
    const sorted = [...drops]
      .map((d) => ({ drop: d, km: distKm(userLoc.lat, userLoc.lng, d.lat, d.lng) }))
      .sort((a, b) => a.km - b.km);

    const nearest = sorted[0];
    const walkMinEstimate = Math.max(1, Math.round((nearest.km / 5) * 60));
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nearest.drop.lat},${nearest.drop.lng}&travelmode=walking`;

    // Set estimate immediately so UI is responsive
    setNearestAnalysis({ drop: nearest.drop, distKm: nearest.km, walkMin: walkMinEstimate, mapsUrl });

    // Then try DirectionsService for precise walking time + route path
    if (!MAPS_API_KEY) return;
    setOptions({ key: MAPS_API_KEY, v: "weekly" });
    importLibrary("routes").then((lib: any) => {
      const DirectionsService = lib?.DirectionsService ?? (window as any).google?.maps?.DirectionsService;
      if (!DirectionsService) return;
      const svc = new DirectionsService();
      svc.route(
        {
          origin: new (window as any).google.maps.LatLng(userLoc.lat, userLoc.lng),
          destination: new (window as any).google.maps.LatLng(nearest.drop.lat, nearest.drop.lng),
          travelMode: "WALKING",
        },
        (result: any, status: string) => {
          if (status !== "OK" || !result?.routes?.[0]) return;
          const leg = result.routes[0].legs[0];
          const walkMin = Math.ceil((leg.duration.value ?? walkMinEstimate * 60) / 60);
          const path: google.maps.LatLng[] =
            result.routes[0].overview_path ?? [];
          setNearestAnalysis({ drop: nearest.drop, distKm: nearest.km, walkMin, mapsUrl, routePath: path });
        }
      );
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoc, drops]);

  // ── Handle session transitions ───────────────────────────────────────────────
  useEffect(() => {
    if (isBanned) { setStep("banned"); return; }
    if (status === "loading") return;
    if (status === "unauthenticated") { setStep("enlist"); return; }

    if (status === "authenticated" && session?.user?.email) {
      authReady.then(async () => {
        try {
          const snap = await getDoc(doc(db, "users", session.user!.email!));
          if (snap.exists()) {
            const data = snap.data();
            if (data.banned) { router.replace("/auth?banned=1"); return; }
            router.replace("/discover"); // returning user — skip code gate
          } else {
            setStep("code");
          }
        } catch {
          router.replace("/discover");
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, isBanned]);

  const handleGoogle = useCallback(async () => {
    if (googlePending) return;
    setGooglePending(true);
    await signIn("google", { redirect: true, callbackUrl: "/auth" });
  }, [googlePending]);

  const handleCodeSubmit = useCallback(async () => {
    if (!codeValue.trim() || codeSubmitting) return;
    setCodeError(null);
    setCodeSubmitting(true);
    try {
      const res = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeValue }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error ?? "Invalid code."); return; }
      // Apply referral if came via invite link
      if (refCode && session?.user?.email) {
        applyReferral(session.user.email, refCode, session.user.name ?? "Hunter").catch(() => {});
      }
      setStep("done");
      setTimeout(() => router.replace("/discover"), 800);
    } catch {
      setCodeError("Connection error. Try again.");
    } finally {
      setCodeSubmitting(false);
    }
  }, [codeValue, codeSubmitting, router]);

  const step1Done = step === "code" || step === "done";
  const step2Done = step === "done";
  const showMap   = step === "code" || step === "enlist";

  if (step === "loading") {
    return (
      <div className="fixed inset-0 bg-pop-dots flex items-center justify-center">
        <div className="bg-primary-container sticker-border sticker-shadow px-8 py-5 font-display-lg text-xl uppercase">
          TRANSMITTING…
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .auth-btn {
          border: 3px solid #1b1b1e;
          box-shadow: 4px 4px 0 #1b1b1e;
          transition: all 0.1s ease;
          cursor: pointer;
        }
        .auth-btn:hover:not(:disabled) { transform: translate(2px,2px); box-shadow: 2px 2px 0 #1b1b1e; }
        .auth-btn:active:not(:disabled) { transform: translate(4px,4px); box-shadow: 0 0 0 #1b1b1e; }
        @keyframes auth-ping { 75%,100% { transform:scale(2.2);opacity:0; } }
      `}</style>

      <div className="fixed inset-0 flex flex-col md:flex-row overflow-hidden">

        {/* ═══════ LEFT PANEL ═══════ */}
        <div className="w-full md:w-[44%] flex flex-col overflow-y-auto bg-pop-dots border-b-4 md:border-b-0 md:border-r-8 border-on-surface shrink-0 z-10">
          <div className="flex flex-col min-h-full px-6 md:px-10 py-8 gap-5">

            {/* Logo */}
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="IT'S STATIC" className="h-11 w-auto self-start drop-shadow-[2px_2px_0px_#1b1b1e]" />
              <div className="bg-tertiary-fixed inline-block px-3 py-1 sticker-border font-display-lg text-xs uppercase tracking-widest self-start transform -rotate-1">
                Urban Resistance Collective
              </div>
            </div>

            {step === "banned" ? (
              <div className="bg-error-container sticker-border p-6 flex flex-col gap-3" style={{ boxShadow: "4px 4px 0 #ba1a1a" }}>
                <span className="material-symbols-outlined text-error text-4xl">block</span>
                <h2 className="font-display-lg text-xl uppercase text-error">Signal Terminated</h2>
                <p className="font-body-md text-sm text-on-error-container leading-relaxed">
                  Your account has been removed. Contact{" "}
                  <a href="https://instagram.com/itstatic.space" className="underline font-bold">@itstatic.space</a>.
                </p>
              </div>
            ) : (
              <>
                {/* Checklist */}
                <div className="bg-white sticker-border p-5 flex flex-col gap-4" style={{ boxShadow: "4px 4px 0 #1b1b1e" }}>
                  <div className="font-display-lg text-xs uppercase tracking-widest text-on-surface-variant">
                    ENLISTMENT PROTOCOL
                  </div>
                  <CheckItem n="01" label="Identify Yourself"
                    state={step1Done ? "done" : step === "enlist" ? "active" : "pending"} />
                  <div className="border-t-2 border-outline-variant" />
                  <CheckItem n="02" label="Enter Your Field Code"
                    state={step2Done ? "done" : step === "code" ? "active" : "pending"} />
                  <div className="border-t-2 border-outline-variant" />
                  <CheckItem n="03" label="You're In — Stay Ecstatic"
                    state={step2Done ? "done" : "pending"} />
                </div>

                {/* ─── STEP 01: Google SSO ─── */}
                {step === "enlist" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="font-display-lg text-2xl uppercase text-on-surface leading-tight">STEP 01</h2>
                      <p className="font-body-md text-on-surface-variant text-sm uppercase font-bold tracking-wide mt-1">
                        Sign in to begin. No bots allowed.
                      </p>
                    </div>
                    <button
                      onClick={handleGoogle}
                      disabled={googlePending}
                      className="auth-btn w-full bg-white py-4 px-6 flex items-center justify-center gap-4 rounded-xl disabled:opacity-60"
                    >
                      <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className="font-display-lg text-lg text-on-background">
                        {googlePending ? "Redirecting…" : "Continue with Google"}
                      </span>
                    </button>

                    {/* Nearest drop hint even before sign-in */}
                    {nearestAnalysis && (
                      <NearestDropCard info={nearestAnalysis} />
                    )}
                    {!nearestAnalysis && drops.length > 0 && !userLoc && (
                      <div className="bg-secondary-container sticker-border p-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-secondary-container text-base">location_searching</span>
                        <p className="font-body-md text-xs text-on-secondary-container">Allow location to see nearest drop.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── STEP 02: Entry code ─── */}
                {step === "code" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="font-display-lg text-2xl uppercase text-on-surface leading-tight">STEP 02</h2>
                      <p className="font-body-md text-on-surface-variant text-sm uppercase font-bold tracking-wide mt-1">
                        Signed in as <span className="text-primary">{session?.user?.name ?? "Operative"}</span>
                      </p>
                    </div>

                    {/* Nearest drop analysis */}
                    {nearestAnalysis ? (
                      <NearestDropCard info={nearestAnalysis} />
                    ) : drops.length > 0 ? (
                      <div className="bg-secondary-container sticker-border p-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-secondary-container text-base">location_searching</span>
                        <p className="font-body-md text-xs text-on-secondary-container">Allow location for nearest drop analysis.</p>
                      </div>
                    ) : (
                      <div className="bg-tertiary-fixed sticker-border p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-on-tertiary-fixed text-base shrink-0 mt-0.5">info</span>
                        <p className="font-body-md text-on-tertiary-fixed text-sm">
                          Check the map — find a code drop near you, visit it to get your entry code.
                        </p>
                      </div>
                    )}

                    {/* Code input */}
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={12}
                      placeholder="ENTER CODE"
                      value={codeValue}
                      onChange={(e) => setCodeValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      className="w-full bg-surface sticker-border font-display-lg text-2xl md:text-3xl text-center tracking-[0.3em] py-5 outline-none focus:border-primary placeholder:text-on-surface-variant/40 placeholder:tracking-widest uppercase"
                      style={{ boxShadow: "4px 4px 0 #1b1b1e" }}
                    />

                    {codeError && (
                      <div className="bg-error-container sticker-border px-4 py-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-error text-base shrink-0">error</span>
                        <p className="font-body-md text-sm text-on-error-container font-bold">{codeError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleCodeSubmit}
                      disabled={codeSubmitting || !codeValue.trim()}
                      className="tactile-button bg-primary text-on-primary w-full py-4 font-display-lg text-xl rounded-xl uppercase disabled:opacity-50"
                    >
                      {codeSubmitting ? "VERIFYING…" : "TRANSMIT CODE"}
                    </button>

                    {/* Mobile map callout */}
                    <div className="md:hidden bg-surface-container sticker-border p-3 text-center">
                      <p className="font-body-md text-xs text-on-surface-variant">↓ Scroll down to see the drop map</p>
                    </div>
                  </div>
                )}

                {/* ─── STEP 03: Done ─── */}
                {step === "done" && (
                  <div className="bg-tertiary-fixed sticker-border p-6 flex flex-col items-center gap-3 text-center" style={{ boxShadow: "4px 4px 0 #1b1b1e" }}>
                    <span className="material-symbols-outlined text-4xl text-on-tertiary-fixed">bolt</span>
                    <div className="font-display-lg text-2xl uppercase text-on-tertiary-fixed">CODE ACCEPTED</div>
                    <p className="font-body-md text-sm text-on-tertiary-fixed">Transmitting you to the static…</p>
                  </div>
                )}
              </>
            )}

            {/* Footer */}
            <div className="mt-auto pt-4 flex flex-wrap justify-center gap-4 border-t-2 border-outline-variant">
              <Link href="/about#privacy" className="font-label-sm text-on-surface-variant uppercase text-xs hover:text-primary">Privacy</Link>
              <Link href="/about#terms"   className="font-label-sm text-on-surface-variant uppercase text-xs hover:text-primary">Terms</Link>
              <Link href="/contact"       className="font-label-sm text-on-surface-variant uppercase text-xs hover:text-primary">Contact</Link>
              <Link href="/"              className="font-label-sm text-on-surface-variant uppercase text-xs hover:text-primary">← Home</Link>
            </div>
            <p className="text-center font-label-sm text-on-surface-variant opacity-40 text-xs pb-2">
              © 2026 IT&apos;S STATIC ECOSYSTEM
            </p>
          </div>
        </div>

        {/* ═══════ RIGHT PANEL — map (desktop) ═══════ */}
        {showMap && (
          <div className="hidden md:block flex-1 relative bg-surface-container-low">
            <MapPanel drops={drops} userLoc={userLoc} nearestAnalysis={nearestAnalysis} />

            {/* Drop legend at bottom */}
            {drops.length > 0 && (
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2 pointer-events-none">
                {drops.map((d) => {
                  const km = userLoc ? distKm(userLoc.lat, userLoc.lng, d.lat, d.lng) : null;
                  const isNearest = nearestAnalysis?.drop.id === d.id;
                  return (
                    <div key={d.id}
                      className={`flex items-center gap-2 px-3 py-1 sticker-border font-display-lg text-xs uppercase ${
                        isNearest ? "bg-primary text-on-primary" : "bg-white text-on-surface"}`}
                      style={{ boxShadow: "2px 2px 0 #1b1b1e" }}>
                      <span className="material-symbols-outlined text-sm">key</span>
                      {d.label}
                      {km !== null && <span className="opacity-70">{fmtDist(km)}</span>}
                      {isNearest && <span className="font-bold">★ NEAREST</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════ MOBILE MAP (below form on code step) ═══════ */}
        {step === "code" && (
          <div className="md:hidden w-full relative border-t-4 border-on-surface shrink-0" style={{ height: 320 }}>
            <MapPanel drops={drops} userLoc={userLoc} nearestAnalysis={nearestAnalysis} />
          </div>
        )}
      </div>

      <SparkleScript />
    </>
  );
}

function SparkleScript() {
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (Math.random() > 0.95) {
        const s = document.createElement("div");
        s.style.cssText =
          'position:fixed;pointer-events:none;font-family:"Material Symbols Outlined";font-size:' +
          (Math.random() * 18 + 10) + "px;left:" + e.clientX + "px;top:" + e.clientY +
          "px;transform:rotate(" + (Math.random() * 360) +
          "deg);opacity:0.7;color:#ff85c1;z-index:9999";
        s.innerText = (["sparkle","star","electric_bolt"] as const)[Math.floor(Math.random() * 3)];
        document.body.appendChild(s);
        const a = s.animate(
          [{ opacity: 0.7, transform: s.style.transform + " scale(1)" },
           { opacity: 0, transform: s.style.transform + " translate(" + (Math.random() * 80 - 40) + "px," + (Math.random() * 80 - 40) + "px) scale(0)" }],
          { duration: 900, easing: "ease-out" }
        );
        a.onfinish = () => s.remove();
      }
    }
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);
  return null;
}
