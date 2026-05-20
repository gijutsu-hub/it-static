"use server";

import webpush, { PushSubscription as WebPushSubscription } from "web-push";

webpush.setVapidDetails(
  "mailto:snath2973@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// In production, store subscriptions in a database.
// This in-memory store is cleared on server restart.
const subscriptions = new Map<string, WebPushSubscription>();

export async function subscribeUser(sub: WebPushSubscription) {
  subscriptions.set(sub.endpoint, sub);
  return { success: true };
}

export async function unsubscribeUser(endpoint: string) {
  subscriptions.delete(endpoint);
  return { success: true };
}

export async function sendNotification(
  message: string,
  options: { title?: string; url?: string } = {}
) {
  if (subscriptions.size === 0) {
    return { success: false, error: "No active subscriptions" };
  }

  const payload = JSON.stringify({
    title: options.title ?? "IT'S STATIC",
    body: message,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    url: options.url ?? "/",
  });

  const results = await Promise.allSettled(
    Array.from(subscriptions.values()).map((sub) =>
      webpush.sendNotification(sub, payload)
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error("Failed to send some notifications:", failed);
  }

  return { success: true, sent: results.length - failed.length };
}
