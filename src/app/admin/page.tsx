import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

export const metadata: Metadata = { title: "Admin — IT'S STATIC" };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "snath2973@gmail.com";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.email !== ADMIN_EMAIL) redirect("/discover");

  return <AdminShell adminEmail={ADMIN_EMAIL} />;
}
