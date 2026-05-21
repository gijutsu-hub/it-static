"use client";

import { useState, useEffect } from "react";
import {
  subscribeToAllKYCSubmissions,
  approveKYC,
  rejectKYC,
  type KYCSubmission,
} from "@/lib/firestore";
import { authReady } from "@/lib/firebase";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function todayCount(submissions: KYCSubmission[]): number {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return submissions.filter((s) => {
    const submittedAt = s.submittedAt?.toDate()?.getTime() ?? 0;
    const reviewedAt = s.reviewedAt?.toDate()?.getTime() ?? 0;
    return reviewedAt >= startOfDay || (s.status !== "pending" && submittedAt >= startOfDay);
  }).length;
}

export default function KYCReview() {
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToAllKYCSubmissions(
      (subs) => {
        setFirebaseError(null);
        setSubmissions(subs);
      },
      (err) => {
        setFirebaseError(
          err.message.includes("permission")
            ? "Firebase permission denied. Ensure Anonymous Authentication is enabled in Firebase Console → Authentication → Sign-in method."
            : `Firebase error: ${err.message}`
        );
      }
    );
    return unsub;
  }, [firebaseReady]);

  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const reviewedToday = todayCount(submissions);

  async function handleApprove() {
    if (!selectedSubmission) return;
    setProcessing(true);
    setError(null);
    try {
      await approveKYC(
        selectedSubmission.id,
        selectedSubmission.email,
        selectedSubmission.kycPhotoPath
      );
      setSelectedSubmission(null);
      setApproveConfirm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedSubmission || !rejectReason.trim()) return;
    setProcessing(true);
    setError(null);
    try {
      await rejectKYC(
        selectedSubmission.id,
        selectedSubmission.email,
        rejectReason.trim()
      );
      setSelectedSubmission(null);
      setRejectMode(false);
      setRejectReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setProcessing(false);
    }
  }

  function closeModal() {
    setSelectedSubmission(null);
    setRejectMode(false);
    setRejectReason("");
    setApproveConfirm(false);
    setError(null);
  }

  const idTypeLabels: Record<string, string> = {
    passport: "Passport",
    national_id: "National ID",
    drivers_license: "Driver's License",
  };

  return (
    <div>
      {/* Firebase error banner */}
      {firebaseError && (
        <div
          style={{
            backgroundColor: "#ffd8e7",
            border: "3px solid #ba1a1a",
            borderRadius: 8,
            padding: "14px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#ba1a1a", flexShrink: 0, marginTop: 1 }}>error</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 13, color: "#ba1a1a", textTransform: "uppercase", marginBottom: 4 }}>
              Firebase Connection Error
            </p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>{firebaseError}</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            backgroundColor: "#ffe24c",
            border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e",
            padding: "16px 24px",
            borderRadius: 8,
            minWidth: 160,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
              fontSize: 36,
              fontWeight: 900,
              color: "#1b1b1e",
              lineHeight: 1,
            }}
          >
            {pendingSubmissions.length}
          </p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
            Pending Review
          </p>
        </div>
        <div
          style={{
            backgroundColor: "#7ed4fd",
            border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e",
            padding: "16px 24px",
            borderRadius: 8,
            minWidth: 160,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
              fontSize: 36,
              fontWeight: 900,
              color: "#1b1b1e",
              lineHeight: 1,
            }}
          >
            {reviewedToday}
          </p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
            Reviewed Today
          </p>
        </div>
      </div>

      {/* Table */}
      {pendingSubmissions.length === 0 ? (
        <div
          style={{
            border: "3px solid #1b1b1e",
            borderRadius: 8,
            padding: "40px 24px",
            textAlign: "center",
            backgroundColor: "#fbf8fc",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#544249", display: "block", marginBottom: 12 }}>
            task_alt
          </span>
          <p
            style={{
              fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#544249",
            }}
          >
            No Pending Submissions
          </p>
          <p style={{ fontSize: 13, color: "#877179", fontWeight: 600, marginTop: 8 }}>
            All KYC applications have been reviewed.
          </p>
        </div>
      ) : (
        <div
          style={{
            border: "3px solid #1b1b1e",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "4px 4px 0 #1b1b1e",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 1fr 120px 120px",
              backgroundColor: "#1b1b1e",
              padding: "12px 20px",
              gap: 16,
            }}
          >
            {["", "USER", "SUBMITTED", "STATUS", "ACTION"].map((col) => (
              <span
                key={col}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#fbf8fc",
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Table rows */}
          {pendingSubmissions.map((sub, idx) => (
            <div
              key={sub.id}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr 1fr 120px 120px",
                padding: "14px 20px",
                gap: 16,
                alignItems: "center",
                backgroundColor: idx % 2 === 0 ? "#fbf8fc" : "#f6f2f7",
                borderBottom: idx < pendingSubmissions.length - 1 ? "2px solid #e4e1e6" : "none",
              }}
            >
              {/* Avatar */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {sub.profilePhotoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sub.profilePhotoURL}
                    alt={sub.displayName}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "2px solid #1b1b1e",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "2px solid #1b1b1e",
                      backgroundColor: "#ffd8e7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#9f376f" }}>person</span>
                  </div>
                )}
              </div>

              {/* Name / email */}
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#1b1b1e" }}>{sub.displayName}</p>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>{sub.email}</p>
                <p style={{ fontSize: 11, color: "#877179", fontWeight: 600 }}>{sub.fullName}</p>
              </div>

              {/* Submitted at */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1b1b1e" }}>
                  {sub.submittedAt ? timeAgo(sub.submittedAt.toDate()) : "—"}
                </p>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>
                  {sub.submittedAt ? sub.submittedAt.toDate().toLocaleDateString() : ""}
                </p>
              </div>

              {/* Status badge */}
              <div>
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#ffe24c",
                    border: "2px solid #1b1b1e",
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#1b1b1e",
                    letterSpacing: "0.04em",
                  }}
                >
                  PENDING
                </span>
              </div>

              {/* Action */}
              <button
                onClick={() => {
                  setSelectedSubmission(sub);
                  setRejectMode(false);
                  setApproveConfirm(false);
                  setError(null);
                }}
                style={{
                  backgroundColor: "#9f376f",
                  color: "white",
                  border: "2px solid #1b1b1e",
                  padding: "8px 16px",
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "3px 3px 0 #1b1b1e",
                  fontFamily: "inherit",
                  borderRadius: 4,
                  transition: "transform 0.1s, box-shadow 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0 #1b1b1e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "3px 3px 0 #1b1b1e";
                }}
              >
                REVIEW
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Full-screen review modal ──────────────────────────────────────────── */}
      {selectedSubmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 200,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              backgroundColor: "#fbf8fc",
              width: "100%",
              maxWidth: 1100,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e",
              margin: "24px",
              borderRadius: 8,
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 28px",
                backgroundColor: "#1b1b1e",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#ffe24c" }}>fingerprint</span>
                <h3
                  style={{
                    fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                    fontSize: 20,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#fbf8fc",
                  }}
                >
                  KYC REVIEW — {selectedSubmission.displayName}
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#877179", fontWeight: 700 }}>
                  Submitted: {selectedSubmission.submittedAt
                    ? selectedSubmission.submittedAt.toDate().toLocaleString()
                    : "—"}
                </span>
                <button
                  onClick={closeModal}
                  style={{
                    background: "none",
                    border: "2px solid #877179",
                    color: "#877179",
                    cursor: "pointer",
                    padding: "4px 12px",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    borderRadius: 4,
                    fontFamily: "inherit",
                  }}
                >
                  CLOSE ✕
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                overflow: "hidden",
              }}
            >
              {/* Left column */}
              <div
                style={{
                  overflowY: "auto",
                  padding: 28,
                  borderRight: "3px solid #1b1b1e",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {/* Challenge code */}
                <div
                  style={{
                    backgroundColor: "#ffe24c",
                    border: "4px solid #1b1b1e",
                    boxShadow: "5px 5px 0 #1b1b1e",
                    padding: "20px 24px",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#544249",
                      marginBottom: 8,
                    }}
                  >
                    CHALLENGE CODE TO VERIFY IN PHOTO
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                      fontSize: 40,
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                      color: "#1b1b1e",
                      lineHeight: 1,
                    }}
                  >
                    {selectedSubmission.challengeCode}
                  </p>
                  <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 8 }}>
                    This code must be visible in the selfie photo
                  </p>
                </div>

                {/* Personal info */}
                <div
                  style={{
                    border: "3px solid #1b1b1e",
                    borderRadius: 8,
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
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 13,
                        textTransform: "uppercase",
                        color: "#3d0025",
                      }}
                    >
                      PERSONAL INFORMATION
                    </p>
                  </div>
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      ["Full Name", selectedSubmission.fullName],
                      ["Date of Birth", selectedSubmission.dateOfBirth],
                      ["Nationality", selectedSubmission.nationality],
                      ["ID Type", idTypeLabels[selectedSubmission.idType] ?? selectedSubmission.idType],
                      ["ID Number", selectedSubmission.idNumber],
                      ["Email", selectedSubmission.email],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase", flexShrink: 0 }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1b1b1e", textAlign: "right", wordBreak: "break-all" }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div
                  style={{
                    border: "3px solid #1b1b1e",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#7ed4fd",
                      padding: "10px 16px",
                      borderBottom: "2px solid #1b1b1e",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 13,
                        textTransform: "uppercase",
                        color: "#1b1b1e",
                      }}
                    >
                      SUBMISSION LOCATION
                    </p>
                  </div>
                  <div style={{ padding: 12 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1b1b1e",
                        fontFamily: "monospace",
                        marginBottom: 10,
                      }}
                    >
                      {selectedSubmission.location.lat.toFixed(6)},{" "}
                      {selectedSubmission.location.lng.toFixed(6)}
                    </p>
                    {/* Static map */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${selectedSubmission.location.lat},${selectedSubmission.location.lng}&zoom=15&size=400x200&markers=color:red%7C${selectedSubmission.location.lat},${selectedSubmission.location.lng}&key=${MAPS_API_KEY}`}
                      alt="Submission location map"
                      style={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                        border: "2px solid #1b1b1e",
                        borderRadius: 4,
                        display: "block",
                      }}
                    />
                  </div>
                </div>

                {/* Notifications status */}
                <div
                  style={{
                    border: "2px solid #1b1b1e",
                    borderRadius: 6,
                    padding: "10px 14px",
                    backgroundColor: selectedSubmission.notificationsEnabled ? "#e8fce8" : "#ffd8e7",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>
                    Notifications
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: selectedSubmission.notificationsEnabled ? "#4caf50" : "#ba1a1a",
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedSubmission.notificationsEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              </div>

              {/* Right column — photo + actions */}
              <div
                style={{
                  overflowY: "auto",
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {/* Profile photo */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {selectedSubmission.profilePhotoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedSubmission.profilePhotoURL}
                      alt="Profile"
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "3px solid #1b1b1e",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "3px solid #1b1b1e",
                        backgroundColor: "#ffd8e7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#9f376f" }}>person</span>
                    </div>
                  )}
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 18,
                        color: "#1b1b1e",
                      }}
                    >
                      {selectedSubmission.displayName}
                    </p>
                    <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>
                      {selectedSubmission.email}
                    </p>
                  </div>
                </div>

                {/* KYC selfie */}
                <div
                  style={{
                    border: "3px solid #1b1b1e",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#ff85c1",
                      padding: "10px 16px",
                      borderBottom: "2px solid #1b1b1e",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 13,
                        textTransform: "uppercase",
                        color: "#3d0025",
                      }}
                    >
                      KYC SELFIE — VERIFY CHALLENGE CODE &amp; ID VISIBLE
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedSubmission.kycPhotoURL}
                    alt="KYC selfie"
                    style={{
                      width: "100%",
                      display: "block",
                      objectFit: "contain",
                      backgroundColor: "#1b1b1e",
                      maxHeight: 420,
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div
                    style={{
                      backgroundColor: "#ffd8e7",
                      border: "2px solid #ba1a1a",
                      padding: "10px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#ba1a1a",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* REJECT flow */}
                  {!rejectMode && !approveConfirm && (
                    <button
                      onClick={() => setRejectMode(true)}
                      disabled={processing}
                      style={{
                        backgroundColor: "#ffd8e7",
                        color: "#ba1a1a",
                        border: "3px solid #ba1a1a",
                        padding: "14px",
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 16,
                        textTransform: "uppercase",
                        cursor: processing ? "default" : "pointer",
                        boxShadow: "4px 4px 0 #ba1a1a",
                        borderRadius: 4,
                        transition: "transform 0.1s, box-shadow 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (processing) return;
                        (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #ba1a1a";
                      }}
                      onMouseLeave={(e) => {
                        if (processing) return;
                        (e.currentTarget as HTMLButtonElement).style.transform = "";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #ba1a1a";
                      }}
                    >
                      REJECT APPLICATION
                    </button>
                  )}

                  {rejectMode && (
                    <div
                      style={{
                        border: "3px solid #ba1a1a",
                        borderRadius: 8,
                        padding: 16,
                        backgroundColor: "#ffd8e7",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: 700,
                          fontSize: 11,
                          textTransform: "uppercase",
                          marginBottom: 8,
                          color: "#ba1a1a",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Rejection Reason (required)
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Explain why this KYC submission is being rejected..."
                        rows={3}
                        style={{
                          width: "100%",
                          border: "2px solid #ba1a1a",
                          padding: "10px 12px",
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
                          outline: "none",
                          boxSizing: "border-box",
                          backgroundColor: "#fbf8fc",
                          borderRadius: 4,
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <button
                          onClick={() => { setRejectMode(false); setRejectReason(""); }}
                          style={{
                            flex: 1,
                            border: "2px solid #544249",
                            padding: "10px",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            backgroundColor: "#fbf8fc",
                            boxShadow: "3px 3px 0 #544249",
                            fontFamily: "inherit",
                            borderRadius: 4,
                          }}
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={processing || !rejectReason.trim()}
                          style={{
                            flex: 2,
                            border: "2px solid #ba1a1a",
                            padding: "10px",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            cursor: processing || !rejectReason.trim() ? "default" : "pointer",
                            backgroundColor: "#ba1a1a",
                            color: "white",
                            boxShadow: processing || !rejectReason.trim() ? "none" : "3px 3px 0 #3d0025",
                            fontFamily: "inherit",
                            borderRadius: 4,
                            opacity: !rejectReason.trim() ? 0.5 : 1,
                          }}
                        >
                          {processing ? "REJECTING..." : "CONFIRM REJECT"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* APPROVE flow */}
                  {!rejectMode && !approveConfirm && (
                    <button
                      onClick={() => setApproveConfirm(true)}
                      disabled={processing}
                      style={{
                        backgroundColor: "#4caf50",
                        color: "white",
                        border: "3px solid #1b1b1e",
                        padding: "14px",
                        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                        fontWeight: 800,
                        fontSize: 16,
                        textTransform: "uppercase",
                        cursor: processing ? "default" : "pointer",
                        boxShadow: "4px 4px 0 #1b1b1e",
                        borderRadius: 4,
                        transition: "transform 0.1s, box-shadow 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (processing) return;
                        (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px,2px)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #1b1b1e";
                      }}
                      onMouseLeave={(e) => {
                        if (processing) return;
                        (e.currentTarget as HTMLButtonElement).style.transform = "";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "4px 4px 0 #1b1b1e";
                      }}
                    >
                      APPROVE APPLICATION
                    </button>
                  )}

                  {approveConfirm && (
                    <div
                      style={{
                        border: "3px solid #4caf50",
                        borderRadius: 8,
                        padding: 16,
                        backgroundColor: "#e8fce8",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                          fontWeight: 800,
                          fontSize: 14,
                          textTransform: "uppercase",
                          color: "#1b1b1e",
                          marginBottom: 6,
                        }}
                      >
                        CONFIRM APPROVAL
                      </p>
                      <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, marginBottom: 12 }}>
                        This will permanently delete the KYC selfie photo and submission record. The user will be marked as verified for 1 year.
                      </p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={() => setApproveConfirm(false)}
                          style={{
                            flex: 1,
                            border: "2px solid #544249",
                            padding: "10px",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            backgroundColor: "#fbf8fc",
                            boxShadow: "3px 3px 0 #544249",
                            fontFamily: "inherit",
                            borderRadius: 4,
                          }}
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={processing}
                          style={{
                            flex: 2,
                            border: "2px solid #1b1b1e",
                            padding: "10px",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            cursor: processing ? "default" : "pointer",
                            backgroundColor: "#4caf50",
                            color: "white",
                            boxShadow: processing ? "none" : "3px 3px 0 #1b1b1e",
                            fontFamily: "inherit",
                            borderRadius: 4,
                          }}
                        >
                          {processing ? "APPROVING..." : "CONFIRM APPROVE"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
