import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import webpush from "web-push";
import { collection, getDocs } from "firebase/firestore";
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

  const { title, body, url, excludeUid } = await req.json() as {
    title?: string;
    body?: string;
    url?: string;
    excludeUid?: string;
  };

  const snap = await getDocs(collection(db, "pushSubscriptions"));

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    snap.docs
      .filter((d) => d.id !== excludeUid)
      .map(async (d) => {
        const sub = d.data().subscription as PushSubscriptionJSON;
        try {
          await webpush.sendNotification(
            sub as Parameters<typeof webpush.sendNotification>[0],
            JSON.stringify({
              title: title ?? "IT'S STATIC",
              body: body ?? "Something's happening near you",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-96x96.png",
              url: url ?? "/discover",
            })
          );
          sent++;
        } catch {
          failed++;
        }
      })
  );

  return NextResponse.json({ sent, failed });
}
