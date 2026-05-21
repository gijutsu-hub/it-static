import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subscription } = await req.json();
  if (!subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const uid = session.user.email;
  await setDoc(doc(db, "pushSubscriptions", uid), {
    uid,
    subscription,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
