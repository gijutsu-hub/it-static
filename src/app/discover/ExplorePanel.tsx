"use client";

import { useState } from "react";
import TreasureHuntPanel from "./TreasureHuntPanel";
import PhotoChallengePanel from "./PhotoChallengePanel";
import type { PhotoChallenge } from "@/lib/firestore";

interface Props {
  uid: string;
  userLocation: { lat: number; lng: number } | null;
  userPoints: number;
  onStartGuess: (challenge: PhotoChallenge) => void;
}

export default function ExplorePanel({ uid, userLocation, userPoints, onStartGuess }: Props) {
  const [tab, setTab] = useState<"hunts" | "challenges">("hunts");

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: "12px 0", fontWeight: 900, fontSize: 12,
    textTransform: "uppercase" as const, letterSpacing: "0.04em",
    cursor: "pointer" as const, border: "none" as const, fontFamily: "inherit",
    backgroundColor: active ? "#1b1b1e" : "#fbf8fc",
    color: active ? "#ffe24c" : "#544249",
    borderBottom: `3px solid #1b1b1e`,
    display: "flex" as const, alignItems: "center" as const,
    justifyContent: "center" as const, gap: 6,
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fbf8fc" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "4px solid #1b1b1e", flexShrink: 0 }}>
        <button style={tabStyle(tab === "hunts")} onClick={() => setTab("hunts")}>
          <span>🗺️</span> HUNTS
        </button>
        <button style={tabStyle(tab === "challenges")} onClick={() => setTab("challenges")}>
          <span>📸</span> CHALLENGES
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "hunts" ? (
          <TreasureHuntPanel uid={uid} userLocation={userLocation} />
        ) : (
          <PhotoChallengePanel uid={uid} userPoints={userPoints} onStartGuess={onStartGuess} />
        )}
      </div>
    </div>
  );
}
