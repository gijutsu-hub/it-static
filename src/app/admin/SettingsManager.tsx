"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminSettings, updateAdminSettings, AdminSettings } from "@/lib/firestore";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConfigStatus {
  smtp: {
    host: string; port: string; secure: string;
    user: string; hasPass: boolean; from: string; configured: boolean;
  };
  razorpay: { keyId: string; hasSecret: boolean; configured: boolean };
  google: { mapsKey: string; clientId: string; hasSecret: boolean; configured: boolean };
  firebase: { projectId: string; configured: boolean };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px",
      backgroundColor: ok ? "#d4edda" : "#f8d7da",
      border: `2px solid ${ok ? "#28a745" : "#dc3545"}`,
      fontSize: 10, fontWeight: 800, textTransform: "uppercase",
      color: ok ? "#155724" : "#721c24", letterSpacing: "0.04em",
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>
        {ok ? "check_circle" : "cancel"}
      </span>
      {label}
    </span>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: "#fff",
      border: "3px solid #1b1b1e",
      boxShadow: "4px 4px 0 #1b1b1e",
      padding: 24, marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 20, color: "#9f376f",
          fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 24",
        }}>{icon}</span>
        <h3 style={{
          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          fontSize: 13, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.04em", margin: 0,
        }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#666", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        padding: "6px 10px",
        backgroundColor: "#f8f6fb",
        border: "2px solid #e4e1e6",
        fontFamily: "monospace", fontSize: 12,
        color: value ? "#1b1b1e" : "#aaa",
      }}>
        {value || (hint ?? "—")}
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block", fontSize: 10, fontWeight: 800,
        textTransform: "uppercase", letterSpacing: "0.04em",
        color: "#544249", marginBottom: 4,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "8px 12px",
          border: "2px solid #1b1b1e",
          fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
          fontSize: 13, fontWeight: 600,
          backgroundColor: "#fff", outline: "none",
        }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsManager() {
  const [config, setConfig]     = useState<ConfigStatus | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Local editable state
  const [trialDays, setTrialDays]     = useState("7");
  const [supportEmail, setSupportEmail] = useState("");
  const [smtpFrom, setSmtpFrom]       = useState("");
  const [razorpayPlanId, setRazorpayPlanId] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");
  const [ptsCheckIn, setPtsCheckIn]   = useState("10");
  const [ptsPhoto, setPtsPhoto]       = useState("25");
  const [ptsHunt, setPtsHunt]         = useState("50");
  const [ptsSquad, setPtsSquad]       = useState("5");
  const [ptsCode, setPtsCode]         = useState("50");
  const [ptsReferral, setPtsReferral] = useState("100");

  const loadAll = useCallback(async () => {
    setLoadingConfig(true);
    const [cfgRes, sett] = await Promise.all([
      fetch("/api/admin/config-status").then((r) => r.json()),
      getAdminSettings(),
    ]);
    setConfig(cfgRes);
    setSettings(sett);

    setTrialDays(String(sett.trialDays ?? 7));
    setSupportEmail(sett.supportEmail ?? "");
    setSmtpFrom(sett.smtpFrom ?? "");
    setRazorpayPlanId(sett.razorpayPlanId ?? "");
    setPriceDisplay(sett.subscriptionPriceDisplay ?? "");
    const p = sett.pointsPerAction;
    setPtsCheckIn(String(p?.checkIn ?? 10));
    setPtsPhoto(String(p?.photoChallenge ?? 25));
    setPtsHunt(String(p?.treasureHunt ?? 50));
    setPtsSquad(String(p?.squadJoin ?? 5));
    setPtsCode(String(p?.entryCode ?? 50));
    setPtsReferral(String(p?.referral ?? 100));
    setLoadingConfig(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveSettings() {
    setSaving(true);
    try {
      await updateAdminSettings({
        trialDays: parseInt(trialDays) || 7,
        supportEmail,
        smtpFrom,
        razorpayPlanId,
        subscriptionPriceDisplay: priceDisplay,
        pointsPerAction: {
          checkIn:        parseInt(ptsCheckIn) || 0,
          photoChallenge: parseInt(ptsPhoto) || 0,
          treasureHunt:   parseInt(ptsHunt) || 0,
          squadJoin:      parseInt(ptsSquad) || 0,
          entryCode:      parseInt(ptsCode) || 0,
          referral:       parseInt(ptsReferral) || 0,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function testSmtp() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-smtp", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  if (loadingConfig || !config || !settings) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#888", fontWeight: 700 }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── SMTP Status ─────────────────────────────────────────────── */}
      <Card title="SMTP / Email" icon="mail">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <StatusBadge ok={config.smtp.configured} label={config.smtp.configured ? "Configured" : "Not configured"} />
          {config.smtp.configured && (
            <>
              <button
                onClick={testSmtp}
                disabled={testing}
                style={{
                  padding: "5px 14px",
                  backgroundColor: testing ? "#aaa" : "#1b1b1e",
                  color: "#fff",
                  border: "2px solid #1b1b1e",
                  cursor: testing ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                }}
              >
                {testing ? "Sending…" : "Send Test Email"}
              </button>
              {testResult && (
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: testResult.ok ? "#155724" : "#721c24",
                }}>
                  {testResult.ok ? "✓ Test email sent to admin" : `✗ ${testResult.error}`}
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Host" value={config.smtp.host} />
          <Field label="Port" value={config.smtp.port} />
          <Field label="Secure" value={config.smtp.secure} hint="not set" />
          <Field label="User" value={config.smtp.user} />
          <Field label="Password" value={config.smtp.hasPass ? "•••••••• (set)" : ""} hint="not set" />
          <Field label="From" value={config.smtp.from} />
        </div>
        <p style={{ fontSize: 11, color: "#888", margin: "8px 0 0", lineHeight: 1.5 }}>
          Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_SECURE</code>, <code>SMTP_USER</code>,{" "}
          <code>SMTP_PASS</code>, <code>SMTP_FROM</code> environment variables to configure email.
        </p>
      </Card>

      {/* ── Razorpay Status ──────────────────────────────────────────── */}
      <Card title="Razorpay / Payments" icon="credit_card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <StatusBadge ok={config.razorpay.configured} label={config.razorpay.configured ? "Configured" : "Not configured"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Field label="Key ID (masked)" value={config.razorpay.keyId} hint="not set" />
          <Field label="Key Secret" value={config.razorpay.hasSecret ? "•••••••• (set)" : ""} hint="not set" />
        </div>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
          Set <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> environment variables.
          The Plan ID and price display are stored in Firestore (editable below).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Razorpay Plan ID" value={razorpayPlanId} onChange={setRazorpayPlanId} placeholder="plan_XXXXXXXXXXXXXXXX" />
          <Input label="Price Display (e.g. ₹299/month)" value={priceDisplay} onChange={setPriceDisplay} placeholder="₹299/month" />
        </div>
      </Card>

      {/* ── Google / Firebase ────────────────────────────────────────── */}
      <Card title="Google & Firebase" icon="cloud">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge ok={config.google.configured} label="Google OAuth" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Field label="Client ID (masked)" value={config.google.clientId} hint="not set" />
              <Field label="Client Secret" value={config.google.hasSecret ? "•••••••• (set)" : ""} hint="not set" />
              <Field label="Maps Key (masked)" value={config.google.mapsKey} hint="not set" />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge ok={config.firebase.configured} label="Firebase" />
            </div>
            <Field label="Project ID" value={config.firebase.projectId} hint="not set" />
          </div>
        </div>
      </Card>

      {/* ── Platform Settings ────────────────────────────────────────── */}
      <Card title="Platform Settings" icon="tune">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Trial Duration (days)" value={trialDays} onChange={setTrialDays} type="number" placeholder="7" />
          <Input label="Support Email" value={supportEmail} onChange={setSupportEmail} placeholder="support@example.com" />
          <Input label="Default SMTP From" value={smtpFrom} onChange={setSmtpFrom} placeholder="noreply@example.com" />
        </div>
      </Card>

      {/* ── Points Per Action ────────────────────────────────────────── */}
      <Card title="Points Per Action" icon="star">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <Input label="Check-In" value={ptsCheckIn} onChange={setPtsCheckIn} type="number" />
          <Input label="Photo Challenge" value={ptsPhoto} onChange={setPtsPhoto} type="number" />
          <Input label="Treasure Hunt" value={ptsHunt} onChange={setPtsHunt} type="number" />
          <Input label="Squad Join" value={ptsSquad} onChange={setPtsSquad} type="number" />
          <Input label="Entry Code Redeem" value={ptsCode} onChange={setPtsCode} type="number" />
          <Input label="Referral" value={ptsReferral} onChange={setPtsReferral} type="number" />
        </div>
      </Card>

      {/* ── Save button ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: "12px 32px",
            backgroundColor: saving ? "#888" : "#9f376f",
            color: "#fff",
            border: "3px solid #1b1b1e",
            boxShadow: saving ? "none" : "4px 4px 0 #1b1b1e",
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 13, fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#155724" }}>
            ✓ Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
