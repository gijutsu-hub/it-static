import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "snath2973@gmail.com";

function maskKey(val: string | undefined): string {
  if (!val) return "";
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const smtp = {
    host: process.env.SMTP_HOST ?? "",
    port: process.env.SMTP_PORT ?? "",
    secure: process.env.SMTP_SECURE ?? "",
    user: process.env.SMTP_USER ?? "",
    hasPass: Boolean(process.env.SMTP_PASS),
    from: process.env.SMTP_FROM ?? "",
    configured: Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ),
  };

  const razorpay = {
    keyId: maskKey(process.env.RAZORPAY_KEY_ID),
    hasSecret: Boolean(process.env.RAZORPAY_KEY_SECRET),
    configured: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ),
  };

  const google = {
    mapsKey: maskKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY),
    clientId: maskKey(process.env.GOOGLE_CLIENT_ID),
    hasSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    configured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
  };

  const firebase = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    configured: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ),
  };

  return NextResponse.json({ smtp, razorpay, google, firebase });
}
