"use client";

import { BADGE_DEFS, type UserProfile } from "@/lib/firestore";

interface Props {
  profile: UserProfile;
  myUid: string;
  friendStatus: "none" | "sent" | "received" | "friends";
  onClose: () => void;
  onConnect: () => void;
  onMessage: () => void;
  onCall: () => void;
}

const INTEREST_COLORS: Record<string, string> = {
  "K-POP VIBES": "#ff85c1",
  "TECH TALK": "#7ed4fd",
  "URBAN ART": "#ffe24c",
  "SKATE CREW": "#ffe24c",
  "RAVE SIGNAL": "#ff85c1",
  "CHILL ZONE": "#c0e8ff",
  "GLITCH ART": "#ffd8e7",
  "SYNTH-WAVE": "#c0e8ff",
  "LO-FI": "#ffe24c",
  "ROOFTOP BEATS": "#7ed4fd",
};

export default function UserProfileModal({ profile, myUid, friendStatus, onClose, onConnect, onMessage, onCall }: Props) {
  const isSelf = profile.email === myUid;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
          borderBottom: "none", boxShadow: "0 -8px 0 #1b1b1e",
          width: "100%", maxWidth: 480,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          overflow: "hidden", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Cover strip */}
        <div style={{ height: 8, background: "linear-gradient(90deg,#ff85c1,#ffe24c,#7ed4fd,#c8f7c5)" }} />

        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {profile.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoURL} alt={profile.displayName} style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", backgroundColor: "#ffd8e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#9f376f" }}>
                {(profile.displayName || "?")[0].toUpperCase()}
              </div>
            )}
            {profile.kycStatus === "approved" && (
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: "50%", backgroundColor: "#c8f7c5", border: "2px solid #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#2e7d32", fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", color: "#1b1b1e" }}>{profile.displayName}</p>
            {profile.codename && (
              <p style={{ fontSize: 11, fontWeight: 800, color: "#9f376f", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>「{profile.codename}」</p>
            )}
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>
              Joined {profile.firstSeen?.toDate().toLocaleDateString("en-SG", { month: "short", year: "numeric" }) ?? "—"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#544249" }}>close</span>
          </button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div style={{ padding: "12px 20px 0" }}>
            <p style={{ fontSize: 13, color: "#1b1b1e", fontWeight: 600, lineHeight: 1.5, fontStyle: "italic" }}>"{profile.bio}"</p>
          </div>
        )}

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <div style={{ padding: "16px 20px 0" }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#544249", letterSpacing: "0.08em", marginBottom: 8 }}>BADGES</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {profile.badges.map((b) => {
                const def = BADGE_DEFS[b];
                if (!def) return null;
                return (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", backgroundColor: def.color, border: "2px solid #1b1b1e", boxShadow: "2px 2px 0 #1b1b1e" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>{def.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{def.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div style={{ padding: "16px 20px 0" }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#544249", letterSpacing: "0.08em", marginBottom: 8 }}>VIBES</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {profile.interests.map((i) => (
                <span key={i} style={{ padding: "3px 10px", backgroundColor: INTEREST_COLORS[i] ?? "#e4e1e6", border: "1.5px solid #1b1b1e", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{i}</span>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isSelf && (
          <div style={{ padding: "20px", display: "flex", gap: 10 }}>
            {friendStatus === "none" && (
              <button
                onClick={onConnect}
                style={{ flex: 1, padding: "12px", backgroundColor: "#9f376f", color: "#fff", border: "3px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                CONNECT
              </button>
            )}
            {friendStatus === "sent" && (
              <div style={{ flex: 1, padding: "12px", backgroundColor: "#e4e1e6", border: "2px solid #1b1b1e", fontWeight: 700, fontSize: 11, textTransform: "uppercase", textAlign: "center", color: "#544249" }}>
                REQUEST SENT
              </div>
            )}
            {friendStatus === "received" && (
              <button
                onClick={onConnect}
                style={{ flex: 1, padding: "12px", backgroundColor: "#ffe24c", border: "3px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}
              >
                ACCEPT REQUEST
              </button>
            )}
            {friendStatus === "friends" && (
              <>
                <button
                  onClick={onMessage}
                  style={{ flex: 1, padding: "12px", backgroundColor: "#ffd8e7", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>chat</span>
                  MESSAGE
                </button>
                <button
                  onClick={onCall}
                  style={{ padding: "12px 16px", backgroundColor: "#7ed4fd", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>videocam</span>
                </button>
              </>
            )}
          </div>
        )}

        {isSelf && (
          <div style={{ padding: "16px 20px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>This is your public profile</p>
          </div>
        )}
      </div>
    </div>
  );
}
