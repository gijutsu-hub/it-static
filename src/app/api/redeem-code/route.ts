import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  doc,
  increment,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const raw: string = body?.code ?? "";
  const code = raw.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const email = session.user.email;

  try {
    const q = query(
      collection(db, "entryCodeDrops"),
      where("code", "==", code),
      where("active", "==", true)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ error: "Invalid code. Check and try again." }, { status: 400 });
    }

    const dropDoc = snap.docs[0];
    const data = dropDoc.data();

    if (data.expiresAt && (data.expiresAt as Timestamp).toMillis() < Date.now()) {
      return NextResponse.json({ error: "Code has expired." }, { status: 400 });
    }

    if (data.maxUses > 0 && data.usedCount >= data.maxUses) {
      return NextResponse.json({ error: "This code has already been fully redeemed." }, { status: 400 });
    }

    if ((data.redeemedBy as string[]).includes(email)) {
      return NextResponse.json({ error: "You already redeemed an entry code." }, { status: 400 });
    }

    await runTransaction(db, async (tx) => {
      const dropRef = doc(db, "entryCodeDrops", dropDoc.id);
      const fresh = await tx.get(dropRef);
      if (!fresh.exists()) throw new Error("Drop removed");
      const fd = fresh.data();
      if (fd.maxUses > 0 && fd.usedCount >= fd.maxUses) throw new Error("Exhausted");
      if ((fd.redeemedBy as string[]).includes(email)) throw new Error("Already redeemed");

      tx.update(dropRef, {
        usedCount: increment(1),
        redeemedBy: arrayUnion(email),
      });

      const userRef = doc(db, "users", email);
      tx.set(
        userRef,
        {
          email,
          entryCodeRedeemed: true,
          displayName: session.user!.name ?? "",
          photoURL: session.user!.image ?? "",
          firstSeen: Timestamp.now(),
          lastSeen: Timestamp.now(),
          banned: false,
          points: 0,
          ownedItems: [],
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "Already redeemed") {
      return NextResponse.json({ error: "You already redeemed an entry code." }, { status: 400 });
    }
    if (msg === "Exhausted") {
      return NextResponse.json({ error: "This code has run out of uses." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not redeem code. Try again." }, { status: 500 });
  }
}
