"use client";

import { useState, useEffect } from "react";
import { subscribeUser, unsubscribeUser } from "@/app/actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationManager() {
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then(setSubscription)
      );
    }
  }, []);

  async function subscribe() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      setSubscription(sub);
      await subscribeUser(JSON.parse(JSON.stringify(sub)));
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    setPending(true);
    try {
      await subscription.unsubscribe();
      await unsubscribeUser(subscription.endpoint);
      setSubscription(null);
    } finally {
      setPending(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      onClick={subscription ? unsubscribe : subscribe}
      disabled={pending}
      className="fixed bottom-4 right-4 z-50 bg-primary text-on-primary font-label-lg px-4 py-2 rounded-xl border-2 border-on-background shadow-[3px_3px_0px_0px_#1b1b1e] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1b1b1e] transition-all disabled:opacity-50"
      title={subscription ? "Disable notifications" : "Enable push notifications"}
    >
      <span className="material-symbols-outlined align-middle mr-1 text-sm">
        {subscription ? "notifications_off" : "notifications"}
      </span>
      {subscription ? "Notifications on" : "Get notified"}
    </button>
  );
}
