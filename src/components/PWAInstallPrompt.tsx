"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as { standalone?: boolean }).standalone;
  return { isIOS, isAndroid, isChrome, isSafari, isStandalone };
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform> | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;

    const p = detectPlatform();
    setPlatform(p);

    if (p.isStandalone) return; // already installed

    // Listen for Chrome/Android native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show the banner for iOS Safari or any browser that hasn't fired
    // beforeinstallprompt yet (including HTTP sites, Firefox, Samsung browser, etc.)
    const timer = setTimeout(() => setVisible(true), 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  // Also show when native event fires
  useEffect(() => {
    if (installEvent) setVisible(true);
  }, [installEvent]);

  function dismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  }

  async function handleInstall() {
    if (installEvent) {
      setInstalling(true);
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      setInstalling(false);
      if (outcome === "accepted") { setVisible(false); return; }
      setInstallEvent(null);
    } else {
      setShowGuide(true);
    }
  }

  if (!visible || !platform) return null;

  const { isIOS, isSafari, isChrome, isAndroid } = platform;

  return (
    <div
      className="fixed bottom-16 left-3 right-3 z-40 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80"
      role="complementary"
      aria-label="Install app prompt"
    >
      <div className="bg-surface-container-highest border-4 border-on-surface rounded-2xl shadow-[4px_4px_0px_0px_#1b1b1e] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-96x96.png"
              alt="IT'S STATIC logo"
              width={48}
              height={48}
              className="rounded-xl border-2 border-on-surface"
            />
            <div>
              <div className="font-display-lg text-sm text-on-surface uppercase leading-tight">
                IT&apos;S STATIC
              </div>
              <div className="font-label-sm text-on-surface-variant text-xs">
                Install for full experience
              </div>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 ml-2 flex-shrink-0"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 flex flex-col gap-3">
          {!showGuide ? (
            <>
              <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                Works offline · Loads faster · No app store needed
              </p>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="tactile-button bg-primary text-on-primary px-4 py-2 font-display-lg text-sm rounded-xl uppercase w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">install_mobile</span>
                {installing ? "Installing…" : installEvent ? "Install App" : "How to Install"}
              </button>
            </>
          ) : (
            <>
              {/* iOS Safari */}
              {isIOS && isSafari && (
                <ol className="font-body-md text-xs text-on-surface space-y-2 list-decimal list-inside">
                  <li>
                    Tap the{" "}
                    <strong>
                      Share{" "}
                      <span className="material-symbols-outlined text-xs align-middle">
                        ios_share
                      </span>
                    </strong>{" "}
                    button at the bottom of Safari
                  </li>
                  <li>
                    Scroll and tap <strong>&quot;Add to Home Screen&quot;</strong>
                  </li>
                  <li>
                    Tap <strong>&quot;Add&quot;</strong>
                  </li>
                </ol>
              )}

              {/* Android Chrome / other */}
              {(isAndroid || isChrome) && !isIOS && (
                <ol className="font-body-md text-xs text-on-surface space-y-2 list-decimal list-inside">
                  <li>
                    Tap the <strong>⋮ menu</strong> in Chrome
                  </li>
                  <li>
                    Tap <strong>&quot;Add to Home Screen&quot;</strong> or{" "}
                    <strong>&quot;Install App&quot;</strong>
                  </li>
                  <li>
                    Tap <strong>&quot;Install&quot;</strong>
                  </li>
                </ol>
              )}

              {/* Generic fallback */}
              {!isIOS && !isAndroid && !isChrome && (
                <ol className="font-body-md text-xs text-on-surface space-y-2 list-decimal list-inside">
                  <li>Open your browser&apos;s menu</li>
                  <li>
                    Look for <strong>&quot;Install&quot;</strong> or{" "}
                    <strong>&quot;Add to Home Screen&quot;</strong>
                  </li>
                  <li>Confirm the install</li>
                </ol>
              )}

              <button
                onClick={() => setShowGuide(false)}
                className="font-label-sm text-on-surface-variant text-xs underline text-left"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
