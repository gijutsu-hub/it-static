import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Quicksand } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import PushNotificationManager from "@/components/PushNotificationManager";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import "./globals.css";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://itstatic.app";

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
  minimumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "IT'S STATIC — THE URBAN RESISTANCE",
    template: "%s | IT'S STATIC",
  },
  description:
    "Transmitting vibes. Recalibrating souls. Digitising the asphalt frequency since before you were aware of it. Join the urban resistance collective.",
  keywords: [
    "urban culture",
    "street art",
    "underground collective",
    "urban resistance",
    "city culture",
    "alternative community",
    "street fashion",
    "urban creative",
    "digital collective",
    "it's static",
    "itstatic",
  ],
  authors: [{ name: "IT'S STATIC", url: BASE_URL }],
  creator: "IT'S STATIC",
  publisher: "IT'S STATIC",
  category: "Entertainment",
  manifest: "/manifest.json",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "IT'S STATIC",
    title: "IT'S STATIC — THE URBAN RESISTANCE",
    description:
      "Transmitting vibes. Recalibrating souls. Digitising the asphalt frequency since before you were aware of it.",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "IT'S STATIC Logo",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "IT'S STATIC — THE URBAN RESISTANCE",
    description:
      "Transmitting vibes. Recalibrating souls. Digitising the asphalt frequency.",
    images: ["/icons/icon-512x512.png"],
    creator: "@itstatic",
    site: "@itstatic",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IT'S STATIC",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/icon-512x512.png", color: "#ff85c1" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "IT'S STATIC",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icons/icon-512x512.png`,
        width: 512,
        height: 512,
      },
      description:
        "Urban resistance collective. Transmitting vibes. Recalibrating souls. Digitising the asphalt frequency.",
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "IT'S STATIC",
      description:
        "THE URBAN RESISTANCE — Transmitting vibes. Recalibrating souls.",
      publisher: { "@id": `${BASE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/discover?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-pop-dots text-on-surface font-body-lg min-h-screen flex flex-col">
        <SessionProvider>
          {children}
          <PushNotificationManager />
          <PWAInstallPrompt />
        </SessionProvider>
      </body>
    </html>
  );
}
