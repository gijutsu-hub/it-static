import type { Metadata } from "next";
import { Suspense } from "react";
import AuthClient from "./AuthClient";

export const metadata: Metadata = {
  title: "IT'S STATIC - Login",
  description: "Join the Ecstatic Pop",
};

export default function AuthPage() {
  return (
    <Suspense>
      <AuthClient />
    </Suspense>
  );
}
