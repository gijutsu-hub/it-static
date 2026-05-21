"use client";

import { useEffect, useState } from "react";
import {
  subscribeToFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getOrCreateDMChat,
  subscribeToMyDMChats,
  type FriendRequest,
  type UserProfile,
  type DMChat,
  BADGE_DEFS,
} from "@/lib/firestore";
import DirectMessageChat from "./DirectMessageChat";

interface Props {
  uid: string;
  displayName: string;
  photoURL: string;
  allUsers: UserProfile[];
  onCall: (theirUid: string, theirName: string) => void;
}

export default function FriendsDirectory({ uid, displayName, photoURL, allUsers, onCall }: Props) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [dmChats, setDmChats] = useState<DMChat[]>([]);
  const [activeDM, setActiveDM] = useState<{ chatId: string; theirUid: string; theirName: string; theirPhoto: string } | null>(null);
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeToFriendRequests(uid, setRequests);
    const unsub2 = subscribeToMyDMChats(uid, setDmChats);
    return () => { unsub1(); unsub2(); };
  }, [uid]);

  const accepted = requests.filter((r) => r.status === "accepted");
  const incoming = requests.filter((r) => r.status === "pending" && r.toUid === uid);
  const outgoing = requests.filter((r) => r.status === "pending" && r.fromUid === uid);

  function getUserForFriend(friendUid: string) {
    return allUsers.find((u) => u.email === friendUid);
  }

  async function handleAccept(reqId: string) {
    setPending(reqId);
    try { await acceptFriendRequest(reqId); } finally { setPending(null); }
  }

  async function handleReject(reqId: string) {
    setPending(reqId);
    try { await rejectFriendRequest(reqId); } finally { setPending(null); }
  }

  async function openDM(theirUid: string, theirName: string, theirPhoto: string) {
    const chatId = await getOrCreateDMChat(
      uid,
      theirUid,
      { [uid]: displayName, [theirUid]: theirName },
      { [uid]: photoURL, [theirUid]: theirPhoto }
    );
    setActiveDM({ chatId, theirUid, theirName, theirPhoto });
  }

  if (activeDM) {
    return (
      <DirectMessageChat
        chatId={activeDM.chatId}
        myUid={uid}
        myName={displayName}
        myPhoto={photoURL}
        theirName={activeDM.theirName}
        theirPhoto={activeDM.theirPhoto}
        onClose={() => setActiveDM(null)}
        onCall={() => onCall(activeDM.theirUid, activeDM.theirName)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#fbf8fc" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "3px solid #1b1b1e", backgroundColor: "#ffd8e7", flexShrink: 0 }}>
        <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", color: "#3d0025" }}>
          FRIENDS
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#544249", marginTop: 2 }}>
          {accepted.length} connection{accepted.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #1b1b1e", flexShrink: 0 }}>
        {([
          { key: "friends", label: "FRIENDS", count: accepted.length },
          { key: "requests", label: "REQUESTS", count: incoming.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "10px 8px", border: "none", borderBottom: tab === t.key ? "3px solid #9f376f" : "3px solid transparent",
              backgroundColor: tab === t.key ? "#ffd8e7" : "transparent",
              fontWeight: 800, fontSize: 11, textTransform: "uppercase",
              color: tab === t.key ? "#9f376f" : "#544249", cursor: "pointer",
              fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ background: "#9f376f", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "friends" && (
          <>
            {accepted.length === 0 && outgoing.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "#544249" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12, color: "#c4bcc3", fontVariationSettings: "'FILL' 1" }}>diversity_3</span>
                <p style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>No connections yet</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Connect with people in Recruits</p>
              </div>
            )}
            {accepted.map((req) => {
              const friendUid = req.fromUid === uid ? req.toUid : req.fromUid;
              const friend = getUserForFriend(friendUid);
              const dmChat = dmChats.find((c) => c.memberUids.includes(friendUid));
              // eslint-disable-next-line react-hooks/rules-of-hooks
              return (
                <FriendCard
                  key={req.id}
                  uid={friendUid}
                  name={friend?.displayName ?? req.fromUid === uid ? req.toUid : req.fromUid}
                  photo={friend?.photoURL ?? ""}
                  bio={friend?.bio}
                  interests={friend?.interests}
                  badges={friend?.badges}
                  lastMessage={dmChat?.lastMessage}
                  onDM={() => openDM(friendUid, friend?.displayName ?? friendUid, friend?.photoURL ?? "")}
                  onCall={() => onCall(friendUid, friend?.displayName ?? friendUid)}
                />
              );
            })}
            {outgoing.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#544249", letterSpacing: "0.06em", marginTop: 8 }}>PENDING ({outgoing.length})</p>
                {outgoing.map((req) => {
                  const friend = getUserForFriend(req.toUid);
                  return (
                    <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "2px solid #e4e1e6", backgroundColor: "#f5f2f6" }}>
                      {friend?.photoURL && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={friend.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover" }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>{friend?.displayName ?? req.toUid}</p>
                        <p style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>Request sent</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#c7ad07", textTransform: "uppercase" }}>PENDING</span>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            {incoming.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "#544249" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12, color: "#c4bcc3", fontVariationSettings: "'FILL' 1" }}>person_add</span>
                <p style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>No pending requests</p>
              </div>
            )}
            {incoming.map((req) => {
              const friend = getUserForFriend(req.fromUid);
              return (
                <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "2px solid #1b1b1e", backgroundColor: "#ffe24c", boxShadow: "3px 3px 0 #1b1b1e" }}>
                  {friend?.photoURL && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={friend.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {friend?.displayName ?? req.fromUid}
                    </p>
                    <p style={{ fontSize: 10, color: "#544249", fontWeight: 600 }}>Wants to connect</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={pending === req.id}
                      style={{ padding: "6px 10px", border: "2px solid #1b1b1e", backgroundColor: "#1b1b1e", color: "#fbf8fc", fontWeight: 800, fontSize: 10, textTransform: "uppercase", cursor: "pointer", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={pending === req.id}
                      style={{ padding: "6px 10px", border: "2px solid #ba1a1a", backgroundColor: "transparent", color: "#ba1a1a", fontWeight: 800, fontSize: 10, textTransform: "uppercase", cursor: "pointer", fontFamily: "var(--font-quicksand,'Quicksand',sans-serif)" }}
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── FriendCard ─────────────────────────────────────────────────────────────────

function FriendCard({ uid: _uid, name, photo, bio, interests, badges, lastMessage, onDM, onCall }: {
  uid: string;
  name: string;
  photo: string;
  bio?: string;
  interests?: string[];
  badges?: string[];
  lastMessage?: string;
  onDM: () => void;
  onCall: () => void;
}) {
  return (
    <div style={{ border: "2px solid #1b1b1e", backgroundColor: "#fbf8fc", boxShadow: "3px 3px 0 #1b1b1e", overflow: "hidden" }}>
      <div style={{ height: 4, background: "linear-gradient(90deg, #9f376f, #7ed4fd)" }} />
      <div style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid #1b1b1e", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid #1b1b1e", backgroundColor: "#e4e1e6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#544249" }}>person</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          {bio && <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bio}</p>}
          {lastMessage && <p style={{ fontSize: 10, color: "#9f376f", fontWeight: 600, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {lastMessage}</p>}
          {badges && badges.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {badges.slice(0, 3).map((b) => {
                const def = BADGE_DEFS[b];
                if (!def) return null;
                return (
                  <span key={b} style={{ display: "flex", alignItems: "center", gap: 2, padding: "1px 6px", backgroundColor: def.color, border: "1.5px solid #1b1b1e", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>{def.icon}</span>
                    {def.label}
                  </span>
                );
              })}
            </div>
          )}
          {interests && interests.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {interests.slice(0, 3).map((i) => (
                <span key={i} style={{ padding: "1px 6px", backgroundColor: "#e4e1e6", border: "1px solid #1b1b1e", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{i}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={onCall}
            style={{ padding: "6px 8px", border: "2px solid #1b1b1e", backgroundColor: "#7ed4fd", cursor: "pointer", display: "flex", alignItems: "center", boxShadow: "2px 2px 0 #1b1b1e" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#005b78", fontVariationSettings: "'FILL' 1" }}>videocam</span>
          </button>
          <button
            onClick={onDM}
            style={{ padding: "6px 8px", border: "2px solid #1b1b1e", backgroundColor: "#ffd8e7", cursor: "pointer", display: "flex", alignItems: "center", boxShadow: "2px 2px 0 #1b1b1e" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#3d0025", fontVariationSettings: "'FILL' 1" }}>chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
