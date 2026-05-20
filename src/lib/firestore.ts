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
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { firebaseApp, storage } from "./firebase";

export const db = getFirestore(firebaseApp);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Squad {
  id: string;
  name: string;
  theme: string;
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
  callback: (submissions: KYCSubmission[]) => void
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
  }, () => {});
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
