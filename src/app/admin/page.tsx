import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NotificationSender from "./NotificationSender";
import UserManagement from "./UserManagement";
import KYCReview from "./KYCReview";

export const metadata: Metadata = { title: "Admin — IT'S STATIC" };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "snath2973@gmail.com";

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
        className="border-b-4 border-on-surface px-16 py-4 flex items-center gap-6"
        style={{ boxShadow: "0 4px 0 #1b1b1e", backgroundColor: "#fbf8fc" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 28, fontWeight: 800, textTransform: "uppercase",
            color: "#9f376f", fontStyle: "italic", letterSpacing: "-0.02em",
          }}
        >
          RESIST_NET · ADMIN
        </h1>
        <span
          className="font-label-sm text-xs uppercase border-2 border-on-surface px-3 py-1"
          style={{ backgroundColor: "#ffe24c", boxShadow: "2px 2px 0 #1b1b1e" }}
        >
          {ADMIN_EMAIL}
        </span>
        <a
          href="/discover"
          className="ml-auto font-label-lg text-sm uppercase text-on-surface-variant hover:text-primary transition-colors"
        >
          ← Back to map
        </a>
      </header>

      <main className="p-8 md:p-16 flex flex-col gap-12 max-w-7xl mx-auto">

        {/* ── KYC Review ──────────────────────────────────────────── */}
        <section>
          <div className="mb-6 flex items-center gap-4">
            <h2
              style={{
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              KYC Verification Review
            </h2>
            <div
              className="h-1 flex-1 border-t-4 border-on-surface"
              style={{ borderStyle: "dashed" }}
            />
          </div>
          <KYCReview />
        </section>

        {/* ── User Management ─────────────────────────────────────── */}
        <section>
          <div className="mb-6 flex items-center gap-4">
            <h2
              style={{
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              User Management
            </h2>
            <div
              className="h-1 flex-1 border-t-4 border-on-surface"
              style={{ borderStyle: "dashed" }}
            />
          </div>
          <UserManagement />
        </section>

        {/* ── Push Notifications ──────────────────────────────────── */}
        <section>
          <div className="mb-6 flex items-center gap-4">
            <h2
              style={{
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              Push Notifications
            </h2>
            <div
              className="h-1 flex-1 border-t-4 border-on-surface"
              style={{ borderStyle: "dashed" }}
            />
          </div>
          <NotificationSender />
        </section>

      </main>
    </div>
  );
}
