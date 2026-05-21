"use client";

import { useEffect, useState } from "react";
import {
  subscribeToPhotoChallenges,
  subscribeToMyChallengeGuesses,
  type PhotoChallenge,
  type PhotoChallengeGuess,
} from "@/lib/firestore";

interface Props {
  uid: string;
  userPoints: number;
  onStartGuess: (challenge: PhotoChallenge) => void;
  onOpenCreateChallenge?: () => void;
}

export default function PhotoChallengePanel({ uid, userPoints, onStartGuess, onOpenCreateChallenge }: Props) {
  const [tab, setTab] = useState<"guess" | "mine">("guess");
  const [challenges, setChallenges] = useState<PhotoChallenge[]>([]);
  const [myGuesses, setMyGuesses] = useState<PhotoChallengeGuess[]>([]);
  const [selected, setSelected] = useState<PhotoChallenge | null>(null);

  useEffect(() => subscribeToPhotoChallenges(setChallenges), []);
  useEffect(() => subscribeToMyChallengeGuesses(uid, setMyGuesses), [uid]);

  const guessedIds = new Set(myGuesses.map((g) => g.challengeId));
  const toGuess = challenges.filter((c) => c.uid !== uid && !guessedIds.has(c.id));
  const myChallenges = challenges.filter((c) => c.uid === uid);

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: "10px 0", fontWeight: 800, fontSize: 11,
    textTransform: "uppercase" as const, letterSpacing: "0.04em",
    cursor: "pointer" as const, border: "none" as const, fontFamily: "inherit",
    backgroundColor: active ? "#ffe24c" : "transparent",
    color: active ? "#211b00" : "#544249",
    borderBottom: active ? "3px solid #1b1b1e" : "3px solid transparent",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 0", borderBottom: "4px solid #1b1b1e" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: "#1b1b1e" }}>
              📸 PHOTO CHALLENGES
            </h2>
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>
              Guess where photos were taken · earn points
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onOpenCreateChallenge && (
              <button
                onClick={onOpenCreateChallenge}
                style={{
                  background: "#9f376f", border: "2px solid #1b1b1e", padding: "6px 10px",
                  boxShadow: "2px 2px 0 #1b1b1e", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 4, fontWeight: 800, fontSize: 10,
                  textTransform: "uppercase", color: "white", fontFamily: "inherit",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>add_location</span>
                NEW
              </button>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ background: "#ffe24c", border: "2px solid #1b1b1e", padding: "4px 10px", boxShadow: "2px 2px 0 #1b1b1e" }}>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#1b1b1e" }}>{userPoints}</span>
                <span style={{ fontWeight: 700, fontSize: 9, color: "#544249", textTransform: "uppercase", display: "block" }}>POINTS</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <button style={tabStyle(tab === "guess")} onClick={() => setTab("guess")}>
            GUESS ({toGuess.length})
          </button>
          <button style={tabStyle(tab === "mine")} onClick={() => setTab("mine")}>
            MY CHALLENGES ({myChallenges.length})
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {tab === "guess" && (
          <>
            {toGuess.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 6 }}>No challenges yet</p>
                <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>Drop a photo on the map to start a challenge for others!</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {toGuess.map((c) => {
                const guessForThis = myGuesses.find((g) => g.challengeId === c.id);
                return (
                  <div
                    key={c.id}
                    style={{ border: "2px solid #1b1b1e", overflow: "hidden", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e", backgroundColor: "#1b1b1e" }}
                    onClick={() => setSelected(c)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageURL} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "6px 8px" }}>
                      <p style={{ fontWeight: 800, fontSize: 10, textTransform: "uppercase", color: "#ffe24c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.displayName}
                      </p>
                      <p style={{ fontSize: 9, color: "#888", fontWeight: 600, marginTop: 2 }}>
                        {c.totalGuesses} guesses · {c.correctGuesses} correct
                      </p>
                      {guessForThis && (
                        <div style={{ marginTop: 4, padding: "2px 6px", backgroundColor: guessForThis.isCorrect ? "#c8f7c5" : "#ffd8e7", border: "1px solid #1b1b1e", display: "inline-block" }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#1b1b1e", textTransform: "uppercase" }}>
                            {guessForThis.isCorrect ? "✓ CORRECT" : `${guessForThis.distanceMeters}m off`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "mine" && (
          <>
            {myChallenges.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                <p style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 6 }}>No challenges posted</p>
                <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>Tap the camera button on the map to post a photo challenge.</p>
              </div>
            )}
            {myChallenges.map((c) => (
              <div key={c.id} style={{ border: "2px solid #1b1b1e", marginBottom: 12, backgroundColor: "#fbf8fc", boxShadow: "3px 3px 0 #1b1b1e", display: "flex", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageURL} alt="" style={{ width: 80, height: 80, objectFit: "cover", flexShrink: 0, display: "block" }} />
                <div style={{ padding: "10px 12px", flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 12, color: "#1b1b1e", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.caption || "No caption"}
                  </p>
                  <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>
                    {c.totalGuesses} guess{c.totalGuesses !== 1 ? "es" : ""} · {c.correctGuesses} found it
                  </p>
                  <p style={{ fontSize: 10, color: "#544249", marginTop: 4 }}>
                    @ {c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Scoring guide */}
      <div style={{ borderTop: "3px solid #1b1b1e", padding: "12px 16px", backgroundColor: "#fffde7", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ffe24c", border: "1.5px solid #1b1b1e" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>Post photo: +5 pts</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#c8f7c5", border: "1.5px solid #1b1b1e" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#544249", textTransform: "uppercase" }}>Correct guess (&lt;5m): +10 pts</span>
        </div>
      </div>

      {/* Challenge detail modal */}
      {selected && (
        <div
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e", borderBottom: "none", padding: 24, maxHeight: "80vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 18, textTransform: "uppercase" }}>WHERE WAS THIS?</p>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Drop a pin to guess the location. Within 5m = correct!</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#544249" }}>close</span>
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.imageURL} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", border: "3px solid #1b1b1e", marginBottom: 16, display: "block" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {selected.photoURL && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover", flexShrink: 0 }} />
              )}
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>{selected.displayName}</p>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>{selected.caption}</p>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>{selected.totalGuesses} guesses</p>
                <p style={{ fontSize: 11, color: "#4caf50", fontWeight: 700 }}>{selected.correctGuesses} found it</p>
              </div>
            </div>

            {guessedIds.has(selected.id) ? (
              <div style={{ padding: "12px 16px", backgroundColor: "#c8f7c5", border: "3px solid #1b1b1e", textAlign: "center" }}>
                <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", color: "#1b1b1e" }}>
                  {myGuesses.find((g) => g.challengeId === selected.id)?.isCorrect
                    ? "✓ You got it right!"
                    : `You were ${myGuesses.find((g) => g.challengeId === selected.id)?.distanceMeters}m away`}
                </p>
              </div>
            ) : (
              <button
                onClick={() => { onStartGuess(selected); setSelected(null); }}
                style={{
                  width: "100%", padding: "14px", backgroundColor: "#9f376f", color: "white",
                  border: "3px solid #1b1b1e", fontWeight: 800, fontSize: 14,
                  textTransform: "uppercase", cursor: "pointer", boxShadow: "4px 4px 0 #1b1b1e",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>location_on</span>
                DROP PIN ON MAP — GUESS LOCATION
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
