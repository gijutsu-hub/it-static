"use client";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  query,
  where,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  Timestamp,
  deleteDoc,
  orderBy,
  deleteField,
  limit,
  increment,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { firebaseApp, storage } from "./firebase";

export const db = getFirestore(firebaseApp);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Squad {
  id: string;
  name: string;
  theme: string;
  category: string;
  hostUid: string;
  hostName: string;
  hostPhotoURL: string;
  location: { lat: number; lng: number };
  address: string;
  capacity: number;
  memberUids: string[];
  createdAt: Timestamp;
  active: boolean;
}

export interface UserProfile {
  email: string;
  displayName: string;
  photoURL: string;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  banned: boolean;
  location?: { lat: number; lng: number };
  codename?: string;
  bio?: string;
  interests?: string[];
  kycStatus?: "pending" | "approved" | "rejected" | "expired";
  kycVerifiedAt?: Timestamp;
  kycExpiresAt?: Timestamp;
  badges?: string[];
  points?: number;
  ownedItems?: string[];
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  participants: string[];
  status: "pending" | "accepted" | "rejected";
  createdAt: Timestamp;
}

export interface KYCSubmission {
  id: string;
  email: string;
  displayName: string;
  profilePhotoURL: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  idType: "passport" | "national_id" | "drivers_license";
  idNumber: string;
  challengeCode: string;
  kycPhotoURL: string;
  kycPhotoPath: string;
  location: { lat: number; lng: number };
  notificationsEnabled: boolean;
  status: "pending" | "rejected";
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  rejectionReason?: string;
}

// ── Squads ─────────────────────────────────────────────────────────────────────

export async function createSquad(
  data: Omit<Squad, "id" | "createdAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, "squads"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export function subscribeToSquads(
  callback: (squads: Squad[]) => void
): () => void {
  const q = query(collection(db, "squads"), where("active", "==", true));
  return onSnapshot(q, (snap) => {
    const squads = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Squad));
    callback(squads);
  }, () => {});
}

export async function getSquad(id: string): Promise<Squad | null> {
  const snap = await getDoc(doc(db, "squads", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Squad;
}

export function subscribeToSquad(
  id: string,
  callback: (squad: Squad | null) => void
): () => void {
  return onSnapshot(doc(db, "squads", id), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Squad) : null);
  }, () => callback(null));
}

export function subscribeToAllSquads(
  callback: (squads: Squad[]) => void
): () => void {
  const q = query(collection(db, "squads"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const squads = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Squad));
    callback(squads);
  }, () => {});
}

export async function joinSquad(squadId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "squads", squadId), {
    memberUids: arrayUnion(uid),
  });
}

// ── Users ──────────────────────────────────────────────────────────────────────

/** Creates user doc on first visit; updates lastSeen + mutable fields on subsequent visits. */
export async function upsertUser(
  email: string,
  data: {
    displayName: string;
    photoURL: string;
    location?: { lat: number; lng: number };
  }
): Promise<void> {
  const userRef = doc(db, "users", email);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      ...(data.location ? { location: data.location } : {}),
      firstSeen: Timestamp.now(),
      lastSeen: Timestamp.now(),
      banned: false,
      points: 0,
      ownedItems: [],
    });
  } else {
    await updateDoc(userRef, {
      displayName: data.displayName,
      photoURL: data.photoURL,
      ...(data.location ? { location: data.location } : {}),
      lastSeen: Timestamp.now(),
    });
  }
}

/** Real-time subscription to all user profiles (admin use). */
export function subscribeToAllUsers(
  callback: (users: UserProfile[]) => void
): () => void {
  return onSnapshot(collection(db, "users"), (snap) => {
    const users = snap.docs.map((d) => d.data() as UserProfile);
    callback(users);
  }, () => {});
}

export async function banUser(email: string): Promise<void> {
  await updateDoc(doc(db, "users", email), { banned: true });
}

export async function unbanUser(email: string): Promise<void> {
  await updateDoc(doc(db, "users", email), { banned: false });
}

export async function updateUserProfile(
  email: string,
  data: { codename?: string; bio?: string; interests?: string[] }
): Promise<void> {
  await updateDoc(doc(db, "users", email), data);
}

/** Real-time subscription to all non-banned users except the caller. */
export function subscribeToUsers(
  excludeUid: string,
  callback: (users: UserProfile[]) => void
): () => void {
  return onSnapshot(collection(db, "users"), (snap) => {
    const users = snap.docs
      .map((d) => d.data() as UserProfile)
      .filter((u) => u.email !== excludeUid && !u.banned);
    callback(users);
  }, () => {});
}

export async function sendFriendRequest(
  fromUid: string,
  toUid: string
): Promise<void> {
  // Prevent duplicate requests
  const q = query(
    collection(db, "friendRequests"),
    where("participants", "array-contains", fromUid)
  );
  const snap = await getDocs(q);
  const exists = snap.docs.some((d) => {
    const data = d.data();
    return data.participants.includes(toUid);
  });
  if (exists) return;

  await addDoc(collection(db, "friendRequests"), {
    fromUid,
    toUid,
    participants: [fromUid, toUid],
    status: "pending",
    createdAt: Timestamp.now(),
  });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "rejected" });
}

export function subscribeToFriendRequests(
  uid: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  const q = query(
    collection(db, "friendRequests"),
    where("participants", "array-contains", uid)
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as FriendRequest)
    );
    callback(requests);
  }, () => {});
}

// ── KYC ───────────────────────────────────────────────────────────────────────

/**
 * Submit a KYC application. Returns the new document ID.
 */
export async function submitKYC(
  data: Omit<KYCSubmission, "id" | "submittedAt" | "status">
): Promise<string> {
  const docRef = await addDoc(collection(db, "kycSubmissions"), {
    ...data,
    status: "pending",
    submittedAt: Timestamp.now(),
  });

  // Update user profile with pending status
  await updateDoc(doc(db, "users", data.email), {
    kycStatus: "pending",
  });

  return docRef.id;
}

/**
 * Real-time subscription to the current user's KYC submission.
 * Returns the most recent doc or null.
 */
export function subscribeToUserKYCStatus(
  email: string,
  callback: (submission: KYCSubmission | null) => void
): () => void {
  const q = query(
    collection(db, "kycSubmissions"),
    where("email", "==", email)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
      return;
    }
    // Pick the most recently submitted doc
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KYCSubmission));
    docs.sort((a, b) => {
      const aTime = a.submittedAt?.toMillis() ?? 0;
      const bTime = b.submittedAt?.toMillis() ?? 0;
      return bTime - aTime;
    });
    callback(docs[0]);
  }, () => {});
}

/**
 * Admin: real-time subscription to all KYC submissions ordered by submittedAt.
 */
export function subscribeToAllKYCSubmissions(
  callback: (submissions: KYCSubmission[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, "kycSubmissions"),
    orderBy("submittedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const submissions = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as KYCSubmission)
    );
    callback(submissions);
  }, (err) => {
    if (onError) onError(err);
  });
}

/**
 * Admin: approve a KYC submission.
 * - Updates user profile with approved status and expiry
 * - Deletes the Storage photo
 * - Deletes the Firestore submission doc
 */
export async function approveKYC(
  submissionId: string,
  email: string,
  kycPhotoPath: string
): Promise<void> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  );

  // Update user profile
  await updateDoc(doc(db, "users", email), {
    kycStatus: "approved",
    kycVerifiedAt: now,
    kycExpiresAt: expiresAt,
  });

  // Delete the Storage photo
  try {
    const photoRef = ref(storage, kycPhotoPath);
    await deleteObject(photoRef);
  } catch (err) {
    console.warn("Could not delete KYC photo from storage:", err);
  }

  // Delete the Firestore submission doc
  await deleteDoc(doc(db, "kycSubmissions", submissionId));
}

/**
 * Admin: reject a KYC submission.
 * Updates submission status and user profile.
 */
export async function rejectKYC(
  submissionId: string,
  email: string,
  reason: string
): Promise<void> {
  await updateDoc(doc(db, "kycSubmissions", submissionId), {
    status: "rejected",
    rejectionReason: reason,
    reviewedAt: Timestamp.now(),
  });

  await updateDoc(doc(db, "users", email), {
    kycStatus: "rejected",
  });
}

/**
 * Admin: manually approve KYC for a user without a submission doc.
 * Sets kycStatus = "approved" and a 1-year expiry directly on the user profile.
 */
export async function manualApproveKYC(email: string): Promise<void> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  );
  await updateDoc(doc(db, "users", email), {
    kycStatus: "approved",
    kycVerifiedAt: now,
    kycExpiresAt: expiresAt,
    kycManualOverride: true,
  });
}

/**
 * Admin: revoke KYC verification for a user.
 * Clears all KYC fields from the user profile.
 */
export async function revokeKYC(email: string): Promise<void> {
  await updateDoc(doc(db, "users", email), {
    kycStatus: deleteField(),
    kycVerifiedAt: deleteField(),
    kycExpiresAt: deleteField(),
    kycManualOverride: deleteField(),
  });
}

/**
 * Deletes a KYC submission doc and its associated Storage photo.
 * Used when user resubmits after rejection.
 */
export async function deleteKYCSubmission(
  submissionId: string,
  kycPhotoPath: string
): Promise<void> {
  try {
    const photoRef = ref(storage, kycPhotoPath);
    await deleteObject(photoRef);
  } catch (err) {
    console.warn("Could not delete KYC photo from storage:", err);
  }

  await deleteDoc(doc(db, "kycSubmissions", submissionId));
}

// ── Squad Chat ─────────────────────────────────────────────────────────────────
//
// Required Firestore Security Rules (add to your firebase console):
//
// match /squads/{squadId}/messages/{msgId} {
//   allow read: if request.auth != null;
//   allow create: if request.auth != null
//     && request.resource.data.text is string
//     && request.resource.data.text.size() <= 500;
// }
// match /squads/{squadId}/presence/{uid} {
//   allow read: if request.auth != null;
//   allow write: if request.auth != null;
// }
// match /privateChats/{chatId} {
//   allow read, update: if request.auth != null
//     && resource.data.memberUids.hasAny([request.auth.token.email]);
//   allow create: if request.auth != null;
// }
// match /privateChats/{chatId}/messages/{msgId} {
//   allow read, create: if request.auth != null;
// }

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL: string;
  text: string;
  sentAt: Timestamp;
  type: "text" | "system" | "photo";
  imageURL?: string;
  locationTag?: { lat: number; lng: number };
}

export interface PresenceEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  online: boolean;
  lastSeen: Timestamp;
}

export interface PrivateChat {
  id: string;
  squadId: string;
  memberUids: string[];
  memberNames: Record<string, string>;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  active: boolean;
}

function sanitizeText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 500);
}

export function subscribeToSquadMessages(
  squadId: string,
  callback: (msgs: ChatMessage[]) => void
): () => void {
  const q = query(
    collection(db, "squads", squadId, "messages"),
    orderBy("sentAt", "asc"),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  }, () => {});
}

export async function sendSquadMessage(
  squadId: string,
  sender: { uid: string; name: string; photoURL: string },
  rawText: string,
  options?: { imageURL?: string; locationTag?: { lat: number; lng: number } }
): Promise<void> {
  const text = sanitizeText(rawText);
  if (!text && !options?.imageURL) return;
  await addDoc(collection(db, "squads", squadId, "messages"), {
    senderUid: sender.uid,
    senderName: sender.name,
    senderPhotoURL: sender.photoURL,
    text: text || "",
    sentAt: Timestamp.now(),
    type: options?.imageURL ? "photo" : "text",
    ...(options?.imageURL ? { imageURL: options.imageURL } : {}),
    ...(options?.locationTag ? { locationTag: options.locationTag } : {}),
  });
}

export async function setSquadPresence(
  squadId: string,
  uid: string,
  displayName: string,
  photoURL: string,
  online: boolean
): Promise<void> {
  await setDoc(
    doc(db, "squads", squadId, "presence", uid),
    { uid, displayName, photoURL, online, lastSeen: Timestamp.now() },
    { merge: true }
  );
}

export function subscribeToSquadPresence(
  squadId: string,
  callback: (entries: PresenceEntry[]) => void
): () => void {
  return onSnapshot(
    collection(db, "squads", squadId, "presence"),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as PresenceEntry));
    },
    () => {}
  );
}

export async function createPrivateChat(
  squadId: string,
  createdBy: string,
  memberUids: string[],
  memberNames: Record<string, string>
): Promise<string> {
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 2 * 60 * 60 * 1000)
  );
  const ref = await addDoc(collection(db, "privateChats"), {
    squadId,
    memberUids,
    memberNames,
    createdBy,
    createdAt: Timestamp.now(),
    expiresAt,
    active: true,
  });
  return ref.id;
}

export function subscribeToMyPrivateChats(
  uid: string,
  callback: (chats: PrivateChat[]) => void
): () => void {
  const q = query(
    collection(db, "privateChats"),
    where("memberUids", "array-contains", uid),
    where("active", "==", true)
  );
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const chats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PrivateChat))
      .filter((c) => c.expiresAt.toMillis() > now);
    callback(chats);
  }, () => {});
}

export async function dissolvePrivateChat(chatId: string): Promise<void> {
  await updateDoc(doc(db, "privateChats", chatId), { active: false });
}

export function subscribeToPrivateChatMessages(
  chatId: string,
  callback: (msgs: ChatMessage[]) => void
): () => void {
  const q = query(
    collection(db, "privateChats", chatId, "messages"),
    orderBy("sentAt", "asc"),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  }, () => {});
}

export async function sendPrivateChatMessage(
  chatId: string,
  sender: { uid: string; name: string; photoURL: string },
  rawText: string
): Promise<void> {
  const text = sanitizeText(rawText);
  if (!text) return;
  await addDoc(collection(db, "privateChats", chatId, "messages"), {
    senderUid: sender.uid,
    senderName: sender.name,
    senderPhotoURL: sender.photoURL,
    text,
    sentAt: Timestamp.now(),
    type: "text",
  });
}

// ── Squad Admin ────────────────────────────────────────────────────────────────

export async function deactivateSquad(squadId: string): Promise<void> {
  await updateDoc(doc(db, "squads", squadId), { active: false });
}

export async function deleteSquad(squadId: string): Promise<void> {
  await deleteDoc(doc(db, "squads", squadId));
}

// ── Tickets / RSVPs ────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  squadId: string;
  squadName: string;
  holderUid: string;
  holderName: string;
  holderPhotoURL: string;
  ticketCode: string;
  issuedAt: Timestamp;
  checkedIn: boolean;
  checkedInAt?: Timestamp;
}

export async function issueTicket(
  squadId: string,
  squadName: string,
  holder: { uid: string; name: string; photoURL: string }
): Promise<string> {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const ref = await addDoc(collection(db, "tickets"), {
    squadId,
    squadName,
    holderUid: holder.uid,
    holderName: holder.name,
    holderPhotoURL: holder.photoURL,
    ticketCode: code,
    issuedAt: Timestamp.now(),
    checkedIn: false,
  });
  return ref.id;
}

export function subscribeToSquadTickets(
  squadId: string,
  callback: (tickets: Ticket[]) => void
): () => void {
  const q = query(collection(db, "tickets"), where("squadId", "==", squadId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
  }, () => {});
}

export function subscribeToMyTickets(
  uid: string,
  callback: (tickets: Ticket[]) => void
): () => void {
  const q = query(collection(db, "tickets"), where("holderUid", "==", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
  }, () => {});
}

export async function checkInTicket(ticketId: string): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    checkedIn: true,
    checkedInAt: Timestamp.now(),
  });
}

// ── Direct Messages ────────────────────────────────────────────────────────────

export interface DMChat {
  id: string;
  memberUids: string[];
  memberNames: Record<string, string>;
  memberPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
}

export async function getOrCreateDMChat(
  myUid: string,
  theirUid: string,
  names: Record<string, string>,
  photos: Record<string, string>
): Promise<string> {
  const q = query(
    collection(db, "directMessages"),
    where("memberUids", "array-contains", myUid)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => {
    const uids: string[] = d.data().memberUids ?? [];
    return uids.includes(theirUid);
  });
  if (existing) return existing.id;

  const ref = await addDoc(collection(db, "directMessages"), {
    memberUids: [myUid, theirUid],
    memberNames: names,
    memberPhotos: photos,
    lastMessage: "",
    lastMessageAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export function subscribeToMyDMChats(
  uid: string,
  callback: (chats: DMChat[]) => void
): () => void {
  const q = query(
    collection(db, "directMessages"),
    where("memberUids", "array-contains", uid)
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as DMChat))
      .sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0));
    callback(chats);
  }, () => {});
}

export function subscribeToDMMessages(
  chatId: string,
  callback: (msgs: ChatMessage[]) => void
): () => void {
  const q = query(
    collection(db, "directMessages", chatId, "messages"),
    orderBy("sentAt", "asc"),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  }, () => {});
}

export async function sendDMMessage(
  chatId: string,
  sender: { uid: string; name: string; photoURL: string },
  rawText: string
): Promise<void> {
  const text = sanitizeText(rawText);
  if (!text) return;
  await addDoc(collection(db, "directMessages", chatId, "messages"), {
    senderUid: sender.uid,
    senderName: sender.name,
    senderPhotoURL: sender.photoURL,
    text,
    sentAt: Timestamp.now(),
    type: "text",
  });
  await updateDoc(doc(db, "directMessages", chatId), {
    lastMessage: text.length > 60 ? text.slice(0, 60) + "…" : text,
    lastMessageAt: Timestamp.now(),
  });
}

// ── Photo Drops ────────────────────────────────────────────────────────────────

export interface PhotoDrop {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  imageURL: string;
  storagePath: string;
  location: { lat: number; lng: number };
  caption: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export async function addPhotoDrop(data: {
  uid: string;
  displayName: string;
  photoURL: string;
  imageURL: string;
  storagePath: string;
  location: { lat: number; lng: number };
  caption: string;
}): Promise<string> {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const ref = await addDoc(collection(db, "photoDrops"), {
    ...data,
    createdAt: Timestamp.now(),
    expiresAt,
  });
  return ref.id;
}

export function subscribeToPhotoDrops(
  callback: (drops: PhotoDrop[]) => void
): () => void {
  const q = query(
    collection(db, "photoDrops"),
    where("expiresAt", ">", Timestamp.now()),
    orderBy("expiresAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoDrop)));
  }, () => {});
}

// ── WebRTC Signaling ───────────────────────────────────────────────────────────

export interface WebRTCCall {
  id: string;
  callerUid: string;
  calleeUid: string;
  callerName: string;
  calleeName: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: Timestamp;
  active: boolean;
}

export async function createWebRTCCall(data: {
  callerUid: string;
  calleeUid: string;
  callerName: string;
  calleeName: string;
  offer: RTCSessionDescriptionInit;
}): Promise<string> {
  const ref = await addDoc(collection(db, "webrtcCalls"), {
    ...data,
    createdAt: Timestamp.now(),
    active: true,
  });
  return ref.id;
}

export async function answerWebRTCCall(
  callId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, "webrtcCalls", callId), { answer });
}

export async function addWebRTCIceCandidate(
  callId: string,
  role: "caller" | "callee",
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(
    collection(db, "webrtcCalls", callId, role === "caller" ? "callerCandidates" : "calleeCandidates"),
    candidate
  );
}

export function subscribeToWebRTCCall(
  callId: string,
  callback: (call: WebRTCCall | null) => void
): () => void {
  return onSnapshot(doc(db, "webrtcCalls", callId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as WebRTCCall) : null);
  }, () => callback(null));
}

export function subscribeToWebRTCIceCandidates(
  callId: string,
  role: "caller" | "callee",
  callback: (candidates: RTCIceCandidateInit[]) => void
): () => void {
  return onSnapshot(
    collection(db, "webrtcCalls", callId, role === "caller" ? "callerCandidates" : "calleeCandidates"),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as RTCIceCandidateInit));
    },
    () => {}
  );
}

export async function endWebRTCCall(callId: string): Promise<void> {
  await updateDoc(doc(db, "webrtcCalls", callId), { active: false });
}

export function subscribeToIncomingCall(
  calleeUid: string,
  callback: (call: WebRTCCall | null) => void
): () => void {
  const q = query(
    collection(db, "webrtcCalls"),
    where("calleeUid", "==", calleeUid),
    where("active", "==", true)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { callback(null); return; }
    callback({ id: snap.docs[0].id, ...snap.docs[0].data() } as WebRTCCall);
  }, () => callback(null));
}

// ── Badges ─────────────────────────────────────────────────────────────────────

export const BADGE_DEFS: Record<string, { label: string; icon: string; color: string }> = {
  pioneer:   { label: "PIONEER",    icon: "rocket_launch",  color: "#ffe24c" },
  host:      { label: "HOST",       icon: "radio_button_checked", color: "#ff85c1" },
  networker: { label: "NETWORKER",  icon: "hub",            color: "#7ed4fd" },
  explorer:  { label: "EXPLORER",   icon: "photo_camera",   color: "#c8f7c5" },
  connected: { label: "CONNECTED",  icon: "diversity_3",    color: "#ffd8e7" },
  verified:  { label: "VERIFIED",   icon: "verified_user",  color: "#c8f7c5" },
};

export async function awardBadge(uid: string, badge: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const current: string[] = snap.data().badges ?? [];
  if (current.includes(badge)) return;
  await updateDoc(userRef, { badges: [...current, badge] });
}

// ── Treasure Hunts ─────────────────────────────────────────────────────────────

export interface TreasureHunt {
  id: string;
  title: string;
  description: string;
  coverEmoji: string;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  totalHints: number;
  rewardBadge?: string;
}

export interface HuntHint {
  id: string;
  huntId: string;
  order: number;
  location: { lat: number; lng: number };
  riddle: string;
  clueText: string;
  radiusMeters: number;
  imageURL?: string;
}

export interface HuntProgress {
  id: string;
  uid: string;
  huntId: string;
  collectedHintIds: string[];
  completed: boolean;
  completedAt?: Timestamp;
  startedAt: Timestamp;
}

export function subscribeToActiveHunts(
  callback: (hunts: TreasureHunt[]) => void
): () => void {
  const q = query(collection(db, "hunts"), where("active", "==", true));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TreasureHunt)));
  }, () => {});
}

export function subscribeToHuntHints(
  huntId: string,
  callback: (hints: HuntHint[]) => void
): () => void {
  const q = query(collection(db, "hints"), where("huntId", "==", huntId), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HuntHint)));
  }, () => {});
}

export function subscribeToAllHints(
  callback: (hints: HuntHint[]) => void
): () => void {
  return onSnapshot(collection(db, "hints"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HuntHint)));
  }, () => {});
}

export function subscribeToMyHuntProgress(
  uid: string,
  callback: (progress: HuntProgress[]) => void
): () => void {
  const q = query(collection(db, "huntProgress"), where("uid", "==", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HuntProgress)));
  }, () => {});
}

export async function collectHint(
  uid: string,
  huntId: string,
  hintId: string,
  totalHints: number,
  rewardBadge?: string
): Promise<void> {
  const progressId = `${uid}_${huntId}`;
  const progressRef = doc(db, "huntProgress", progressId);
  const snap = await getDoc(progressRef);

  if (!snap.exists()) {
    await setDoc(progressRef, {
      uid, huntId,
      collectedHintIds: [hintId],
      completed: false,
      startedAt: Timestamp.now(),
    });
    return;
  }

  const data = snap.data() as HuntProgress;
  if (data.collectedHintIds.includes(hintId)) return;

  const updated = [...data.collectedHintIds, hintId];
  const completed = updated.length >= totalHints;

  await updateDoc(progressRef, {
    collectedHintIds: updated,
    completed,
    ...(completed ? { completedAt: Timestamp.now() } : {}),
  });

  if (completed && rewardBadge) {
    await awardBadge(uid, rewardBadge);
  }
}

export async function createHunt(data: Omit<TreasureHunt, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "hunts"), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export async function createHuntHint(data: Omit<HuntHint, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "hints"), data);
  return ref.id;
}

// ── Push Subscriptions ─────────────────────────────────────────────────────────

export async function savePushSubscription(uid: string, subscription: PushSubscriptionJSON): Promise<void> {
  await setDoc(doc(db, "pushSubscriptions", uid), { uid, subscription, updatedAt: Timestamp.now() }, { merge: true });
}

export async function getPushSubscription(uid: string): Promise<PushSubscriptionJSON | null> {
  const snap = await getDoc(doc(db, "pushSubscriptions", uid));
  return snap.exists() ? (snap.data().subscription as PushSubscriptionJSON) : null;
}

// ── Squad Photos ───────────────────────────────────────────────────────────────

export interface SquadPhoto {
  id: string;
  squadId: string;
  uid: string;
  displayName: string;
  userPhotoURL: string;
  imageURL: string;
  storagePath: string;
  location: { lat: number; lng: number };
  caption: string;
  createdAt: Timestamp;
}

export async function addSquadPhoto(data: Omit<SquadPhoto, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "squadPhotos"), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export function subscribeToSquadPhotos(
  squadId: string,
  callback: (photos: SquadPhoto[]) => void
): () => void {
  const q = query(
    collection(db, "squadPhotos"),
    where("squadId", "==", squadId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SquadPhoto)));
  }, () => {});
}

// ── Points ─────────────────────────────────────────────────────────────────────

export async function addPoints(uid: string, amount: number): Promise<void> {
  await updateDoc(doc(db, "users", uid), { points: increment(amount) });
}

// ── Photo Challenges ───────────────────────────────────────────────────────────

export interface PhotoChallenge {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  imageURL: string;
  storagePath: string;
  location: { lat: number; lng: number };
  caption: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  totalGuesses: number;
  correctGuesses: number;
}

export interface PhotoChallengeGuess {
  id: string;
  challengeId: string;
  challengerUid: string;
  guesserUid: string;
  guesserName: string;
  pinLocation: { lat: number; lng: number };
  distanceMeters: number;
  isCorrect: boolean;
  pointsAwarded: number;
  createdAt: Timestamp;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createPhotoChallenge(data: {
  uid: string;
  displayName: string;
  photoURL: string;
  imageURL: string;
  storagePath: string;
  location: { lat: number; lng: number };
  caption: string;
}): Promise<string> {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const ref = await addDoc(collection(db, "photoChallenges"), {
    ...data,
    createdAt: Timestamp.now(),
    expiresAt,
    totalGuesses: 0,
    correctGuesses: 0,
  });
  await addPoints(data.uid, 5);
  return ref.id;
}

export function subscribeToPhotoChallenges(
  callback: (challenges: PhotoChallenge[]) => void
): () => void {
  const q = query(
    collection(db, "photoChallenges"),
    where("expiresAt", ">", Timestamp.now()),
    orderBy("expiresAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoChallenge)));
  }, () => {});
}

export function subscribeToPhotoChallengesByUser(
  uid: string,
  callback: (challenges: PhotoChallenge[]) => void
): () => void {
  const q = query(collection(db, "photoChallenges"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoChallenge)));
  }, () => {});
}

export async function submitPhotoGuess(
  challengeId: string,
  guesserUid: string,
  guesserName: string,
  pinLocation: { lat: number; lng: number }
): Promise<{ isCorrect: boolean; distanceMeters: number; alreadyGuessed: boolean }> {
  const existingQ = query(
    collection(db, "photoChallengeGuesses"),
    where("challengeId", "==", challengeId),
    where("guesserUid", "==", guesserUid)
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) {
    const d = existingSnap.docs[0].data();
    return { isCorrect: d.isCorrect, distanceMeters: d.distanceMeters, alreadyGuessed: true };
  }

  const challengeSnap = await getDoc(doc(db, "photoChallenges", challengeId));
  if (!challengeSnap.exists()) throw new Error("Challenge not found");
  const challenge = challengeSnap.data() as PhotoChallenge;

  const dist = haversineMeters(challenge.location.lat, challenge.location.lng, pinLocation.lat, pinLocation.lng);
  const isCorrect = dist <= 5;

  await addDoc(collection(db, "photoChallengeGuesses"), {
    challengeId,
    challengerUid: challenge.uid,
    guesserUid,
    guesserName,
    pinLocation,
    distanceMeters: Math.round(dist),
    isCorrect,
    pointsAwarded: isCorrect ? 10 : 0,
    createdAt: Timestamp.now(),
  });

  await updateDoc(doc(db, "photoChallenges", challengeId), {
    totalGuesses: increment(1),
    ...(isCorrect ? { correctGuesses: increment(1) } : {}),
  });

  if (isCorrect) {
    await addPoints(guesserUid, 10);
    await sendInAppNotification(challenge.uid, {
      title: "📍 Correct Guess!",
      body: `${guesserName} found your photo spot!`,
      type: "challenge_correct",
    });
  }

  return { isCorrect, distanceMeters: Math.round(dist), alreadyGuessed: false };
}

export function subscribeToMyChallengeGuesses(
  uid: string,
  callback: (guesses: PhotoChallengeGuess[]) => void
): () => void {
  const q = query(collection(db, "photoChallengeGuesses"), where("guesserUid", "==", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoChallengeGuess)));
  }, () => {});
}

// ── In-App Notifications ───────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  toUid: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  url?: string;
  createdAt: Timestamp;
}

export async function sendInAppNotification(
  toUid: string,
  data: { title: string; body: string; type: string; url?: string }
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    toUid,
    ...data,
    read: false,
    createdAt: Timestamp.now(),
  });
}

export function subscribeToMyNotifications(
  uid: string,
  callback: (notifs: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
  }, () => {});
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const q = query(collection(db, "notifications"), where("toUid", "==", uid), where("read", "==", false));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

// ── Store ──────────────────────────────────────────────────────────────────────

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: "badge" | "frame" | "emoji";
  value: string;
  emoji?: string;
  active: boolean;
  createdAt: Timestamp;
}

export function subscribeToStoreItems(
  callback: (items: StoreItem[]) => void
): () => void {
  const q = query(collection(db, "storeItems"), where("active", "==", true), orderBy("cost", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreItem)));
  }, () => {});
}

export function subscribeToAllStoreItems(
  callback: (items: StoreItem[]) => void
): () => void {
  const q = query(collection(db, "storeItems"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreItem)));
  }, () => {});
}

export async function createStoreItem(
  data: Omit<StoreItem, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "storeItems"), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export async function updateStoreItem(id: string, data: Partial<StoreItem>): Promise<void> {
  await updateDoc(doc(db, "storeItems", id), data);
}

export async function purchaseStoreItem(
  uid: string,
  item: StoreItem
): Promise<{ success: boolean; reason?: string }> {
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return { success: false, reason: "User not found" };
  const userData = userSnap.data() as UserProfile;
  const currentPoints = userData.points ?? 0;
  const ownedItems = userData.ownedItems ?? [];

  if (ownedItems.includes(item.id)) return { success: false, reason: "Already owned" };
  if (currentPoints < item.cost) return { success: false, reason: "Not enough points" };

  await updateDoc(doc(db, "users", uid), {
    points: increment(-item.cost),
    ownedItems: arrayUnion(item.id),
    ...(item.type === "badge" ? { badges: arrayUnion(item.value) } : {}),
  });

  return { success: true };
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

export function subscribeToLeaderboard(
  callback: (users: UserProfile[]) => void
): () => void {
  return onSnapshot(collection(db, "users"), (snap) => {
    const users = snap.docs
      .map((d) => d.data() as UserProfile)
      .filter((u) => !u.banned)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 30);
    callback(users);
  }, () => {});
}
