"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createWebRTCCall,
  answerWebRTCCall,
  addWebRTCIceCandidate,
  subscribeToWebRTCCall,
  subscribeToWebRTCIceCandidates,
  endWebRTCCall,
} from "@/lib/firestore";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface Props {
  mode: "caller" | "callee";
  callId?: string;
  myUid: string;
  myName: string;
  theirName: string;
  onCallId?: (id: string) => void;
  onEnd: () => void;
  offer?: RTCSessionDescriptionInit;
}

export default function WebRTCCall({ mode, callId: initialCallId, myUid, myName, theirName, onCallId, onEnd, offer }: Props) {
  const [callId, setCallId] = useState<string | null>(initialCallId ?? null);
  const [status, setStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const addedCandidatesRef = useRef<Set<string>>(new Set());

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const handleEnd = useCallback(async () => {
    if (callId) await endWebRTCCall(callId).catch(() => {});
    cleanup();
    onEnd();
  }, [callId, cleanup, onEnd]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let cid = initialCallId ?? null;

    async function init() {
      // Get local media
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        // fallback: audio only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setStatus("connected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          setStatus("ended");
          setTimeout(handleEnd, 1500);
        }
      };

      if (mode === "caller") {
        pc.onicecandidate = async (e) => {
          if (e.candidate && cid) {
            await addWebRTCIceCandidate(cid, "caller", e.candidate.toJSON());
          }
        };

        const offerDesc = await pc.createOffer();
        await pc.setLocalDescription(offerDesc);

        cid = await createWebRTCCall({
          callerUid: myUid,
          calleeUid: "",
          callerName: myName,
          calleeName: theirName,
          offer: offerDesc,
        });
        setCallId(cid);
        onCallId?.(cid);

        // Wait for answer
        const unsub = subscribeToWebRTCCall(cid, async (call) => {
          if (!call?.answer || pc.remoteDescription) return;
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
        });
        unsubs.push(unsub);

        // Watch callee ICE candidates
        const unsub2 = subscribeToWebRTCIceCandidates(cid, "callee", async (candidates) => {
          for (const c of candidates) {
            const key = JSON.stringify(c);
            if (addedCandidatesRef.current.has(key)) continue;
            addedCandidatesRef.current.add(key);
            if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
          }
        });
        unsubs.push(unsub2);

      } else {
        // callee
        pc.onicecandidate = async (e) => {
          if (e.candidate && cid) {
            await addWebRTCIceCandidate(cid, "callee", e.candidate.toJSON());
          }
        };

        if (offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answerDesc = await pc.createAnswer();
          await pc.setLocalDescription(answerDesc);
          if (cid) await answerWebRTCCall(cid, answerDesc);
        }

        if (cid) {
          // Watch caller ICE candidates
          const unsub = subscribeToWebRTCIceCandidates(cid, "caller", async (candidates) => {
            for (const c of candidates) {
              const key = JSON.stringify(c);
              if (addedCandidatesRef.current.has(key)) continue;
              addedCandidatesRef.current.add(key);
              if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
            }
          });
          unsubs.push(unsub);
        }
      }

      // Monitor call ended
      if (cid) {
        const unsub3 = subscribeToWebRTCCall(cid, (call) => {
          if (!call?.active && status !== "ended") {
            setStatus("ended");
            setTimeout(handleEnd, 1500);
          }
        });
        unsubs.push(unsub3);
      }
    }

    init().catch(console.error);

    return () => {
      unsubs.forEach((u) => u());
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicMuted((v) => !v);
  }

  function toggleCam() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamOff((v) => !v);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "#1b1b1e", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Remote video — full background */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: status === "connected" ? 1 : 0, transition: "opacity 0.3s" }}
      />

      {/* Connecting / ended overlay */}
      {status !== "connected" && (
        <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 64, color: status === "ended" ? "#ba1a1a" : "#9f376f", fontVariationSettings: "'FILL' 1", display: "block", marginBottom: 16 }}>
            {status === "ended" ? "call_end" : "videocam"}
          </span>
          <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 20, fontWeight: 900, color: "#fbf8fc", textTransform: "uppercase", marginBottom: 8 }}>
            {status === "ended" ? "CALL ENDED" : mode === "caller" ? `CALLING ${theirName.toUpperCase()}…` : `CONNECTING…`}
          </p>
          {status === "connecting" && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#9f376f", animation: `pulse 1.2s ${i * 0.4}s infinite` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Local video — PiP */}
      <div style={{ position: "absolute", bottom: 100, right: 16, width: 100, height: 140, border: "2px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", overflow: "hidden", zIndex: 3, backgroundColor: "#2a2a2e" }}>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: camOff ? "none" : "block" }} />
        {camOff && (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#544249" }}>videocam_off</span>
          </div>
        )}
      </div>

      {/* Name label */}
      {status === "connected" && (
        <div style={{ position: "absolute", top: 24, left: 16, zIndex: 3, backgroundColor: "rgba(27,27,30,0.7)", padding: "4px 12px", border: "1.5px solid rgba(255,255,255,0.15)" }}>
          <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontSize: 13, fontWeight: 700, color: "#fbf8fc", textTransform: "uppercase" }}>{theirName}</p>
        </div>
      )}

      {/* Controls */}
      <div style={{ position: "absolute", bottom: 32, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, zIndex: 4 }}>
        <button
          onClick={toggleMic}
          style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #1b1b1e", backgroundColor: micMuted ? "#ba1a1a" : "#fbf8fc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: micMuted ? "#fbf8fc" : "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
            {micMuted ? "mic_off" : "mic"}
          </span>
        </button>
        <button
          onClick={handleEnd}
          style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #ba1a1a", backgroundColor: "#ba1a1a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "3px 3px 0 #5e0b0b" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#fbf8fc", fontVariationSettings: "'FILL' 1" }}>call_end</span>
        </button>
        <button
          onClick={toggleCam}
          style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #1b1b1e", backgroundColor: camOff ? "#ba1a1a" : "#fbf8fc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: camOff ? "#fbf8fc" : "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>
            {camOff ? "videocam_off" : "videocam"}
          </span>
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
