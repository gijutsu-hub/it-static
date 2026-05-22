import type { NextConfig } from "next";
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/app-build-manifest\.json$/],
});

// Explicit CSP so Google images / Maps / Firebase all load
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://accounts.google.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // *.googleusercontent.com  = Google user avatars (lh3, lh4 …)
  // *.gstatic.com            = Google static assets (fonts, map graphics, icons)
  // *.googleapis.com         = ALL Google API CDN: map tiles (khms0-3), Static Maps, Firebase Storage …
  // *.ggpht.com              = Google-hosted photos / Places imagery CDN
  // *.firebasestorage.app    = new Firebase Storage bucket URL format
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://*.googleapis.com https://*.ggpht.com https://*.firebasestorage.app",
  // *.googleapis.com covers Firestore, Storage REST, Auth (identitytoolkit, securetoken), Maps, FCM
  // *.firebasestorage.app covers new Firebase Storage SDK URL format (bucket: itstatic-space.firebasestorage.app)
  // *.firebaseapp.com covers Firebase Auth domain token requests
  "connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://*.cloudfunctions.net https://*.firebasestorage.app https://*.firebaseapp.com https://api.razorpay.com https://lumberjack.razorpay.com",
  // *.firebaseapp.com handles OAuth redirect frames; docs.google.com for embedded Google Forms
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://docs.google.com https://api.razorpay.com https://*.razorpay.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["ec2-18-143-145-226.ap-southeast-1.compute.amazonaws.com"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Explicitly permit geolocation from the top-level page
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default pwaConfig(nextConfig);
