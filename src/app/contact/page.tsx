import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import InstagramFeed from "./InstagramFeed";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Reach IT'S STATIC on Instagram @itstatic.space — DMs open, vibes accepted.",
};

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square bg-surface-container-high sticker-border rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col flex-1">

        {/* ── Hero ── */}
        <section className="py-10 md:py-16 px-4 md:px-16 border-b-8 border-on-surface">
          <div className="max-w-7xl mx-auto">
            <div className="inline-block bg-primary-container text-on-primary-container px-5 py-2 sticker-border sticker-shadow transform -rotate-1 font-display-lg text-lg md:text-2xl uppercase tracking-tighter mb-6 mobile-no-rotate">
              TRANSMISSION 003: SIGNAL RECEIVED?
            </div>
            <h1 className="font-display-lg text-5xl md:text-7xl text-on-surface leading-[0.9] tracking-tighter uppercase mb-6">
              REACH OUT
              <br />
              <span className="bg-tertiary-fixed text-on-tertiary-fixed px-3 sticker-border sticker-shadow inline-block transform rotate-1">
                TO THE STATIC
              </span>
            </h1>
            <p className="font-body-md text-on-surface-variant text-base md:text-lg max-w-2xl font-bold uppercase tracking-wide">
              We exist in the DMs. Slide in on Instagram — it&apos;s the fastest
              way to reach a real human from IT&apos;S STATIC.
            </p>
          </div>
        </section>

        {/* ── Main content ── */}
        <div className="max-w-7xl mx-auto w-full px-4 md:px-16 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Left: contact cards */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Primary CTA: Instagram */}
            <div className="bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] sticker-border sticker-shadow rounded-2xl p-1">
              <div className="bg-white rounded-[calc(1rem-4px)] p-6 md:p-8 h-full">
                <div className="font-display-lg text-2xl md:text-3xl uppercase text-on-surface mb-1">
                  INSTAGRAM
                </div>
                <div className="font-body-md text-on-surface-variant text-sm mb-4 uppercase font-bold tracking-wide">
                  Official Channel · Fastest Response
                </div>
                <a
                  href="https://instagram.com/itstatic.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tactile-button bg-gradient-to-r from-[#ee2a7b] to-[#6228d7] text-white px-6 py-4 font-display-lg text-xl rounded-xl uppercase flex items-center gap-3 mb-4"
                >
                  <span className="material-symbols-outlined text-2xl">photo_camera</span>
                  @itstatic.space
                </a>
                <p className="font-body-md text-on-surface text-sm leading-relaxed">
                  Send us a DM for support queries, collab pitches, feature
                  requests, or just to say you&apos;re ecstatic. We monitor the
                  account daily.
                </p>
              </div>
            </div>

            {/* Response time badge */}
            <div className="bg-tertiary-fixed sticker-border sticker-shadow rounded-2xl p-5 transform rotate-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-2xl text-on-tertiary-fixed">schedule</span>
                <span className="font-display-lg text-lg uppercase text-on-tertiary-fixed">RESPONSE TIME</span>
              </div>
              <p className="font-body-md text-on-tertiary-fixed text-sm">
                Typically within <strong>24–48 hours</strong>. Complex issues
                may take up to 5 business days. We are a small crew, so please
                be patient — we will get back to you.
              </p>
            </div>

            {/* What to include */}
            <div className="bg-secondary-container sticker-border sticker-shadow rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-2xl text-on-secondary-container">checklist</span>
                <span className="font-display-lg text-lg uppercase text-on-secondary-container">INCLUDE IN YOUR DM</span>
              </div>
              <ul className="font-body-md text-on-secondary-container text-sm space-y-2">
                {[
                  "Your registered email address",
                  "Type of issue (billing, account, bug, other)",
                  "Screenshots if relevant",
                  "Transaction ID for payment issues",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base mt-0.5 shrink-0">arrow_right</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Also useful */}
            <div className="bg-surface-container sticker-border rounded-2xl p-5">
              <div className="font-display-lg text-base uppercase text-on-surface mb-3">
                ALSO USEFUL
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/about#terms"
                  className="flex items-center gap-2 text-sm font-body-md text-primary hover:text-on-primary-container transition-colors underline decoration-4 underline-offset-4"
                >
                  <span className="material-symbols-outlined text-base">article</span>
                  Terms &amp; Conditions
                </Link>
                <Link
                  href="/about#refund"
                  className="flex items-center gap-2 text-sm font-body-md text-primary hover:text-on-primary-container transition-colors underline decoration-4 underline-offset-4"
                >
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  Refund Policy
                </Link>
                <Link
                  href="/about#privacy"
                  className="flex items-center gap-2 text-sm font-body-md text-primary hover:text-on-primary-container transition-colors underline decoration-4 underline-offset-4"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Instagram feed */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div>
              <div className="inline-block bg-on-surface text-secondary-container px-4 py-2 sticker-border font-display-lg text-xl uppercase tracking-tight mb-2 transform -rotate-1">
                LATEST FROM THE STATIC
              </div>
              <p className="font-body-md text-on-surface-variant text-sm uppercase font-bold tracking-wide">
                Follow{" "}
                <a
                  href="https://instagram.com/itstatic.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline decoration-4 underline-offset-2"
                >
                  @itstatic.space
                </a>{" "}
                for drops, events, and urban static moments.
              </p>
            </div>

            <div className="bg-white sticker-border sticker-shadow rounded-2xl p-4 md:p-6">
              {/* Profile header */}
              <a
                href="https://instagram.com/itstatic.space"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 mb-6 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-0.5 sticker-border shrink-0">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo.svg"
                      alt="IT'S STATIC"
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                </div>
                <div>
                  <div className="font-display-lg text-lg uppercase text-on-surface group-hover:text-primary transition-colors">
                    @itstatic.space
                  </div>
                  <div className="font-body-md text-on-surface-variant text-xs uppercase font-bold">
                    IT&apos;S STATIC · Urban Resistance
                  </div>
                </div>
                <span className="material-symbols-outlined ml-auto text-on-surface-variant group-hover:text-primary transition-colors">
                  open_in_new
                </span>
              </a>

              {/* Feed grid */}
              <Suspense fallback={<FeedSkeleton />}>
                <InstagramFeed />
              </Suspense>

              {/* View all */}
              <div className="mt-6 text-center">
                <a
                  href="https://instagram.com/itstatic.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tactile-button bg-gradient-to-r from-[#ee2a7b] to-[#6228d7] text-white px-8 py-3 font-display-lg text-base rounded-xl uppercase inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                  VIEW FULL FEED
                </a>
              </div>
            </div>

            {/* Community note */}
            <div className="bg-primary-fixed sticker-border sticker-shadow rounded-2xl p-5 transform -rotate-1 mobile-no-rotate">
              <div className="font-display-lg text-xl uppercase text-on-primary-fixed mb-2">
                STAY ECSTATIC.
              </div>
              <p className="font-body-md text-on-primary-fixed text-sm leading-relaxed">
                IT&apos;S STATIC is built by a small team of people who care about
                real cities, real people, and real moments. We read every DM.
                Your feedback shapes the platform.
              </p>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
