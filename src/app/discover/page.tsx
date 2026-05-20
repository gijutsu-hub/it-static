import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DiscoverClient from "./DiscoverClient";

export const metadata = {
  title: "itstatic.space | Recruit Directory",
};

async function isUserBanned(email: string): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || projectId === "REPLACE_ME") return false;

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(email)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.fields?.banned?.booleanValue === true;
  } catch {
    return false;
  }
}

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const email = session.user.email!;
  const banned = await isUserBanned(email);
  if (banned) redirect("/auth?banned=1");

  return <DiscoverClient session={session} />;
}
