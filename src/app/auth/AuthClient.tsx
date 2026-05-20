"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AuthClient() {
  const [googlePending, setGooglePending] = useState(false);
  const searchParams = useSearchParams();
  const isBanned = searchParams.get("banned") === "1";

  async function handleGoogle() {
    if (isBanned) return;
    setGooglePending(true);
    await signIn("google", { callbackUrl: "/discover" });
  }

  return (
    <>
      <style>{`
        .auth-sticker-bg {
          background-color: #fbf8fc;
          background-image: radial-gradient(circle at 2px 2px, #e4e1e6 1px, transparent 0);
          background-size: 24px 24px;
        }
        .auth-brutalist-card {
          border: 3px solid #1b1b1e;
          box-shadow: 8px 8px 0px 0px #1b1b1e;
        }
        .auth-brutalist-btn {
          border: 3px solid #1b1b1e;
          box-shadow: 4px 4px 0px 0px #1b1b1e;
          transition: all 0.1s ease;
        }
        .auth-brutalist-btn:hover:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: 2px 2px 0px 0px #1b1b1e;
        }
        .auth-brutalist-btn:active:not(:disabled) {
          transform: translate(4px, 4px);
          box-shadow: 0px 0px 0px 0px #1b1b1e;
        }
        .auth-float { animation: auth-float 6s ease-in-out infinite; }
        @keyframes auth-float {
          0%   { transform: translateY(0px)   rotate(-3deg); }
          50%  { transform: translateY(-20px) rotate(3deg); }
          100% { transform: translateY(0px)   rotate(-3deg); }
        }
      `}</style>

      <div className="fixed inset-0 overflow-auto auth-sticker-bg flex flex-col items-center justify-center z-10">

        {/* Floating decorative stickers */}
        <div className="fixed top-10 left-10 auth-float opacity-20 pointer-events-none hidden md:block">
          <div className="bg-primary-container p-4 rounded-xl border-4 border-on-background shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-12deg]">
            <span className="material-symbols-outlined text-4xl text-on-background">bolt</span>
          </div>
        </div>
        <div className="fixed bottom-20 right-20 auth-float opacity-20 pointer-events-none hidden md:block" style={{ animationDelay: "-2s" }}>
          <div className="bg-tertiary-fixed p-6 rounded-full border-4 border-on-background shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[15deg]">
            <span className="material-symbols-outlined text-5xl text-on-background">favorite</span>
          </div>
        </div>
        <div className="fixed top-1/4 right-10 auth-float opacity-20 pointer-events-none hidden md:block" style={{ animationDelay: "-4s" }}>
          <div className="bg-secondary-container p-3 rounded-lg border-4 border-on-background shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[8deg]">
            <span className="material-symbols-outlined text-3xl text-on-background">star</span>
          </div>
        </div>

        <main className="w-full max-w-[480px] px-4 flex flex-col items-center z-10 py-12">

          {/* Logo */}
          <div className="mb-12 text-center">
            <h1 className="font-display-lg text-[64px] md:text-[56px] tracking-tighter uppercase text-primary leading-none mb-2">
              IT&apos;S STATIC
            </h1>
            <div className="bg-tertiary-fixed inline-block px-4 py-1 border-2 border-on-background rotate-[-2deg] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-label-lg text-on-tertiary-fixed uppercase tracking-widest text-sm">
                Join the Ecstatic Pop
              </span>
            </div>
          </div>

          {/* Card */}
          <div className="w-full bg-surface auth-brutalist-card p-6 md:p-12 flex flex-col gap-6">
            {isBanned ? (
              /* ── BANNED STATE ── */
              <>
                <header className="text-center">
                  <div
                    className="bg-error-container border-4 border-error p-5 mb-2"
                    style={{ boxShadow: "4px 4px 0 #ba1a1a" }}
                  >
                    <span className="material-symbols-outlined text-error block mb-2" style={{ fontSize: 48 }}>
                      block
                    </span>
                    <h2 className="font-headline-md text-xl text-error mb-2">Account Suspended</h2>
                    <p className="font-body-md text-sm text-on-error-container leading-relaxed">
                      Your account has been banned from RESIST_NET by a network admin.
                      If you believe this is a mistake, contact support.
                    </p>
                  </div>
                </header>
                <p className="font-label-sm text-xs text-center text-on-surface-variant uppercase tracking-widest opacity-60">
                  Access revoked · Signal terminated
                </p>
              </>
            ) : (
              /* ── NORMAL LOGIN STATE ── */
              <>
                <header className="text-center">
                  <h2 className="font-headline-md text-2xl text-on-background mb-2">Welcome back!</h2>
                  <p className="font-body-md text-on-surface-variant">Ready for the next protocol?</p>
                </header>

                <button
                  onClick={handleGoogle}
                  disabled={googlePending}
                  className="auth-brutalist-btn w-full bg-white py-4 px-6 flex items-center justify-center gap-4 rounded-xl disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="font-label-lg text-lg text-on-background">
                    {googlePending ? "Redirecting…" : "Continue with Google"}
                  </span>
                </button>
              </>
            )}
          </div>

          <footer className="mt-12 text-center flex flex-col gap-4">
            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="font-label-sm text-on-surface-variant uppercase hover:text-primary transition-colors text-xs">Privacy</a>
              <a href="#" className="font-label-sm text-on-surface-variant uppercase hover:text-primary transition-colors text-xs">Terms</a>
              <a href="#" className="font-label-sm text-on-surface-variant uppercase hover:text-primary transition-colors text-xs">Help</a>
            </div>
            <p className="font-label-sm text-on-surface-variant opacity-50 text-xs">© 2024 IT&apos;S STATIC ECOSYSTEM</p>
          </footer>

        </main>

        <SparkleScript />
      </div>
    </>
  );
}

function SparkleScript() {
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (Math.random() > 0.92) {
        const s = document.createElement("div");
        s.style.cssText =
          'position:fixed;pointer-events:none;font-family:"Material Symbols Outlined";font-size:' +
          (Math.random() * 20 + 10) +
          "px;left:" + e.clientX + "px;top:" + e.clientY +
          "px;transform:rotate(" + (Math.random() * 360) +
          "deg);opacity:0.6;color:#ff85c1;z-index:9999";
        s.innerText = (["sparkle", "star", "electric_bolt"] as const)[
          Math.floor(Math.random() * 3)
        ];
        document.body.appendChild(s);
        const a = s.animate(
          [
            { opacity: 0.6, transform: s.style.transform + " scale(1)" },
            {
              opacity: 0,
              transform:
                s.style.transform +
                " translate(" + (Math.random() * 100 - 50) + "px," +
                (Math.random() * 100 - 50) + "px) scale(0)",
            },
          ],
          { duration: 1000, easing: "ease-out" }
        );
        a.onfinish = () => s.remove();
      }
    }
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);
  return null;
}
