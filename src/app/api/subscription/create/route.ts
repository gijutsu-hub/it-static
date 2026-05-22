import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRazorpay } from "@/lib/razorpay";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const name = session.user.name ?? "User";

  if (!process.env.RAZORPAY_PLAN_ID) {
    return NextResponse.json({ error: "Subscription not configured" }, { status: 503 });
  }

  try {
    const razorpay = getRazorpay();

    // Start billing 7 days from now — giving a free trial period
    const startAt = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);

    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      total_count: 120, // 10 years max
      quantity: 1,
      customer_notify: 1,
      start_at: startAt,
      notes: { email, name },
    });

    const trialEndsAt = Timestamp.fromDate(new Date(startAt * 1000));

    await updateDoc(doc(db, "users", email), {
      subscriptionId: subscription.id,
      subscriptionStatus: "pending",
      trialStartedAt: Timestamp.now(),
      trialEndsAt,
    });

    sendWelcomeEmail(email, name, new Date(startAt * 1000)).catch(() => {});

    return NextResponse.json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      trialEndsAt: trialEndsAt.toMillis(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create subscription";
    console.error("Subscription create error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
