import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthClient from "./AuthClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://itstatic.app";

export const metadata: Metadata = {
  title: "Join the Static — Enlist Now",
  description:
    "Sign in or create your account to join IT'S STATIC — the urban resistance collective transmitting vibes and recalibrating souls.",
  alternates: { canonical: `${BASE_URL}/auth` },
  openGraph: {
    title: "Join the Static — IT'S STATIC",
    description: "Enlist now. No bots allowed.",
    url: `${BASE_URL}/auth`,
  },
  robots: { index: false, follow: false },
};

export default async function AuthPage() {
  const session = await auth();
  if (session?.user) redirect("/discover");

  return (
    <Suspense>
      <AuthClient />
    </Suspense>
  );
}
