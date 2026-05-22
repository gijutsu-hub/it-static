import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firestore";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
  sendTrialEndingEmail,
} from "@/lib/email";

function verifySignature(body: string, sig: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function getUserProfile(email: string) {
  const snap = await getDoc(doc(db, "users", email));
  return snap.exists() ? (snap.data() as { displayName?: string }) : null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  if (secret && !verifySignature(body, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.event as string;
  const subscriptionEntity = (event.payload as Record<string, unknown>)?.subscription as Record<string, unknown> | undefined;
  const subEntity = subscriptionEntity?.entity as Record<string, unknown> | undefined;
  const notes = subEntity?.notes as Record<string, string> | undefined;
  const email = notes?.email;

  if (!email) return NextResponse.json({ ok: true });

  const userRef = doc(db, "users", email);

  switch (eventName) {
    case "subscription.authenticated": {
      // Mandate authorized — trial begins
      const trialEndsAt = Timestamp.fromMillis(
        ((subEntity?.start_at as number) ?? 0) * 1000 || Date.now() + 7 * 86400000
      );
      await updateDoc(userRef, {
        subscriptionStatus: "trial",
        subscriptionActivatedAt: Timestamp.now(),
        trialEndsAt,
      });
      break;
    }

    case "subscription.activated": {
      await updateDoc(userRef, {
        subscriptionStatus: "active",
        subscriptionActivatedAt: Timestamp.now(),
      });
      break;
    }

    case "subscription.charged": {
      const paymentEntity = (event.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined;
      const amountPaise = (paymentEntity?.entity as Record<string, unknown>)?.amount as number ?? 6900;
      await updateDoc(userRef, {
        subscriptionStatus: "active",
        lastChargedAt: Timestamp.now(),
      });
      const profile = await getUserProfile(email);
      sendPaymentSuccessEmail(email, profile?.displayName ?? "User", Math.round(amountPaise / 100)).catch(() => {});
      break;
    }

    case "subscription.payment_failed": {
      await updateDoc(userRef, { subscriptionStatus: "past_due" });
      const profile = await getUserProfile(email);
      sendPaymentFailedEmail(email, profile?.displayName ?? "User").catch(() => {});
      break;
    }

    case "subscription.pending": {
      // Trial ending soon — Razorpay fires this ~2 days before charge
      const profile = await getUserProfile(email);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().subscriptionStatus === "trial") {
        const trialEndsAt: Timestamp | undefined = snap.data().trialEndsAt;
        const daysLeft = trialEndsAt
          ? Math.max(1, Math.ceil((trialEndsAt.toMillis() - Date.now()) / 86400000))
          : 2;
        sendTrialEndingEmail(email, profile?.displayName ?? "User", daysLeft).catch(() => {});
      }
      break;
    }

    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.completed": {
      await updateDoc(userRef, { subscriptionStatus: "cancelled" });
      const profile = await getUserProfile(email);
      sendSubscriptionCancelledEmail(email, profile?.displayName ?? "User").catch(() => {});
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
