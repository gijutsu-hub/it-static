"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Session } from "next-auth";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { doc, onSnapshot } from "firebase/firestore";
import {
  subscribeToSquads,
  subscribeToUsers,
  createSquad,
  joinSquad,
  upsertUser,
  subscribeToUserKYCStatus,
  issueTicket,
  subscribeToPhotoDrops,
  addPhotoDrop,
  createPhotoChallenge,
  subscribeToIncomingCall,
  subscribeToAllHints,
  subscribeToFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  getOrCreateDMChat,
  awardBadge,
  submitPhotoGuess,
  subscribeToMyNotifications,
  markAllNotificationsRead,
  subscribeToSquadPhotos,
  db,
  type Squad,
  type KYCSubmission,
  type UserProfile,
  type PhotoDrop,
  type WebRTCCall,
  type HuntHint,
  type FriendRequest,
  type PhotoChallenge,
  type AppNotification,
  type SquadPhoto,
} from "@/lib/firestore";
import { authReady, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import RecruitDirectory from "./RecruitDirectory";
import KYCFlow from "./KYCFlow";
import SquadChat from "./SquadChat";
import IntelPanel from "./IntelPanel";
import FriendsDirectory from "./FriendsDirectory";
import UserProfileModal from "./UserProfileModal";
import ExplorePanel from "./ExplorePanel";
import LeaderboardPanel from "./LeaderboardPanel";
import StorePanel from "./StorePanel";
import WebRTCCallComponent from "./WebRTCCall";
import { signOut } from "next-auth/react";
import QRCode from "qrcode";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://itstatic.app";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
const MAPS_MAP_ID = process.env.NEXT_PUBLIC_MAPS_MAP_ID ?? "DEMO_MAP_ID";

// distance between two lat/lng points in km (haversine approximation)
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const THEME_COLORS: Record<string, string> = {
  "K-POP VIBES": "#ff85c1",
  "TECH TALK": "#7ed4fd",
  "ROOFTOP BEATS": "#7ed4fd",
  "URBAN ART": "#ffe24c",
  "SKATE CREW": "#ffe24c",
  "RAVE SIGNAL": "#ff85c1",
  "CHILL ZONE": "#c0e8ff",
};

interface Props {
  session: Session;
}

export default function DiscoverClient({ session }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerMapRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const userMarkerRef =
    useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userLocMarkerMapRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const allUsersRef = useRef<UserProfile[]>([]);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [allSquads, setAllSquads] = useState<Squad[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [nearbySquads, setNearbySquads] = useState<Squad[]>([]);
  const [activeNav, setActiveNav] = useState<"squads" | "intel" | "recruits" | "kyc" | "friends" | "explore" | "store" | "leaderboard">(
    "squads"
  );
  const [kycSubmission, setKycSubmission] = useState<KYCSubmission | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null | undefined>(undefined);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostForm, setHostForm] = useState({ name: "", category: "", capacity: "10" });
  const [hostLocationMode, setHostLocationMode] = useState<"current" | "pick">("current");
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hosting, setHosting] = useState(false);
  const [hostedSquadId, setHostedSquadId] = useState<string | null>(null);
  const [successQrUrl, setSuccessQrUrl] = useState("");
  const [copiedEventLink, setCopiedEventLink] = useState(false);

  const [webRTCCall, setWebRTCCall] = useState<{ theirUid: string; theirName: string; mode: "caller" | "callee"; callId?: string; offer?: RTCSessionDescriptionInit } | null>(null);
  const [incomingCall, setIncomingCall] = useState<WebRTCCall | null>(null);
  const [photoDrops, setPhotoDrops] = useState<PhotoDrop[]>([]);
  const [showPhotoDropModal, setShowPhotoDropModal] = useState(false);
  const [photoDropCaption, setPhotoDropCaption] = useState("");
  const [photoDropFile, setPhotoDropFile] = useState<File | null>(null);
  const [photoDropUploading, setPhotoDropUploading] = useState(false);
  const photoDropMapMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const hintMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const photoDropFileRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoDrop, setSelectedPhotoDrop] = useState<PhotoDrop | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [huntHints, setHuntHints] = useState<HuntHint[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [guessMode, setGuessMode] = useState<{ challenge: PhotoChallenge } | null>(null);
  const [guessResult, setGuessResult] = useState<{ isCorrect: boolean; distanceMeters: number } | null>(null);
  const [guessSubmitting, setGuessSubmitting] = useState(false);
  const guessPinMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [squadPhotos, setSquadPhotos] = useState<SquadPhoto[]>([]);
  const squadPhotoMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  const AdvancedMarkerElementRef = useRef<typeof google.maps.marker.AdvancedMarkerElement | null>(null);
  const hostMapDivRef = useRef<HTMLDivElement>(null);
  const hostGoogleMapRef = useRef<google.maps.Map | null>(null);
  const hostPickerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const closeAllPanels = useCallback(() => {
    setNotifPanelOpen(false);
    setSettingsPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!notifPanelOpen && !settingsPanelOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifPanelOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsPanelOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifPanelOpen, settingsPanelOpen]);

  const user = session.user!;
  // Use email as stable UID since we use Next-Auth (not Firebase Auth)
  const uid = user.email ?? "anon";

  const mySquad = allSquads.find(
    (s) => s.memberUids?.includes(uid) || s.hostUid === uid
  ) ?? null;

  // ── Wait for Firebase anonymous auth before any Firestore calls ───────────
  useEffect(() => {
    authReady.then(() => setFirebaseReady(true));
  }, []);

  // ── Register user in Firestore immediately on mount ───────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    upsertUser(uid, {
      displayName: user.name ?? "Anonymous",
      photoURL: user.image ?? "",
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  // ── Subscribe to current user's KYC status for sidebar indicator ──────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToUserKYCStatus(uid, (sub) => {
      setKycSubmission(sub);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Subscribe to user profile for KYC approval gate ────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    const userDocRef = doc(db, "users", uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      const profile = snap.exists() ? (snap.data() as UserProfile) : null;
      setUserProfile(profile);
      if (profile?.kycStatus === "approved") {
        awardBadge(uid, "verified").catch(() => {});
      }
    }, () => {});
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Force KYC tab when profile loads and KYC is not approved ───────────────
  const kycApproved = userProfile?.kycStatus === "approved";
  useEffect(() => {
    if (userProfile !== undefined && !kycApproved) {
      setActiveNav("kyc");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.kycStatus]);

  // ── Request geolocation proactively on mount (before Maps loads) ──────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      setUserLocation({ lat: 1.3521, lng: 103.8198 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (googleMapRef.current) {
          googleMapRef.current.setCenter(loc);
          googleMapRef.current.setZoom(15);
          placeUserMarker(googleMapRef.current, loc);
        }
        if (firebaseReady) {
          upsertUser(uid, {
            displayName: user.name ?? "Anonymous",
            photoURL: user.image ?? "",
            location: loc,
          }).catch(() => {});
        }
      },
      () => {
        setLocationDenied(true);
        setUserLocation({ lat: 1.3521, lng: 103.8198 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load Google Maps ───────────────────────────────────────────────────────
  useEffect(() => {
    setOptions({ key: MAPS_API_KEY, v: "weekly" });
    Promise.all([
      importLibrary("maps"),
      importLibrary("marker").then((lib: any) => {
        AdvancedMarkerElementRef.current = lib.AdvancedMarkerElement;
      }),
    ]).then(() => setMapsReady(true));
  }, []);

  // ── Initialize map once ready ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || googleMapRef.current) return;

    let cancelled = false;
    importLibrary("maps").then(({ Map }) => {
      if (cancelled || !mapDivRef.current) return;
      initMap(Map);
    });
    return () => { cancelled = true; };
  }, [mapsReady]);

  function initMap(Map: typeof google.maps.Map) {
    if (!mapDivRef.current) return;
    const center = userLocation ?? { lat: 1.3521, lng: 103.8198 };
    const map = new Map(mapDivRef.current, {
      center,
      zoom: userLocation ? 15 : 14,
      mapId: MAPS_MAP_ID,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });
    googleMapRef.current = map;
    if (userLocation) placeUserMarker(map, userLocation);
    if (allUsersRef.current.length > 0) {
      updateUserLocationMarkers(allUsersRef.current, map);
    }
    setMapInitialized(true);
  }

  // ── Subscribe to all squads from Firestore ─────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToSquads((squads) => {
      setAllSquads(squads);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  // ── Subscribe to all other users for live location markers ─────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeToUsers(uid, (users) => {
      allUsersRef.current = users;
      setAllUsers(users);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Subscribe to photo drops ───────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToPhotoDrops(setPhotoDrops);
  }, [firebaseReady]);

  // ── Listen for incoming WebRTC calls ───────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToIncomingCall(uid, (call) => {
      if (call && !webRTCCall) setIncomingCall(call);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Subscribe to all hunt hints for map markers ────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToAllHints(setHuntHints);
  }, [firebaseReady]);

  // ── Subscribe to friend requests (for profile modal status) ───────────────
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToFriendRequests(uid, setFriendRequests);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── 5-minute GPS location refresh interval ────────────────────────────────
  useEffect(() => {
    if (!firebaseReady || !("geolocation" in navigator)) return;
    const id = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (userMarkerRef.current) userMarkerRef.current.position = loc;
          upsertUser(uid, {
            displayName: user.name ?? "Anonymous",
            photoURL: user.image ?? "",
            location: loc,
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  // ── Subscribe to squad photos for map markers ─────────────────────────────
  useEffect(() => {
    if (!firebaseReady || !mySquad) return;
    return subscribeToSquadPhotos(mySquad.id, setSquadPhotos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady, mySquad?.id]);

  // ── Request notification permission on mount ─────────────────────────────
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Subscribe to in-app notifications ─────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeToMyNotifications(uid, (notifs) => {
      setAppNotifications(notifs);
      // Fire browser notification for new unread items
      const unread = notifs.filter((n) => !n.read);
      if (unread.length > 0 && Notification.permission === "granted") {
        const latest = unread[0];
        try {
          new Notification(latest.title, {
            body: latest.body,
            icon: "/icons/icon-192x192.png",
          });
        } catch { /* ignore */ }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, firebaseReady]);

  // ── Update user location markers whenever users list changes ──────────────
  useEffect(() => {
    if (!googleMapRef.current) return;
    updateUserLocationMarkers(allUsers, googleMapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers]);

  // ── Photo drop markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = googleMapRef.current;
    const AME = AdvancedMarkerElementRef.current;
    if (!map || !AME) return;

    const currentIds = new Set(photoDrops.map((d) => d.id));
    photoDropMapMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { (marker as any).map = null; photoDropMapMarkersRef.current.delete(id); }
    });

    photoDrops.forEach((drop) => {
      if (photoDropMapMarkersRef.current.has(drop.id)) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      wrap.innerHTML = `
        <div style="background:#1b1b1e;border:3px solid #ffe24c;box-shadow:4px 4px 0 #ffe24c;overflow:hidden;max-width:160px;">
          <img src="${drop.imageURL}" style="width:160px;height:90px;object-fit:cover;display:block;" />
          <div style="padding:4px 8px;">
            <div style="color:#ffe24c;font-size:9px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${drop.displayName}</div>
            <div style="color:#aaa;font-size:8px;font-weight:600;white-space:nowrap;">@ ${drop.location.lat.toFixed(4)}, ${drop.location.lng.toFixed(4)}</div>
          </div>
        </div>
        <div style="width:2px;height:10px;background:#ffe24c;"></div>
        <div style="width:6px;height:3px;background:#ffe24c;opacity:0.6;border-radius:999px;"></div>`;
      const marker = new AME({ map, position: drop.location, content: wrap, zIndex: 8 });
      wrap.addEventListener("click", () => {
        setSelectedPhotoDrop(drop);
      });
      photoDropMapMarkersRef.current.set(drop.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoDrops, mapInitialized]);

  // ── Squad photo map markers ───────────────────────────────────────────────
  useEffect(() => {
    const map = googleMapRef.current;
    const AME = AdvancedMarkerElementRef.current;
    if (!map || !AME) return;

    const currentIds = new Set(squadPhotos.map((p) => p.id));
    squadPhotoMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { (marker as any).map = null; squadPhotoMarkersRef.current.delete(id); }
    });

    squadPhotos.forEach((photo) => {
      if (squadPhotoMarkersRef.current.has(photo.id)) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      wrap.innerHTML = `
        <div style="background:#005b78;border:3px solid #7ed4fd;box-shadow:4px 4px 0 #005b78;overflow:hidden;max-width:140px;">
          <img src="${photo.imageURL}" style="width:140px;height:80px;object-fit:cover;display:block;" />
          <div style="padding:4px 8px;">
            <div style="color:#7ed4fd;font-size:8px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📸 ${photo.displayName}</div>
          </div>
        </div>
        <div style="width:2px;height:10px;background:#7ed4fd;"></div>
        <div style="width:6px;height:3px;background:#7ed4fd;opacity:0.6;border-radius:999px;"></div>`;
      const marker = new AME({ map, position: photo.location, content: wrap, zIndex: 9 });
      wrap.addEventListener("click", () => {
        setSelectedPhotoDrop({
          id: photo.id, uid: photo.uid, displayName: photo.displayName,
          photoURL: photo.userPhotoURL, imageURL: photo.imageURL,
          storagePath: photo.storagePath, location: photo.location,
          caption: photo.caption, createdAt: photo.createdAt,
          expiresAt: photo.createdAt,
        });
      });
      squadPhotoMarkersRef.current.set(photo.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadPhotos, mapInitialized]);

  // ── Browser notification on incoming call ────────────────────────────────
  useEffect(() => {
    if (!incomingCall) return;
    if (Notification.permission === "granted") {
      try {
        new Notification("📞 INCOMING CALL", {
          body: `${incomingCall.callerName} is calling you`,
          icon: "/icons/icon-192x192.png",
        });
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall?.id]);

  // ── Treasure hunt hint markers ─────────────────────────────────────────────
  useEffect(() => {
    const map = googleMapRef.current;
    const AME = AdvancedMarkerElementRef.current;
    if (!map || !AME) return;

    const currentIds = new Set(huntHints.map((h) => h.id));
    hintMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { (marker as any).map = null; hintMarkersRef.current.delete(id); }
    });

    huntHints.forEach((hint) => {
      if (hintMarkersRef.current.has(hint.id)) return;
      const dist = userLocation ? Math.round(
        6371000 * 2 * Math.atan2(
          Math.sqrt(Math.sin(((hint.location.lat - userLocation.lat) * Math.PI / 180) / 2) ** 2 +
            Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(hint.location.lat * Math.PI / 180) *
            Math.sin(((hint.location.lng - userLocation.lng) * Math.PI / 180) / 2) ** 2),
          Math.sqrt(1 - (Math.sin(((hint.location.lat - userLocation.lat) * Math.PI / 180) / 2) ** 2 +
            Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(hint.location.lat * Math.PI / 180) *
            Math.sin(((hint.location.lng - userLocation.lng) * Math.PI / 180) / 2) ** 2))
        )
      ) : null;
      const inRange = dist !== null && dist <= hint.radiusMeters;

      const el = document.createElement("div");
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      el.innerHTML = `
        <div style="width:40px;height:40px;border-radius:50%;background:${inRange ? "#ffe24c" : "#1b1b1e"};border:3px solid ${inRange ? "#1b1b1e" : "#ffe24c"};box-shadow:4px 4px 0 ${inRange ? "#1b1b1e" : "#ffe24c"};display:flex;align-items:center;justify-content:center;${inRange ? "animation:pulse2 1.2s infinite;" : ""}">
          <span style="font-size:20px;">${inRange ? "🎁" : "🔒"}</span>
        </div>
        <div style="width:2px;height:10px;background:#1b1b1e;"></div>
        <div style="width:6px;height:3px;background:#1b1b1e;opacity:0.4;border-radius:999px;"></div>`;

      const marker = new AME({ map, position: hint.location, content: el, zIndex: 15 });
      hintMarkersRef.current.set(hint.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntHints, mapInitialized, userLocation]);

  // ── Filter nearby squads and update map markers ────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const nearby = allSquads.filter(
      (s) =>
        distanceKm(
          userLocation.lat,
          userLocation.lng,
          s.location.lat,
          s.location.lng
        ) <= 5
    );
    setNearbySquads(nearby);
    if (googleMapRef.current) {
      updateMapMarkers(nearby, googleMapRef.current);
    }
  }, [allSquads, userLocation]);

  function placeUserMarker(
    map: google.maps.Map,
    loc: { lat: number; lng: number }
  ) {
    if (!AdvancedMarkerElementRef.current) return;
    const AdvancedMarkerElement = AdvancedMarkerElementRef.current;

    const el = document.createElement("div");
    el.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:0;";
    el.innerHTML = `
      <div style="background:#ff85c1;border:3px solid #1b1b1e;box-shadow:4px 4px 0 #1b1b1e;padding:6px 12px;border-radius:12px;display:flex;align-items:center;gap:8px;white-space:nowrap;">
        <img src="${user.image ?? ""}" style="width:24px;height:24px;border-radius:50%;border:2px solid #1b1b1e;flex-shrink:0;" />
        <span style="font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:11px;color:#1b1b1e;text-transform:uppercase;">YOU</span>
      </div>
      <div style="width:3px;height:14px;background:#1b1b1e;"></div>
      <div style="width:8px;height:4px;background:#1b1b1e;opacity:0.4;border-radius:999px;"></div>`;

    userMarkerRef.current = new AdvancedMarkerElement({
      map,
      position: loc,
      content: el,
      title: "You",
      zIndex: 100,
    });
  }

  function updateMapMarkers(squads: Squad[], map: google.maps.Map) {
    if (!AdvancedMarkerElementRef.current) return;
    const AdvancedMarkerElement = AdvancedMarkerElementRef.current;

    const currentIds = new Set(squads.map((s) => s.id));

    // Remove stale markers
    markerMapRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        (marker as any).map = null;
        markerMapRef.current.delete(id);
      }
    });

    // Add new markers
    squads.forEach((squad) => {
      if (markerMapRef.current.has(squad.id)) return;

      const bg = THEME_COLORS[squad.theme] ?? "#ffe24c";
      const memberCount = squad.memberUids?.length ?? 0;

      const el = document.createElement("div");
      el.style.cssText =
        "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      el.innerHTML = `
        <div style="background:${bg};border:3px solid #1b1b1e;box-shadow:5px 5px 0 #1b1b1e;padding:8px 14px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px;transition:transform 0.15s;">
          <span style="font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:11px;color:#1b1b1e;text-transform:uppercase;letter-spacing:0.04em;">${squad.name}</span>
          <span style="background:white;border:1.5px solid #1b1b1e;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:700;font-family:var(--font-quicksand),'Quicksand',sans-serif;color:#1b1b1e;">${memberCount} / ${squad.capacity} active</span>
        </div>
        <div style="width:3px;height:18px;background:#1b1b1e;"></div>
        <div style="width:10px;height:5px;background:#1b1b1e;opacity:0.3;border-radius:999px;"></div>`;

      const marker = new AdvancedMarkerElement({
        map,
        position: squad.location,
        content: el,
        title: squad.name,
      });

      el.addEventListener("click", () => setSelectedSquad(squad));
      markerMapRef.current.set(squad.id, marker);
    });
  }

  function updateUserLocationMarkers(users: UserProfile[], map: google.maps.Map) {
    if (!AdvancedMarkerElementRef.current) return;
    const AdvancedMarkerElement = AdvancedMarkerElementRef.current;

    const usersWithLoc = users.filter((u) => u.location);
    const currentEmails = new Set(usersWithLoc.map((u) => u.email));
    const nowMs = Date.now();

    // Remove stale markers
    userLocMarkerMapRef.current.forEach((marker, email) => {
      if (!currentEmails.has(email)) {
        (marker as any).map = null;
        userLocMarkerMapRef.current.delete(email);
      }
    });

    // Always recreate markers to reflect updated LIVE status
    usersWithLoc.forEach((person) => {
      if (!person.location) return;
      const existing = userLocMarkerMapRef.current.get(person.email);
      if (existing) {
        (existing as any).map = null;
        userLocMarkerMapRef.current.delete(person.email);
      }

      const lastSeenMs = person.lastSeen?.toMillis?.() ?? 0;
      const isLive = nowMs - lastSeenMs < 6 * 60 * 1000; // seen within 6 min
      const initial = (person.displayName || "?").charAt(0).toUpperCase();

      const el = document.createElement("div");
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:0;";
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          ${isLive ? `<div style="background:#4caf50;color:white;font-size:7px;font-weight:900;text-transform:uppercase;padding:1px 5px;border:1.5px solid #1b1b1e;letter-spacing:0.05em;margin-bottom:2px;">LIVE</div>` : ""}
          <div style="position:relative;width:40px;height:40px;border-radius:50%;border:3px solid ${isLive ? "#4caf50" : "#1b1b1e"};box-shadow:3px 3px 0 ${isLive ? "#4caf50" : "#1b1b1e"};overflow:hidden;background:#ffd8e7;flex-shrink:0;">
            ${person.photoURL
              ? `<img src="${person.photoURL}" style="width:100%;height:100%;object-fit:cover;" />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#9f376f;font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;">${initial}</div>`
            }
          </div>
        </div>
        <div style="width:3px;height:10px;background:#1b1b1e;"></div>
        <div style="width:8px;height:4px;background:#1b1b1e;opacity:0.35;border-radius:999px;"></div>`;

      const marker = new AdvancedMarkerElement({
        map,
        position: person.location,
        content: el,
        title: person.displayName || "User",
      });

      el.addEventListener("click", () => {
        setSelectedUserProfile(person);
      });

      userLocMarkerMapRef.current.set(person.email, marker);
    });
  }

  async function handleJoin(squad: Squad) {
    if (squad.memberUids?.includes(uid)) return;
    if ((squad.memberUids?.length ?? 0) >= squad.capacity) return;
    setJoining(squad.id);
    try {
      await joinSquad(squad.id, uid);
      await issueTicket(squad.id, squad.name, {
        uid,
        name: user.name ?? "Anonymous",
        photoURL: user.image ?? "",
      }).catch(() => {});
      awardBadge(uid, "pioneer").catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setJoining(null);
      setSelectedSquad(null);
    }
  }

  function getFriendStatus(theirUid: string): "none" | "sent" | "received" | "friends" {
    const req = friendRequests.find((r) => r.participants.includes(theirUid));
    if (!req) return "none";
    if (req.status === "accepted") return "friends";
    if (req.status === "pending" && req.fromUid === uid) return "sent";
    if (req.status === "pending" && req.toUid === uid) return "received";
    return "none";
  }

  async function handlePhotoDrop() {
    if (!photoDropFile || !userLocation) return;
    setPhotoDropUploading(true);
    try {
      const path = `photoDrops/${uid}/${Date.now()}_${photoDropFile.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, photoDropFile);
      const imageURL = await getDownloadURL(sRef);
      await addPhotoDrop({
        uid,
        displayName: user.name ?? "Anonymous",
        photoURL: user.image ?? "",
        imageURL,
        storagePath: path,
        location: userLocation,
        caption: photoDropCaption.trim().slice(0, 150),
      });
      // Also create a photo challenge for others to guess
      await createPhotoChallenge({
        uid,
        displayName: user.name ?? "Anonymous",
        photoURL: user.image ?? "",
        imageURL,
        storagePath: path,
        location: userLocation,
        caption: photoDropCaption.trim().slice(0, 150),
      });
      awardBadge(uid, "explorer").catch(() => {});
      setShowPhotoDropModal(false);
      setPhotoDropCaption("");
      setPhotoDropFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setPhotoDropUploading(false);
    }
  }

  async function handleSubmitGuess() {
    if (!guessMode || !googleMapRef.current) return;
    const center = googleMapRef.current.getCenter();
    if (!center) return;
    const pinLocation = { lat: center.lat(), lng: center.lng() };
    setGuessSubmitting(true);
    try {
      const result = await submitPhotoGuess(
        guessMode.challenge.id,
        uid,
        user.name ?? "Anonymous",
        pinLocation
      );
      setGuessResult({ isCorrect: result.isCorrect, distanceMeters: result.distanceMeters });
    } catch (e) {
      console.error(e);
    } finally {
      setGuessSubmitting(false);
    }
  }

  const totalActiveNodes = allSquads.reduce(
    (acc, s) => acc + (s.memberUids?.length ?? 0),
    0
  );

  const SQUAD_THEMES = Object.keys(THEME_COLORS);

  async function handleHostSquad() {
    if (!hostForm.name.trim() || !hostForm.category) return;
    const loc = userLocation ?? { lat: 1.3521, lng: 103.8198 };
    setHosting(true);
    try {
      const squadId = await createSquad({
        name: hostForm.name.trim().toUpperCase(),
        theme: hostForm.category,
        category: hostForm.category,
        hostUid: uid,
        hostName: user.name ?? "Anonymous",
        hostPhotoURL: user.image ?? "",
        location: loc,
        address: "",
        capacity: parseInt(hostForm.capacity) || 10,
        memberUids: [uid],
        active: true,
      });
      setHostedSquadId(squadId);
      awardBadge(uid, "host").catch(() => {});
      const url = `${BASE_URL}/event/${squadId}`;
      const qrUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
      setSuccessQrUrl(qrUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setHosting(false);
    }
  }

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ fontFamily: "var(--font-quicksand),'Quicksand',sans-serif", backgroundColor: "#fbf8fc" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        className="discover-header"
        style={{
          position: "fixed", top: 0, left: 0, width: "100%", zIndex: 50,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#fbf8fc",
          borderBottom: "4px solid #1b1b1e",
          boxShadow: "4px 4px 0 rgba(27,27,30,1)",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="IT'S STATIC" style={{ height: 44, filter: "drop-shadow(2px 2px 0px #1b1b1e)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Notifications */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setNotifPanelOpen(v => !v);
                setSettingsPanelOpen(false);
                if (!notifPanelOpen && appNotifications.some(n => !n.read)) {
                  markAllNotificationsRead(uid).catch(() => {});
                }
              }}
              aria-label="Notifications"
              style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", color: "#9f376f", padding: 8, background: "none", border: "none", cursor: "pointer", borderRadius: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>notifications</span>
              {(appNotifications.some(n => !n.read) || kycSubmission?.status === "rejected") && (
                <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ba1a1a", border: "1.5px solid #fbf8fc" }} />
              )}
              {kycSubmission?.status === "pending" && !notifPanelOpen && !appNotifications.some(n => !n.read) && (
                <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", backgroundColor: "#c7ad07", border: "1.5px solid #fbf8fc" }} />
              )}
            </button>
            {notifPanelOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 300, backgroundColor: "#fbf8fc", border: "3px solid #1b1b1e", boxShadow: "6px 6px 0 #1b1b1e", zIndex: 200, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "2px solid #1b1b1e", backgroundColor: "#ffd8e7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 900, fontSize: 12, textTransform: "uppercase", color: "#3d0025", letterSpacing: "0.04em" }}>NOTIFICATIONS</p>
                  {appNotifications.some(n => !n.read) && (
                    <button onClick={() => markAllNotificationsRead(uid).catch(() => {})} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#9f376f", textTransform: "uppercase", fontFamily: "inherit" }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {userProfile?.kycStatus === "approved" && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", backgroundColor: "#c8f7c5", border: "2px solid #1b1b1e", borderRadius: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#4caf50", flexShrink: 0 }}>verified_user</span>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: "#1b1b1e" }}>Identity Verified</p>
                        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Your KYC was approved. Full access granted.</p>
                      </div>
                    </div>
                  )}
                  {kycSubmission?.status === "rejected" && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", backgroundColor: "#ffd8e7", border: "2px solid #ba1a1a", borderRadius: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#ba1a1a", flexShrink: 0 }}>cancel</span>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: "#ba1a1a" }}>Verification Rejected</p>
                        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Please resubmit your identity verification.</p>
                      </div>
                    </div>
                  )}
                  {kycSubmission?.status === "pending" && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", backgroundColor: "#ffe24c", border: "2px solid #1b1b1e", borderRadius: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1b1b1e", flexShrink: 0 }}>pending</span>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: "#1b1b1e" }}>Verification Pending</p>
                        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>Under review. We&apos;ll notify you when done.</p>
                      </div>
                    </div>
                  )}
                  {appNotifications.slice(0, 10).map((notif) => (
                    <div key={notif.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", backgroundColor: notif.read ? "#fbf8fc" : "#ffd8e7", border: "2px solid #1b1b1e", borderRadius: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#9f376f", flexShrink: 0 }}>notifications_active</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: "#1b1b1e" }}>{notif.title}</p>
                        <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginTop: 2 }}>{notif.body}</p>
                      </div>
                      {!notif.read && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#9f376f", flexShrink: 0, marginTop: 4 }} />}
                    </div>
                  ))}
                  {appNotifications.length === 0 && !kycSubmission && userProfile?.kycStatus !== "approved" && (
                    <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, textAlign: "center", padding: "8px 0" }}>No new notifications</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Friends shortcut */}
          <button
            onClick={() => { setActiveNav("friends"); closeAllPanels(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", color: activeNav === "friends" ? "#791651" : "#9f376f", padding: 8, background: activeNav === "friends" ? "#ffd8e7" : "none", border: "none", cursor: "pointer", borderRadius: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: activeNav === "friends" ? "'FILL' 1" : "'FILL' 0" }}>diversity_3</span>
          </button>

          {/* Settings / user pill */}
          <div ref={settingsRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setSettingsPanelOpen(v => !v); setNotifPanelOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: settingsPanelOpen ? "#ffc1d9" : "#ffd8e7", border: "2px solid #1b1b1e", padding: "6px 10px", borderRadius: 8, cursor: "pointer", transition: "background 0.1s" }}
            >
              <span className="hidden sm:block" style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.02em", textTransform: "uppercase", color: "#3d0025" }}>
                {(user.name ?? "COMMANDER").toUpperCase().replace(/ /g, "_")}
              </span>
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="Profile" style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #1b1b1e", flexShrink: 0 }} />
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#3d0025" }}>
                {settingsPanelOpen ? "expand_less" : "expand_more"}
              </span>
            </button>
            {settingsPanelOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 200, backgroundColor: "#fbf8fc", border: "3px solid #1b1b1e", boxShadow: "6px 6px 0 #1b1b1e", zIndex: 200, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "14px 12px", borderBottom: "2px solid #1b1b1e", textAlign: "center" }}>
                  {user.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="Profile" style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #1b1b1e", display: "block", margin: "0 auto 8px" }} />
                  )}
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#1b1b1e", textTransform: "uppercase", letterSpacing: "0.02em" }}>{user.name}</p>
                  <p style={{ fontSize: 11, color: "#544249", marginTop: 2 }}>{user.email}</p>
                  {userProfile?.kycStatus === "approved" && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "2px 8px", backgroundColor: "#c8f7c5", border: "1.5px solid #1b1b1e", borderRadius: 999 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: "#4caf50" }}>verified</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#4caf50", textTransform: "uppercase" }}>VERIFIED</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <button
                    onClick={() => signOut({ callbackUrl: "/auth" })}
                    style={{ width: "100%", padding: "10px 12px", backgroundColor: "#ffd8e7", border: "2px solid #1b1b1e", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#ba1a1a", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                    SIGN OUT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside
        className="discover-sidebar"
        style={{
          position: "fixed", left: 0, top: 0, height: "100%", width: 320,
          backgroundColor: "#7ed4fd", flexDirection: "column",
          zIndex: 40, borderRight: "4px solid #1b1b1e",
          boxShadow: "8px 0 0 rgba(0,102,134,1)",
          paddingTop: 88, paddingBottom: 32, overflowY: "auto",
        }}
      >
        {/* Operations box */}
        <div style={{ padding: "0 24px", marginBottom: 24 }}>
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              padding: 16, boxShadow: "4px 4px 0 #1b1b1e", borderRadius: 12,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 900, color: "#1b1b1e", textTransform: "uppercase",
              }}
            >
              OPERATIONS
            </h2>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 700, marginTop: 2 }}>
              Active Nodes: {totalActiveNodes}
            </p>
          </div>

          {/* KYC required banner */}
          {userProfile !== undefined && !kycApproved && (
            <div
              style={{
                marginTop: 12,
                backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
                boxShadow: "3px 3px 0 #1b1b1e", padding: "10px 14px", borderRadius: 8,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1b1b1e", flexShrink: 0, marginTop: 1 }}>
                lock
              </span>
              <div>
                <p style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 2 }}>
                  IDENTITY REQUIRED
                </p>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#544249", lineHeight: 1.4 }}>
                  Complete VERIFY ID to unlock all features.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 16px" }}>
          {[
            { icon: mySquad ? "chat" : "groups", label: mySquad ? "SQUAD CHAT" : "Squads", key: "squads" },
            { icon: "fingerprint", label: "VERIFY ID", key: "kyc" },
            { icon: "person_search", label: "Recruits", key: "recruits" },
            { icon: "diversity_3", label: "Friends", key: "friends" },
            { icon: "article", label: "Intel", key: "intel" },
            { icon: "explore", label: "EXPLORE", key: "explore" },
            { icon: "leaderboard", label: "LEADERBOARD", key: "leaderboard" },
            { icon: "storefront", label: "STORE", key: "store" },
          ].map((item) => {
            const isActive = activeNav === item.key;
            const isKyc = item.key === "kyc";
            const isLocked = !kycApproved && item.key !== "kyc";

            // Determine KYC indicator
            let kycIndicator: React.ReactNode = null;
            if (isKyc && kycSubmission !== undefined) {
              if (kycApproved) {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4caf50", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#4caf50", textTransform: "uppercase" }}>VERIFIED</span>
                  </span>
                );
              } else if (kycSubmission?.status === "pending") {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#c7ad07", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#544249", textTransform: "uppercase" }}>(PENDING)</span>
                  </span>
                );
              } else if (kycSubmission?.status === "rejected") {
                kycIndicator = (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ba1a1a", border: "1.5px solid #1b1b1e", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#ba1a1a", textTransform: "uppercase" }}>REJECTED</span>
                  </span>
                );
              }
            }

            return (
              <button
                key={item.key}
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  closeAllPanels();
                  setActiveNav(item.key as typeof activeNav);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 8,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  textAlign: "left", width: "100%", fontWeight: 700,
                  fontSize: 14, textTransform: "uppercase", letterSpacing: "0.02em",
                  fontFamily: "inherit", transition: "all 0.12s",
                  backgroundColor: isActive ? "#ffe24c" : "transparent",
                  color: isLocked ? "#7aafbf" : isActive ? "#211b00" : "#005b78",
                  border: isActive ? "2px solid #1b1b1e" : "2px solid transparent",
                  boxShadow: isActive ? "4px 4px 0 #1b1b1e" : "none",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {isLocked ? "lock" : item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {kycIndicator}
                {item.key === "store" && (userProfile?.points ?? 0) > 0 && (
                  <span style={{ backgroundColor: "#ffe24c", border: "1px solid #1b1b1e", padding: "1px 6px", fontSize: 9, fontWeight: 800, borderRadius: 2 }}>
                    {userProfile?.points ?? 0}⭐
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Nearby squads list */}
        <div style={{ marginTop: 24, padding: "0 16px" }}>
          <div style={{ borderTop: "4px solid #1b1b1e", paddingTop: 20 }}>
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              Squads Nearby
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nearbySquads.length === 0 && (
                <p style={{ color: "#544249", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                  No squads nearby yet.{"\n"}Host the first one!
                </p>
              )}
              {nearbySquads.map((squad) => {
                const isMember = squad.memberUids?.includes(uid);
                const isFull = (squad.memberUids?.length ?? 0) >= squad.capacity;
                return (
                  <div
                    key={squad.id}
                    style={{
                      backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
                      padding: "10px 12px", boxShadow: "4px 4px 0 #1b1b1e",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          border: "2px solid #1b1b1e",
                          backgroundColor: THEME_COLORS[squad.theme] ?? "#ffe24c",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, display: "block" }}>
                          {squad.name}
                        </span>
                        <span style={{ fontSize: 11, color: "#544249", fontWeight: 600 }}>
                          {squad.memberUids?.length ?? 0}/{squad.capacity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoin(squad)}
                      disabled={isMember || isFull || joining === squad.id}
                      style={{
                        backgroundColor: isMember ? "#e4e1e6" : "#9f376f",
                        color: isMember ? "#544249" : "white",
                        border: "2px solid #1b1b1e",
                        padding: "4px 12px", fontWeight: 700, fontSize: 11,
                        textTransform: "uppercase", cursor: isMember || isFull ? "default" : "pointer",
                        boxShadow: isMember ? "none" : "3px 3px 0 #1b1b1e",
                        fontFamily: "inherit", borderRadius: 2,
                        opacity: isFull && !isMember ? 0.5 : 1,
                      }}
                    >
                      {joining === squad.id ? "..." : isMember ? "IN" : isFull ? "FULL" : "JOIN"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <main
        className="discover-main"
        style={{
          flex: 1, position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Squad Chat — shown when squads tab active and user is in a squad */}
        {activeNav === "squads" && mySquad && kycApproved && (
          <div className="discover-overlay-panel">
            <SquadChat
              squad={mySquad}
              uid={uid}
              displayName={user.name ?? "Anonymous"}
              photoURL={user.image ?? ""}
              userLocation={userLocation}
              onVideoCall={(_squadId) => {
                if (!mySquad) return;
                setWebRTCCall({ theirUid: "", theirName: "SQUAD", mode: "caller" });
              }}
            />
          </div>
        )}

        {/* Recruit Directory — shown when recruits tab is active */}
        {activeNav === "recruits" && (
          <div className="discover-overlay-panel">
            <RecruitDirectory uid={uid} />
          </div>
        )}

        {/* Intel Panel — shown when intel tab is active */}
        {activeNav === "intel" && (
          <div className="discover-overlay-panel">
            <IntelPanel uid={uid} />
          </div>
        )}

        {/* KYC Flow — shown when kyc tab is active */}
        {activeNav === "kyc" && (
          <div className="discover-overlay-panel">
            <KYCFlow
              uid={uid}
              displayName={user.name ?? ""}
              profilePhotoURL={user.image ?? ""}
            />
          </div>
        )}

        {/* Friends Directory — shown when friends tab is active */}
        {activeNav === "friends" && (
          <div className="discover-overlay-panel">
            <FriendsDirectory
              uid={uid}
              displayName={user.name ?? ""}
              photoURL={user.image ?? ""}
              allUsers={allUsers}
              onCall={(theirUid, theirName) => setWebRTCCall({ theirUid, theirName, mode: "caller" })}
            />
          </div>
        )}

        {/* Explore panel (Hunts + Challenges) */}
        {activeNav === "explore" && !guessMode && (
          <div className="discover-overlay-panel">
            <ExplorePanel
              uid={uid}
              userLocation={userLocation}
              userPoints={userProfile?.points ?? 0}
              onStartGuess={(challenge) => {
                setGuessMode({ challenge });
                setGuessResult(null);
              }}
            />
          </div>
        )}

        {/* Leaderboard panel */}
        {activeNav === "leaderboard" && (
          <div className="discover-overlay-panel">
            <LeaderboardPanel myUid={uid} />
          </div>
        )}

        {/* Store panel */}
        {activeNav === "store" && (
          <div className="discover-overlay-panel">
            <StorePanel uid={uid} userProfile={userProfile ?? null} onPointsUpdate={() => {}} />
          </div>
        )}

        {/* Google Map — kept mounted for Google Maps lifecycle, hidden when overlay panels are active */}
        {(() => {
          const panelActive = (activeNav === "recruits" || activeNav === "kyc" || activeNav === "intel" ||
            activeNav === "friends" || activeNav === "leaderboard" ||
            activeNav === "store" || (activeNav === "explore" && !guessMode) ||
            (activeNav === "squads" && !!mySquad && kycApproved));
          return (
            <div
              ref={mapDivRef}
              style={{
                width: "100%",
                height: "100%",
                visibility: panelActive ? "hidden" : "visible",
                pointerEvents: panelActive ? "none" : "auto",
              }}
            />
          );
        })()}

        {/* Guess mode overlay */}
        {guessMode && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
            {/* Targeting crosshair */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
              <div style={{ width: 40, height: 40, position: "relative" }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "#9f376f", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "#9f376f", transform: "translateX(-50%)" }} />
                <div style={{ position: "absolute", inset: 4, borderRadius: "50%", border: "2px solid #9f376f" }} />
              </div>
            </div>

            {/* Top: challenge preview */}
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1b1b1e", border: "3px solid #ffe24c", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto", maxWidth: 320 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={guessMode.challenge.imageURL} alt="" style={{ width: 48, height: 48, objectFit: "cover", border: "2px solid #ffe24c", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#ffe24c", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>WHERE WAS THIS TAKEN?</p>
                <p style={{ color: "#aaa", fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Move the map, then drop your pin</p>
              </div>
              <button onClick={() => { setGuessMode(null); setGuessResult(null); setActiveNav("explore"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 4, flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Bottom: submit button */}
            <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: "calc(100% - 48px)", maxWidth: 400 }}>
              {guessResult ? (
                <div style={{ background: guessResult.isCorrect ? "#c8f7c5" : "#ffd8e7", border: "3px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", padding: "16px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 4 }}>
                    {guessResult.isCorrect ? "🎯 CORRECT!" : `📍 ${guessResult.distanceMeters}m away`}
                  </p>
                  <p style={{ fontSize: 12, color: "#544249", fontWeight: 600, marginBottom: 12 }}>
                    {guessResult.isCorrect ? "You earned +10 points!" : "Better luck next time!"}
                  </p>
                  <button
                    onClick={() => { setGuessMode(null); setGuessResult(null); setActiveNav("explore"); }}
                    style={{ padding: "10px 24px", background: "#9f376f", color: "white", border: "2px solid #1b1b1e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer", boxShadow: "3px 3px 0 #1b1b1e", fontFamily: "inherit" }}
                  >
                    BACK TO CHALLENGES
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSubmitGuess}
                  disabled={guessSubmitting}
                  style={{
                    width: "100%", padding: "16px", background: guessSubmitting ? "#e4e1e6" : "#9f376f",
                    color: "white", border: "3px solid #1b1b1e", fontWeight: 900, fontSize: 16,
                    textTransform: "uppercase", cursor: guessSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  {guessSubmitting ? "SUBMITTING…" : "DROP PIN HERE"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {!mapsReady && activeNav !== "recruits" && activeNav !== "kyc" && activeNav !== "intel" && activeNav !== "friends" && activeNav !== "leaderboard" && activeNav !== "store" && !(activeNav === "explore" && !guessMode) && !(activeNav === "squads" && !!mySquad && kycApproved) && (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#f6f2f7", zIndex: 10,
            }}
          >
            <div
              style={{
                border: "4px solid #1b1b1e", backgroundColor: "#fbf8fc",
                padding: 32, boxShadow: "8px 8px 0 #1b1b1e", textAlign: "center",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 48, color: "#9f376f", display: "block", marginBottom: 16 }}
              >
                radar
              </span>
              <p
                style={{
                  fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                  fontSize: 20, fontWeight: 700, textTransform: "uppercase",
                }}
              >
                Booting signal map...
              </p>
            </div>
          </div>
        )}

        {/* Location denied notice */}
        {locationDenied && !guessMode && activeNav !== "recruits" && activeNav !== "kyc" && activeNav !== "intel" && activeNav !== "friends" && activeNav !== "leaderboard" && activeNav !== "store" && !(activeNav === "explore" && !guessMode) && !(activeNav === "squads" && !!mySquad && kycApproved) && (
          <div
            style={{
              position: "absolute", top: 16, left: "50%",
              transform: "translateX(-50%)", zIndex: 20,
              backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
              boxShadow: "4px 4px 0 #1b1b1e", padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1b1b1e" }}>
              location_off
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#1b1b1e" }}>
              Location denied — showing default area
            </span>
          </div>
        )}

        {/* ── PHOTO DROP FAB ───────────────────────────────────────────── */}
        {activeNav === "squads" && !mySquad && kycApproved && userLocation && (
          <button
            onClick={() => setShowPhotoDropModal(true)}
            style={{
              position: "absolute", left: 24, bottom: 80, zIndex: 20,
              width: 52, height: 52, borderRadius: "50%",
              backgroundColor: "#ffe24c", border: "3px solid #1b1b1e",
              boxShadow: "4px 4px 0 #1b1b1e", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Drop a photo on the map"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#1b1b1e", fontVariationSettings: "'FILL' 1" }}>add_a_photo</span>
          </button>
        )}

        {/* ── RIGHT OVERLAY PANELS ──────────────────────────────────────── */}
        {!guessMode && activeNav !== "recruits" && activeNav !== "kyc" && activeNav !== "intel" && activeNav !== "friends" && activeNav !== "leaderboard" && activeNav !== "store" && activeNav !== "explore" && !(activeNav === "squads" && !!mySquad && kycApproved) && (
        <div
          style={{
            position: "absolute", right: 24, top: 24,
            width: 272, display: "flex", flexDirection: "column", gap: 20,
            zIndex: 10, pointerEvents: "none",
          }}
        >
          {/* YOUR PARTY */}
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e", padding: 20, borderRadius: 16,
              pointerEvents: "auto",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              YOUR PARTY
            </h3>
            {mySquad ? (
              <>
                <p
                  style={{
                    fontWeight: 700, fontSize: 13, marginBottom: 10,
                    color: "#9f376f", textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {mySquad.name}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user.image && (
                    <img
                      src={user.image}
                      alt="You"
                      style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e" }}
                    />
                  )}
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {user.name} (You)
                    </p>
                    <span
                      style={{
                        fontSize: 10, color: "#9f376f", fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {mySquad.hostUid === uid ? "Host" : "Member"}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#544249", marginTop: 8, fontWeight: 600 }}>
                  {mySquad.memberUids?.length ?? 0}/{mySquad.capacity} members
                </p>
                <button
                  onClick={() => setActiveNav("squads")}
                  style={{
                    marginTop: 12, width: "100%",
                    padding: "8px 12px", backgroundColor: "#9f376f",
                    color: "white", border: "2.5px solid #1b1b1e",
                    borderRadius: 6, cursor: "pointer",
                    fontWeight: 800, fontSize: 12, textTransform: "uppercase",
                    fontFamily: "inherit", boxShadow: "3px 3px 0 #3d0025",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
                  OPEN SQUAD CHAT
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  {user.image && (
                    <img
                      src={user.image}
                      alt="You"
                      style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1b1b1e" }}
                    />
                  )}
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</p>
                    <span style={{ fontSize: 10, color: "#006686", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block" }} />
                      SCOUTING
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px dashed #1b1b1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ color: "#1b1b1e", fontSize: 18 }}>add</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 12, fontStyle: "italic", color: "#544249" }}>No squad yet — join or host</p>
                </div>
                <button
                  onClick={() => { setShowHostModal(true); setHostedSquadId(null); setSuccessQrUrl(""); setHostForm({ name: "", category: "", capacity: "10" }); }}
                  style={{
                    width: "100%", padding: "10px 12px", backgroundColor: "#ffe24c",
                    border: "2.5px solid #1b1b1e", borderRadius: 6, cursor: "pointer",
                    fontWeight: 800, fontSize: 12, textTransform: "uppercase",
                    fontFamily: "inherit", boxShadow: "3px 3px 0 #1b1b1e",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    color: "#1b1b1e",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_location_alt</span>
                  HOST A SQUAD
                </button>
              </>
            )}
          </div>

          {/* INCOMING */}
          <div
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "6px 6px 0 #1b1b1e", padding: 20, borderRadius: 16,
              pointerEvents: "auto",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 22, fontWeight: 700, marginBottom: 14,
                textTransform: "uppercase", color: "#1b1b1e",
              }}
            >
              INCOMING
            </h3>
            <p style={{ fontSize: 13, color: "#544249", fontWeight: 600 }}>
              No incoming requests
            </p>
          </div>
        </div>
        )}
      </main>


      {/* ── SQUAD DETAIL MODAL (click marker / sidebar) ───────────────────── */}
      {selectedSquad && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setSelectedSquad(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "8px 8px 0 #1b1b1e", padding: 36,
              maxWidth: 400, width: "100%", borderRadius: 16,
            }}
          >
            <div
              style={{
                backgroundColor: THEME_COLORS[selectedSquad.theme] ?? "#ffe24c",
                border: "3px solid #1b1b1e", padding: "8px 16px",
                display: "inline-block", marginBottom: 16, borderRadius: 6,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#1b1b1e" }}>
                {selectedSquad.theme}
              </span>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif",
                fontSize: 30, fontWeight: 800, textTransform: "uppercase",
                color: "#9f376f", marginBottom: 8,
              }}
            >
              {selectedSquad.name}
            </h2>
            <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, marginBottom: 4 }}>
              Hosted by <strong>{selectedSquad.hostName}</strong>
            </p>
            <p style={{ fontSize: 14, color: "#544249", fontWeight: 600, marginBottom: 20 }}>
              {selectedSquad.memberUids?.length ?? 0} / {selectedSquad.capacity} members
            </p>

            {/* Capacity bar */}
            <div style={{ backgroundColor: "#e4e1e6", borderRadius: 999, height: 8, marginBottom: 24, border: "2px solid #1b1b1e" }}>
              <div
                style={{
                  backgroundColor: "#9f376f", height: "100%", borderRadius: 999,
                  width: `${Math.min(100, ((selectedSquad.memberUids?.length ?? 0) / selectedSquad.capacity) * 100)}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <button
                onClick={() => setSelectedSquad(null)}
                style={{
                  flex: 1, border: "3px solid #1b1b1e", padding: "12px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#fbf8fc",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                }}
              >
                CLOSE
              </button>
              <button
                onClick={() => handleJoin(selectedSquad)}
                disabled={
                  selectedSquad.memberUids?.includes(uid) ||
                  (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity ||
                  joining === selectedSquad.id
                }
                style={{
                  flex: 2, border: "3px solid #1b1b1e", padding: "12px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#9f376f", color: "white",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                  opacity:
                    selectedSquad.memberUids?.includes(uid) ||
                    (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity
                      ? 0.5 : 1,
                }}
              >
                {joining === selectedSquad.id
                  ? "JOINING..."
                  : selectedSquad.memberUids?.includes(uid)
                  ? "ALREADY IN"
                  : (selectedSquad.memberUids?.length ?? 0) >= selectedSquad.capacity
                  ? "SQUAD FULL"
                  : "JOIN SQUAD"}
              </button>
            </div>
            {selectedSquad.memberUids?.includes(uid) && (
              <button
                onClick={() => { setWebRTCCall({ theirUid: "", theirName: "SQUAD", mode: "caller" }); setSelectedSquad(null); }}
                style={{
                  width: "100%", border: "3px solid #1b1b1e", padding: "12px",
                  fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                  cursor: "pointer", backgroundColor: "#7ed4fd", color: "#1b1b1e",
                  boxShadow: "4px 4px 0 #1b1b1e", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>videocam</span>
                START VIDEO CALL
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── WEBRTC VIDEO CALL ────────────────────────────────────────────── */}
      {webRTCCall && (
        <WebRTCCallComponent
          mode={webRTCCall.mode}
          callId={webRTCCall.callId}
          myUid={uid}
          myName={user.name ?? "AGENT"}
          theirName={webRTCCall.theirName}
          offer={webRTCCall.offer}
          onCallId={(id: string) => setWebRTCCall((v) => v ? { ...v, callId: id } : v)}
          onEnd={() => setWebRTCCall(null)}
        />
      )}

      {/* ── INCOMING CALL BANNER ─────────────────────────────────────────── */}
      {incomingCall && !webRTCCall && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 300, backgroundColor: "#fbf8fc", border: "3px solid #1b1b1e",
          boxShadow: "6px 6px 0 #1b1b1e", padding: "16px 24px",
          display: "flex", alignItems: "center", gap: 16, minWidth: 280,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#4caf50", fontVariationSettings: "'FILL' 1", animation: "pulse 1s infinite" }}>phone_in_talk</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 14, textTransform: "uppercase" }}>INCOMING CALL</p>
            <p style={{ fontSize: 12, color: "#544249", fontWeight: 600 }}>{incomingCall.callerName}</p>
          </div>
          <button
            onClick={() => {
              setWebRTCCall({ theirUid: incomingCall.callerUid, theirName: incomingCall.callerName, mode: "callee", callId: incomingCall.id, offer: incomingCall.offer });
              setIncomingCall(null);
            }}
            style={{ padding: "8px 14px", backgroundColor: "#4caf50", border: "2px solid #1b1b1e", color: "#fff", fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer" }}
          >
            ANSWER
          </button>
          <button
            onClick={() => setIncomingCall(null)}
            style={{ padding: "8px 14px", backgroundColor: "#ba1a1a", border: "2px solid #1b1b1e", color: "#fff", fontWeight: 800, fontSize: 11, textTransform: "uppercase", cursor: "pointer" }}
          >
            DECLINE
          </button>
        </div>
      )}

      {/* ── USER PROFILE MODAL ───────────────────────────────────────────── */}
      {selectedUserProfile && (
        <UserProfileModal
          profile={selectedUserProfile}
          myUid={uid}
          friendStatus={getFriendStatus(selectedUserProfile.email)}
          onClose={() => setSelectedUserProfile(null)}
          onConnect={async () => {
            const fs = getFriendStatus(selectedUserProfile.email);
            if (fs === "received") {
              const req = friendRequests.find((r) => r.participants.includes(selectedUserProfile.email) && r.status === "pending" && r.toUid === uid);
              if (req) await acceptFriendRequest(req.id);
            } else if (fs === "none") {
              await sendFriendRequest(uid, selectedUserProfile.email);
            }
            setSelectedUserProfile(null);
          }}
          onMessage={async () => {
            const chatId = await getOrCreateDMChat(uid, selectedUserProfile.email, { [uid]: user.name ?? "", [selectedUserProfile.email]: selectedUserProfile.displayName }, { [uid]: user.image ?? "", [selectedUserProfile.email]: selectedUserProfile.photoURL });
            setSelectedUserProfile(null);
            setActiveNav("friends");
            void chatId;
          }}
          onCall={() => {
            setWebRTCCall({ theirUid: selectedUserProfile.email, theirName: selectedUserProfile.displayName, mode: "caller" });
            setSelectedUserProfile(null);
          }}
        />
      )}

      {/* ── PHOTO DROP DETAIL ─────────────────────────────────────────────── */}
      {selectedPhotoDrop && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setSelectedPhotoDrop(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#1b1b1e", border: "4px solid #ffe24c", boxShadow: "8px 8px 0 #ffe24c", maxWidth: 400, width: "100%", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhotoDrop.imageURL} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              {selectedPhotoDrop.photoURL && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPhotoDrop.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #ffe24c", objectFit: "cover", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", color: "#fbf8fc" }}>{selectedPhotoDrop.displayName}</p>
                {selectedPhotoDrop.caption && (
                  <p style={{ fontSize: 11, color: "#ffe24c", fontWeight: 600, marginTop: 2 }}>{selectedPhotoDrop.caption}</p>
                )}
              </div>
              <button onClick={() => setSelectedPhotoDrop(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fbf8fc" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO DROP MODAL ─────────────────────────────────────────────── */}
      {showPhotoDropModal && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { if (!photoDropUploading) setShowPhotoDropModal(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e", boxShadow: "10px 10px 0 #1b1b1e", padding: 28, width: "100%", maxWidth: 420 }}
          >
            <p style={{ fontFamily: "var(--font-bricolage,'Bricolage Grotesque',sans-serif)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", marginBottom: 4 }}>DROP A PHOTO</p>
            <p style={{ fontSize: 11, color: "#544249", fontWeight: 600, marginBottom: 20 }}>Tag a photo at your location · visible for 24h</p>

            <input
              type="file"
              accept="image/*"
              ref={photoDropFileRef}
              style={{ display: "none" }}
              onChange={(e) => setPhotoDropFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => photoDropFileRef.current?.click()}
              style={{
                width: "100%", padding: "14px", border: "3px dashed #1b1b1e", backgroundColor: photoDropFile ? "#c8f7c5" : "#f6f2f7",
                cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontWeight: 700, fontSize: 12, textTransform: "uppercase", fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>add_a_photo</span>
              {photoDropFile ? photoDropFile.name : "CHOOSE PHOTO"}
            </button>

            {photoDropFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(photoDropFile)}
                alt="preview"
                style={{ width: "100%", height: 160, objectFit: "cover", border: "2px solid #1b1b1e", marginBottom: 14 }}
              />
            )}

            <input
              type="text"
              placeholder="Add a caption… (optional)"
              value={photoDropCaption}
              onChange={(e) => setPhotoDropCaption(e.target.value)}
              maxLength={150}
              style={{
                width: "100%", padding: "10px 14px", border: "2px solid #1b1b1e",
                fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                backgroundColor: "#fbf8fc", outline: "none", marginBottom: 20, boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowPhotoDropModal(false)}
                disabled={photoDropUploading}
                style={{ flex: 1, padding: "12px", border: "2px solid #1b1b1e", backgroundColor: "#fbf8fc", fontWeight: 700, fontSize: 12, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
              >
                CANCEL
              </button>
              <button
                onClick={handlePhotoDrop}
                disabled={!photoDropFile || photoDropUploading}
                style={{
                  flex: 2, padding: "12px", border: "3px solid #1b1b1e",
                  backgroundColor: !photoDropFile || photoDropUploading ? "#e4e1e6" : "#ffe24c",
                  fontWeight: 800, fontSize: 13, textTransform: "uppercase", cursor: !photoDropFile || photoDropUploading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", boxShadow: !photoDropFile || photoDropUploading ? "none" : "4px 4px 0 #1b1b1e",
                }}
              >
                {photoDropUploading ? "UPLOADING…" : "DROP IT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOST A SQUAD MODAL ─────────────────────────────────────────────── */}
      {showHostModal && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)",
            zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={() => { if (!hosting) { setShowHostModal(false); } }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fbf8fc", border: "4px solid #1b1b1e",
              boxShadow: "10px 10px 0 #1b1b1e", padding: 32,
              maxWidth: 460, width: "100%", borderRadius: 16,
              maxHeight: "90vh", overflowY: "auto",
            }}
          >
            {!hostedSquadId ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <span style={{ display: "inline-block", background: "#ffe24c", border: "2px solid #1b1b1e", padding: "3px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                      DEPLOY SQUAD
                    </span>
                    <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e", lineHeight: 1 }}>
                      HOST A SQUAD
                    </h2>
                  </div>
                  <button onClick={() => setShowHostModal(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#544249" }}>close</span>
                  </button>
                </div>

                {/* Squad Name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 11, textTransform: "uppercase", marginBottom: 6, color: "#1b1b1e", letterSpacing: "0.04em" }}>
                    SQUAD NAME *
                  </label>
                  <input
                    type="text"
                    value={hostForm.name}
                    onChange={(e) => setHostForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="E.G. ROOFTOP REBELS"
                    maxLength={40}
                    style={{
                      width: "100%", padding: "12px 14px", border: "3px solid #1b1b1e",
                      fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                      backgroundColor: "#fbf8fc", outline: "none", boxSizing: "border-box",
                      textTransform: "uppercase", letterSpacing: "0.03em",
                    }}
                  />
                </div>

                {/* Theme */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 11, textTransform: "uppercase", marginBottom: 6, color: "#1b1b1e", letterSpacing: "0.04em" }}>
                    THEME / VIBE *
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {SQUAD_THEMES.map(t => {
                      const bg = THEME_COLORS[t] ?? "#ffe24c";
                      const selected = hostForm.category === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setHostForm(f => ({ ...f, category: t }))}
                          style={{
                            padding: "6px 14px", border: "2.5px solid #1b1b1e", fontWeight: 700, fontSize: 11,
                            cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
                            backgroundColor: selected ? "#1b1b1e" : bg,
                            color: selected ? "#fbf8fc" : "#1b1b1e",
                            boxShadow: selected ? "none" : "2px 2px 0 #1b1b1e",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Capacity */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 11, textTransform: "uppercase", marginBottom: 6, color: "#1b1b1e", letterSpacing: "0.04em" }}>
                    MAX CREW SIZE
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["5", "10", "15", "20", "30"].map(cap => (
                      <button
                        key={cap}
                        onClick={() => setHostForm(f => ({ ...f, capacity: cap }))}
                        style={{
                          flex: 1, padding: "10px 0", border: "2.5px solid #1b1b1e", fontWeight: 800, fontSize: 14,
                          cursor: "pointer", fontFamily: "inherit",
                          backgroundColor: hostForm.capacity === cap ? "#1b1b1e" : "#fbf8fc",
                          color: hostForm.capacity === cap ? "#fbf8fc" : "#1b1b1e",
                          boxShadow: hostForm.capacity === cap ? "none" : "2px 2px 0 #1b1b1e",
                        }}
                      >
                        {cap}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location note */}
                <div style={{ padding: "10px 14px", backgroundColor: "#c0e8ff", border: "2px solid #1b1b1e", marginBottom: 24, display: "flex", alignItems: "center", gap: 8, borderRadius: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#006686", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#005b78" }}>
                    {userLocation ? "Will use your current GPS location" : "GPS unavailable — using default area"}
                  </p>
                </div>

                <button
                  onClick={handleHostSquad}
                  disabled={hosting || !hostForm.name.trim() || !hostForm.category}
                  style={{
                    width: "100%", padding: "16px", backgroundColor: hosting || !hostForm.name.trim() || !hostForm.category ? "#e4e1e6" : "#9f376f",
                    color: hosting || !hostForm.name.trim() || !hostForm.category ? "#544249" : "white",
                    border: "3px solid #1b1b1e", fontWeight: 800, fontSize: 15, textTransform: "uppercase",
                    cursor: hosting || !hostForm.name.trim() || !hostForm.category ? "not-allowed" : "pointer",
                    boxShadow: "5px 5px 0 #1b1b1e", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    letterSpacing: "0.04em",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_location_alt</span>
                  {hosting ? "DEPLOYING..." : "DEPLOY SQUAD"}
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, backgroundColor: "#c8f7c5", border: "3px solid #1b1b1e", borderRadius: "50%", marginBottom: 14 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#4caf50", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <h2 style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: "#1b1b1e", marginBottom: 6 }}>
                    SQUAD DEPLOYED!
                  </h2>
                  <p style={{ fontSize: 13, color: "#544249", fontWeight: 600 }}>Share the QR or link to rally your crew.</p>
                </div>

                {successQrUrl && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={successQrUrl} alt="QR Code" style={{ width: 160, height: 160, border: "4px solid #1b1b1e", boxShadow: "4px 4px 0 #1b1b1e", imageRendering: "pixelated" }} />
                  </div>
                )}

                <button
                  onClick={async () => {
                    const url = `${BASE_URL}/event/${hostedSquadId}`;
                    await navigator.clipboard.writeText(url).catch(() => {});
                    setCopiedEventLink(true);
                    setTimeout(() => setCopiedEventLink(false), 2000);
                  }}
                  style={{
                    width: "100%", marginBottom: 10, padding: "12px", backgroundColor: "#ffe24c", border: "2.5px solid #1b1b1e",
                    fontWeight: 700, fontSize: 12, textTransform: "uppercase", cursor: "pointer",
                    boxShadow: "3px 3px 0 #1b1b1e", fontFamily: "inherit", color: "#1b1b1e",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {copiedEventLink ? "check" : "content_copy"}
                  </span>
                  {copiedEventLink ? "LINK COPIED!" : "COPY INVITE LINK"}
                </button>

                <button
                  onClick={() => { setShowHostModal(false); setActiveNav("squads"); }}
                  style={{
                    width: "100%", padding: "14px", backgroundColor: "#9f376f", color: "white",
                    border: "3px solid #1b1b1e", fontWeight: 800, fontSize: 14, textTransform: "uppercase",
                    cursor: "pointer", boxShadow: "5px 5px 0 #1b1b1e", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
                  OPEN SQUAD CHAT
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV — phone only (< 640px) ─────────────────────── */}
      <div
        className="flex sm:hidden"
        style={{
          position: "fixed", bottom: 0, left: 0, width: "100%",
          backgroundColor: "#fbf8fc", borderTop: "4px solid #1b1b1e",
          justifyContent: "space-around",
          paddingTop: "10px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          zIndex: 50,
        }}
      >
        {([
          { icon: mySquad ? "chat" : "map", label: mySquad ? "CHAT" : "MAP", key: "squads" },
          { icon: "person_search", label: "RECRUITS", key: "recruits" },
          { icon: "explore", label: "EXPLORE", key: "explore" },
          { icon: "leaderboard", label: "RANKS", key: "leaderboard" },
          { icon: "storefront", label: "STORE", key: "store" },
        ] as const).map((item) => {
          const isActive = activeNav === item.key;
          const isLocked = !kycApproved;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (isLocked) return;
                closeAllPanels();
                setActiveNav(item.key);
              }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                color: isLocked ? "#c4bcc3" : isActive ? "#9f376f" : "#544249",
                background: "none", border: "none",
                cursor: isLocked ? "not-allowed" : "pointer",
                padding: "4px 12px", minWidth: 60,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {isLocked ? "lock" : item.icon}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
