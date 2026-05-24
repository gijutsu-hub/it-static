"use client";

import { useState } from "react";
import AnalyticsDashboard  from "./AnalyticsDashboard";
import UserManagement      from "./UserManagement";
import KYCReview           from "./KYCReview";
import SubscriptionManager from "./SubscriptionManager";
import ProfileManager      from "./ProfileManager";
import CodeDropManager     from "./CodeDropManager";
import HuntManager         from "./HuntManager";
import SquadManagement     from "./SquadManagement";
import StoreManager        from "./StoreManager";
import NotificationSender  from "./NotificationSender";
import SettingsManager     from "./SettingsManager";
import PointsManager       from "./PointsManager";

const TABS = [
  { id: "overview",   icon: "bar_chart",        label: "Overview"      },
  { id: "users",      icon: "group",             label: "Users"         },
  { id: "profiles",   icon: "manage_accounts",   label: "Profiles"      },
  { id: "kyc",        icon: "verified_user",      label: "KYC"           },
  { id: "subs",       icon: "credit_card",        label: "Subscriptions" },
  { id: "codedrops",  icon: "key",               label: "Code Drops"    },
  { id: "hunts",      icon: "explore",            label: "Hunts"         },
  { id: "squads",     icon: "diversity_3",        label: "Squads"        },
  { id: "store",      icon: "storefront",         label: "Store"         },
  { id: "notify",     icon: "campaign",           label: "Notify"        },
  { id: "points",     icon: "star",               label: "Points"        },
  { id: "settings",   icon: "settings",           label: "Settings"      },
] as const;

type TabId = typeof TABS[number]["id"];

const SECTION_TITLES: Record<TabId, string> = {
  overview:   "Platform Analytics",
  users:      "User Management",
  profiles:   "Profile System",
  kyc:        "KYC Verification",
  subs:       "Subscription Management",
  codedrops:  "Entry Code Drops",
  hunts:      "Treasure Hunts",
  squads:     "Squad Management",
  store:      "Store Management",
  notify:     "Push Notifications",
  points:     "Points & Leaderboard",
  settings:   "Platform Settings",
};

export default function AdminShell({ adminEmail }: { adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fbf8fc", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 60,
        backgroundColor: "#1b1b1e",
        borderBottom: "4px solid #9f376f",
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 24px", height: 56, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="IT'S STATIC" style={{ height: 28, filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(300deg)" }} />
          <span style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 15, fontWeight: 800, textTransform: "uppercase",
            color: "#ff85c1", letterSpacing: "-0.01em",
          }}>
            ADMIN
          </span>
        </div>

        <div style={{
          backgroundColor: "#ffe24c", border: "2px solid #877179",
          padding: "2px 10px", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", color: "#1b1b1e", letterSpacing: "0.04em",
        }}>
          {adminEmail}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <a href="/discover" style={{
            fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            color: "#aaa", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>map</span>
            MAP
          </a>
          <a href="/" style={{
            fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            color: "#aaa", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>home</span>
            HOME
          </a>
        </div>
      </header>

      {/* ── Sticky tab bar ────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 56, zIndex: 50,
        backgroundColor: "#fbf8fc",
        borderBottom: "4px solid #1b1b1e",
        overflowX: "auto",
        display: "flex",
        whiteSpace: "nowrap",
        scrollbarWidth: "none",
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "12px 18px",
                backgroundColor: isActive ? "#1b1b1e" : "transparent",
                color: isActive ? "#ff85c1" : "#544249",
                border: "none",
                borderRight: "2px solid #e4e1e6",
                cursor: "pointer",
                fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
                fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                transition: "background-color 0.1s, color 0.1s",
                flexShrink: 0,
                boxShadow: isActive ? "inset 0 -4px 0 #9f376f" : "none",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 24" }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main style={{ padding: "28px 24px", maxWidth: 1320, margin: "0 auto" }}>

        {/* Section title */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{
            fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)",
            fontSize: 20, fontWeight: 800, textTransform: "uppercase",
            color: "#1b1b1e", whiteSpace: "nowrap",
          }}>
            {SECTION_TITLES[activeTab]}
          </h2>
          <div style={{ flex: 1, height: 0, borderTop: "4px dashed #e4e1e6" }} />
          <span style={{
            backgroundColor: "#ffe24c", border: "2px solid #1b1b1e",
            boxShadow: "2px 2px 0 #1b1b1e", padding: "2px 10px",
            fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </span>
        </div>

        {/* Tab panels — keep all mounted to preserve subscriptions */}
        <div style={{ display: activeTab === "overview"  ? "block" : "none" }}><AnalyticsDashboard  /></div>
        <div style={{ display: activeTab === "users"     ? "block" : "none" }}><UserManagement      /></div>
        <div style={{ display: activeTab === "profiles"  ? "block" : "none" }}><ProfileManager      /></div>
        <div style={{ display: activeTab === "kyc"       ? "block" : "none" }}><KYCReview           /></div>
        <div style={{ display: activeTab === "subs"      ? "block" : "none" }}><SubscriptionManager /></div>
        <div style={{ display: activeTab === "codedrops" ? "block" : "none" }}><CodeDropManager     /></div>
        <div style={{ display: activeTab === "hunts"     ? "block" : "none" }}><HuntManager         /></div>
        <div style={{ display: activeTab === "squads"    ? "block" : "none" }}><SquadManagement     /></div>
        <div style={{ display: activeTab === "store"     ? "block" : "none" }}><StoreManager        /></div>
        <div style={{ display: activeTab === "notify"    ? "block" : "none" }}><NotificationSender  /></div>
        <div style={{ display: activeTab === "points"    ? "block" : "none" }}><PointsManager adminEmail={adminEmail} /></div>
        <div style={{ display: activeTab === "settings"  ? "block" : "none" }}><SettingsManager     /></div>
      </main>
    </div>
  );
}
