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
  type: "text" | "system";
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
  rawText: string
): Promise<void> {
  const text = sanitizeText(rawText);
  if (!text) return;
  await addDoc(collection(db, "squads", squadId, "messages"), {
    senderUid: sender.uid,
    senderName: sender.name,
    senderPhotoURL: sender.photoURL,
    text,
    sentAt: Timestamp.now(),
    type: "text",
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
