import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import webpush from "web-push";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firestore";

webpush.setVapidDetails(
  process.env.NEXT_PUBLIC_VAPID_SUBJECT ?? "mailto:admin@itstatic.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUid, title, body, url, icon } = await req.json();
  if (!targetUid) return NextResponse.json({ error: "Missing targetUid" }, { status: 400 });

  const snap = await getDoc(doc(db, "pushSubscriptions", targetUid));
  if (!snap.exists()) return NextResponse.json({ sent: false, reason: "No subscription" });

  const subscription = snap.data().subscription as PushSubscriptionJSON;

  try {
    await webpush.sendNotification(
      subscription as any,
      JSON.stringify({
        title: title ?? "IT'S STATIC",
        body: body ?? "Something's happening near you",
        icon: icon ?? "/icons/icon-192x192.png",
        badge: "/icons/icon-96x96.png",
        url: url ?? "/discover",
      })
    );
    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error("Push send error:", err);
    return NextResponse.json({ sent: false, reason: err.message }, { status: 500 });
  }
}
