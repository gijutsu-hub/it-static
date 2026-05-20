"use client";

import { useState, useEffect, useRef } from "react";
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

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

// ── Utility ────────────────────────────────────────────────────────────────────

function generateChallengeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function KYCFlow({ uid, displayName, profilePhotoURL }: Props) {
  // ── KYC status subscription ─────────────────────────────────────────────────
  const [kycSubmission, setKycSubmission] = useState<KYCSubmission | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeToUserKYCStatus(uid, (sub) => {
      setKycSubmission(sub);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    const userDocRef = doc(db, "users", uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) setUserProfile(snap.data() as UserProfile);
    });
    return unsub;
  }, [uid]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [challengeCode] = useState<string>(() => generateChallengeCode());
  const [newChallengeCode, setNewChallengeCode] = useState<string | null>(null);

  const activeChallengeCode = newChallengeCode ?? challengeCode;

  const [identity, setIdentity] = useState<IdentityData>({
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    idType: "passport",
    idNumber: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPhotoURL, setUploadedPhotoURL] = useState<string | null>(null);
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(null);

  const [lockedLocation, setLockedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [notifStatus, setNotifStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "subscribed">("idle");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // resubmit mode — clearing old data
  const [clearing, setClearing] = useState(false);

  // ── Map refs ────────────────────────────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const kycMapRef = useRef<google.maps.Map | null>(null);
  const kycMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // ── Load map when step 4 ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;

    (async () => {
      try {
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await importLibrary("marker") as google.maps.MarkerLibrary;

        if (cancelled || !mapDivRef.current || kycMapRef.current) return;

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

            // Place marker
            const el = document.createElement("div");
            el.style.cssText = "display:flex;flex-direction:column;align-items:center;";
            el.innerHTML = `
              <div style="background:#ffe24c;border:3px solid #1b1b1e;box-shadow:4px 4px 0 #1b1b1e;padding:6px 14px;border-radius:10px;font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:12px;color:#1b1b1e;text-transform:uppercase;">
                YOUR POSITION
              </div>
              <div style="width:3px;height:14px;background:#1b1b1e;"></div>
              <div style="width:8px;height:4px;background:#1b1b1e;opacity:0.4;border-radius:999px;"></div>`;

            kycMarkerRef.current = new AdvancedMarkerElement({
              map,
              position: loc,
              content: el,
              title: "Your location",
            });

            setLockedLocation(loc);
            setLocationLoading(false);
          },
          (err) => {
            if (cancelled) return;
            setLocationError(err.message || "Location access denied.");
            setLocationLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Map init error:", err);
          setLocationError("Failed to load map.");
          setLocationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (kycMapRef.current) {
        kycMapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    // Reset previously uploaded data if user re-picks
    setUploadedPhotoURL(null);
    setUploadedPhotoPath(null);
    setUploadError(null);
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoUploading(true);
    setUploadError(null);
    try {
      await authReady;
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      const compressed = await compressImage(photoFile);
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
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRequestNotifications() {
    setNotifStatus("requesting");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setNotifStatus("denied");
        return;
      }
      // Subscribe to push
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setNotifStatus("subscribed");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        });
        await subscribeUser(JSON.parse(JSON.stringify(sub)));
        setNotifStatus("subscribed");
      } else {
        setNotifStatus("granted");
      }
    } catch (err) {
      console.error("Notification subscription error:", err);
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
    } catch (err: unknown) {
      console.error("KYC submit error:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleResubmit() {
    if (!kycSubmission) return;
    setClearing(true);
    try {
      await deleteKYCSubmission(kycSubmission.id, kycSubmission.kycPhotoPath);
      // Generate a new challenge code and reset form
      setNewChallengeCode(generateChallengeCode());
      setStep(1);
      setIdentity({ fullName: "", dateOfBirth: "", nationality: "", idType: "passport", idNumber: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      setUploadedPhotoURL(null);
      setUploadedPhotoPath(null);
      setLockedLocation(null);
      setLocationError(null);
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

  // While loading KYC status
  if (kycSubmission === undefined) {
    return (
      <KYCShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#9f376f" }}>fingerprint</span>
          <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 700, textTransform: "uppercase", color: "#1b1b1e" }}>
            Loading...
          </p>
        </div>
      </KYCShell>
    );
  }

  // Approved state (via user profile)
  if (userProfile?.kycStatus === "approved") {
    const expiresAt = userProfile.kycExpiresAt?.toDate();
    return (
      <KYCShell>
        <ApprovedScreen expiresAt={expiresAt} />
      </KYCShell>
    );
  }

  // Pending state
  if (kycSubmission && kycSubmission.status === "pending") {
    return (
      <KYCShell>
        <PendingScreen submission={kycSubmission} />
      </KYCShell>
    );
  }

  // Rejected state
  if (kycSubmission && kycSubmission.status === "rejected") {
    return (
      <KYCShell>
        <RejectedScreen
          submission={kycSubmission}
          onResubmit={handleResubmit}
          clearing={clearing}
        />
      </KYCShell>
    );
  }

  // ── Step renderer ─────────────────────────────────────────────────────────────

  const canGoNext = (() => {
    if (step === 1) {
      return (
        identity.fullName.trim().length > 0 &&
        identity.dateOfBirth.trim().length > 0 &&
        identity.nationality.trim().length > 0 &&
        identity.idNumber.trim().length > 0
      );
    }
    if (step === 2) return true;
    if (step === 3) return !!uploadedPhotoURL;
    if (step === 4) return !!lockedLocation;
    if (step === 5) return notifStatus === "subscribed" || notifStatus === "granted";
    return false;
  })();

  return (
    <KYCShell>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Progress header */}
        <div
          style={{
            padding: "24px 32px 0",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#9f376f" }}>fingerprint</span>
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontSize: 28, fontWeight: 900, textTransform: "uppercase",
                  color: "#1b1b1e", lineHeight: 1,
                }}
              >
                IDENTITY VERIFICATION
              </h2>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Step {step} of 6
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              display: "flex", gap: 6, marginBottom: 24,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1, height: 6,
                  backgroundColor: s <= step ? "#9f376f" : "#e4e1e6",
                  border: "2px solid #1b1b1e",
                  borderRadius: 2,
                  transition: "background-color 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 32px" }}>
          {step === 1 && (
            <Step1Identity identity={identity} onChange={setIdentity} />
          )}
          {step === 2 && (
            <Step2ChallengeCode code={activeChallengeCode} />
          )}
          {step === 3 && (
            <Step3PhotoUpload
              challengeCode={activeChallengeCode}
              photoPreview={photoPreview}
              uploading={photoUploading}
              uploaded={!!uploadedPhotoURL}
              uploadError={uploadError}
              onFileChange={handleFileChange}
              onUpload={handlePhotoUpload}
            />
          )}
          {step === 4 && (
            <Step4LocationLock
              mapDivRef={mapDivRef}
              lockedLocation={lockedLocation}
              loading={locationLoading}
              error={locationError}
            />
          )}
          {step === 5 && (
            <Step5Notifications
              status={notifStatus}
              onRequest={handleRequestNotifications}
            />
          )}
          {step === 6 && (
            <Step6Review
              identity={identity}
              challengeCode={activeChallengeCode}
              photoPreview={uploadedPhotoURL ?? photoPreview}
              location={lockedLocation}
              notifStatus={notifStatus}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* Navigation footer */}
        {step < 6 && (
          <div
            style={{
              padding: "20px 32px",
              flexShrink: 0,
              borderTop: "3px solid #1b1b1e",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#fbf8fc",
            }}
          >
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              style={{
                border: "3px solid #1b1b1e",
                padding: "12px 24px",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "uppercase",
                cursor: step === 1 ? "default" : "pointer",
                backgroundColor: "#fbf8fc",
                boxShadow: step === 1 ? "none" : "4px 4px 0 #1b1b1e",
                fontFamily: "inherit",
                opacity: step === 1 ? 0.4 : 1,
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
            >
              ← BACK
            </button>
            <button
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              disabled={!canGoNext}
              style={{
                border: "3px solid #1b1b1e",
                padding: "12px 32px",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "uppercase",
                cursor: canGoNext ? "pointer" : "default",
                backgroundColor: canGoNext ? "#9f376f" : "#e4e1e6",
                color: canGoNext ? "white" : "#544249",
                boxShadow: canGoNext ? "4px 4px 0 #1b1b1e" : "none",
                fontFamily: "inherit",
                opacity: canGoNext ? 1 : 0.6,
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!canGoNext) return;
                (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #1b1b1e";
              }}
              onMouseLeave={(e) => {
                if (!canGoNext) return;
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
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

// ── Shell wrapper ─────────────────────────────────────────────────────────────

function KYCShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#fbf8fc",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// ── Step 1: Identity Data ─────────────────────────────────────────────────────

function Step1Identity({
  identity,
  onChange,
}: {
  identity: IdentityData;
  onChange: (d: IdentityData) => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "3px solid #1b1b1e",
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#f6f2f7",
    borderRadius: 4,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 6,
    color: "#544249",
    letterSpacing: "0.04em",
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          backgroundColor: "#ffd8e7",
          border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e",
          padding: "14px 18px",
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            color: "#3d0025",
          }}
        >
          IDENTITY DATA
        </p>
        <p style={{ fontSize: 12, color: "#3d0025", fontWeight: 600, marginTop: 4 }}>
          Enter your legal details exactly as they appear on your ID document.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Full Legal Name</label>
          <input
            value={identity.fullName}
            onChange={(e) => onChange({ ...identity, fullName: e.target.value })}
            placeholder="As it appears on your ID"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Date of Birth</label>
          <input
            type="date"
            value={identity.dateOfBirth}
            onChange={(e) => onChange({ ...identity, dateOfBirth: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Nationality</label>
          <input
            value={identity.nationality}
            onChange={(e) => onChange({ ...identity, nationality: e.target.value })}
            placeholder="e.g. Singaporean"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>ID Type</label>
          <select
            value={identity.idType}
            onChange={(e) =>
              onChange({ ...identity, idType: e.target.value as IdentityData["idType"] })
            }
            style={{ ...inputStyle, appearance: "none" }}
          >
            <option value="passport">Passport</option>
            <option value="national_id">National ID</option>
            <option value="drivers_license">Driver&apos;s License</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>ID Number</label>
          <input
            value={identity.idNumber}
            onChange={(e) => onChange({ ...identity, idNumber: e.target.value })}
            placeholder="Document number"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Challenge Code ────────────────────────────────────────────────────

function Step2ChallengeCode({ code }: { code: string }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          backgroundColor: "#ffe24c",
          border: "4px solid #1b1b1e",
          boxShadow: "6px 6px 0 #1b1b1e",
          padding: "28px 32px",
          marginBottom: 28,
          borderRadius: 8,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#544249",
            marginBottom: 16,
          }}
        >
          YOUR CHALLENGE CODE
        </p>
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#1b1b1e",
            lineHeight: 1,
            wordBreak: "break-all",
          }}
        >
          {code}
        </p>
      </div>

      <div
        style={{
          border: "3px solid #1b1b1e",
          backgroundColor: "#fbf8fc",
          boxShadow: "4px 4px 0 #1b1b1e",
          padding: 20,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 15,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "#1b1b1e",
            marginBottom: 14,
          }}
        >
          INSTRUCTIONS
        </p>
        {[
          "Write this code on a piece of paper in large, clear letters.",
          "Hold the paper next to your face AND your ID document.",
          "Take a clear, well-lit photo in the next step.",
        ].map((instruction, i) => (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "#ff85c1",
                border: "2px solid #1b1b1e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontWeight: 900,
                  fontSize: 13,
                  color: "#1b1b1e",
                }}
              >
                {i + 1}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1b1b1e", paddingTop: 4, lineHeight: 1.4 }}>
              {instruction}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          backgroundColor: "#7ed4fd",
          border: "2px solid #1b1b1e",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          color: "#1b1b1e",
        }}
      >
        This code links your selfie to this specific verification session.
      </div>
    </div>
  );
}

// ── Step 3: Photo Upload ──────────────────────────────────────────────────────

function Step3PhotoUpload({
  challengeCode,
  photoPreview,
  uploading,
  uploaded,
  uploadError,
  onFileChange,
  onUpload,
}: {
  challengeCode: string;
  photoPreview: string | null;
  uploading: boolean;
  uploaded: boolean;
  uploadError: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          backgroundColor: "#ffd8e7",
          border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e",
          padding: "14px 18px",
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            color: "#3d0025",
          }}
        >
          VERIFICATION SELFIE
        </p>
        <p style={{ fontSize: 12, color: "#3d0025", fontWeight: 600, marginTop: 4 }}>
          Upload a photo of yourself holding the challenge code and your ID.
        </p>
      </div>

      {/* Challenge code reminder */}
      <div
        style={{
          display: "inline-block",
          backgroundColor: "#ffe24c",
          border: "3px solid #1b1b1e",
          boxShadow: "3px 3px 0 #1b1b1e",
          padding: "8px 18px",
          borderRadius: 6,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Code:{" "}
        </span>
        <span
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 20,
            fontWeight: 900,
            color: "#1b1b1e",
            letterSpacing: "0.08em",
          }}
        >
          {challengeCode}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && !uploaded && inputRef.current?.click()}
        style={{
          border: "3px dashed #1b1b1e",
          borderRadius: 8,
          backgroundColor: uploaded ? "#e8fce8" : "#f6f2f7",
          padding: photoPreview ? 0 : "48px 24px",
          textAlign: "center",
          cursor: uploaded ? "default" : "pointer",
          position: "relative",
          overflow: "hidden",
          minHeight: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.2s",
        }}
      >
        {photoPreview ? (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="KYC preview"
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "cover",
                display: "block",
              }}
            />
            {/* Challenge code overlay */}
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                backgroundColor: "rgba(255,226,76,0.9)",
                border: "2px solid #1b1b1e",
                padding: "4px 12px",
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontWeight: 900,
                  fontSize: 16,
                  color: "#1b1b1e",
                  letterSpacing: "0.06em",
                }}
              >
                {challengeCode}
              </span>
            </div>
            {uploaded && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  backgroundColor: "#4caf50",
                  border: "2px solid #1b1b1e",
                  padding: "4px 12px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "white" }}>check_circle</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "white", textTransform: "uppercase" }}>UPLOADED</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#9f376f" }}>add_a_photo</span>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 700,
                fontSize: 16,
                textTransform: "uppercase",
                color: "#1b1b1e",
              }}
            >
              CLICK TO SELECT PHOTO
            </p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>
              JPG, PNG, WEBP — will be compressed to 900px max
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: "none" }}
      />

      {photoPreview && !uploaded && (
        <button
          onClick={onUpload}
          disabled={uploading}
          style={{
            width: "100%",
            marginTop: 16,
            backgroundColor: uploading ? "#e4e1e6" : "#9f376f",
            color: uploading ? "#544249" : "white",
            border: "3px solid #1b1b1e",
            padding: "14px",
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            cursor: uploading ? "default" : "pointer",
            boxShadow: uploading ? "none" : "4px 4px 0 #1b1b1e",
            borderRadius: 4,
            transition: "transform 0.1s, box-shadow 0.1s",
          }}
          onMouseEnter={(e) => {
            if (uploading) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #1b1b1e";
          }}
          onMouseLeave={(e) => {
            if (uploading) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
          }}
        >
          {uploading ? "UPLOADING..." : "UPLOAD PHOTO"}
        </button>
      )}

      {photoPreview && !uploaded && !uploading && (
        <p style={{ textAlign: "center", fontSize: 12, color: "#544249", fontWeight: 600, marginTop: 8 }}>
          Or{" "}
          <span
            onClick={() => inputRef.current?.click()}
            style={{ color: "#9f376f", cursor: "pointer", textDecoration: "underline" }}
          >
            choose a different photo
          </span>
        </p>
      )}

      {uploadError && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            backgroundColor: "#ffd8e7",
            border: "2px solid #ba1a1a",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            color: "#ba1a1a",
          }}
        >
          Upload failed: {uploadError}
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
}: {
  mapDivRef: React.RefObject<HTMLDivElement | null>;
  lockedLocation: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          backgroundColor: "#7ed4fd",
          border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e",
          padding: "14px 18px",
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            color: "#1b1b1e",
          }}
        >
          LOCATION LOCK
        </p>
        <p style={{ fontSize: 12, color: "#005b78", fontWeight: 600, marginTop: 4 }}>
          Your current coordinates will be recorded for this verification session.
        </p>
      </div>

      <div
        ref={mapDivRef}
        style={{
          width: "100%",
          height: 280,
          border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e",
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#e4e1e6",
          position: "relative",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
              backgroundColor: "#f6f2f7",
              zIndex: 10,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#9f376f" }}>my_location</span>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                color: "#1b1b1e",
              }}
            >
              LOCATING...
            </p>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            backgroundColor: "#ffd8e7",
            border: "2px solid #ba1a1a",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            color: "#ba1a1a",
          }}
        >
          {error}
        </div>
      )}

      {lockedLocation && !loading && (
        <div
          style={{
            marginTop: 16,
            padding: "16px 20px",
            backgroundColor: "#ffe24c",
            border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#1b1b1e" }}>location_on</span>
          <div>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 15,
                textTransform: "uppercase",
                color: "#1b1b1e",
              }}
            >
              COORDINATES LOCKED
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#544249", fontFamily: "monospace" }}>
              {lockedLocation.lat.toFixed(6)}, {lockedLocation.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Notifications ─────────────────────────────────────────────────────

function Step5Notifications({
  status,
  onRequest,
}: {
  status: string;
  onRequest: () => void;
}) {
  const isEnabled = status === "subscribed" || status === "granted";
  const isDenied = status === "denied";

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          backgroundColor: "#ff85c1",
          border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e",
          padding: "14px 18px",
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            color: "#3d0025",
          }}
        >
          SIGNAL NOTIFICATIONS
        </p>
        <p style={{ fontSize: 12, color: "#3d0025", fontWeight: 600, marginTop: 4 }}>
          Push notifications are required to complete KYC. You&apos;ll be notified of verification results.
        </p>
      </div>

      <div
        style={{
          border: "3px solid #1b1b1e",
          borderRadius: 8,
          padding: 28,
          backgroundColor: "#fbf8fc",
          textAlign: "center",
          boxShadow: "4px 4px 0 #1b1b1e",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 56,
            color: isEnabled ? "#4caf50" : isDenied ? "#ba1a1a" : "#9f376f",
            display: "block",
            marginBottom: 16,
            fontVariationSettings: "'FILL' 1",
          }}
        >
          {isEnabled ? "notifications_active" : isDenied ? "notifications_off" : "notifications"}
        </span>

        {!isEnabled && !isDenied && (
          <>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 18,
                textTransform: "uppercase",
                color: "#1b1b1e",
                marginBottom: 8,
              }}
            >
              ENABLE NOTIFICATIONS
            </p>
            <p style={{ fontSize: 13, color: "#544249", fontWeight: 600, marginBottom: 24 }}>
              You must enable push notifications to proceed with identity verification.
            </p>
            <button
              onClick={onRequest}
              disabled={status === "requesting"}
              style={{
                backgroundColor: "#9f376f",
                color: "white",
                border: "3px solid #1b1b1e",
                padding: "14px 32px",
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 16,
                textTransform: "uppercase",
                cursor: status === "requesting" ? "default" : "pointer",
                boxShadow: "4px 4px 0 #1b1b1e",
                borderRadius: 4,
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={(e) => {
                if (status === "requesting") return;
                (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #1b1b1e";
              }}
              onMouseLeave={(e) => {
                if (status === "requesting") return;
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
              }}
            >
              {status === "requesting" ? "REQUESTING..." : "ALLOW NOTIFICATIONS"}
            </button>
          </>
        )}

        {isEnabled && (
          <>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 18,
                textTransform: "uppercase",
                color: "#4caf50",
                marginBottom: 8,
              }}
            >
              NOTIFICATIONS ENABLED
            </p>
            <p style={{ fontSize: 13, color: "#544249", fontWeight: 600 }}>
              {status === "subscribed"
                ? "Push notifications successfully activated. You're ready to proceed."
                : "Notifications granted. You're ready to proceed."}
            </p>
          </>
        )}

        {isDenied && (
          <>
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 18,
                textTransform: "uppercase",
                color: "#ba1a1a",
                marginBottom: 8,
              }}
            >
              NOTIFICATIONS BLOCKED
            </p>
            <p style={{ fontSize: 13, color: "#ba1a1a", fontWeight: 600, marginBottom: 16 }}>
              Notifications are required for KYC verification. Please enable them in your browser settings, then refresh and try again.
            </p>
            <div
              style={{
                backgroundColor: "#ffd8e7",
                border: "2px solid #ba1a1a",
                padding: "12px 16px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                color: "#ba1a1a",
              }}
            >
              Browser settings → Site settings → Notifications → Allow for this site
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 6: Review & Submit ───────────────────────────────────────────────────

function Step6Review({
  identity,
  challengeCode,
  photoPreview,
  location,
  notifStatus,
  submitting,
  submitError,
  onSubmit,
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
  const idTypeLabels: Record<string, string> = {
    passport: "Passport",
    national_id: "National ID",
    drivers_license: "Driver's License",
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      <div
        style={{
          backgroundColor: "#ffe24c",
          border: "4px solid #1b1b1e",
          boxShadow: "6px 6px 0 #1b1b1e",
          padding: "16px 20px",
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 900,
            fontSize: 18,
            textTransform: "uppercase",
            color: "#1b1b1e",
          }}
        >
          MISSION BRIEFING — REVIEW YOUR SUBMISSION
        </p>
        <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, marginTop: 4 }}>
          Review all details before submitting. This cannot be undone without admin action.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Identity */}
        <div
          style={{
            border: "3px solid #1b1b1e",
            borderRadius: 8,
            backgroundColor: "#fbf8fc",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffd8e7",
              padding: "10px 16px",
              borderBottom: "2px solid #1b1b1e",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: 13,
                textTransform: "uppercase",
                color: "#3d0025",
              }}
            >
              IDENTITY
            </p>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Full Name", identity.fullName],
              ["Date of Birth", identity.dateOfBirth],
              ["Nationality", identity.nationality],
              ["ID Type", idTypeLabels[identity.idType] ?? identity.idType],
              ["ID Number", identity.idNumber],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1b1b1e" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Challenge code */}
        <div
          style={{
            border: "3px solid #1b1b1e",
            borderRadius: 8,
            backgroundColor: "#ffe24c",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Challenge Code
          </span>
          <span
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontSize: 22,
              fontWeight: 900,
              color: "#1b1b1e",
              letterSpacing: "0.08em",
            }}
          >
            {challengeCode}
          </span>
        </div>

        {/* Photo thumbnail */}
        {photoPreview && (
          <div
            style={{
              border: "3px solid #1b1b1e",
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="KYC photo"
              style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "#ffe24c",
                border: "2px solid #1b1b1e",
                padding: "3px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                color: "#1b1b1e",
                textTransform: "uppercase",
              }}
            >
              KYC SELFIE
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div
            style={{
              border: "3px solid #1b1b1e",
              borderRadius: 8,
              backgroundColor: "#7ed4fd",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#005b78", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Location
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1b1b1e", fontFamily: "monospace" }}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          </div>
        )}

        {/* Notifications */}
        <div
          style={{
            border: "3px solid #1b1b1e",
            borderRadius: 8,
            backgroundColor: notifStatus === "subscribed" || notifStatus === "granted" ? "#e8fce8" : "#ffd8e7",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Notifications
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: notifStatus === "subscribed" || notifStatus === "granted" ? "#4caf50" : "#ba1a1a",
              textTransform: "uppercase",
            }}
          >
            {notifStatus === "subscribed"
              ? "PUSH ENABLED"
              : notifStatus === "granted"
              ? "GRANTED"
              : "DISABLED"}
          </span>
        </div>

        {/* Error */}
        {submitError && (
          <div
            style={{
              backgroundColor: "#ffd8e7",
              border: "2px solid #ba1a1a",
              padding: "12px 16px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#ba1a1a",
            }}
          >
            {submitError}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            width: "100%",
            backgroundColor: submitting ? "#e4e1e6" : "#9f376f",
            color: submitting ? "#544249" : "white",
            border: "4px solid #1b1b1e",
            padding: "18px",
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontWeight: 900,
            fontSize: 18,
            textTransform: "uppercase",
            cursor: submitting ? "default" : "pointer",
            boxShadow: submitting ? "none" : "6px 6px 0 #1b1b1e",
            borderRadius: 4,
            letterSpacing: "-0.01em",
            transition: "transform 0.1s, box-shadow 0.1s",
            marginTop: 8,
          }}
          onMouseEnter={(e) => {
            if (submitting) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
          }}
          onMouseLeave={(e) => {
            if (submitting) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 0 #1b1b1e";
          }}
        >
          {submitting ? "SUBMITTING..." : "SUBMIT KYC APPLICATION"}
        </button>
      </div>
    </div>
  );
}

// ── Pending Screen ────────────────────────────────────────────────────────────

function PendingScreen({ submission }: { submission: KYCSubmission }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          backgroundColor: "#ffe24c",
          border: "4px solid #1b1b1e",
          boxShadow: "6px 6px 0 #1b1b1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
          pending
        </span>
      </div>

      <div>
        <h2
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 32,
            fontWeight: 900,
            textTransform: "uppercase",
            color: "#1b1b1e",
            marginBottom: 8,
          }}
        >
          VERIFICATION PENDING
        </h2>
        <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, lineHeight: 1.6 }}>
          Your KYC application is under review. You will be notified once a decision has been made.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          border: "3px solid #1b1b1e",
          borderRadius: 8,
          backgroundColor: "#fbf8fc",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffe24c",
            padding: "10px 16px",
            borderBottom: "2px solid #1b1b1e",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 13,
              textTransform: "uppercase",
              color: "#1b1b1e",
            }}
          >
            SUBMITTED INFO
          </p>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Name", submission.fullName],
            ["Nationality", submission.nationality],
            ["ID Type", submission.idType.replace("_", " ")],
            ["Submitted", submission.submittedAt?.toDate().toLocaleDateString() ?? "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>
                {label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1b1b1e", textTransform: "capitalize" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "12px 20px",
          backgroundColor: "#7ed4fd",
          border: "2px solid #1b1b1e",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          color: "#005b78",
          maxWidth: 400,
          width: "100%",
        }}
      >
        Typical review time: 24–72 hours. Keep an eye on your push notifications.
      </div>
    </div>
  );
}

// ── Rejected Screen ───────────────────────────────────────────────────────────

function RejectedScreen({
  submission,
  onResubmit,
  clearing,
}: {
  submission: KYCSubmission;
  onResubmit: () => void;
  clearing: boolean;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          backgroundColor: "#ffd8e7",
          border: "4px solid #ba1a1a",
          boxShadow: "6px 6px 0 #ba1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#ba1a1a", fontVariationSettings: "'FILL' 1" }}>
          cancel
        </span>
      </div>

      <div>
        <h2
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 32,
            fontWeight: 900,
            textTransform: "uppercase",
            color: "#ba1a1a",
            marginBottom: 8,
          }}
        >
          VERIFICATION REJECTED
        </h2>
        <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, lineHeight: 1.6 }}>
          Your KYC application was not approved. You may resubmit with corrected information.
        </p>
      </div>

      {submission.rejectionReason && (
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            backgroundColor: "#ffd8e7",
            border: "3px solid #ba1a1a",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: 13,
              textTransform: "uppercase",
              color: "#ba1a1a",
              marginBottom: 8,
            }}
          >
            REJECTION REASON
          </p>
          <p style={{ fontSize: 14, color: "#3d0025", fontWeight: 600, lineHeight: 1.5 }}>
            {submission.rejectionReason}
          </p>
        </div>
      )}

      <button
        onClick={onResubmit}
        disabled={clearing}
        style={{
          backgroundColor: clearing ? "#e4e1e6" : "#9f376f",
          color: clearing ? "#544249" : "white",
          border: "4px solid #1b1b1e",
          padding: "16px 40px",
          fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
          fontWeight: 900,
          fontSize: 18,
          textTransform: "uppercase",
          cursor: clearing ? "default" : "pointer",
          boxShadow: clearing ? "none" : "6px 6px 0 #1b1b1e",
          borderRadius: 4,
          letterSpacing: "-0.01em",
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
        onMouseEnter={(e) => {
          if (clearing) return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
        }}
        onMouseLeave={(e) => {
          if (clearing) return;
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 0 #1b1b1e";
        }}
      >
        {clearing ? "CLEARING..." : "RESUBMIT APPLICATION"}
      </button>
    </div>
  );
}

// ── Approved Screen ───────────────────────────────────────────────────────────

function ApprovedScreen({ expiresAt }: { expiresAt?: Date }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          backgroundColor: "#c8f7c5",
          border: "4px solid #1b1b1e",
          boxShadow: "6px 6px 0 #1b1b1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>
          verified_user
        </span>
      </div>

      <div>
        <h2
          style={{
            fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
            fontSize: 32,
            fontWeight: 900,
            textTransform: "uppercase",
            color: "#4caf50",
            marginBottom: 8,
          }}
        >
          IDENTITY VERIFIED
        </h2>
        <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, lineHeight: 1.6 }}>
          Your identity has been verified. You have full access to all platform features.
        </p>
      </div>

      {expiresAt && (
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#ffe24c",
            border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            color: "#1b1b1e",
          }}
        >
          Verification valid until: {expiresAt.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
