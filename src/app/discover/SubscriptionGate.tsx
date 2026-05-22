"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/lib/firestore";

interface Props {
  userProfile: UserProfile;
  userEmail: string;
  userName: string;
}

export default function SubscriptionGate({ userProfile, userEmail, userName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const isAdminSuspended = !!userProfile.adminSuspended;
  const status = userProfile.subscriptionStatus;
  const trialEndsAt = userProfile.trialEndsAt?.toDate();
  const now = new Date();
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
    : 0;
  const isTrialActive = status === "trial" && daysLeft > 0;
  const isPastDue = status === "past_due";
  const isCancelled = status === "cancelled";
  const isPending = status === "pending";

  // Preload Razorpay script (always run — hooks must not be conditional)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as Record<string, unknown>).Razorpay) { setRazorpayReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => setRazorpayReady(true);
    document.head.appendChild(script);
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/create", { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to start subscription");
      }
      const { subscriptionId, razorpayKeyId } = await res.json() as {
        subscriptionId: string;
        razorpayKeyId: string;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: "IT'S STATIC",
        description: "Monthly Membership — ₹69/month after 7-day trial",
        image: "/icons/icon-192x192.png",
        prefill: { email: userEmail, name: userName },
        theme: { color: "#9f376f" },
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: () => {
          // Subscription activated — reload to re-check status
          window.location.reload();
        },
      });
      rzp.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const btn = (
    <button
      onClick={handleSubscribe}
      disabled={loading || !razorpayReady}
      style={{
        width: "100%", padding: "16px", backgroundColor: loading ? "#e4e1e6" : "#9f376f",
        color: loading ? "#544249" : "white", border: "3px solid #1b1b1e",
        boxShadow: loading ? "none" : "5px 5px 0 #1b1b1e",
        fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
        fontWeight: 900, fontSize: 15, textTransform: "uppercase" as const,
        cursor: loading || !razorpayReady ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        letterSpacing: "0.04em",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
        {loading ? "hourglass_empty" : "upi"}
      </span>
      {loading ? "OPENING PAYMENT…" : "SET UP UPI AUTOPAY →"}
    </button>
  );

  // Hard wall — admin suspended
  if (isAdminSuspended) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 999,
        backgroundColor: "#1b1b1e",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          width: "100%", maxWidth: 460, textAlign: "center",
          border: "4px solid #ba1a1a", boxShadow: "10px 10px 0 #ba1a1a",
          backgroundColor: "#fbf8fc", padding: 40,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            backgroundColor: "#ffd8e7", border: "4px solid #ba1a1a",
            boxShadow: "4px 4px 0 #ba1a1a",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#ba1a1a", fontVariationSettings: "'FILL' 1" }}>
              block
            </span>
          </div>
          <h2 style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 28, fontWeight: 900, textTransform: "uppercase",
            color: "#ba1a1a", marginBottom: 12,
          }}>
            ACCOUNT SUSPENDED
          </h2>
          <p style={{ fontSize: 13, color: "#544249", fontWeight: 600, lineHeight: 1.6, marginBottom: 20 }}>
            Your account has been suspended due to a payment issue or policy violation.
            Contact support to resolve this.
          </p>
          <div style={{
            backgroundColor: "#ffd8e7", border: "2px solid #ba1a1a",
            padding: "12px 16px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#3d0025" }}>
              Account: <span style={{ fontFamily: "monospace" }}>{userEmail}</span>
            </p>
          </div>
          <p style={{ fontSize: 11, color: "#877179", fontWeight: 600 }}>
            IT&apos;S STATIC · support@itstatic.app
          </p>
        </div>
      </div>
    );
  }

  // Show a soft banner for trial (still has access)
  if (isTrialActive) {
    return (
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
          backgroundColor: daysLeft <= 2 ? "#ffe24c" : "#7ed4fd",
          borderBottom: "3px solid #1b1b1e", boxShadow: "0 4px 0 #1b1b1e",
          padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexWrap: "wrap" as const,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#1b1b1e" }}>timer</span>
          <span style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontWeight: 800, fontSize: 12, textTransform: "uppercase" as const, color: "#1b1b1e",
          }}>
            FREE TRIAL — {daysLeft} DAY{daysLeft !== 1 ? "S" : ""} LEFT
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#544249" }}>
            Set up UPI autopay to continue after trial (₹69/month)
          </span>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={loading || !razorpayReady}
          style={{
            padding: "8px 18px", backgroundColor: "#9f376f", color: "white",
            border: "2px solid #1b1b1e", boxShadow: "3px 3px 0 #1b1b1e",
            fontWeight: 800, fontSize: 11, textTransform: "uppercase" as const,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {loading ? "…" : "SET UP AUTOPAY"}
        </button>
      </div>
    );
  }

  // Full-screen gate for no subscription / cancelled / pending
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        backgroundColor: "#fbf8fc",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 480,
          border: "4px solid #1b1b1e", boxShadow: "10px 10px 0 #1b1b1e",
          backgroundColor: "#fbf8fc", padding: 40,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 40, fontWeight: 900, textTransform: "uppercase",
            color: "#9f376f", letterSpacing: "-0.03em", lineHeight: 1,
          }}>
            IT&apos;S STATIC
          </p>
        </div>

        {/* Status-specific message */}
        {isPastDue && (
          <div style={{
            backgroundColor: "#ffd8e7", border: "3px solid #ba1a1a",
            boxShadow: "4px 4px 0 #ba1a1a", padding: "14px 18px", marginBottom: 20,
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, textTransform: "uppercase", color: "#ba1a1a", margin: 0 }}>
              PAYMENT FAILED
            </p>
            <p style={{ fontSize: 12, color: "#3d0025", fontWeight: 600, margin: "4px 0 0" }}>
              Your last payment didn&apos;t go through. Razorpay will retry automatically. You can also re-authorize below.
            </p>
          </div>
        )}

        {isCancelled && (
          <div style={{
            backgroundColor: "#ffd8e7", border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e", padding: "14px 18px", marginBottom: 20,
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, textTransform: "uppercase", color: "#ba1a1a", margin: 0 }}>
              SUBSCRIPTION ENDED
            </p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, margin: "4px 0 0" }}>
              Your membership has ended. Resubscribe to regain access.
            </p>
          </div>
        )}

        {isPending && (
          <div style={{
            backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
            boxShadow: "4px 4px 0 #1b1b1e", padding: "14px 18px", marginBottom: 20,
          }}>
            <p style={{ fontWeight: 900, fontSize: 13, textTransform: "uppercase", color: "#1b1b1e", margin: 0 }}>
              MANDATE PENDING
            </p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, margin: "4px 0 0" }}>
              Your UPI mandate is being set up. Complete the authorization to start your trial.
            </p>
          </div>
        )}

        <h2 style={{
          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          fontSize: 26, fontWeight: 900, textTransform: "uppercase",
          color: "#1b1b1e", marginBottom: 8,
        }}>
          {isCancelled || isPastDue ? "RESUBSCRIBE" : "START YOUR FREE TRIAL"}
        </h2>

        <p style={{ fontSize: 13, color: "#544249", fontWeight: 600, marginBottom: 24, lineHeight: 1.6 }}>
          {isCancelled || isPastDue
            ? "Set up your UPI autopay to restore access to the map, squads, and challenges."
            : "Explore IT'S STATIC free for 7 days. After your trial, ₹69/month is charged via UPI autopay — cancel anytime."}
        </p>

        {/* Pricing card */}
        <div style={{
          backgroundColor: "#ffd8e7", border: "3px solid #1b1b1e",
          boxShadow: "4px 4px 0 #1b1b1e", padding: "18px 22px", marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={{
              fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
              fontSize: 40, fontWeight: 900, color: "#1b1b1e",
            }}>
              ₹69
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#544249" }}>/month</span>
            <div style={{
              marginLeft: "auto", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
              padding: "3px 10px", fontSize: 10, fontWeight: 800, textTransform: "uppercase",
            }}>
              7 DAYS FREE
            </div>
          </div>
          {["Access the live map & user locations", "Join & host squads", "Drop & claim photo challenges", "Leaderboard, store & badges"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1b1b1e" }}>{f}</span>
            </div>
          ))}
        </div>

        {btn}

        {error && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#ba1a1a", fontWeight: 700, textAlign: "center" }}>
            {error}
          </p>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: "#9e9ba1", fontWeight: 600, textAlign: "center" }}>
          UPI autopay via Razorpay · Secured payment · Cancel anytime
        </p>
      </div>
    </div>
  );
}
