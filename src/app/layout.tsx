import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Quicksand } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import PushNotificationManager from "@/components/PushNotificationManager";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#ff85c1",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "IT'S STATIC — THE URBAN RESISTANCE",
  description:
    "Transmitting vibes. Recalibrating souls. Digitising the asphalt frequency since before you were aware of it.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IT'S STATIC",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${quicksand.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-pop-dots text-on-surface font-body-lg min-h-screen flex flex-col">
        <SessionProvider>
          {children}
          <PushNotificationManager />
        </SessionProvider>
      </body>
    </html>
  );
}
