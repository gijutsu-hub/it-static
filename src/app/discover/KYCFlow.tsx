"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { authReady, firebaseAuth } from "@/lib/firebase";
import {
  submitKYC,
  subscribeToUserKYCStatus,
  deleteKYCSubmission,
  type KYCSubmission,
  type UserProfile,
} from "@/lib/firestore";
import { subscribeUser } from "@/app/actions";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firestore";

// ── Blink detection constants ─────────────────────────────────────────────────
const BLINKS_REQUIRED = 3;
const CALIB_FRAMES    = 28;    // ~1.7 s at 60ms interval
const CLOSE_RATIO     = 0.68;  // stdDev drops to 68 % of baseline → eyes closing
const OPEN_RATIO      = 0.80;  // stdDev returns to 80 % of baseline → eyes open again
const MIN_BLINK_MS    = 60;
const MAX_BLINK_MS    = 550;
const SAMPLE_INTERVAL = 60;    // ms between analysis frames

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateChallengeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

async function compressImage(source: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unsupported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => { if (b) resolve(b); else reject(new Error("toBlob failed")); },
        "image/jpeg", 0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Eye-region luma standard deviation (higher = eyes open with varied texture)
function lumaStdDev(data: Uint8ClampedArray): number {
  const n = data.length >> 2;
  if (n === 0) return 0;
  let sum = 0, sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    sum += y; sumSq += y * y;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IdentityData {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  idType: "passport" | "national_id" | "drivers_license";
  idNumber: string;
}

interface Props {
  uid: string;
  displayName: string;
  profilePhotoURL: string;
}

// ── KYCFlow ───────────────────────────────────────────────────────────────────

export default function KYCFlow({ uid, displayName, profilePhotoURL }: Props) {
  const [kycSubmission, setKycSubmission] = useState<KYCSubmission | null | undefined>(undefined);
  const [userProfile, setUserProfile]     = useState<UserProfile | null>(null);

  useEffect(() => subscribeToUserKYCStatus(uid, setKycSubmission), [uid]);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setUserProfile(snap.data() as UserProfile);
    });
    return unsub;
  }, [uid]);

  const [step, setStep]                               = useState(1);
  const [challengeCode]                               = useState<string>(generateChallengeCode);
  const [newChallengeCode, setNewChallengeCode]       = useState<string | null>(null);
  const activeChallengeCode                           = newChallengeCode ?? challengeCode;

  const [identity, setIdentity] = useState<IdentityData>({
    fullName: "", dateOfBirth: "", nationality: "", idType: "passport", idNumber: "",
  });

  const [capturedBlob,    setCapturedBlob]    = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [photoUploading,  setPhotoUploading]  = useState(false);
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [uploadedPhotoURL,  setUploadedPhotoURL]  = useState<string | null>(null);
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(null);

  const [lockedLocation,  setLockedLocation]  = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError,   setLocationError]   = useState<string | null>(null);
  const [locationRetryKey, setLocationRetryKey] = useState(0);

  const [notifStatus, setNotifStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "subscribed">("idle");

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [clearing,     setClearing]     = useState(false);

  const mapDivRef    = useRef<HTMLDivElement>(null);
  const kycMapRef    = useRef<google.maps.Map | null>(null);
  const kycMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Load map + geolocation when step 4 (or retry)
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    kycMapRef.current = null;
    setLockedLocation(null);
    setLocationError(null);

    (async () => {
      try {
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await importLibrary("marker") as google.maps.MarkerLibrary;
        if (cancelled || !mapDivRef.current) return;

        const map = new Map(mapDivRef.current, {
          center: { lat: 1.3521, lng: 103.8198 },
          zoom: 14,
          mapId: "KYC_LOCATION_MAP",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        kycMapRef.current = map;
        setLocationLoading(true);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.setCenter(loc);
            map.setZoom(16);
            const el = document.createElement("div");
            el.style.cssText = "display:flex;flex-direction:column;align-items:center;";
            el.innerHTML = `
              <div style="background:#ffe24c;border:3px solid #1b1b1e;box-shadow:4px 4px 0 #1b1b1e;padding:6px 14px;border-radius:10px;font-weight:800;font-size:12px;color:#1b1b1e;text-transform:uppercase;white-space:nowrap;">
                YOUR POSITION
              </div>
              <div style="width:3px;height:14px;background:#1b1b1e;margin:0 auto;"></div>
              <div style="width:8px;height:4px;background:#1b1b1e;opacity:0.4;border-radius:999px;margin:0 auto;"></div>`;
            if (kycMarkerRef.current) kycMarkerRef.current.map = null;
            kycMarkerRef.current = new AdvancedMarkerElement({
              map, position: loc, content: el, title: "Your location",
            });
            setLockedLocation(loc);
            setLocationLoading(false);
          },
          (err) => {
            if (cancelled) return;
            const msg =
              err.code === 1 ? "Location permission denied. Tap Retry after allowing access in browser settings." :
              err.code === 2 ? "GPS unavailable. Check device location settings, then retry." :
              "Location request timed out. Please tap Retry.";
            setLocationError(msg);
            setLocationLoading(false);
          },
          { enableHighAccuracy: true, timeout: 12000 }
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Map init error:", err);
          setLocationError("Failed to load map. Please retry.");
          setLocationLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  // locationRetryKey triggers retry without remounting
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, locationRetryKey]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleCapture(blob: Blob, preview: string) {
    setCapturedBlob(blob);
    setCapturedPreview(preview);
    setUploadedPhotoURL(null);
    setUploadedPhotoPath(null);
    setUploadError(null);
  }

  function handleRetake() {
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setCapturedBlob(null);
    setCapturedPreview(null);
    setUploadedPhotoURL(null);
    setUploadedPhotoPath(null);
    setUploadError(null);
  }

  async function handlePhotoUpload() {
    if (!capturedBlob) return;
    setPhotoUploading(true);
    setUploadError(null);
    try {
      await authReady;
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      const compressed = await compressImage(capturedBlob);
      const path = `kyc/${uid}/${Date.now()}.jpg`;
      const form = new FormData();
      form.append("file", new Blob([compressed], { type: "image/jpeg" }));
      form.append("token", token);
      form.append("path", path);
      const res = await fetch("/api/upload-kyc", { method: "POST", body: form });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Upload failed");
      }
      const { url } = await res.json();
      setUploadedPhotoURL(url);
      setUploadedPhotoPath(path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRequestNotifications() {
    setNotifStatus("requesting");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") { setNotifStatus("denied"); return; }
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) { setNotifStatus("subscribed"); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
        await subscribeUser(JSON.parse(JSON.stringify(sub)));
        setNotifStatus("subscribed");
      } else {
        setNotifStatus("granted");
      }
    } catch {
      setNotifStatus("denied");
    }
  }

  async function handleSubmit() {
    if (!uploadedPhotoURL || !uploadedPhotoPath || !lockedLocation) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitKYC({
        email: uid,
        displayName,
        profilePhotoURL,
        fullName: identity.fullName,
        dateOfBirth: identity.dateOfBirth,
        nationality: identity.nationality,
        idType: identity.idType,
        idNumber: identity.idNumber,
        challengeCode: activeChallengeCode,
        kycPhotoURL: uploadedPhotoURL,
        kycPhotoPath: uploadedPhotoPath,
        location: lockedLocation,
        notificationsEnabled: notifStatus === "subscribed" || notifStatus === "granted",
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleResubmit() {
    if (!kycSubmission) return;
    setClearing(true);
    try {
      await deleteKYCSubmission(kycSubmission.id, kycSubmission.kycPhotoPath);
      setNewChallengeCode(generateChallengeCode());
      setStep(1);
      setIdentity({ fullName: "", dateOfBirth: "", nationality: "", idType: "passport", idNumber: "" });
      if (capturedPreview) URL.revokeObjectURL(capturedPreview);
      setCapturedBlob(null);
      setCapturedPreview(null);
      setUploadedPhotoURL(null);
      setUploadedPhotoPath(null);
      setLockedLocation(null);
      setLocationError(null);
      setLocationRetryKey(0);
      setNotifStatus("idle");
      setSubmitError(null);
      kycMapRef.current = null;
    } catch (err) {
      console.error("Resubmit cleanup error:", err);
    } finally {
      setClearing(false);
    }
  }

  // ── Early states ─────────────────────────────────────────────────────────────

  if (kycSubmission === undefined) {
    return (
      <KYCShell>
        <div className="flex flex-col items-center justify-center h-full gap-5">
          <span className="material-symbols-outlined text-5xl" style={{ color: "#9f376f" }}>fingerprint</span>
          <p className="font-bold text-xl uppercase tracking-wider" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
            Loading...
          </p>
        </div>
      </KYCShell>
    );
  }

  if (userProfile?.kycStatus === "approved") {
    return <KYCShell><ApprovedScreen expiresAt={userProfile.kycExpiresAt?.toDate()} /></KYCShell>;
  }
  if (kycSubmission?.status === "pending") {
    return <KYCShell><PendingScreen submission={kycSubmission} /></KYCShell>;
  }
  if (kycSubmission?.status === "rejected") {
    return (
      <KYCShell>
        <RejectedScreen submission={kycSubmission} onResubmit={handleResubmit} clearing={clearing} />
      </KYCShell>
    );
  }

  // ── canGoNext ────────────────────────────────────────────────────────────────

  const canGoNext = (() => {
    if (step === 1) return !!(identity.fullName.trim() && identity.dateOfBirth.trim() && identity.nationality.trim() && identity.idNumber.trim());
    if (step === 2) return true;
    if (step === 3) return !!uploadedPhotoURL;
    if (step === 4) return !!lockedLocation;
    if (step === 5) return notifStatus === "subscribed" || notifStatus === "granted";
    return false;
  })();

  return (
    <KYCShell>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 sm:px-8 pt-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-3xl" style={{ color: "#9f376f" }}>fingerprint</span>
            <div>
              <h2 className="font-black text-xl sm:text-2xl uppercase leading-none"
                style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
                IDENTITY VERIFICATION
              </h2>
              <p className="text-xs font-bold uppercase tracking-widest mt-0.5" style={{ color: "#544249" }}>
                Step {step} of 6
              </p>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-4">
            {[1,2,3,4,5,6].map((s) => (
              <div key={s} className="flex-1 h-1.5 rounded-sm transition-colors duration-200"
                style={{
                  backgroundColor: s <= step ? "#9f376f" : "#e4e1e6",
                  border: "2px solid #1b1b1e",
                }} />
            ))}
          </div>
        </div>

        {/* ── Step content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-2">
          {step === 1 && <Step1Identity identity={identity} onChange={setIdentity} />}
          {step === 2 && <Step2ChallengeCode code={activeChallengeCode} />}
          {step === 3 && (
            <Step3LiveCapture
              challengeCode={activeChallengeCode}
              capturedPreview={capturedPreview}
              uploaded={!!uploadedPhotoURL}
              uploading={photoUploading}
              uploadError={uploadError}
              onCapture={handleCapture}
              onRetake={handleRetake}
              onUpload={handlePhotoUpload}
            />
          )}
          {step === 4 && (
            <Step4LocationLock
              mapDivRef={mapDivRef}
              lockedLocation={lockedLocation}
              loading={locationLoading}
              error={locationError}
              onRetry={() => setLocationRetryKey((k) => k + 1)}
            />
          )}
          {step === 5 && (
            <Step5Notifications status={notifStatus} onRequest={handleRequestNotifications} />
          )}
          {step === 6 && (
            <Step6Review
              identity={identity}
              challengeCode={activeChallengeCode}
              photoPreview={uploadedPhotoURL ?? capturedPreview}
              location={lockedLocation}
              notifStatus={notifStatus}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* ── Navigation footer ───────────────────────────────────────────────── */}
        {step < 6 && (
          <div
            className="flex-shrink-0 flex justify-between items-center gap-3 px-4 sm:px-8 py-4"
            style={{ borderTop: "3px solid #1b1b1e", backgroundColor: "#fbf8fc" }}
          >
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex-1 sm:flex-none py-3 px-5 font-black text-sm uppercase tracking-wide border-[3px] border-on-surface
                transition-[transform,box-shadow] duration-75
                disabled:opacity-40 disabled:cursor-not-allowed
                enabled:shadow-[4px_4px_0_#1b1b1e] enabled:active:shadow-[1px_1px_0_#1b1b1e]
                enabled:active:translate-x-px enabled:active:translate-y-px enabled:cursor-pointer"
              style={{ fontFamily: "var(--font-bricolage)", backgroundColor: "#fbf8fc", color: "#1b1b1e" }}
            >
              ← BACK
            </button>
            <button
              onClick={() => { if (canGoNext) setStep((s) => Math.min(6, s + 1)); }}
              disabled={!canGoNext}
              className="flex-1 sm:flex-none py-3 px-7 font-black text-sm uppercase tracking-wide border-[3px] border-on-surface
                transition-[transform,box-shadow] duration-75
                disabled:opacity-50 disabled:cursor-not-allowed
                enabled:shadow-[4px_4px_0_#1b1b1e] enabled:active:shadow-[1px_1px_0_#1b1b1e]
                enabled:active:translate-x-px enabled:active:translate-y-px enabled:cursor-pointer"
              style={{
                fontFamily: "var(--font-bricolage)",
                backgroundColor: canGoNext ? "#9f376f" : "#e4e1e6",
                color: canGoNext ? "white" : "#544249",
              }}
            >
              NEXT →
            </button>
          </div>
        )}
      </div>
    </KYCShell>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function KYCShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden z-[5]"
      style={{ backgroundColor: "#fbf8fc" }}>
      {children}
    </div>
  );
}

// ── Step 1: Identity ──────────────────────────────────────────────────────────

function Step1Identity({ identity, onChange }: { identity: IdentityData; onChange: (d: IdentityData) => void }) {
  const field = "w-full border-[3px] border-on-surface px-3 py-3 text-sm font-semibold outline-none rounded-[4px] bg-[#f6f2f7] focus:border-[#9f376f] transition-colors";
  const label = "block text-[11px] font-black uppercase tracking-widest mb-1.5 text-[#544249]";

  return (
    <div className="pb-6">
      <div className="rounded-lg p-4 mb-5 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
        style={{ backgroundColor: "#ffd8e7" }}>
        <p className="font-black text-base uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#3d0025" }}>
          IDENTITY DATA
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: "#3d0025" }}>
          Enter your legal details exactly as they appear on your ID document.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className={label}>Full Legal Name</label>
          <input className={field} value={identity.fullName} placeholder="As it appears on your ID"
            onChange={(e) => onChange({ ...identity, fullName: e.target.value })} />
        </div>
        <div>
          <label className={label}>Date of Birth</label>
          <input type="date" className={field} value={identity.dateOfBirth}
            onChange={(e) => onChange({ ...identity, dateOfBirth: e.target.value })} />
        </div>
        <div>
          <label className={label}>Nationality</label>
          <input className={field} value={identity.nationality} placeholder="e.g. Singaporean"
            onChange={(e) => onChange({ ...identity, nationality: e.target.value })} />
        </div>
        <div>
          <label className={label}>ID Type</label>
          <select className={`${field} appearance-none`} value={identity.idType}
            onChange={(e) => onChange({ ...identity, idType: e.target.value as IdentityData["idType"] })}>
            <option value="passport">Passport</option>
            <option value="national_id">National ID</option>
            <option value="drivers_license">Driver&apos;s License</option>
          </select>
        </div>
        <div>
          <label className={label}>ID Number</label>
          <input className={field} value={identity.idNumber} placeholder="Document number"
            onChange={(e) => onChange({ ...identity, idNumber: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Challenge Code ────────────────────────────────────────────────────

function Step2ChallengeCode({ code }: { code: string }) {
  return (
    <div className="pb-6">
      <div className="rounded-lg p-6 sm:p-8 mb-6 border-4 border-on-surface shadow-[6px_6px_0_#1b1b1e] text-center"
        style={{ backgroundColor: "#ffe24c" }}>
        <p className="text-xs font-black uppercase tracking-[0.1em] mb-3" style={{ color: "#544249" }}>
          YOUR CHALLENGE CODE
        </p>
        <p className="font-black text-4xl sm:text-5xl tracking-[0.12em] leading-none break-all"
          style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          {code}
        </p>
      </div>

      <div className="rounded-lg p-5 mb-4 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
        style={{ backgroundColor: "#fbf8fc" }}>
        <p className="font-black text-sm uppercase mb-4" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          INSTRUCTIONS
        </p>
        {[
          "Write this code on a piece of paper in large, clear letters.",
          "Hold the paper visible while the camera captures your face in the next step.",
          "Blink naturally 3 times — the camera will auto-detect liveness and capture.",
        ].map((txt, i) => (
          <div key={i} className="flex items-start gap-3 mb-3">
            <div className="w-7 h-7 rounded-full border-2 border-on-surface flex-shrink-0 flex items-center justify-center font-black text-sm"
              style={{ backgroundColor: "#ff85c1", color: "#1b1b1e" }}>
              {i + 1}
            </div>
            <p className="text-sm font-semibold leading-snug pt-0.5" style={{ color: "#1b1b1e" }}>{txt}</p>
          </div>
        ))}
      </div>

      <div className="rounded-md px-4 py-3 border-2 border-on-surface text-xs font-bold"
        style={{ backgroundColor: "#7ed4fd", color: "#1b1b1e" }}>
        This code links your selfie to this specific verification session.
      </div>
    </div>
  );
}

// ── Step 3: Live Camera + Blink Detection ─────────────────────────────────────

type CapturePhase = "requesting" | "calibrating" | "watching" | "done" | "error";

function Step3LiveCapture({
  challengeCode,
  capturedPreview,
  uploaded,
  uploading,
  uploadError,
  onCapture,
  onRetake,
  onUpload,
}: {
  challengeCode: string;
  capturedPreview: string | null;
  uploaded: boolean;
  uploading: boolean;
  uploadError: string | null;
  onCapture: (blob: Blob, preview: string) => void;
  onRetake: () => void;
  onUpload: () => void;
}) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const overlayRef      = useRef<HTMLCanvasElement>(null);
  const analysisRef     = useRef<HTMLCanvasElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const rafRef          = useRef<number>(0);

  // Blink state — all in refs so RAF loop doesn't stale-close
  const phaseRef        = useRef<CapturePhase>("requesting");
  const calibSamplesRef = useRef<number[]>([]);
  const baselineRef     = useRef(0);
  const blinkOpenRef    = useRef(true); // true = eyes currently open
  const blinkStartRef   = useRef(0);
  const blinksCountRef  = useRef(0);
  const lastSampleRef   = useRef(0);

  const [phase,  setPhase]  = useState<CapturePhase>("requesting");
  const [blinks, setBlinks] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stable ref for onCapture callback (parent may create new fn each render)
  const onCaptureRef = useRef(onCapture);
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);

  const stopStream = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── Overlay drawing ──────────────────────────────────────────────────────────
  const drawOverlay = useCallback((ph: CapturePhase, blinksDone: number) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Dark vignette outside oval
    const cx = W / 2, cy = H * 0.44;
    const rx = W * 0.34, ry = H * 0.40;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill("evenodd");
    ctx.restore();

    // Oval guide border
    const ovalColor =
      ph === "watching" ? "rgba(255,226,76,0.95)" :
      ph === "calibrating" ? "rgba(255,255,255,0.65)" :
      "rgba(255,255,255,0.5)";
    ctx.save();
    ctx.strokeStyle = ovalColor;
    ctx.lineWidth = 3;
    if (ph === "calibrating") ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Blink dot indicators
    const dotR = 13, gap = 38;
    const startX = cx - ((BLINKS_REQUIRED - 1) * gap) / 2;
    const dotY = H - 50;
    for (let i = 0; i < BLINKS_REQUIRED; i++) {
      const dx = startX + i * gap;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < blinksDone ? "#ffe24c" : "rgba(255,255,255,0.25)";
      ctx.fill();
      ctx.strokeStyle = i < blinksDone ? "#1b1b1e" : "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i < blinksDone) {
        ctx.fillStyle = "#1b1b1e";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✓", dx, dotY);
      }
      ctx.restore();
    }

    // Status pill
    const statusText: Record<CapturePhase, string> = {
      requesting: "STARTING CAMERA…",
      calibrating: "CALIBRATING — HOLD STILL",
      watching: `BLINK ${Math.min(blinksDone + 1, BLINKS_REQUIRED)} OF ${BLINKS_REQUIRED}`,
      done: "✓ CAPTURED",
      error: "ERROR",
    };
    const text = statusText[ph];
    if (text) {
      ctx.save();
      ctx.font = "bold 13px sans-serif";
      const tw = ctx.measureText(text).width;
      const pad = 14, bh = 28;
      const bw = tw + pad * 2;
      const bx = cx - bw / 2, by = H - 92;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.fillStyle = "#ffe24c";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, cx, by + bh / 2);
      ctx.restore();
    }
  }, []);

  // ── Analysis loop ────────────────────────────────────────────────────────────
  const analyzeFrame = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === "done" || ph === "error") return;

    const video    = videoRef.current;
    const aCanvas  = analysisRef.current;
    const oCanvas  = overlayRef.current;

    if (!video || !aCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const W = video.videoWidth  || 640;
    const H = video.videoHeight || 480;

    // Sync overlay canvas size to video natural size
    if (oCanvas && (oCanvas.width !== W || oCanvas.height !== H)) {
      oCanvas.width  = W;
      oCanvas.height = H;
    }

    aCanvas.width = W; aCanvas.height = H;
    const ctx = aCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(analyzeFrame); return; }
    ctx.drawImage(video, 0, 0, W, H);

    const now = performance.now();
    if (now - lastSampleRef.current >= SAMPLE_INTERVAL) {
      lastSampleRef.current = now;

      // Eye ROI: upper-center band (works for centered face with oval guide)
      const ex = Math.floor(W * 0.18), ey = Math.floor(H * 0.23);
      const ew = Math.floor(W * 0.64), eh = Math.floor(H * 0.20);
      const sd = lumaStdDev(ctx.getImageData(ex, ey, ew, eh).data);

      if (ph === "calibrating") {
        calibSamplesRef.current.push(sd);
        if (calibSamplesRef.current.length >= CALIB_FRAMES) {
          const arr = calibSamplesRef.current;
          const baseline = arr.reduce((a, b) => a + b, 0) / arr.length;
          if (baseline > 4) {
            baselineRef.current = baseline;
            phaseRef.current    = "watching";
            blinkOpenRef.current = true;
            setPhase("watching");
          } else {
            calibSamplesRef.current = []; // retry calibration (no face detected)
          }
        }
      } else if (ph === "watching") {
        const bl = baselineRef.current;
        if (bl > 0) {
          if (blinkOpenRef.current && sd < bl * CLOSE_RATIO) {
            // Eyes starting to close
            blinkOpenRef.current = false;
            blinkStartRef.current = now;
          } else if (!blinkOpenRef.current) {
            if (sd >= bl * OPEN_RATIO) {
              // Eyes reopened — valid blink?
              const dur = now - blinkStartRef.current;
              if (dur >= MIN_BLINK_MS && dur <= MAX_BLINK_MS) {
                blinksCountRef.current += 1;
                setBlinks(blinksCountRef.current);
                if (blinksCountRef.current >= BLINKS_REQUIRED) {
                  // ── Capture frame ──────────────────────────────────────
                  phaseRef.current = "done";
                  setPhase("done");
                  aCanvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    onCaptureRef.current(blob, url);
                    stopStream();
                  }, "image/jpeg", 0.92);
                  // Draw final overlay before exit
                  drawOverlay("done", BLINKS_REQUIRED);
                  return;
                }
              }
              blinkOpenRef.current = true;
            } else if (now - blinkStartRef.current > MAX_BLINK_MS) {
              blinkOpenRef.current = true; // too long → reset
            }
          }
        }
      }
    }

    drawOverlay(phaseRef.current, blinksCountRef.current);
    rafRef.current = requestAnimationFrame(analyzeFrame);
  }, [drawOverlay, stopStream]);

  // ── Start camera ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (capturedPreview) return;

    let cancelled = false;
    phaseRef.current = "requesting";
    calibSamplesRef.current = [];
    blinksCountRef.current  = 0;
    blinkOpenRef.current    = true;
    lastSampleRef.current   = 0;
    setPhase("requesting");
    setBlinks(0);
    setCameraError(null);

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      v.play().then(() => {
        if (cancelled) return;
        phaseRef.current = "calibrating";
        setPhase("calibrating");
        rafRef.current = requestAnimationFrame(analyzeFrame);
      });
    }).catch((err: Error) => {
      if (cancelled) return;
      console.error("Camera error:", err);
      phaseRef.current = "error";
      setPhase("error");
      setCameraError(
        err.name === "NotAllowedError"  ? "Camera permission denied. Allow access and refresh." :
        err.name === "NotFoundError"    ? "No camera found on this device." :
        "Camera unavailable. Please try again."
      );
    });

    return () => { cancelled = true; stopStream(); };
  }, [analyzeFrame, capturedPreview, stopStream]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="rounded-lg p-4 mb-4 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
        style={{ backgroundColor: "#ffd8e7" }}>
        <p className="font-black text-base uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#3d0025" }}>
          LIVENESS VERIFICATION
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: "#3d0025" }}>
          Position your face in the oval and blink naturally 3 times. Hold your challenge code visible.
        </p>
      </div>

      {/* Challenge code reminder */}
      <div className="inline-flex items-center gap-2 rounded-md px-4 py-2 mb-4 border-[3px] border-on-surface shadow-[3px_3px_0_#1b1b1e]"
        style={{ backgroundColor: "#ffe24c" }}>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#544249" }}>CODE:</span>
        <span className="font-black text-xl tracking-widest" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          {challengeCode}
        </span>
      </div>

      {capturedPreview ? (
        /* ── Captured: show preview + upload ── */
        <div>
          <div className="relative rounded-lg border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e] overflow-hidden mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedPreview} alt="Captured selfie"
              className="w-full max-h-72 sm:max-h-80 object-cover block" />
            <div className="absolute top-3 right-3 px-2 py-1 rounded border-2 border-on-surface"
              style={{ backgroundColor: "rgba(255,226,76,0.92)" }}>
              <span className="font-black text-base tracking-widest" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
                {challengeCode}
              </span>
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded border-2 border-on-surface"
              style={{ backgroundColor: "#4caf50" }}>
              <span className="material-symbols-outlined text-sm text-white">verified</span>
              <span className="text-xs font-bold text-white uppercase">3 BLINKS VERIFIED</span>
            </div>
            {uploaded && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded border-2 border-on-surface"
                style={{ backgroundColor: "#4caf50" }}>
                <span className="material-symbols-outlined text-sm text-white">check_circle</span>
                <span className="text-xs font-bold text-white uppercase">UPLOADED</span>
              </div>
            )}
          </div>

          {!uploaded && (
            <button onClick={onUpload} disabled={uploading}
              className="w-full py-4 font-black text-base uppercase border-[3px] border-on-surface rounded-sm
                transition-[transform,box-shadow] duration-75
                disabled:opacity-60 disabled:cursor-not-allowed
                enabled:shadow-[4px_4px_0_#1b1b1e] enabled:active:shadow-[1px_1px_0_#1b1b1e]
                enabled:active:translate-x-px enabled:active:translate-y-px enabled:cursor-pointer"
              style={{
                fontFamily: "var(--font-bricolage)",
                backgroundColor: uploading ? "#e4e1e6" : "#9f376f",
                color: uploading ? "#544249" : "white",
              }}>
              {uploading ? "UPLOADING…" : "UPLOAD PHOTO →"}
            </button>
          )}

          {!uploaded && !uploading && (
            <button onClick={onRetake}
              className="w-full mt-3 py-3 font-black text-sm uppercase border-[3px] border-on-surface rounded-sm
                shadow-[3px_3px_0_#1b1b1e] active:shadow-[1px_1px_0_#1b1b1e] active:translate-x-px active:translate-y-px
                transition-[transform,box-shadow] duration-75 cursor-pointer"
              style={{ fontFamily: "var(--font-bricolage)", backgroundColor: "#fbf8fc", color: "#1b1b1e" }}>
              ↺ RETAKE
            </button>
          )}

          {uploadError && (
            <div className="mt-3 px-4 py-3 rounded-md border-2 border-red-600 text-sm font-bold"
              style={{ backgroundColor: "#ffd8e7", color: "#ba1a1a" }}>
              Upload failed: {uploadError}
            </div>
          )}
        </div>
      ) : (
        /* ── Live camera + blink detection ── */
        <div>
          {phase === "error" ? (
            <div className="flex flex-col items-center justify-center min-h-52 rounded-lg border-[3px] border-on-surface gap-4 p-6"
              style={{ backgroundColor: "#ffd8e7" }}>
              <span className="material-symbols-outlined text-5xl" style={{ color: "#ba1a1a" }}>videocam_off</span>
              <p className="text-sm font-bold text-center" style={{ color: "#ba1a1a" }}>
                {cameraError}
              </p>
            </div>
          ) : (
            <div
              className="relative rounded-lg border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e] overflow-hidden bg-black"
              style={{ aspectRatio: "4/3" }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {/* Overlay: oval guide, blink dots, status */}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full"
                style={{ pointerEvents: "none" }}
              />
              {/* Hidden canvas for pixel analysis */}
              <canvas ref={analysisRef} className="hidden" />
            </div>
          )}

          {/* Blink progress below camera */}
          <div className="flex items-center justify-center gap-4 mt-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-12 h-12 rounded-full border-[3px] border-on-surface flex items-center justify-center transition-all duration-300"
                  style={{ backgroundColor: i < blinks ? "#ffe24c" : "#e4e1e6" }}
                >
                  <span className="material-symbols-outlined text-xl"
                    style={{ color: "#1b1b1e", fontVariationSettings: i < blinks ? "'FILL' 1" : "'FILL' 0" }}>
                    {i < blinks ? "check" : "remove_red_eye"}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wide"
                  style={{ color: i < blinks ? "#9f376f" : "#9e9ba1" }}>
                  BLINK {i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-4 rounded-lg p-4 border-[3px] border-on-surface" style={{ backgroundColor: "#7ed4fd" }}>
            <p className="text-xs font-black uppercase mb-2" style={{ color: "#005b78" }}>TIPS</p>
            <ul className="space-y-1.5">
              {[
                "Centre your face inside the oval guide",
                "Hold your challenge code paper clearly visible",
                "Good lighting helps — face a window or bright light",
                "Blink at normal speed — not too fast or slow",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-semibold" style={{ color: "#005b78" }}>
                  <span className="font-black leading-none mt-px">·</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Location Lock ─────────────────────────────────────────────────────

function Step4LocationLock({
  mapDivRef,
  lockedLocation,
  loading,
  error,
  onRetry,
}: {
  mapDivRef: React.RefObject<HTMLDivElement | null>;
  lockedLocation: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="pb-6">
      <div className="rounded-lg p-4 mb-5 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
        style={{ backgroundColor: "#7ed4fd" }}>
        <p className="font-black text-base uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          LOCATION LOCK
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: "#005b78" }}>
          Your GPS coordinates are recorded for this verification session.
        </p>
      </div>

      {/* Map container */}
      <div
        ref={mapDivRef}
        className="w-full rounded-lg border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e] overflow-hidden relative"
        style={{ height: 280, backgroundColor: "#e4e1e6" }}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ backgroundColor: "#f6f2f7" }}>
            <span className="material-symbols-outlined text-4xl animate-pulse" style={{ color: "#9f376f" }}>
              my_location
            </span>
            <p className="font-bold text-sm uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
              LOCATING…
            </p>
          </div>
        )}
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="mt-3 rounded-lg border-[3px] border-red-600 p-4" style={{ backgroundColor: "#ffd8e7" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "#ba1a1a" }}>{error}</p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 font-black text-sm uppercase border-[3px] border-on-surface rounded-sm
              shadow-[4px_4px_0_#1b1b1e] active:shadow-[1px_1px_0_#1b1b1e] active:translate-x-px active:translate-y-px
              transition-[transform,box-shadow] duration-75 cursor-pointer"
            style={{ fontFamily: "var(--font-bricolage)", backgroundColor: "#9f376f", color: "white" }}
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            RETRY LOCATION
          </button>
        </div>
      )}

      {/* Locked coordinates */}
      {lockedLocation && !loading && (
        <div className="mt-4 flex items-center gap-3 rounded-lg p-4 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
          style={{ backgroundColor: "#ffe24c" }}>
          <span className="material-symbols-outlined text-3xl" style={{ color: "#1b1b1e" }}>location_on</span>
          <div>
            <p className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
              COORDINATES LOCKED
            </p>
            <p className="text-xs font-bold mt-0.5 font-mono" style={{ color: "#544249" }}>
              {lockedLocation.lat.toFixed(6)}, {lockedLocation.lng.toFixed(6)}
            </p>
          </div>
          <span className="material-symbols-outlined ml-auto text-2xl" style={{ color: "#4caf50" }}>check_circle</span>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Notifications ─────────────────────────────────────────────────────

function Step5Notifications({ status, onRequest }: { status: string; onRequest: () => void }) {
  const isEnabled = status === "subscribed" || status === "granted";
  const isDenied  = status === "denied";

  return (
    <div className="pb-6">
      <div className="rounded-lg p-4 mb-5 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e]"
        style={{ backgroundColor: "#ff85c1" }}>
        <p className="font-black text-base uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#3d0025" }}>
          SIGNAL NOTIFICATIONS
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: "#3d0025" }}>
          Push notifications are required to receive your verification result.
        </p>
      </div>

      <div className="rounded-lg p-7 border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e] text-center"
        style={{ backgroundColor: "#fbf8fc" }}>
        <span
          className="material-symbols-outlined text-5xl block mb-4"
          style={{
            color: isEnabled ? "#4caf50" : isDenied ? "#ba1a1a" : "#9f376f",
            fontVariationSettings: "'FILL' 1",
          }}>
          {isEnabled ? "notifications_active" : isDenied ? "notifications_off" : "notifications"}
        </span>

        {!isEnabled && !isDenied && (
          <>
            <p className="font-black text-lg uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
              ENABLE NOTIFICATIONS
            </p>
            <p className="text-sm font-semibold mb-6" style={{ color: "#544249" }}>
              You must enable push notifications to proceed with identity verification.
            </p>
            <button onClick={onRequest} disabled={status === "requesting"}
              className="px-8 py-4 font-black text-base uppercase border-[3px] border-on-surface rounded-sm
                transition-[transform,box-shadow] duration-75
                disabled:opacity-60 disabled:cursor-not-allowed
                enabled:shadow-[4px_4px_0_#1b1b1e] enabled:active:shadow-[1px_1px_0_#1b1b1e]
                enabled:active:translate-x-px enabled:active:translate-y-px enabled:cursor-pointer"
              style={{ fontFamily: "var(--font-bricolage)", backgroundColor: "#9f376f", color: "white" }}>
              {status === "requesting" ? "REQUESTING…" : "ALLOW NOTIFICATIONS"}
            </button>
          </>
        )}

        {isEnabled && (
          <>
            <p className="font-black text-lg uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#4caf50" }}>
              NOTIFICATIONS ENABLED
            </p>
            <p className="text-sm font-semibold" style={{ color: "#544249" }}>
              {status === "subscribed" ? "Push notifications activated. You&apos;re ready to proceed." : "Notifications granted."}
            </p>
          </>
        )}

        {isDenied && (
          <>
            <p className="font-black text-lg uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#ba1a1a" }}>
              NOTIFICATIONS BLOCKED
            </p>
            <p className="text-sm font-semibold mb-4" style={{ color: "#ba1a1a" }}>
              Enable in your browser settings, then refresh the page.
            </p>
            <div className="text-xs font-bold p-3 rounded-md border-2 border-red-400 text-left"
              style={{ backgroundColor: "#ffd8e7", color: "#ba1a1a" }}>
              Browser settings → Site settings → Notifications → Allow
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 6: Review & Submit ───────────────────────────────────────────────────

function Step6Review({
  identity, challengeCode, photoPreview, location, notifStatus, submitting, submitError, onSubmit,
}: {
  identity: IdentityData;
  challengeCode: string;
  photoPreview: string | null;
  location: { lat: number; lng: number } | null;
  notifStatus: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const idLabels: Record<string, string> = {
    passport: "Passport", national_id: "National ID", drivers_license: "Driver's License",
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-baseline gap-4 py-1.5 border-b border-dashed last:border-0"
      style={{ borderColor: "#e4e1e6" }}>
      <span className="text-[11px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: "#544249" }}>{label}</span>
      <span className="text-sm font-bold text-right" style={{ color: "#1b1b1e" }}>{value}</span>
    </div>
  );

  return (
    <div className="pb-8">
      <div className="rounded-lg p-4 mb-5 border-4 border-on-surface shadow-[6px_6px_0_#1b1b1e]"
        style={{ backgroundColor: "#ffe24c" }}>
        <p className="font-black text-base uppercase" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          REVIEW YOUR SUBMISSION
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: "#544249" }}>
          Check all details carefully. This cannot be undone without admin action.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Identity block */}
        <div className="rounded-lg border-[3px] border-on-surface overflow-hidden">
          <div className="px-4 py-2.5 border-b-2 border-on-surface" style={{ backgroundColor: "#ffd8e7" }}>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#3d0025" }}>IDENTITY</span>
          </div>
          <div className="p-4" style={{ backgroundColor: "#fbf8fc" }}>
            <Row label="Full Name"    value={identity.fullName} />
            <Row label="Date of Birth" value={identity.dateOfBirth} />
            <Row label="Nationality"  value={identity.nationality} />
            <Row label="ID Type"      value={idLabels[identity.idType] ?? identity.idType} />
            <Row label="ID Number"    value={identity.idNumber} />
          </div>
        </div>

        {/* Challenge code */}
        <div className="flex justify-between items-center rounded-lg px-4 py-3 border-[3px] border-on-surface"
          style={{ backgroundColor: "#ffe24c" }}>
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#544249" }}>
            CHALLENGE CODE
          </span>
          <span className="font-black text-xl tracking-widest" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
            {challengeCode}
          </span>
        </div>

        {/* Photo */}
        {photoPreview && (
          <div className="rounded-lg border-[3px] border-on-surface overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="KYC selfie"
              className="w-full object-cover block" style={{ maxHeight: 180 }} />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded border-2 border-on-surface text-xs font-bold uppercase"
              style={{ backgroundColor: "#ffe24c", color: "#1b1b1e" }}>
              KYC SELFIE
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="flex justify-between items-center rounded-lg px-4 py-3 border-[3px] border-on-surface"
            style={{ backgroundColor: "#7ed4fd" }}>
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#005b78" }}>LOCATION</span>
            <span className="text-xs font-bold font-mono" style={{ color: "#1b1b1e" }}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          </div>
        )}

        {/* Notifications */}
        <div className="flex justify-between items-center rounded-lg px-4 py-3 border-[3px] border-on-surface"
          style={{
            backgroundColor: notifStatus === "subscribed" || notifStatus === "granted" ? "#e8fce8" : "#ffd8e7",
          }}>
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#544249" }}>NOTIFICATIONS</span>
          <span className="text-xs font-bold uppercase"
            style={{ color: notifStatus === "subscribed" || notifStatus === "granted" ? "#4caf50" : "#ba1a1a" }}>
            {notifStatus === "subscribed" ? "PUSH ENABLED" : notifStatus === "granted" ? "GRANTED" : "DISABLED"}
          </span>
        </div>

        {submitError && (
          <div className="px-4 py-3 rounded-md border-2 border-red-600 text-sm font-bold"
            style={{ backgroundColor: "#ffd8e7", color: "#ba1a1a" }}>
            {submitError}
          </div>
        )}

        <button onClick={onSubmit} disabled={submitting}
          className="w-full py-5 font-black text-lg uppercase border-4 border-on-surface rounded-sm mt-2
            transition-[transform,box-shadow] duration-75
            disabled:opacity-60 disabled:cursor-not-allowed
            enabled:shadow-[6px_6px_0_#1b1b1e] enabled:active:shadow-[2px_2px_0_#1b1b1e]
            enabled:active:translate-x-1 enabled:active:translate-y-1 enabled:cursor-pointer"
          style={{
            fontFamily: "var(--font-bricolage)",
            backgroundColor: submitting ? "#e4e1e6" : "#9f376f",
            color: submitting ? "#544249" : "white",
          }}>
          {submitting ? "SUBMITTING…" : "SUBMIT KYC APPLICATION"}
        </button>
      </div>
    </div>
  );
}

// ── Pending Screen ────────────────────────────────────────────────────────────

function PendingScreen({ submission }: { submission: KYCSubmission }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 sm:p-12 text-center">
      <div className="w-24 h-24 rounded-full border-4 border-on-surface shadow-[6px_6px_0_#1b1b1e] flex items-center justify-center"
        style={{ backgroundColor: "#ffe24c" }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
          pending
        </span>
      </div>
      <div>
        <h2 className="font-black text-3xl uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#1b1b1e" }}>
          VERIFICATION PENDING
        </h2>
        <p className="text-sm font-semibold leading-relaxed" style={{ color: "#544249" }}>
          Your KYC application is under review. You will be notified once a decision has been made.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border-[3px] border-on-surface overflow-hidden">
        <div className="px-4 py-2.5 border-b-2 border-on-surface" style={{ backgroundColor: "#ffe24c" }}>
          <span className="text-xs font-black uppercase" style={{ color: "#1b1b1e" }}>SUBMITTED INFO</span>
        </div>
        <div className="p-4 flex flex-col gap-2" style={{ backgroundColor: "#fbf8fc" }}>
          {[
            ["Name", submission.fullName],
            ["Nationality", submission.nationality],
            ["ID Type", submission.idType.replace("_", " ")],
            ["Submitted", submission.submittedAt?.toDate().toLocaleDateString() ?? "—"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#544249" }}>{l}</span>
              <span className="text-sm font-bold capitalize" style={{ color: "#1b1b1e" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs font-bold p-4 rounded-md border-2 border-on-surface w-full max-w-sm"
        style={{ backgroundColor: "#7ed4fd", color: "#005b78" }}>
        Typical review time: 24–72 hours. Keep an eye on your push notifications.
      </div>
    </div>
  );
}

// ── Rejected Screen ───────────────────────────────────────────────────────────

function RejectedScreen({ submission, onResubmit, clearing }: {
  submission: KYCSubmission;
  onResubmit: () => void;
  clearing: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 sm:p-12 text-center">
      <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center"
        style={{ backgroundColor: "#ffd8e7", borderColor: "#ba1a1a", boxShadow: "6px 6px 0 #ba1a1a" }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: "#ba1a1a", fontVariationSettings: "'FILL' 1" }}>
          cancel
        </span>
      </div>
      <div>
        <h2 className="font-black text-3xl uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#ba1a1a" }}>
          VERIFICATION REJECTED
        </h2>
        <p className="text-sm font-semibold leading-relaxed" style={{ color: "#544249" }}>
          Your application was not approved. You may resubmit with corrected information.
        </p>
      </div>

      {submission.rejectionReason && (
        <div className="w-full max-w-sm rounded-lg border-[3px] p-4 text-left"
          style={{ backgroundColor: "#ffd8e7", borderColor: "#ba1a1a" }}>
          <p className="text-xs font-black uppercase mb-2" style={{ color: "#ba1a1a" }}>REJECTION REASON</p>
          <p className="text-sm font-semibold leading-snug" style={{ color: "#3d0025" }}>{submission.rejectionReason}</p>
        </div>
      )}

      <button onClick={onResubmit} disabled={clearing}
        className="px-10 py-4 font-black text-lg uppercase border-4 border-on-surface rounded-sm
          transition-[transform,box-shadow] duration-75
          disabled:opacity-60 disabled:cursor-not-allowed
          enabled:shadow-[6px_6px_0_#1b1b1e] enabled:active:shadow-[2px_2px_0_#1b1b1e]
          enabled:active:translate-x-1 enabled:active:translate-y-1 enabled:cursor-pointer"
        style={{ fontFamily: "var(--font-bricolage)", backgroundColor: clearing ? "#e4e1e6" : "#9f376f", color: clearing ? "#544249" : "white" }}>
        {clearing ? "CLEARING…" : "RESUBMIT APPLICATION"}
      </button>
    </div>
  );
}

// ── Approved Screen ───────────────────────────────────────────────────────────

function ApprovedScreen({ expiresAt }: { expiresAt?: Date }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 sm:p-12 text-center">
      <div className="w-24 h-24 rounded-full border-4 border-on-surface shadow-[6px_6px_0_#1b1b1e] flex items-center justify-center"
        style={{ backgroundColor: "#c8f7c5" }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>
          verified_user
        </span>
      </div>
      <div>
        <h2 className="font-black text-3xl uppercase mb-2" style={{ fontFamily: "var(--font-bricolage)", color: "#4caf50" }}>
          IDENTITY VERIFIED
        </h2>
        <p className="text-sm font-semibold leading-relaxed" style={{ color: "#544249" }}>
          Your identity has been verified. You have full access to all platform features.
        </p>
      </div>
      {expiresAt && (
        <div className="px-6 py-3 rounded-md border-[3px] border-on-surface shadow-[4px_4px_0_#1b1b1e] text-sm font-bold"
          style={{ backgroundColor: "#ffe24c", color: "#1b1b1e" }}>
          Verification valid until: {expiresAt.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
