import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NotificationSender from "./NotificationSender";
import UserManagement from "./UserManagement";
import KYCReview from "./KYCReview";
import SquadManagement from "./SquadManagement";
import AnalyticsDashboard from "./AnalyticsDashboard";
import HuntManager from "./HuntManager";
import StoreManager from "./StoreManager";

export const metadata: Metadata = { title: "Admin — IT'S STATIC" };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "snath2973@gmail.com";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <h2
        style={{
          fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
          fontSize: 22, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h2>
      <div className="h-1 flex-1 border-t-4 border-on-surface" style={{ borderStyle: "dashed" }} />
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.email !== ADMIN_EMAIL) redirect("/discover");

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", backgroundColor: "#fbf8fc" }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: "4px solid #1b1b1e", boxShadow: "0 4px 0 #1b1b1e",
          backgroundColor: "#fbf8fc", padding: "14px 32px",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 24, fontWeight: 800, textTransform: "uppercase",
            color: "#9f376f", fontStyle: "italic", letterSpacing: "-0.02em",
          }}
        >
          IT&apos;S STATIC · ADMIN
        </h1>
        <span
          style={{
            backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
            boxShadow: "2px 2px 0 #1b1b1e", padding: "3px 10px",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          }}
        >
          {ADMIN_EMAIL}
        </span>
        <a
          href="/discover"
          style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#544249", textDecoration: "none" }}
        >
          ← Back to map
        </a>
      </header>

      <main style={{ padding: "32px 24px", maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>

        {/* ── Analytics Dashboard ──────────────────────────────────── */}
        <section>
          <SectionHeader title="Platform Analytics" />
          <AnalyticsDashboard />
        </section>

        {/* ── KYC Review ──────────────────────────────────────────── */}
        <section>
          <SectionHeader title="KYC Verification Review" />
          <KYCReview />
        </section>

        {/* ── Squad Management ────────────────────────────────────── */}
        <section>
          <SectionHeader title="Squad Management" />
          <SquadManagement />
        </section>

        {/* ── User Management ─────────────────────────────────────── */}
        <section>
          <SectionHeader title="User Management" />
          <UserManagement />
        </section>

        {/* ── Push Notifications ──────────────────────────────────── */}
        <section>
          <SectionHeader title="Push Notifications" />
          <NotificationSender />
        </section>

        {/* ── Treasure Hunts ──────────────────────────────────────── */}
        <section>
          <SectionHeader title="🗺️ Treasure Hunts" />
          <HuntManager />
        </section>

        {/* ── Store Management ──────────────────────────────────── */}
        <section>
          <SectionHeader title="🛍️ Store Management" />
          <StoreManager />
        </section>

      </main>
    </div>
  );
}
